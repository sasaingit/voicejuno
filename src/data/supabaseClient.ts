import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read required environment variables from Vite's import.meta.env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const IS_DEV = import.meta.env.DEV as boolean;

function validateEnv(name: string, value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Missing required env var: ${name}.\n` +
        'Create a .env.local file in the project root with:\n' +
        'VITE_SUPABASE_URL=your_supabase_project_url\n' +
        'VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n' +
        '\nTip: In Vite, env vars must be prefixed with VITE_ to be exposed to the client.'
    );
  }
}

validateEnv('VITE_SUPABASE_URL', SUPABASE_URL);
validateEnv('VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);

// In non-local (production) builds, enforce HTTPS for the Supabase URL to avoid mixed content
if (!IS_DEV) {
  const url = String(SUPABASE_URL);
  if (!url.startsWith('https://')) {
    throw new Error(
      'Invalid VITE_SUPABASE_URL for production: must start with https://.\n' +
        `Current value: ${url} \n` +
        'Update your environment to use the HTTPS project URL from Supabase.'
    );
  }
}

// Initialize and export a singleton Supabase client
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY!
);
