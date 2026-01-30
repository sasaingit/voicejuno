import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { EDGE_FUNCTIONS_BASE_URL } from '../config';

export type AuthState = {
  session: import('@supabase/supabase-js').Session | null;
  user: import('@supabase/supabase-js').User | null;
  loading: boolean;
  signInWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Helper: WebAuthn support detection
function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

type StartResponse<T> = {
  options: T;
  challengeId: string;
};

type FinishResponse = {
  // On success, backend returns a valid Supabase session access_token/refresh_token
  // The easiest client-side path is to call supabase.auth.setSession with the returned tokens,
  // but the Supabase Edge Function could also set auth cookies. We support token-based here.
  access_token?: string;
  refresh_token?: string;
};

// Convert arbitrary object properties that may be base64url strings back to ArrayBuffers
// for WebAuthn API. We assume the backend sends options already correctly shaped per WebAuthn spec;
// modern frameworks often handle binary members as base64url. We'll best-effort convert common fields.
function base64urlToArrayBuffer(b64url: string): ArrayBuffer {
  const pad = '==='.slice((b64url.length + 3) % 4);
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const str = window.atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

function reviveRequestOptionsForCreate(options: any) {
  // PublicKeyCredentialCreationOptions
  if (options.challenge && typeof options.challenge === 'string') {
    options.challenge = base64urlToArrayBuffer(options.challenge);
  }
  if (options.user?.id && typeof options.user.id === 'string') {
    options.user.id = base64urlToArrayBuffer(options.user.id);
  }
  if (Array.isArray(options.excludeCredentials)) {
    options.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToArrayBuffer(cred.id) : cred.id,
    }));
  }
  return options;
}

function reviveRequestOptionsForGet(options: any) {
  // PublicKeyCredentialRequestOptions
  if (options.challenge && typeof options.challenge === 'string') {
    options.challenge = base64urlToArrayBuffer(options.challenge);
  }
  if (Array.isArray(options.allowCredentials)) {
    options.allowCredentials = options.allowCredentials.map((cred: any) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToArrayBuffer(cred.id) : cred.id,
    }));
  }
  return options;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    let active = true;
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    unsubRef.current = () => sub.subscription.unsubscribe();
    return () => {
      active = false;
      unsubRef.current?.();
    };
  }, []);

  const registerPasskey = useCallback(async () => {
    if (!isWebAuthnSupported()) {
      throw new Error('Passkeys are not supported in this browser. Please use Chrome.');
    }

    // 1. start
    const startRes = await fetch(`${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-register-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!startRes.ok) throw new Error('Network error — please try again.');
    const { options, challengeId } =
      (await startRes.json()) as StartResponse<PublicKeyCredentialCreationOptions>;

    // Ensure binary fields are ArrayBuffers
    const publicKey = reviveRequestOptionsForCreate({ ...options });

    // 2. create credential
    let credential: PublicKeyCredential;
    try {
      credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
      if (!credential) throw new Error('You canceled the request.');
    } catch (e: any) {
      // Map common DOMException names to friendly copy
      if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') {
        throw new Error('You canceled the request.');
      }
      if (e?.name === 'InvalidStateError') {
        throw new Error('A passkey already exists for this device. Try sign in.');
      }
      throw new Error(e?.message || 'Network error — please try again.');
    }

    // 3. finish
    const attestation = (credential as unknown as { toJSON: () => unknown }).toJSON();
    const finishRes = await fetch(`${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-register-finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: attestation, challengeId }),
    });
    if (!finishRes.ok) throw new Error('Network error — please try again.');
    const finishJson = (await finishRes.json()) as FinishResponse;

    // 4. set Supabase session if tokens returned
    if (finishJson.access_token && finishJson.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: finishJson.access_token,
        refresh_token: finishJson.refresh_token,
      });
      if (error) throw new Error(error.message || 'Network error — please try again.');
      setSession(data.session);
      setUser(data.session?.user ?? null);
    } else {
      // If backend set cookies directly, fetch session
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    }
  }, []);

  const signInWithPasskey = useCallback(async () => {
    if (!isWebAuthnSupported()) {
      throw new Error('Passkeys are not supported in this browser. Please use Chrome.');
    }

    // 1. start
    const startRes = await fetch(`${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-login-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!startRes.ok) throw new Error('Network error — please try again.');
    const { options, challengeId } =
      (await startRes.json()) as StartResponse<PublicKeyCredentialRequestOptions>;

    // 2. get assertion
    const publicKey = reviveRequestOptionsForGet({ ...options });
    let assertion: PublicKeyCredential;
    try {
      assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
      if (!assertion) throw new Error('You canceled the request.');
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') {
        throw new Error('You canceled the request.');
      }
      if (e?.name === 'InvalidStateError' || e?.name === 'NotFoundError') {
        throw new Error('No passkey found for this account.');
      }
      throw new Error(e?.message || 'Network error — please try again.');
    }

    // 3. finish
    const assertionJSON = (assertion as unknown as { toJSON: () => unknown }).toJSON();
    const finishRes = await fetch(`${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-login-finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: assertionJSON, challengeId }),
    });
    if (!finishRes.ok) throw new Error('Network error — please try again.');
    const finishJson = (await finishRes.json()) as FinishResponse;

    // 4. set Supabase session
    if (finishJson.access_token && finishJson.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: finishJson.access_token,
        refresh_token: finishJson.refresh_token,
      });
      if (error) throw new Error(error.message || 'Network error — please try again.');
      setSession(data.session);
      setUser(data.session?.user ?? null);
    } else {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return useMemo(
    () => ({ session, user, loading, registerPasskey, signInWithPasskey, signOut }),
    [session, user, loading, registerPasskey, signInWithPasskey, signOut]
  );
}
