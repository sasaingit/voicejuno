import type { Entry } from '../../types/entry';
import { formatEntryTimestamp } from '../../utils/time';

type EntriesListProps = {
  entries: Entry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: Entry) => void;
};

export default function EntriesList({ entries, selectedEntryId, onSelectEntry }: EntriesListProps) {
  return (
    <div className="entriesList">
      {entries.map((entry) => {
        const isSelected = entry.id === selectedEntryId;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelectEntry(entry)}
            aria-current={isSelected ? 'true' : undefined}
            className="entryListItem"
          >
            <div className="entryListMeta">{formatEntryTimestamp(entry.recorded_at)}</div>
            <div className="entryListTitle">{entry.title}</div>
          </button>
        );
      })}
    </div>
  );
}
