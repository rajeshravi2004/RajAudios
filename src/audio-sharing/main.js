import { AudioRouter, validateShareOptions } from '../../electron/audio-router.js'
import { captureRajifyAudio } from './capture.js'
import './style.css'

const router = new AudioRouter()
const startButton = document.querySelector('#start')
const stopButton = document.querySelector('#stop')
const statusText = document.querySelector('#status')
let setup = null
let waiting = true
let stopped = false
let message = ''

const stop = () => {
  stopped = true
  waiting = false
  void router.stop()
}

window.rajifyAudio = (method, value) => {
  if (!window.opener || window.opener.closed || window.opener.location.origin !== location.origin) {
    throw new Error('Open audio sharing from the Rajify music tab.')
  }
  if (method === 'prepare' && !setup) {
    setup = { options: validateShareOptions(value.options), handle: value.handle }
    document.querySelector('#devices').textContent = `${setup.options.outputs.length} selected outputs. Ready to sync your music.`
    startButton.disabled = false
    statusText.textContent = 'Your browser will ask which tab to share.'
    return
  }
  if (method === 'status') return { ...router.status(), waiting, message: message || router.message }
  if (method === 'update') return router.update(value)
  throw new Error('Unknown audio action.')
}

startButton.addEventListener('click', async () => {
  if (!setup || stopped) return
  startButton.disabled = true
  statusText.textContent = 'Choose the Rajify music tab and enable Share tab audio.'
  let stream
  try {
    const captured = await captureRajifyAudio(setup.handle)
    stream = captured.stream
    const { video, isSource } = captured
    if (stopped) throw new Error('Sharing was cancelled.')
    video.addEventListener('capturehandlechange', () => {
      if (!isSource()) { message = 'The source tab changed. Start sharing again.'; stop() }
    })
    await router.start(setup.options, stream)
    if (stopped) { await router.stop(); return }
    waiting = false
    statusText.textContent = 'Sharing is on. Return to Rajify to play, pause, or adjust timing. Keep this window open.'
    stopButton.textContent = 'Stop sharing & close'
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop())
    await router.stop()
    waiting = false
    message = error.name === 'NotAllowedError' ? 'Tab sharing was cancelled or blocked. Click Sync & play to try again.' : error.message
    statusText.textContent = message
  }
})

stopButton.addEventListener('click', () => { stop(); window.close() })
window.addEventListener('pagehide', stop)
setInterval(() => {
  if (!window.opener || window.opener.closed) { stop(); window.close(); return }
  if (!waiting && !router.active) statusText.textContent = message || router.message || 'Sharing stopped. Return to Rajify to start again.'
}, 1000)
