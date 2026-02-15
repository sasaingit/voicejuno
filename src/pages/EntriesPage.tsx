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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Entries</h1>
        <button type="button" onClick={() => navigate(ROUTES.app)} aria-label="Close">
          X
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 12,
          padding: 12,
          maxWidth: 1100,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ overflow: 'auto', paddingRight: 4 }}>
          {status === 'idle' || status === 'loading' ? (
            <div style={{ color: 'var(--muted)' }}>Loading…</div>
          ) : status === 'error' ? (
            <div style={{ color: 'var(--muted)' }}>{errorMessage ?? 'Loading entries failed.'}</div>
          ) : entries.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No entries yet.</div>
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
