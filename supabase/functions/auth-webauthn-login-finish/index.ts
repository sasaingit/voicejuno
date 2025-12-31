// @ts-nocheck
// Supabase Edge Function: auth-webauthn-login-finish
// Step 6 — Login finish endpoint per spec
// Route: POST /auth/webauthn/login/finish

// Deno runtime (Supabase Edge Functions)
// deno-lint-ignore-file no-explicit-any
// eslint-disable-next-line
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { verifyAuthenticationResponse } from 'https://esm.sh/@simplewebauthn/server@11.0.0';
import * as jose from 'https://deno.land/x/jose@v5.8.0/index.ts';

type Json = Record<string, any>;

function base64url(bytes: Uint8Array): string {
  const binString = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binString).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function toBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binString);
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
  console.error('Missing required env variables for WebAuthn login finish');
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
  await supabase.from('webauthn_challenges').delete().eq('id', id);
}

async function findCredentialById(credentialIdB64u: string) {
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('*')
    .eq('credential_id', credentialIdB64u)
    .single();
  if (error) throw new Error(`Credential lookup failed: ${error.message}`);
  return data as any;
}

async function updateCredentialUsage(credentialIdB64u: string, newCounter: number) {
  const { error } = await supabase
    .from('webauthn_credentials')
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq('credential_id', credentialIdB64u);
  if (error) throw new Error(`Credential update failed: ${error.message}`);
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
    if (!challengeRow || challengeRow.type !== 'login') {
      return errorResponse(400, 'Invalid challenge', originHeader);
    }
    const now = new Date();
    const expiresAt = new Date(challengeRow.expires_at);
    if (!(expiresAt.getTime() > now.getTime())) {
      return errorResponse(400, 'Challenge expired', originHeader);
    }

    // 2) Lookup stored credential by credentialId
    const credentialIdB64u: string = credential?.id;
    if (!credentialIdB64u || typeof credentialIdB64u !== 'string') {
      return errorResponse(400, 'Invalid credential id', originHeader);
    }
    const stored = await findCredentialById(credentialIdB64u);

    // 3) Verify assertion
    const authenticator = {
      credentialID: fromBase64url(stored.credential_id),
      credentialPublicKey: fromBase64url(stored.public_key),
      counter: stored.counter ?? 0,
      // transports: stored.transports ?? undefined, // optional
    } as any;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: WEBAUTHN_ORIGIN!,
      expectedRPID: WEBAUTHN_RP_ID!,
      authenticator,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return errorResponse(400, 'Assertion verification failed', originHeader);
    }

    const { newCounter } = verification.authenticationInfo as any;

    // 4) Update counter and last_used_at
    await updateCredentialUsage(credentialIdB64u, newCounter ?? (stored.counter ?? 0));

    // Mark challenge consumed (best-effort)
    consumeChallenge(challengeId).catch(() => {});

    // 5) Mint JWT for the owning user
    const userId: string = stored.user_id;
    const access_token = await mintJwt(userId);

    return jsonResponse(
      { access_token, token_type: 'bearer', expires_in: 86400 },
      { status: 200, origin: originHeader },
    );
  } catch (e) {
    console.error('Login finish error:', e);
    return errorResponse(500, 'Internal Server Error', originHeader);
  }
}

// Supabase Edge Functions require a default export
// deno-lint-ignore no-unused-vars
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(handler);
