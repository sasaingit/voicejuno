import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RecordButton from '../components/recorder/RecordButton';
import Timer from '../components/recorder/Timer';
import TranscriptView from '../components/recorder/TranscriptView';
import { useAuth } from '../hooks/useAuth';
import { useCreateEntry } from '../hooks/useEntries';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { buildEntryTitle } from '../utils/title';

type RecorderUiState = 'SIGNED_OUT' | 'IDLE' | 'RECORDING' | 'SAVING' | 'ERROR';

const COPY = Object.freeze({
  unsupportedSpeech: 'Speech recognition not supported in this browser. Please use Chrome.',
  saving: 'Saving…',
  privacyNote: 'Transcription is performed using your browser’s speech recognition service.',
  emptyNotSaved: 'Nothing captured — entry not saved.',
  saveFailed: 'Save failed — try again.',
});

const TIMING = Object.freeze({
  timerTickMs: 1000,
});

const ROUTES = Object.freeze({
  entries: '/app/entries',
});

export default function AppHomePage() {
  const { user, signOut } = useAuth();
  const speech = useSpeechRecognition();
  const createEntry = useCreateEntry();

  const [uiState, setUiState] = useState<RecorderUiState>(() => (user ? 'IDLE' : 'SIGNED_OUT'));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);

  const combinedTranscript = `${speech.finalTranscript}${speech.interimTranscript}`.trim();

  useEffect(() => {
    setUiState(user ? 'IDLE' : 'SIGNED_OUT');
  }, [user]);

  useEffect(() => {
    if (uiState !== 'RECORDING') return;
    if (speech.status !== 'error') return;

    setUiError(speech.errorMessage ?? null);
    setUiState('ERROR');
  }, [speech.errorMessage, speech.status, uiState]);

  useEffect(() => {
    if (uiState !== 'RECORDING') return;

    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, TIMING.timerTickMs);

    return () => {
      window.clearInterval(id);
    };
  }, [uiState]);

  const isBusy = uiState === 'SAVING';
  const recordButtonState = uiState === 'RECORDING' ? 'recording' : uiState === 'SAVING' ? 'saving' : 'idle';
  const recordDisabled = !speech.isSupported || isBusy || uiState === 'SIGNED_OUT' || uiState === 'ERROR';

  async function handleRecordToggle() {
    if (uiState === 'RECORDING') {
      setUiState('SAVING');

      const transcript = `${speech.finalTranscript}${speech.interimTranscript}`.trim();
      speech.stop();

      if (transcript.length === 0) {
        speech.reset();
        setElapsedSeconds(0);
        setUiError(null);
        setUiMessage(COPY.emptyNotSaved);
        setUiState('IDLE');
        return;
      }

      const recordedAt = new Date().toISOString();
      const title = buildEntryTitle(recordedAt);
      const { error } = await createEntry.create({ title, transcript, recorded_at: recordedAt });

      speech.reset();
      setElapsedSeconds(0);
      setUiError(null);
      setUiMessage(error ? error.message : null);
      setUiState('IDLE');
      return;
    }

    if (uiState !== 'IDLE') return;
    setElapsedSeconds(0);
    setUiError(null);
    setUiMessage(null);
    speech.reset();
    speech.start();
    setUiState('RECORDING');
  }

  function handleRetry() {
    speech.reset();
    setElapsedSeconds(0);
    setUiError(null);
    setUiMessage(null);
    setUiState(user ? 'IDLE' : 'SIGNED_OUT');
  }

  return (
    <div className="container">
      <h1>App</h1>

      <p className="muted" style={{ fontSize: 12 }}>
        Logged in as <code>{user?.email ?? user?.id}</code>
      </p>

      <nav className="appNav">
        <Link to={ROUTES.entries}>Entries</Link>
        <button type="button" onClick={() => void signOut()} disabled={isBusy}>
          Logout
        </button>
      </nav>

      <div className="stackCenter">
        {uiState === 'RECORDING' ? <Timer seconds={elapsedSeconds} /> : null}

        <RecordButton state={recordButtonState} disabled={recordDisabled} onClick={() => void handleRecordToggle()} />

        {uiState === 'SAVING' ? <div className="muted" style={{ fontSize: 14 }}>{COPY.saving}</div> : null}

        {uiMessage ? (
          <div className="notice">
            {uiMessage}
          </div>
        ) : null}

        {!speech.isSupported ? (
          <div className="muted" style={{ fontSize: 14, maxWidth: 520, textAlign: 'center' }}>
            {COPY.unsupportedSpeech}
          </div>
        ) : null}

        {uiState === 'RECORDING' ? (
          <div style={{ width: '100%', marginTop: 12 }}>
            <TranscriptView finalTranscript={speech.finalTranscript} interimTranscript={speech.interimTranscript} />
          </div>
        ) : null}

        {uiState === 'ERROR' ? (
          <div style={{ width: '100%', marginTop: 12, display: 'grid', gap: 10 }}>
            <div className="noticeError">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>{uiError ?? speech.errorMessage ?? 'Error'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={handleRetry}>
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {uiState !== 'ERROR' &&
        uiState !== 'SIGNED_OUT' &&
        uiState !== 'SAVING' &&
        uiState !== 'RECORDING' &&
        combinedTranscript.length > 0 ? (
          <div style={{ width: '100%', marginTop: 12 }}>
            <TranscriptView finalTranscript={speech.finalTranscript} interimTranscript={speech.interimTranscript} />
          </div>
        ) : null}

        <div className="muted" style={{ marginTop: 18, fontSize: 12, maxWidth: 520, textAlign: 'center' }}>
          {COPY.privacyNote}
        </div>
      </div>
    </div>
  );
}
