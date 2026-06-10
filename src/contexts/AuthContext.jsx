import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchProfile(uid) {
    // Retry up to 3 times in case of timing issues
    let data, error
    for (let i = 0; i < 3; i++) {
      const result = await supabase
        .from('profiles')
        .select('*, american_spaces(id, name, state, city)')
        .eq('id', uid)
        .single()
      data = result.data
      error = result.error
      if (data && data.role) break
      await new Promise(r => setTimeout(r, 500))
    }
    if (data) setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin'
  const isPAO = profile?.role === 'pao'
  const isSpecialist = profile?.role === 'specialist'
  const isCoordinator = profile?.role === 'coordinator'
  const isSpaceDirector = profile?.role === 'space_director'
  const canReview = ['admin', 'pao', 'specialist', 'coordinator'].includes(profile?.role)

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut,
      isAdmin, isPAO, isSpecialist, isCoordinator, isSpaceDirector, canReview,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)