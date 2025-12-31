// @ts-nocheck
// Supabase Edge Function: auth-webauthn-register-finish
// Step 4 — Register finish endpoint per spec
// Route: POST /auth/webauthn/register/finish

// Deno runtime (Supabase Edge Functions)
// deno-lint-ignore-file no-explicit-any
// eslint-disable-next-line
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { verifyRegistrationResponse } from 'https://esm.sh/@simplewebauthn/server@11.0.0';
import * as jose from 'https://deno.land/x/jose@v5.8.0/index.ts';

type Json = Record<string, any>;

function base64url(bytes: Uint8Array): string {
  const binString = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binString).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64url(b64u: string): Uint8Array {
  const b64 = b64u.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(b64u.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cors(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

const SUPABASE_URL = Deno.env.get('URL');
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
const JWT_SECRET = Deno.env.get('JWT_SECRET');
const WEBAUTHN_RP_ID = Deno.env.get('WEBAUTHN_RP_ID');
const WEBAUTHN_ORIGIN = Deno.env.get('WEBAUTHN_ORIGIN');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET || !WEBAUTHN_RP_ID || !WEBAUTHN_ORIGIN) {
  console.error('Missing required env variables for WebAuthn register finish');
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: Json, init?: ResponseInit & { origin?: string | null }) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json; charset=utf-8',
    ...cors(init?.origin ?? null),
  };
  const { origin, headers: _h, ...rest } = (init as any) || {};
  return new Response(JSON.stringify(body), { ...rest, headers });
}

function errorResponse(status: number, message: string, origin: string | null) {
  return jsonResponse({ error: { message } }, { status, origin });
}

async function loadChallenge(challengeId: string) {
  const { data, error } = await supabase
    .from('webauthn_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();
  if (error) throw new Error(`Challenge load failed: ${error.message}`);
  return data as any;
}

async function consumeChallenge(id: string) {
  // Optional: delete or mark consumed to prevent replay
  await supabase.from('webauthn_challenges').delete().eq('id', id);
}

async function createAuthUser(): Promise<string> {
  // Create a new Supabase Auth user with a synthetic email
  const syntheticId = crypto.randomUUID();
  const email = `${syntheticId}@passkey.local`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { auth_method: 'passkey' },
  });
  if (error || !data?.user?.id) {
    throw new Error(`Create user failed: ${error?.message || 'unknown'}`);
  }
  return data.user.id;
}

async function storeCredential(payload: Record<string, any>) {
  const { error } = await supabase.from('webauthn_credentials').insert(payload);
  if (error) throw new Error(`Credential insert failed: ${error.message}`);
}

async function mintJwt(userId: string): Promise<string> {
  const key = new TextEncoder().encode(JWT_SECRET);
  const jwt = await new jose.SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuer('edge-fn')
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key);
  return jwt;
}

export default async function handler(req: Request): Promise<Response> {
  const originHeader = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(originHeader) });
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method Not Allowed', originHeader);
  }
  if (!originHeader || originHeader !== WEBAUTHN_ORIGIN) {
    return errorResponse(403, 'Forbidden: invalid origin', originHeader);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET || !WEBAUTHN_RP_ID) {
    return errorResponse(500, 'Server misconfiguration', originHeader);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const credential = body?.credential;
    const challengeId = body?.challengeId as string | undefined;
    if (!credential || !challengeId) {
      return errorResponse(400, 'Invalid body: expected { credential, challengeId }', originHeader);
    }

    // 1) Load challenge and validate
    const challengeRow = await loadChallenge(challengeId);
    if (!challengeRow || challengeRow.type !== 'register') {
      return errorResponse(400, 'Invalid challenge', originHeader);
    }
    const now = new Date();
    const expiresAt = new Date(challengeRow.expires_at);
    if (!(expiresAt.getTime() > now.getTime())) {
      return errorResponse(400, 'Challenge expired', originHeader);
    }

    // 2) Verify attestation
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: WEBAUTHN_ORIGIN!,
      expectedRPID: WEBAUTHN_RP_ID!,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return errorResponse(400, 'Attestation verification failed', originHeader);
    }

    const { credentialID, credentialPublicKey, counter, aaguid, attestationObject, fmt } =
      verification.registrationInfo as any;

    // 3) Create Supabase Auth user
    const userId = await createAuthUser();

    // 4) Store credential
    const transports: string[] | undefined = credential?.transports;
    const payload = {
      user_id: userId,
      credential_id: typeof credentialID === 'string' ? credentialID : base64url(new Uint8Array(credentialID)),
      public_key: base64url(new Uint8Array(credentialPublicKey)),
      counter: counter ?? 0,
      transports: transports ?? null,
      aaguid: aaguid ? (typeof aaguid === 'string' ? aaguid : base64url(new Uint8Array(aaguid))) : null,
      attestation_fmt: fmt ?? null,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    } as Record<string, any>;

    await storeCredential(payload);

    // Mark challenge consumed (best-effort)
    consumeChallenge(challengeId).catch(() => {});

    // 5) Mint JWT compatible with Supabase
    const access_token = await mintJwt(userId);

    return jsonResponse(
      { access_token, token_type: 'bearer', expires_in: 86400 },
      { status: 200, origin: originHeader },
    );
  } catch (e) {
    console.error('Register finish error:', e);
    return errorResponse(500, 'Internal Server Error', originHeader);
  }
}

// Supabase Edge Functions require a default export
// deno-lint-ignore no-unused-vars
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(handler);
