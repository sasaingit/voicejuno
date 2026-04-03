import { useEffect, useState } from 'react';
import { fetchMyAccount } from '../data/accounts.api';
import type { Account } from '../types/account';

type MyAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; account: Account }
  | { status: 'error'; message: string };

const ERROR_MESSAGES = Object.freeze({
  loadFailed: 'Failed to load account.',
});

export function useMyAccount(options: { enabled: boolean }) {
  const [state, setState] = useState<MyAccountState>({ status: 'idle' });

  useEffect(() => {
    if (!options.enabled) {
      setState({ status: 'idle' });
      return;
    }

    let active = true;
    setState({ status: 'loading' });

    async function run() {
      const result = await fetchMyAccount();
      if (!active) return;

      if (result.error) {
        setState({ status: 'error', message: result.error.message || ERROR_MESSAGES.loadFailed });
        return;
      }

      setState({ status: 'success', account: result.data });
    }

    void run();
    return () => {
      active = false;
    };
  }, [options.enabled]);

  return state;
}
