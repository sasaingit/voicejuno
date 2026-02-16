import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10.0.1';
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

type WebauthnChallengeInsert = {
  type: 'login';
  challenge: string;
  expires_at: string;
};

function expiresAtIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
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
    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      userVerification: 'required',
    });

    const supabase = createAdminClient(env);
    const insert: WebauthnChallengeInsert = {
      type: 'login',
      challenge: options.challenge,
      expires_at: expiresAtIso(5),
    };

    const { data, error } = await supabase
      .from('webauthn_challenges')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store login challenge:', error);
      return errorResponse(500, 'Failed to create challenge', origin);
    }

    return jsonResponse(200, { options, challengeId: data.id }, origin);
  } catch (e) {
    console.error('Login start error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
