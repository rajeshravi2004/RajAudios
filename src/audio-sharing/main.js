import { AudioRouter, validateShareOptions } from '../../electron/audio-router.js'
import { captureRajifyAudio } from './capture.js'
import './style.css'

const router = new AudioRouter()
const startButton = document.querySelector('#start')
const stopButton = document.querySelector('#stop')
const statusText = document.querySelector('#status')
const handle = location.hash.slice(1)
const channel = /^[\da-f-]{36}$/i.test(handle) && globalThis.BroadcastChannel
  ? new BroadcastChannel(`rajify-audio-${handle}`) : null
let setup = null
let waiting = true
let stopped = false
let message = ''
let lastSeen = Date.now()
let timer

const status = () => ({ ...router.status(), waiting, message: message || router.message })
const publish = () => channel?.postMessage({ type: 'status', status: status() })
const stop = () => {
  if (stopped) return
  stopped = true
  waiting = false
  clearInterval(timer)
  void router.stop()
  message ||= 'The audio tab closed. Normal playback has been restored.'
  publish()
  channel?.close()
}

if (channel) {
  channel.onmessage = async ({ data }) => {
    if (stopped) return
    lastSeen = Date.now()
    if (data.type === 'stop') { stop(); window.close(); return }
    if (data.type === 'prepare' && !setup) {
      try {
        if (data.handle !== handle) throw new Error('This audio session does not match. Start sharing again.')
        setup = { options: validateShareOptions(data.options), handle }
        document.querySelector('#devices').textContent = `${setup.options.outputs.length} selected outputs. Ready to sync your music.`
        startButton.disabled = false
        statusText.textContent = 'Click Share Rajify audio to choose your music tab.'
        publish()
      } catch (error) {
        message = error.message
        stop()
        window.close()
      }
    }
    if (data.type === 'request' && setup) {
      try {
        let result
        if (data.method === 'status') result = status()
        else if (data.method === 'update') result = await router.update(data.value)
        else throw new Error('Unknown audio action.')
        if (!stopped) channel.postMessage({ type: 'result', id: data.id, result })
      } catch (error) {
        if (!stopped) channel.postMessage({ type: 'result', id: data.id, error: error.message })
      }
    }
  }
  channel.postMessage({ type: 'ready' })
  timer = setInterval(() => {
    // Allow for background-tab timer throttling; ended capture also stops the router.
    if (Date.now() - lastSeen > (setup ? 90000 : 15000)) {
      message = 'The music tab is no longer connected. Return to Rajify and start sharing again.'
      stop()
      statusText.textContent = message
      startButton.disabled = true
      window.close()
      return
    }
    channel.postMessage({ type: setup ? 'heartbeat' : 'ready' })
    if (setup && !waiting && !router.active) {
      publish()
      statusText.textContent = message || router.message || 'Sharing stopped. Return to Rajify to start again.'
    }
  }, 1000)
} else {
  statusText.textContent = 'Open Settings in Rajify and click Sync & play to connect this tab.'
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
    publish()
    statusText.textContent = 'Sharing is on. Return to your Rajify music tab to play, pause, or adjust timing. Keep this audio tab open.'
    stopButton.textContent = 'Stop sharing & close'
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop())
    await router.stop()
    if (stopped) return
    waiting = false
    message = error.name === 'NotAllowedError' ? 'Tab sharing was cancelled or blocked. Click Sync & play to try again.' : error.message
    statusText.textContent = message
    publish()
  }
})

stopButton.addEventListener('click', () => { stop(); window.close() })
window.addEventListener('pagehide', stop)
