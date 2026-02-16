import {
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from 'npm:@simplewebauthn/server@10.0.1';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { base64UrlToBytes, normalizeBase64Url } from '../_shared/base64url.ts';
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

type LoginFinishBody = {
  credential: unknown;
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
        response: body.credential as any,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: origin,
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

    // Create a real Supabase Auth session (access + refresh token) so supabase-js
    // can persist it to localStorage and handle refresh token rotation.
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(
      credRow.user_id,
    );
    if (userErr || !userRes?.user?.email) {
      console.error('Failed to look up user email:', userErr);
      return errorResponse(500, 'Failed to create session', origin);
    }

    const { data: linkRes, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userRes.user.email,
      options: {
        // Not actually used (we exchange server-side), but required by the API shape
        redirectTo: origin,
      },
    });
    if (linkErr || !linkRes?.properties?.hashed_token) {
      console.error('Failed to generate link for session exchange:', linkErr);
      return errorResponse(500, 'Failed to create session', origin);
    }

    const { data: verifyRes, error: verifyErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkRes.properties.hashed_token,
    });
    if (verifyErr || !verifyRes?.session?.access_token || !verifyRes?.session?.refresh_token) {
      console.error('Failed to exchange token for session:', verifyErr);
      return errorResponse(500, 'Failed to create session', origin);
    }

    return jsonResponse(
      200,
      {
        access_token: verifyRes.session.access_token,
        refresh_token: verifyRes.session.refresh_token,
      },
      origin,
    );
  } catch (e) {
    console.error('Login finish error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
