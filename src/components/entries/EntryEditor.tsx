import type { Entry } from '../../types/entry';
import { formatEntryTimestamp } from '../../utils/time';

type EntryEditorProps = {
  entry: Entry | null;
};

export default function EntryEditor({ entry }: EntryEditorProps) {
  if (!entry) {
    return (
      <div
        style={{
          height: '100%',
          border: '1px solid #374151',
          borderRadius: 12,
          padding: 16,
          background: '#0f172a',
        }}
      >
        <div style={{ color: 'var(--muted)' }}>Select an entry from the list.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        border: '1px solid #374151',
        borderRadius: 12,
        padding: 16,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{formatEntryTimestamp(entry.recorded_at)}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{entry.title}</div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
          color: 'var(--fg)',
          opacity: 0.95,
          overflow: 'auto',
        }}
      >
        {entry.transcript}
      </div>
    </div>
  );
}
