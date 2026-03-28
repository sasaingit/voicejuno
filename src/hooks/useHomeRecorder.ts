import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { EntryCreate } from '../types/entry';
import { buildEntryTitle } from '../utils/title';
import type { UseSpeechRecognition } from './useSpeechRecognition';

export type RecorderState = 'SIGNED_OUT' | 'IDLE' | 'RECORDING' | 'SAVING' | 'ERROR';

export type NoticeType = 'info' | 'success' | 'error';

export type Notice = {
  type: NoticeType;
  message: string;
};

type CreateEntryClient = {
  create: (input: EntryCreate) => Promise<{ entry: unknown; error: Error | null }>;
};

const COPY = Object.freeze({
  emptyNotSaved: 'Nothing captured — entry not saved.',
  saveSuccess: 'Saved.',
});

const TIMING = Object.freeze({
  timerTickMs: 1000,
  successNoticeMs: 3000,
});

function buildCombinedTranscript(speech: UseSpeechRecognition): string {
  return `${speech.finalTranscript}${speech.interimTranscript}`.trim();
}

export function useHomeRecorder(args: {
  user: User | null;
  speech: UseSpeechRecognition;
  createEntry: CreateEntryClient;
}) {
  const { user, speech, createEntry } = args;

  const [recorderState, setRecorderState] = useState<RecorderState>(() => (user ? 'IDLE' : 'SIGNED_OUT'));
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recorderErrorMessage, setRecorderErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const combinedTranscript = useMemo(() => buildCombinedTranscript(speech), [speech.finalTranscript, speech.interimTranscript]);

  const resetUi = useCallback(() => {
    speech.reset();
    setRecordingSeconds(0);
    setRecorderErrorMessage(null);
    setNotice(null);
  }, [speech]);

  useEffect(() => {
    setRecorderState(user ? 'IDLE' : 'SIGNED_OUT');
  }, [user]);

  useEffect(() => {
    if (recorderState !== 'RECORDING') return;
    if (speech.status !== 'error') return;

    setRecorderErrorMessage(speech.errorMessage ?? null);
    setRecorderState('ERROR');
  }, [recorderState, speech.errorMessage, speech.status]);

  useEffect(() => {
    if (recorderState !== 'RECORDING') return;

    const id = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, TIMING.timerTickMs);

    return () => {
      window.clearInterval(id);
    };
  }, [recorderState]);

  useEffect(() => {
    if (notice?.type !== 'success') return;

    const id = window.setTimeout(() => {
      setNotice(null);
    }, TIMING.successNoticeMs);

    return () => {
      window.clearTimeout(id);
    };
  }, [notice]);

  const isBusy = recorderState === 'SAVING';
  const recordButtonState: 'idle' | 'recording' | 'saving' =
    recorderState === 'RECORDING' ? 'recording' : recorderState === 'SAVING' ? 'saving' : 'idle';
  const recordDisabled = !speech.isSupported || isBusy || recorderState === 'SIGNED_OUT' || recorderState === 'ERROR';
  const shouldShowTranscript = recorderState === 'RECORDING' || (recorderState === 'IDLE' && combinedTranscript.length > 0);

  const handleRecordButtonClick = useCallback(async () => {
    if (recorderState === 'RECORDING') {
      setRecorderState('SAVING');

      const transcript = buildCombinedTranscript(speech);
      speech.stop();

      if (transcript.length === 0) {
        resetUi();
        setNotice({ type: 'info', message: COPY.emptyNotSaved });
        setRecorderState('IDLE');
        return;
      }

      const recordedAt = new Date().toISOString();
      const title = buildEntryTitle(recordedAt);
      const { error } = await createEntry.create({ title, transcript, recorded_at: recordedAt } satisfies EntryCreate);

      resetUi();
      if (error) {
        setNotice({ type: 'error', message: error.message });
      } else {
        setNotice({ type: 'success', message: COPY.saveSuccess });
      }

      setRecorderState('IDLE');
      return;
    }

    if (recorderState !== 'IDLE') return;

    resetUi();
    speech.start();
    setRecorderState('RECORDING');
  }, [createEntry, recorderState, resetUi, speech]);

  const handleRetry = useCallback(() => {
    resetUi();
    setRecorderState(user ? 'IDLE' : 'SIGNED_OUT');
  }, [resetUi, user]);

  return {
    recorderState,
    recordingSeconds,
    recorderErrorMessage,
    notice,
    isBusy,
    recordButtonState,
    recordDisabled,
    combinedTranscript,
    shouldShowTranscript,
    handleRecordButtonClick,
    handleRetry,
  };
}
