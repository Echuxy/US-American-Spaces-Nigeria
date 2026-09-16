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
        // Participant pages do not require an auth session, while the
        // dedicated coordinator Control Room does. Persisting the session
        // keeps the coordinator signed in across page refreshes.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export const summitBackendEnabled = Boolean(summitSupabase)

export function getSummitDeviceId() {
  if (typeof window === 'undefined') return 'server'
  const key = 'summit2026-device-id'
  let value = window.localStorage.getItem(key)
  if (!value) {
    value = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(key, value)
  }
  return value
}
