import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

export default function LoginPage() {
  const { session, loading, registerPasskey, signInWithPasskey } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'register' | 'signin' | null>(null);

  const isWebAuthnSupported = useMemo(() => isWebAuthnAvailable(), []);

  useEffect(() => {
    if (!isWebAuthnSupported) {
      setError('Passkeys are not supported in this browser. Please use Chrome.');
    }
  }, [isWebAuthnSupported]);

  const onRegister = useCallback(async () => {
    setError(null);
    setBusy('register');
    try {
      await registerPasskey();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error — please try again.';
      setError(message);
    } finally {
      setBusy(null);
    }
  }, [registerPasskey]);

  const onSignin = useCallback(async () => {
    setError(null);
    setBusy('signin');
    try {
      await signInWithPasskey();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error — please try again.';
      setError(message);
    } finally {
      setBusy(null);
    }
  }, [signInWithPasskey]);

  // Redirect if already logged in
  if (!loading && session) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="container">
      <h1>Login</h1>

      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          {!isWebAuthnSupported && (
            <div role="alert" style={{ color: 'crimson', marginBottom: 12 }}>
              Passkeys are not supported in this browser. Please use Chrome.
            </div>
          )}

          {error && (
            <div role="alert" style={{ color: 'crimson', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onRegister} disabled={!isWebAuthnSupported || !!busy}>
              {busy === 'register' ? 'Creating…' : 'Create passkey'}
            </button>
            <button onClick={onSignin} disabled={!isWebAuthnSupported || !!busy}>
              {busy === 'signin' ? 'Signing in…' : 'Sign in with passkey'}
            </button>
          </div>

          <p style={{ marginTop: 16 }}>
            Go to <Link to="/app">App</Link> or <Link to="/app/entries">Entries</Link>
          </p>

          <p style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
            Transcription is performed using your browser’s speech recognition service.
          </p>
        </>
      )}
    </div>
  );
}
