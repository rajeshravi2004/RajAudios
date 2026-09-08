import { AudioRouter } from './audio-router.js'

const router = new AudioRouter()
// Main process executes only this fixed allowlist; no Node APIs or preload are
// exposed to this window. State is intentionally session-only.
window.rajifyAudio = async (method, value) => {
  if (!['devices', 'start', 'stop', 'status', 'update'].includes(method)) throw new Error('Unknown audio action.')
  return router[method](value)
}
