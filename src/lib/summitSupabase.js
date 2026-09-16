import { createClient } from '@supabase/supabase-js'

// Summit uses its own Supabase project so the existing American Spaces
// application backend is never replaced or re-pointed.
const SUPABASE_URL = import.meta.env.VITE_SUMMIT_SUPABASE_URL
const SUPABASE_KEY =
  import.meta.env.VITE_SUMMIT_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUMMIT_SUPABASE_PUBLISHABLE_KEY

export const summitSupabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null

export const summitBackendEnabled = Boolean(summitSupabase)
