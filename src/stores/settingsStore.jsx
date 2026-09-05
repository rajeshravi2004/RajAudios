/**
 * settingsStore.js — App settings context
 * Persisted to IndexedDB via storage.js
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { settingsStorage } from '../utils/storage.js'

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
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  // Load from storage on mount
  useEffect(() => {
    settingsStorage.get().then(saved => {
      setSettingsState(prev => ({ ...prev, ...saved }))
      setLoaded(true)
    })
  }, [])

  const updateSettings = useCallback(async (updates) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      settingsStorage.set(updates) // persist async
      return next
    })
  }, [])

  const resetSettings = useCallback(async () => {
    await settingsStorage.set(DEFAULT_SETTINGS)
    setSettingsState(DEFAULT_SETTINGS)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
