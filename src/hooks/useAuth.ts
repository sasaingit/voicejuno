import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../data/supabaseClient';
import {
  finishWebauthnLogin,
  finishWebauthnRegister,
  getTokensOrError,
  startWebauthnLogin,
  startWebauthnRegister,
  type FinishResponse,
} from '../data/webauthnAuthRepository';

export type AuthState = {
  session: import('@supabase/supabase-js').Session | null;
  user: import('@supabase/supabase-js').User | null;
  loading: boolean;
  signInWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ERROR_MESSAGES = Object.freeze({
  passkeysUnsupported: 'Passkeys are not supported in this browser. Please use Chrome.',
  canceled: 'You canceled the request.',
  passkeyAlreadyExists: 'A passkey already exists for this device. Try sign in.',
  noPasskeyFound: 'No passkey found for this account.',
  network: 'Network error — please try again.',
  registrationTokensMissing: 'Registration succeeded but session tokens were not returned.',
  loginTokensMissing: 'Login succeeded but session tokens were not returned.',
});

// Helper: WebAuthn support detection
function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

type DomExceptionLike = {
  name?: unknown;
  message?: unknown;
};

function isDomExceptionLike(value: unknown): value is DomExceptionLike {
  return typeof value === 'object' && value !== null;
}

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

function reviveRequestOptionsForCreate(
  options: PublicKeyCredentialCreationOptions
): PublicKeyCredentialCreationOptions {
  // PublicKeyCredentialCreationOptions
  const revived: PublicKeyCredentialCreationOptions = { ...options };
  const challenge = revived.challenge;

  if (typeof challenge === 'string') {
    revived.challenge = base64urlToArrayBuffer(challenge);
  }

  const user = revived.user;
  if (user && typeof user.id === 'string') {
    revived.user = { ...user, id: base64urlToArrayBuffer(user.id) };
  }

  if (Array.isArray(revived.excludeCredentials)) {
    revived.excludeCredentials = revived.excludeCredentials.map((cred) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToArrayBuffer(cred.id) : cred.id,
    }));
  }
  return revived;
}

function reviveRequestOptionsForGet(
  options: PublicKeyCredentialRequestOptions
): PublicKeyCredentialRequestOptions {
  // PublicKeyCredentialRequestOptions
  const revived: PublicKeyCredentialRequestOptions = { ...options };
  const challenge = revived.challenge;
  if (typeof challenge === 'string') {
    revived.challenge = base64urlToArrayBuffer(challenge);
  }

  if (Array.isArray(revived.allowCredentials)) {
    revived.allowCredentials = revived.allowCredentials.map((cred) => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToArrayBuffer(cred.id) : cred.id,
    }));
  }
  return revived;
}

function mapWebauthnError(e: unknown, context: 'register' | 'login'): Error {
  if (isDomExceptionLike(e)) {
    const name = typeof e.name === 'string' ? e.name : undefined;
    if (name === 'AbortError' || name === 'NotAllowedError') {
      return new Error(ERROR_MESSAGES.canceled);
    }
    if (context === 'register' && name === 'InvalidStateError') {
      return new Error(ERROR_MESSAGES.passkeyAlreadyExists);
    }
    if (context === 'login' && (name === 'InvalidStateError' || name === 'NotFoundError')) {
      return new Error(ERROR_MESSAGES.noPasskeyFound);
    }

    const message = typeof e.message === 'string' ? e.message : undefined;
    return new Error(message || ERROR_MESSAGES.network);
  }

  return e instanceof Error ? e : new Error(ERROR_MESSAGES.network);
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
      throw new Error(ERROR_MESSAGES.passkeysUnsupported);
    }

    // 1. start
    const startResult = await startWebauthnRegister();
    if (startResult.error) throw startResult.error;
    const { options, challengeId } = startResult.data;

    // Ensure binary fields are ArrayBuffers
    const publicKey = reviveRequestOptionsForCreate(options);

    // 2. create credential
    let credential: PublicKeyCredential;
    try {
      credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
      if (!credential) throw new Error(ERROR_MESSAGES.canceled);
    } catch (e) {
      throw mapWebauthnError(e, 'register');
    }

    // 3. finish
    const attestation = (credential as unknown as { toJSON: () => unknown }).toJSON();
    const finishResult = await finishWebauthnRegister({ credential: attestation, challengeId });
    if (finishResult.error) throw finishResult.error;
    const finishJson: FinishResponse = finishResult.data;

    // 4. set Supabase session (Option A: tokens must be returned)
    const tokensResult = getTokensOrError(finishJson);
    if (tokensResult.error) {
      throw new Error(ERROR_MESSAGES.registrationTokensMissing);
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
    });
    if (error) throw new Error(error.message || 'Network error — please try again.');
    setSession(data.session);
    setUser(data.session?.user ?? null);
  }, []);

  const signInWithPasskey = useCallback(async () => {
    if (!isWebAuthnSupported()) {
      throw new Error(ERROR_MESSAGES.passkeysUnsupported);
    }

    // 1. start
    const startResult = await startWebauthnLogin();
    if (startResult.error) throw startResult.error;
    const { options, challengeId } = startResult.data;

    // 2. get assertion
    const publicKey = reviveRequestOptionsForGet(options);
    let assertion: PublicKeyCredential;
    try {
      assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
      if (!assertion) throw new Error(ERROR_MESSAGES.canceled);
    } catch (e) {
      throw mapWebauthnError(e, 'login');
    }

    // 3. finish
    const assertionJSON = (assertion as unknown as { toJSON: () => unknown }).toJSON();
    const finishResult = await finishWebauthnLogin({ credential: assertionJSON, challengeId });
    if (finishResult.error) throw finishResult.error;
    const finishJson: FinishResponse = finishResult.data;

    // 4. set Supabase session
    const tokensResult = getTokensOrError(finishJson);
    if (tokensResult.error) {
      throw new Error(ERROR_MESSAGES.loginTokensMissing);
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
    });
    if (error) throw new Error(error.message || 'Network error — please try again.');
    setSession(data.session);
    setUser(data.session?.user ?? null);
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
