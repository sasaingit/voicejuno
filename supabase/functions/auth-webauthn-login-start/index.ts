// @ts-nocheck
// Supabase Edge Function: auth-webauthn-login-start
// Step 5 — Login start endpoint per spec
// Route: POST /auth/webauthn/login/start

// Deno runtime (Supabase Edge Functions)
// deno-lint-ignore-file no-explicit-any
// eslint-disable-next-line
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

type Json = Record<string, any>;

// Utility: base64url encode ArrayBuffer
function base64url(bytes: Uint8Array): string {
  const binString = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binString).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

// Utility: generate secure random bytes
function randomBytes(len = 32): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}

// CORS headers helper
function cors(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

// Read required env vars (set as Edge Function secrets in Supabase)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WEBAUTHN_RP_ID = Deno.env.get('WEBAUTHN_RP_ID');
const WEBAUTHN_ORIGIN = Deno.env.get('WEBAUTHN_ORIGIN');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBAUTHN_RP_ID || !WEBAUTHN_ORIGIN) {
  console.error('Missing required environment variables for WebAuthn login start');
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Persist challenge in DB and return its id
async function storeChallenge(challenge: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const payload: Record<string, any> = {
    challenge,
    type: 'login',
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from('webauthn_challenges')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`DB insert failed: ${error.message}`);
  }
  return data.id as string;
}

function jsonResponse(body: Json, init?: ResponseInit & { origin?: string | null }) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json; charset=utf-8',
    ...cors(init?.origin ?? null),
  };
  const { origin, headers: _, ...rest } = (init as any) || {};
  return new Response(JSON.stringify(body), { ...rest, headers });
}

function errorResponse(status: number, message: string, origin: string | null) {
  return jsonResponse({ error: { message } }, { status, origin });
}

export default async function handler(req: Request): Promise<Response> {
  const originHeader = req.headers.get('Origin');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(originHeader) });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method Not Allowed', originHeader);
  }

  // Enforce allowed origin
  if (!originHeader || originHeader !== WEBAUTHN_ORIGIN) {
    return errorResponse(403, 'Forbidden: invalid origin', originHeader);
  }

  // Validate env again at request time
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBAUTHN_RP_ID) {
    return errorResponse(500, 'Server misconfiguration', originHeader);
  }

  try {
    // 1) Generate challenge
    const challenge = base64url(randomBytes(32));

    // 2) Store challenge (type=login, expires in 5 minutes)
    const challengeId = await storeChallenge(challenge);

    // 3) Build PublicKeyCredentialRequestOptionsJSON
    const options: Json = {
      challenge,
      rpId: WEBAUTHN_RP_ID,
      userVerification: 'required',
      timeout: 60_000,
      // Intentionally omit allowCredentials to support discoverable (usernameless) passkeys
    };

    // 4) Respond
    return jsonResponse({ options, challengeId }, { status: 200, origin: originHeader });
  } catch (e) {
    console.error('Login start error:', e);
    return errorResponse(500, 'Internal Server Error', originHeader);
  }
}

// Supabase Edge Functions require a default export
// deno-lint-ignore no-unused-vars
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(handler);
