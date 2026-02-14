type TranscriptViewProps = {
  finalTranscript: string;
  interimTranscript: string;
};

export default function TranscriptView({ finalTranscript, interimTranscript }: TranscriptViewProps) {
  const text = `${finalTranscript}${interimTranscript}`.trim();

  return (
    <div
      style={{
        width: '100%',
        minHeight: 120,
        border: '1px solid #374151',
        borderRadius: 12,
        padding: 12,
        background: '#0f172a',
        color: 'var(--fg)',
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
      }}
    >
      {text.length > 0 ? text : <span style={{ color: 'var(--muted)' }}>Start recording to see transcript…</span>}
    </div>
  );
}
