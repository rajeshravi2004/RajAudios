import { useSyncExternalStore } from 'react'

let sessionApiKey = ''
const listeners = new Set()

const emitChange = () => listeners.forEach(listener => listener())

export const getSessionApiKey = () => sessionApiKey

export const setSessionApiKey = (apiKey) => {
  sessionApiKey = apiKey.trim()
  emitChange()
}

export const clearSessionApiKey = () => {
  sessionApiKey = ''
  emitChange()
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSessionApiKey = () => useSyncExternalStore(
  subscribe,
  getSessionApiKey,
  () => '',
)

export const testYouTubeApiKey = async (apiKey) => {
  const response = await fetch('https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ', {
    headers: { 'x-goog-api-key': apiKey.trim() },
  })
  if (response.ok) return { valid: true }
  const body = await response.json().catch(() => ({}))
  return {
    valid: false,
    message: body?.error?.message || `YouTube returned HTTP ${response.status}.`,
  }
}
