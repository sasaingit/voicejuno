import type { Entry } from '../../types/entry';
import { formatEntryTimestamp } from '../../utils/time';

type EntryEditorProps = {
  entry: Entry | null;
};

export default function EntryEditor({ entry }: EntryEditorProps) {
  if (!entry) {
    return (
      <div className="entryEditor">
        <div className="muted">Select an entry from the list.</div>
      </div>
    );
  }

  return (
    <div className="entryEditor">
      <div className="entryListMeta">{formatEntryTimestamp(entry.recorded_at)}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{entry.title}</div>
      <div className="entryTranscript">
        {entry.transcript}
      </div>
    </div>
  );
}
