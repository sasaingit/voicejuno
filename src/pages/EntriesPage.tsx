import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EntriesList from '../components/entries/EntriesList';
import EntryEditor from '../components/entries/EntryEditor';
import { listEntries } from '../data/entries.api';
import type { Entry } from '../types/entry';

export default function EntriesPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setErrorMessage(null);

      try {
        const data = await listEntries();
        if (cancelled) return;
        setEntries(data);
        setStatus('success');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Loading entries failed.';
        setErrorMessage(message);
        setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

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
        <button type="button" onClick={() => navigate('/app')} aria-label="Close">
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
          {status === 'loading' ? (
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
