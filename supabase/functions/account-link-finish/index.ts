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

type LinkFinishBody = {
  code: string;
};

type LinkCodeRow = {
  id: string;
  issuer_account_id: string;
  redeemed_at: string | null;
};

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
    const body = (await req.json()) as LinkFinishBody;
    if (!body?.code || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
      return errorResponse(400, 'Invalid code', origin);
    }

    const supabase = createAdminClient(env);

    // Extract redeemer user from Authorization header.
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Missing authorization', origin);
    }
    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return errorResponse(401, 'Invalid token', origin);
    }
    const redeemerId = userData.user.id;

    // Look up redeemer's current account.
    const { data: redeemerMembership, error: redeemerError } = await supabase
      .from('account_users')
      .select('account_id')
      .eq('user_id', redeemerId)
      .single<{ account_id: string }>();

    if (redeemerError || !redeemerMembership) {
      return errorResponse(400, 'No account found for this device', origin);
    }
    const redeemerAccountId = redeemerMembership.account_id;

    // Find the matching unexpired, unredeemed code.
    const codeHash = await hashCode(body.code);

    const { data: codeRow, error: codeError } = await supabase
      .from('account_link_codes')
      .select('id,issuer_account_id,redeemed_at')
      .eq('code_hash', codeHash)
      .is('redeemed_at', null)
      .gte('expires_at', new Date().toISOString())
      .single<LinkCodeRow>();

    if (codeError || !codeRow) {
      return errorResponse(400, 'Invalid or expired code', origin);
    }

    const issuerAccountId = codeRow.issuer_account_id;

    // Already in the same account — nothing to do.
    if (redeemerAccountId === issuerAccountId) {
      return errorResponse(400, 'Devices are already linked', origin);
    }

    // Merge: move redeemer's entries to issuer's account.
    const { error: entriesError } = await supabase
      .from('entries')
      .update({ account_id: issuerAccountId })
      .eq('account_id', redeemerAccountId);

    if (entriesError) {
      console.error('Failed to reassign entries:', entriesError);
      return errorResponse(500, 'Failed to merge entries', origin);
    }

    // Move redeemer user to issuer's account.
    const { error: membershipError } = await supabase
      .from('account_users')
      .update({ account_id: issuerAccountId })
      .eq('user_id', redeemerId);

    if (membershipError) {
      console.error('Failed to update membership:', membershipError);
      return errorResponse(500, 'Failed to link device', origin);
    }

    // Delete the now-empty redeemer account.
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', redeemerAccountId);

    if (deleteError) {
      console.error('Failed to delete old account:', deleteError);
      // Non-fatal — the merge succeeded.
    }

    // Mark code as redeemed.
    await supabase
      .from('account_link_codes')
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by_user_id: redeemerId,
      })
      .eq('id', codeRow.id);

    return jsonResponse(200, { success: true }, origin);
  } catch (e) {
    console.error('Account link finish error:', e);
    return errorResponse(500, 'Internal Server Error', origin);
  }
}

serve(handler);
