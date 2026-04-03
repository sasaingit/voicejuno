import { useCallback, useEffect, useRef, useState } from 'react';
import { startAccountLink, finishAccountLink } from '../../data/accountLink.api';

type Mode = 'idle' | 'issuer' | 'redeemer';
type Status = 'idle' | 'loading' | 'success' | 'error';

const CODE_EXPIRY_SECONDS = 300; // 5 minutes

export default function LinkDevice({ onLinked }: { onLinked?: () => void }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [status, setStatus] = useState<Status>('idle');
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleGenerateCode = useCallback(async () => {
    setMode('issuer');
    setStatus('loading');
    setError(null);

    const result = await startAccountLink();
    if (result.error) {
      setStatus('error');
      setError(result.error.message);
      return;
    }

    setCode(result.data.code);
    setStatus('idle');
    setCountdown(CODE_EXPIRY_SECONDS);

    // Countdown timer.
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setMode('idle');
          setCode('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleRedeemCode = useCallback(async () => {
    if (!/^\d{6}$/.test(inputCode)) {
      setError('Enter a 6-digit code.');
      return;
    }

    setStatus('loading');
    setError(null);

    const result = await finishAccountLink(inputCode);
    if (result.error) {
      setStatus('error');
      setError(result.error.message);
      return;
    }

    setStatus('success');
    setMode('idle');
    setInputCode('');
    onLinked?.();
  }, [inputCode, onLinked]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMode('idle');
    setStatus('idle');
    setCode('');
    setInputCode('');
    setError(null);
  }, []);

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (mode === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {status === 'success' ? (
          <div className="notice">Device linked successfully.</div>
        ) : null}
        <button type="button" onClick={handleGenerateCode}>
          Link another device
        </button>
        <button type="button" onClick={() => { setMode('redeemer'); setError(null); setStatus('idle'); }}>
          Join existing account
        </button>
      </div>
    );
  }

  if (mode === 'issuer') {
    return (
      <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
        {status === 'loading' ? (
          <div className="muted">Generating code…</div>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 12 }}>Enter this code on your other device:</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, fontVariantNumeric: 'tabular-nums' }}>
              {code}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Expires in {formatCountdown(countdown)}
            </div>
          </>
        )}
        {error ? <div className="noticeError">{error}</div> : null}
        <button type="button" onClick={handleCancel}>Cancel</button>
      </div>
    );
  }

  // mode === 'redeemer'
  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
      <div className="muted" style={{ fontSize: 12 }}>Enter the 6-digit code from your other device:</div>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 8,
          textAlign: 'center',
          width: 180,
          fontVariantNumeric: 'tabular-nums',
        }}
        disabled={status === 'loading'}
      />
      {error ? <div className="noticeError">{error}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleRedeemCode} disabled={status === 'loading'}>
          {status === 'loading' ? 'Linking…' : 'Link'}
        </button>
        <button type="button" onClick={handleCancel} disabled={status === 'loading'}>
          Cancel
        </button>
      </div>
    </div>
  );
}
