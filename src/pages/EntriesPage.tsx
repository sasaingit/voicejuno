import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EntriesList from '../components/entries/EntriesList';
import EntryEditor from '../components/entries/EntryEditor';
import { useEntriesList } from '../hooks/useEntries';

const ROUTES = Object.freeze({
  app: '/app',
});

export default function EntriesPage() {
  const navigate = useNavigate();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const { entries, status, errorMessage } = useEntriesList();

  const selectedEntry = selectedEntryId ? (entries.find((entry) => entry.id === selectedEntryId) ?? null) : null;

  return (
    <div className="entriesPage">
      <div className="entriesHeader">
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Entries</h1>
        <button type="button" onClick={() => navigate(ROUTES.app)} aria-label="Close">
          X
        </button>
      </div>

      <div className="entriesGrid">
        <div className="entriesListPane">
          {status === 'idle' || status === 'loading' ? (
            <div className="muted">Loading…</div>
          ) : status === 'error' ? (
            <div className="muted">{errorMessage ?? 'Loading entries failed.'}</div>
          ) : entries.length === 0 ? (
            <div className="muted">No entries yet.</div>
          ) : (
            <EntriesList
              entries={entries}
              selectedEntryId={selectedEntryId}
              onSelectEntry={(entry) => setSelectedEntryId(entry.id)}
            />
          )}
        </div>

        <EntryEditor entry={selectedEntry} />
      </div>
    </div>
  );
}
