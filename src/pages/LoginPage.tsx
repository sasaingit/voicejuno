import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { session, loading, registerPasskey, signInWithPasskey } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'register' | 'signin' | null>(null);

  const isWebAuthnSupported = useMemo(() => {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).PublicKeyCredential &&
      typeof (window as any).PublicKeyCredential === 'function'
    );
  }, []);

  useEffect(() => {
    if (!isWebAuthnSupported) {
      setError('Passkeys are not supported in this browser. Please use Chrome.');
    }
  }, [isWebAuthnSupported]);

  async function onRegister() {
    setError(null);
    setBusy('register');
    try {
      await registerPasskey();
    } catch (e: any) {
      setError(e?.message || 'Network error — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onSignin() {
    setError(null);
    setBusy('signin');
    try {
      await signInWithPasskey();
    } catch (e: any) {
      setError(e?.message || 'Network error — please try again.');
    } finally {
      setBusy(null);
    }
  }

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
