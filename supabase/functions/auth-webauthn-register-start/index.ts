import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@10.0.1';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { bytesToBase64Url } from '../_shared/base64url.ts';
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
  type: 'register';
  challenge: string;
  user_handle: string;
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
    // Passkey-only: we do not identify the user up-front.
    // We still must provide a stable `user.id` for the registration ceremony.
    const userHandleBytes = crypto.getRandomValues(new Uint8Array(32));
    const userHandle = bytesToBase64Url(userHandleBytes);

    const options = await generateRegistrationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      rpName: env.WEBAUTHN_RP_NAME,
      userID: userHandleBytes,
      userName: 'passkey',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    const supabase = createAdminClient(env);

    const insert: WebauthnChallengeInsert = {
      type: 'register',
      challenge: options.challenge,
      user_handle: userHandle,
      expires_at: expiresAtIso(5),
    };

    const { data, error } = await supabase
      .from('webauthn_challenges')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store register challenge:', error);
      return errorResponse(500, 'Failed to create challenge', origin);
    }

    return jsonResponse(200, { options, challengeId: data.id }, origin);
  } catch (e) {
    console.error('Register start error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
