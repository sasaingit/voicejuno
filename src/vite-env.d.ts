/// <reference types="vite/client" />

// App-specific typing for Vite env variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Add more VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
