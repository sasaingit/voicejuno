import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getAllowedOrigins, getEnv } from '../_shared/env.ts';
import {
  assertOrigin,
  assertPost,
  errorResponse,
  getCorsOriginIfAllowed,
  handlePreflight,
  jsonResponse,
} from '../_shared/http.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

function expiresAtIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

function generateSixDigitCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(100_000 + (value % 900_000));
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function handler(req: Request): Promise<Response> {
  const env = getEnv();
  const allowedOrigins = getAllowedOrigins(env);
  const preflight = handlePreflight(req, allowedOrigins);
  if (preflight) return preflight;

  let origin: string;
  try {
    assertPost(req);
    origin = assertOrigin(req, allowedOrigins);
  } catch (e) {
    const corsOrigin = getCorsOriginIfAllowed(req, allowedOrigins);
    return errorResponse(
      e instanceof Error && e.message === 'Method Not Allowed' ? 405 : 401,
      e instanceof Error ? e.message : 'Unauthorized',
      corsOrigin,
    );
  }

  try {
    const supabase = createAdminClient(env);

    // Extract user from Authorization header.
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Missing authorization', origin);
    }
    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return errorResponse(401, 'Invalid token', origin);
    }
    const userId = userData.user.id;

    // Look up caller's account.
    const { data: membership, error: membershipError } = await supabase
      .from('account_users')
      .select('account_id')
      .eq('user_id', userId)
      .single<{ account_id: string }>();

    if (membershipError || !membership) {
      return errorResponse(400, 'No account found', origin);
    }

    // Generate code, hash it, and store.
    const code = generateSixDigitCode();
    const codeHash = await hashCode(code);

    const { error: insertError } = await supabase
      .from('account_link_codes')
      .insert({
        issuer_account_id: membership.account_id,
        issuer_user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAtIso(5),
      });

    if (insertError) {
      console.error('Failed to store link code:', insertError);
      return errorResponse(500, 'Failed to create link code', origin);
    }

    return jsonResponse(200, { code }, origin);
  } catch (e) {
    console.error('Account link start error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
