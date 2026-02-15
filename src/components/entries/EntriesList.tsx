import type { Entry } from '../../types/entry';
import { formatEntryTimestamp } from '../../utils/time';

type EntriesListProps = {
  entries: Entry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: Entry) => void;
};

export default function EntriesList({ entries, selectedEntryId, onSelectEntry }: EntriesListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry) => {
        const isSelected = entry.id === selectedEntryId;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelectEntry(entry)}
            aria-current={isSelected ? 'true' : undefined}
            style={{
              textAlign: 'left',
              padding: 12,
              borderRadius: 12,
              border: '1px solid #374151',
              background: isSelected ? '#111827' : '#0f172a',
            }}
          >
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{formatEntryTimestamp(entry.recorded_at)}</div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{entry.title}</div>
          </button>
        );
      })}
    </div>
  );
}
