import { useCallback, useEffect, useState } from 'react';
import { createEntry, listEntries } from '../data/entries.api';
import type { Entry, EntryCreate } from '../types/entry';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

type EntriesListState = {
  entries: Entry[];
  status: AsyncStatus;
  errorMessage: string | null;
};

export function useEntriesList() {
  const [state, setState] = useState<EntriesListState>({
    entries: [],
    status: 'idle',
    errorMessage: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading', errorMessage: null }));

    const result = await listEntries();
    if (result.error) {
      setState((prev) => ({ ...prev, status: 'error', errorMessage: result.error.message }));
      return;
    }

    setState({ entries: result.data, status: 'success', errorMessage: null });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    entries: state.entries,
    status: state.status,
    errorMessage: state.errorMessage,
    reload,
  };
}

type CreateEntryState = {
  status: AsyncStatus;
  errorMessage: string | null;
};

export function useCreateEntry() {
  const [state, setState] = useState<CreateEntryState>({
    status: 'idle',
    errorMessage: null,
  });

  const create = useCallback(async (input: EntryCreate) => {
    setState({ status: 'loading', errorMessage: null });

    const result = await createEntry(input);
    if (result.error) {
      setState({ status: 'error', errorMessage: result.error.message });
      return { entry: null, error: result.error } as const;
    }

    setState({ status: 'success', errorMessage: null });
    return { entry: result.data, error: null } as const;
  }, []);

  return {
    status: state.status,
    errorMessage: state.errorMessage,
    create,
  };
}
