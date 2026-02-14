import { useCallback, useMemo, useRef, useState } from 'react';

export type SpeechStatus = 'idle' | 'recording' | 'error';

export type UseSpeechRecognition = {
  isSupported: boolean;
  status: SpeechStatus;
  finalTranscript: string;
  interimTranscript: string;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

const DEFAULTS = Object.freeze({
  lang: 'en-AU',
});

const ERROR_MESSAGES = Object.freeze({
  unsupported: 'Speech recognition not supported in this browser. Please use Chrome.',
  permissionDenied: 'Microphone permission denied.',
  micUnavailable: 'Microphone not available.',
  noSpeech: 'No speech detected.',
  network: 'Network error — please try again.',
  stoppedUnexpectedly: 'Recognition stopped unexpectedly.',
  generic: 'Recognition error — please try again.',
});

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  item: (index: number) => SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;

  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapSpeechError(code: string | undefined): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return ERROR_MESSAGES.permissionDenied;
  }
  if (code === 'audio-capture') {
    return ERROR_MESSAGES.micUnavailable;
  }
  if (code === 'no-speech') {
    return ERROR_MESSAGES.noSpeech;
  }
  if (code === 'network') {
    return ERROR_MESSAGES.network;
  }
  if (code === 'aborted') {
    return ERROR_MESSAGES.stoppedUnexpectedly;
  }
  return ERROR_MESSAGES.generic;
}

function normalizeTranscriptChunk(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function useSpeechRecognition(): UseSpeechRecognition {
  const ctor = useMemo(() => getSpeechRecognitionConstructor(), []);
  const isSupported = !!ctor;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stopRequestedRef = useRef(false);
  const statusRef = useRef<SpeechStatus>('idle');

  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    statusRef.current = 'idle';
    try {
      recognitionRef.current?.stop();
    } finally {
      recognitionRef.current = null;
      setInterimTranscript('');
      setStatus('idle');
    }
  }, []);

  const reset = useCallback(() => {
    stopRequestedRef.current = true;
    statusRef.current = 'idle';
    try {
      recognitionRef.current?.stop();
    } finally {
      recognitionRef.current = null;
      setFinalTranscript('');
      setInterimTranscript('');
      setErrorMessage(null);
      setStatus('idle');
    }
  }, []);

  const start = useCallback(() => {
    if (!ctor) {
      setErrorMessage(ERROR_MESSAGES.unsupported);
      setStatus('error');
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    stopRequestedRef.current = false;
    statusRef.current = 'recording';
    setErrorMessage(null);
    setStatus('recording');

    const recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = DEFAULTS.lang;

    recognition.onresult = (event) => {
      let nextFinal = '';
      let nextInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result.item(0);
        const chunk = normalizeTranscriptChunk(alt.transcript);
        if (chunk.length === 0) continue;

        if (result.isFinal) {
          nextFinal += `${chunk} `;
        } else {
          nextInterim += `${chunk} `;
        }
      }

      if (nextFinal.length > 0) {
        setFinalTranscript((prev) => {
          const merged = `${prev}${nextFinal}`;
          return merged.replace(/\s+/g, ' ').trimEnd() + ' ';
        });
      }

      setInterimTranscript(nextInterim);
    };

    recognition.onerror = (event) => {
      const message = mapSpeechError(event.error);
      recognitionRef.current = null;
      setErrorMessage(message);
      setStatus('error');
      setInterimTranscript('');
    };

    recognition.onend = () => {
      const stoppedByUser = stopRequestedRef.current;
      recognitionRef.current = null;
      stopRequestedRef.current = false;
      setInterimTranscript('');

      if (!stoppedByUser && statusRef.current === 'recording') {
        setErrorMessage(ERROR_MESSAGES.stoppedUnexpectedly);
        setStatus('error');
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      recognitionRef.current = null;
      statusRef.current = 'error';
      setErrorMessage(e instanceof Error ? e.message : ERROR_MESSAGES.generic);
      setStatus('error');
    }
  }, [ctor]);

  return {
    isSupported,
    status,
    finalTranscript,
    interimTranscript,
    errorMessage,
    start,
    stop,
    reset,
  };
}
