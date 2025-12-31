// Central app configuration
// Project reference for Supabase (used for Edge Functions URL construction)
export const SUPABASE_PROJECT_REF = 'qxnpspxxcugrifehsifh' as const;

// Base URL for Supabase Edge Functions
export const EDGE_FUNCTIONS_BASE_URL = `https://${SUPABASE_PROJECT_REF}.functions.supabase.co` as const;
