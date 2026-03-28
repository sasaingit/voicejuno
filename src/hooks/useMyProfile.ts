import { useEffect, useState } from 'react';
import { fetchMyProfile } from '../data/profiles.api';
import type { Profile } from '../types/profile';

type MyProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; profile: Profile }
  | { status: 'error'; message: string };

const ERROR_MESSAGES = Object.freeze({
  loadFailed: 'Failed to load profile.',
});

export function useMyProfile(options: { enabled: boolean }) {
  const [state, setState] = useState<MyProfileState>({ status: 'idle' });

  useEffect(() => {
    if (!options.enabled) {
      setState({ status: 'idle' });
      return;
    }

    let active = true;
    setState({ status: 'loading' });

    async function run() {
      const result = await fetchMyProfile();
      if (!active) return;

      if (result.error) {
        setState({ status: 'error', message: result.error.message || ERROR_MESSAGES.loadFailed });
        return;
      }

      setState({ status: 'success', profile: result.data });
    }

    void run();
    return () => {
      active = false;
    };
  }, [options.enabled]);

  return state;
}
