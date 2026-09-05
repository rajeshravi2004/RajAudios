/**
 * settingsStore.js — App settings context
 * Persisted to IndexedDB via storage.js
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { settingsStorage } from '../utils/storage.js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from './authStore.jsx'

const SettingsContext = createContext(null)

export const LANGUAGES = [
  { value: 'tamil', label: 'Tamil', flag: '🇮🇳' },
  { value: 'hindi', label: 'Hindi', flag: '🇮🇳' },
  { value: 'english', label: 'English', flag: '🌐' },
  { value: 'telugu', label: 'Telugu', flag: '🇮🇳' },
  { value: 'malayalam', label: 'Malayalam', flag: '🇮🇳' },
  { value: 'kannada', label: 'Kannada', flag: '🇮🇳' },
  { value: 'bengali', label: 'Bengali', flag: '🇮🇳' },
  { value: 'marathi', label: 'Marathi', flag: '🇮🇳' },
  { value: 'punjabi', label: 'Punjabi', flag: '🇮🇳' },
  { value: 'gujarati', label: 'Gujarati', flag: '🇮🇳' },
  { value: 'urdu', label: 'Urdu', flag: '🇵🇰' },
  { value: 'korean', label: 'Korean', flag: '🇰🇷' },
  { value: 'japanese', label: 'Japanese', flag: '🇯🇵' },
  { value: 'spanish', label: 'Spanish', flag: '🇪🇸' },
  { value: 'french', label: 'French', flag: '🇫🇷' },
  { value: 'arabic', label: 'Arabic', flag: '🇸🇦' },
  { value: 'portuguese', label: 'Portuguese', flag: '🇧🇷' },
  { value: 'german', label: 'German', flag: '🇩🇪' },
  { value: 'italian', label: 'Italian', flag: '🇮🇹' },
  { value: 'chinese', label: 'Chinese', flag: '🇨🇳' },
]

const DEFAULT_SETTINGS = {
  language: 'tamil',
  region: 'IN',
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  autoplay: true,
  contentFilterStrength: 'moderate',
  theme: 'dark',
  saveHistory: true,
  personalizedRecommendations: true,
}

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('local')

  // Load from storage on mount
  useEffect(() => {
    settingsStorage.get().then(saved => {
      setSettingsState(prev => ({ ...prev, ...saved }))
      setLoaded(true)
    })
  }, [])

  // Pull the signed-in user's preferences once local settings are available.
  useEffect(() => {
    if (!loaded || !user || !supabase) {
      if (loaded && !user) setCloudStatus('local')
      return
    }

    let active = true
    setCloudStatus('syncing')
    supabase
      .from('user_preferences')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return
        if (error) {
          console.warn('Cloud preferences are unavailable:', error.message)
          setCloudStatus('error')
          return
        }
        if (data?.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings }
          setSettingsState(merged)
          await settingsStorage.set(merged)
        } else {
          await supabase.from('user_preferences').upsert({
            user_id: user.id,
            settings,
            updated_at: new Date().toISOString(),
          })
        }
        if (active) setCloudStatus('synced')
      })

    return () => { active = false }
  }, [loaded, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSettings = useCallback((updates) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      settingsStorage.set(next)
      if (user && supabase) {
        setCloudStatus('syncing')
        supabase.from('user_preferences').upsert({
          user_id: user.id,
          settings: next,
          updated_at: new Date().toISOString(),
        }).then(({ error }) => setCloudStatus(error ? 'error' : 'synced'))
      }
      return next
    })
  }, [user])

  const resetSettings = useCallback(async () => {
    await settingsStorage.set(DEFAULT_SETTINGS)
    setSettingsState(DEFAULT_SETTINGS)
    if (user && supabase) {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        settings: DEFAULT_SETTINGS,
        updated_at: new Date().toISOString(),
      })
      setCloudStatus(error ? 'error' : 'synced')
    }
  }, [user])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, loaded, cloudStatus }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
