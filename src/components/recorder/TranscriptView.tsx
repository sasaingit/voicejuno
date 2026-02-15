type TranscriptViewProps = {
  finalTranscript: string;
  interimTranscript: string;
};

export default function TranscriptView({ finalTranscript, interimTranscript }: TranscriptViewProps) {
  const text = `${finalTranscript}${interimTranscript}`.trim();

  return (
    <div className="transcriptView">
      {text.length > 0 ? text : <span className="transcriptPlaceholder">Start recording to see transcript…</span>}
    </div>
  );
}
