import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || ''

const getProfile = (user) => ({
  name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Listener',
  email: user?.email || '',
  avatarUrl: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '',
})

const syncProfile = async (user) => {
  if (!supabase || !user) return
  const profile = getProfile(user)
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: profile.name,
    avatar_url: profile.avatarUrl || null,
    updated_at: new Date().toISOString(),
  })
  if (error) console.warn('Profile sync is unavailable:', error.message)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [guestMode, setGuestMode] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) setAuthError(error.message)
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) syncProfile(data.session.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (event === 'SIGNED_IN' && nextSession?.user) {
        setGuestMode(false)
        setTimeout(() => syncProfile(nextSession.user), 0)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setAuthError('Cloud sign-in has not been configured for this deployment.')
      return
    }
    setAuthError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setAuthError(error.message)
  }, [])

  const signOut = useCallback(async () => {
    setAuthError('')
    setGuestMode(false)
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(error.message)
  }, [])

  const continueAsGuest = useCallback(() => {
    setAuthError('')
    setGuestMode(true)
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile: getProfile(session?.user),
    loading,
    authError,
    guestMode,
    isConfigured: isSupabaseConfigured,
    isAdmin: Boolean(session?.user?.email && session.user.email.toLowerCase() === adminEmail),
    signInWithGoogle,
    signOut,
    continueAsGuest,
  }), [session, loading, authError, guestMode, signInWithGoogle, signOut, continueAsGuest])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
