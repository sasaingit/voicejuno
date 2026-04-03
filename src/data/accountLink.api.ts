import { EDGE_FUNCTIONS_BASE_URL } from '../config';
import { supabase } from './supabaseClient';

export type Result<T> = { data: T; error: null } | { data: null; error: Error };

const ROUTES = Object.freeze({
  start: `${EDGE_FUNCTIONS_BASE_URL}/account-link-start`,
  finish: `${EDGE_FUNCTIONS_BASE_URL}/account-link-finish`,
});

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function startAccountLink(): Promise<Result<{ code: string }>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(ROUTES.start, { method: 'POST', headers });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error ?? 'Failed to generate link code.';
      return { data: null, error: new Error(message) };
    }

    const json = await res.json();
    if (typeof json?.code !== 'string') {
      return { data: null, error: new Error('Invalid response from server.') };
    }

    return { data: { code: json.code }, error: null };
  } catch {
    return { data: null, error: new Error('Network error — please try again.') };
  }
}

export async function finishAccountLink(code: string): Promise<Result<null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(ROUTES.finish, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error ?? 'Failed to link device.';
      return { data: null, error: new Error(message) };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: new Error('Network error — please try again.') };
  }
}
