import {
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from 'npm:@simplewebauthn/server@10.0.1';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  base64UrlToBytes,
  bytesToBase64Url,
  normalizeBase64Url,
} from '../_shared/base64url.ts';
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

type RegisterFinishBody = {
  credential: unknown;
  challengeId: string;
};

type WebauthnChallengeRow = {
  id: string;
  type: 'register' | 'login';
  challenge: string;
  user_handle: string | null;
  expires_at: string;
};

type WebauthnCredentialInsert = {
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  last_used_at: string;
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
    const body = (await req.json()) as RegisterFinishBody;
    if (!body?.challengeId || !body?.credential) {
      return errorResponse(400, 'Missing credential or challengeId', origin);
    }

    const supabase = createAdminClient(env);

    const { data: challengeRow, error: challengeError } = await supabase
      .from('webauthn_challenges')
      .select('id,type,challenge,user_handle,expires_at')
      .eq('id', body.challengeId)
      .single<WebauthnChallengeRow>();

    if (challengeError || !challengeRow) {
      return errorResponse(400, 'Invalid challenge', origin);
    }
    if (challengeRow.type !== 'register') {
      return errorResponse(400, 'Challenge type mismatch', origin);
    }
    if (isExpired(challengeRow.expires_at)) {
      return errorResponse(400, 'Challenge expired', origin);
    }
    if (!challengeRow.user_handle) {
      return errorResponse(500, 'Challenge missing user handle', origin);
    }

    const userHandleBytes = base64UrlToBytes(challengeRow.user_handle);

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential as any,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
        requireUserVerification: true,
      });
    } catch (e) {
      console.error('Attestation verification failed:', e);
      return errorResponse(400, 'Invalid credential', origin);
    }

    if (!verification.verified || !verification.registrationInfo) {
      return errorResponse(400, 'Invalid credential', origin);
    }

    const { credentialID, credentialPublicKey, counter } =
      verification.registrationInfo;

    const credentialIdFromClient = (body.credential as any)?.id;
    const credentialIdFromVerification = bytesToBase64Url(
      new Uint8Array(credentialID),
    );
    const credentialId =
      typeof credentialIdFromClient === 'string' &&
      credentialIdFromClient.trim().length > 0
        ? normalizeBase64Url(credentialIdFromClient)
        : credentialIdFromVerification;

    if (!credentialId || credentialId.length === 0) {
      console.error('Registration succeeded but credential id is missing');
      return errorResponse(500, 'Failed to extract credential id', origin);
    }

    const userEmail = `${crypto.randomUUID()}@passkey.local`;
    const { data: created, error: createUserError } = await supabase.auth.admin
      .createUser({
        email: userEmail,
        email_confirm: true,
      });

    if (createUserError || !created.user) {
      console.error('Failed to create Supabase auth user:', createUserError);
      return errorResponse(500, 'Failed to create user', origin);
    }

    const authUserId = created.user.id;

    const credentialInsert: WebauthnCredentialInsert = {
      user_id: authUserId,
      credential_id: credentialId,
      public_key: bytesToBase64Url(new Uint8Array(credentialPublicKey)),
      counter,
      transports: (body.credential as any)?.transports ?? null,
      last_used_at: new Date().toISOString(),
    };

    const { error: credError } = await supabase
      .from('webauthn_credentials')
      .insert(credentialInsert);

    if (credError) {
      console.error('Failed to store credential:', credError);
      return errorResponse(500, 'Failed to store credential', origin);
    }

    await supabase.from('webauthn_challenges').delete().eq('id', challengeRow.id);

    const accessToken = await mintSupabaseJwt(env, {
      sub: authUserId,
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
    console.error('Register finish error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
