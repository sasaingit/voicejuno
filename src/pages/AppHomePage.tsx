import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import LinkDevice from '../components/account/LinkDevice';
import RecordButton from '../components/recorder/RecordButton';
import Timer from '../components/recorder/Timer';
import TranscriptView from '../components/recorder/TranscriptView';
import { useAuth } from '../hooks/useAuth';
import { useCreateEntry } from '../hooks/useEntries';
import { useMyAccount } from '../hooks/useMyAccount';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useHomeRecorder } from '../hooks/useHomeRecorder';

const COPY = Object.freeze({
  unsupportedSpeech: 'Speech recognition not supported in this browser. Please use Chrome.',
  saving: 'Saving…',
  privacyNote: 'Transcription is performed using your browser’s speech recognition service.',
});

const ROUTES = Object.freeze({
  entries: '/app/entries',
});

export default function AppHomePage() {
  const { user, signOut } = useAuth();
  const account = useMyAccount({ enabled: !!user });
  const speech = useSpeechRecognition();
  const createEntry = useCreateEntry();

  const recorder = useHomeRecorder({ user, speech, createEntry });

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleRecord = useCallback(async () => {
    await recorder.handleRecordButtonClick();
  }, [recorder.handleRecordButtonClick]);

  const styles = useMemo(
    () =>
      ({
        metaText: { fontSize: 12 },
        savingText: { fontSize: 14 },
        unsupported: { fontSize: 14, maxWidth: 520, textAlign: 'center' as const },
        fullWidthSection: { width: '100%', marginTop: 12 },
        errorPanel: { width: '100%', marginTop: 12, display: 'grid', gap: 10 },
        errorTitle: { fontWeight: 600, marginBottom: 6 },
        errorMessage: { color: 'var(--muted)', fontSize: 14 },
        errorActions: { display: 'flex', justifyContent: 'center' },
        privacyNote: { marginTop: 18, fontSize: 12, maxWidth: 520, textAlign: 'center' as const },
      }) as const,
    []
  );

  return (
    <div className="container">
      <h1>App</h1>

      <p className="muted" style={styles.metaText}>
        Logged in as <code>{account.status === 'success' ? account.account.handle : user?.email ?? user?.id}</code>
      </p>

      {account.status === 'error' ? (
        <p className="muted" style={styles.metaText}>
          {account.message}
        </p>
      ) : null}

      <nav className="appNav">
        <Link to={ROUTES.entries}>Entries</Link>
        <button type="button" onClick={handleSignOut} disabled={recorder.isBusy}>
          Logout
        </button>
      </nav>

      <div className="stackCenter">
        {recorder.recorderState === 'RECORDING' ? <Timer seconds={recorder.recordingSeconds} /> : null}

        <RecordButton
          state={recorder.recordButtonState}
          disabled={recorder.recordDisabled}
          onClick={handleRecord}
        />

        {recorder.recorderState === 'SAVING' ? (
          <div className="muted" style={styles.savingText}>
            {COPY.saving}
          </div>
        ) : null}

        {recorder.notice ? (
          <div className={recorder.notice.type === 'error' ? 'noticeError' : 'notice'}>{recorder.notice.message}</div>
        ) : null}

        {!speech.isSupported ? (
          <div className="muted" style={styles.unsupported}>
            {COPY.unsupportedSpeech}
          </div>
        ) : null}

        {recorder.recorderState === 'ERROR' ? (
          <div style={styles.errorPanel}>
            <div className="noticeError">
              <div style={styles.errorTitle}>Something went wrong</div>
              <div style={styles.errorMessage}>{recorder.recorderErrorMessage ?? speech.errorMessage ?? 'Error'}</div>
            </div>
            <div style={styles.errorActions}>
              <button type="button" onClick={recorder.handleRetry}>
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {recorder.shouldShowTranscript ? (
          <div style={styles.fullWidthSection}>
            <TranscriptView finalTranscript={speech.finalTranscript} interimTranscript={speech.interimTranscript} />
          </div>
        ) : null}

        <div className="muted" style={styles.privacyNote}>
          {COPY.privacyNote}
        </div>

        <div style={styles.fullWidthSection}>
          <LinkDevice />
        </div>
      </div>
    </div>
  );
}
