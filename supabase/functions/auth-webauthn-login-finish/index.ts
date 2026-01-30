import {
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from 'npm:@simplewebauthn/server@10.0.1';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { base64UrlToBytes, normalizeBase64Url } from '../_shared/base64url.ts';
import { getEnv } from '../_shared/env.ts';
import {
  assertOrigin,
  assertPost,
  errorResponse,
  handlePreflight,
  jsonResponse,
} from '../_shared/http.ts';
import { mintSupabaseJwt } from '../_shared/jwt.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

type LoginFinishBody = {
  credential: any;
  challengeId: string;
};

type WebauthnChallengeRow = {
  id: string;
  type: 'register' | 'login';
  challenge: string;
  expires_at: string;
};

type WebauthnCredentialRow = {
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
};

function isExpired(expiresAtIso: string): boolean {
  return Date.parse(expiresAtIso) <= Date.now();
}

async function handler(req: Request): Promise<Response> {
  const env = getEnv();
  const preflight = handlePreflight(req, env.WEBAUTHN_ORIGIN);
  if (preflight) return preflight;

  let origin: string;
  try {
    assertPost(req);
    origin = assertOrigin(req, env.WEBAUTHN_ORIGIN);
  } catch (e) {
    return errorResponse(
      e instanceof Error && e.message === 'Method Not Allowed' ? 405 : 401,
      e instanceof Error ? e.message : 'Unauthorized',
      env.WEBAUTHN_ORIGIN,
    );
  }

  try {
    const body = (await req.json()) as LoginFinishBody;
    if (!body?.challengeId || !body?.credential) {
      return errorResponse(400, 'Missing credential or challengeId', origin);
    }

    const supabase = createAdminClient(env);

    const { data: challengeRow, error: challengeError } = await supabase
      .from('webauthn_challenges')
      .select('id,type,challenge,expires_at')
      .eq('id', body.challengeId)
      .single<WebauthnChallengeRow>();

    if (challengeError || !challengeRow) {
      return errorResponse(400, 'Invalid challenge', origin);
    }
    if (challengeRow.type !== 'login') {
      return errorResponse(400, 'Challenge type mismatch', origin);
    }
    if (isExpired(challengeRow.expires_at)) {
      return errorResponse(400, 'Challenge expired', origin);
    }

    const rawCredentialId = body.credential?.id;
    if (typeof rawCredentialId !== 'string' || rawCredentialId.length === 0) {
      return errorResponse(400, 'Missing credential id', origin);
    }

    const credentialId = normalizeBase64Url(rawCredentialId);

    const { data: credRow, error: credError } = await supabase
      .from('webauthn_credentials')
      .select('user_id,credential_id,public_key,counter,transports')
      .eq('credential_id', credentialId)
      .single<WebauthnCredentialRow>();

    if (credError || !credRow) {
      return errorResponse(400, 'Unknown credential', origin);
    }

    const authenticator = {
      credentialID: base64UrlToBytes(normalizeBase64Url(credRow.credential_id)),
      credentialPublicKey: base64UrlToBytes(credRow.public_key),
      counter: credRow.counter,
      transports: credRow.transports ?? undefined,
    };

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
        authenticator,
        requireUserVerification: true,
      });
    } catch (e) {
      console.error('Assertion verification failed:', e);
      return errorResponse(400, 'Invalid credential', origin);
    }

    if (!verification.verified) {
      return errorResponse(400, 'Invalid credential', origin);
    }

    const newCounter = verification.authenticationInfo.newCounter;
    await supabase
      .from('webauthn_credentials')
      .update({
        counter: newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('credential_id', credRow.credential_id);

    await supabase.from('webauthn_challenges').delete().eq('id', challengeRow.id);

    const accessToken = await mintSupabaseJwt(env, {
      sub: credRow.user_id,
      role: 'authenticated',
      aud: 'authenticated',
    });

    return jsonResponse(
      200,
      {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 60 * 60 * 24,
      },
      origin,
    );
  } catch (e) {
    console.error('Login finish error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
