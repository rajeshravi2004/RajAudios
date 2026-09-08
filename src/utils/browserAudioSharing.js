const pause = () => new Promise(resolve => setTimeout(resolve, 200))
const idle = message => ({ active: false, outputs: [], mono: true, message })

export function createBrowserAudioSharing() {
  const supported = Boolean(window.isSecureContext && navigator.mediaDevices?.getDisplayMedia
    && navigator.mediaDevices?.setCaptureHandleConfig && globalThis.AudioContext?.prototype.setSinkId
    && globalThis.MediaStreamTrack?.prototype.getCaptureHandle
    && navigator.mediaDevices?.getSupportedConstraints().suppressLocalAudioPlayback && globalThis.BroadcastChannel)
  let nextHandle = supported ? crypto.randomUUID() : ''
  let session = null
  let generation = 0
  const stop = () => {
    generation++
    window.removeEventListener('pagehide', stop)
    if (session) {
      session.channel.postMessage({ type: 'stop' })
      session.channel.close()
      for (const pending of session.pending.values()) pending.reject(new Error('Audio sharing stopped.'))
      session = null
    }
    if (supported) navigator.mediaDevices.setCaptureHandleConfig({})
    return idle('')
  }
  const request = (current, method, value) => new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      current.pending.delete(id)
      reject(new Error('The audio tab is not responding. Start sharing again.'))
    }, 15000)
    current.pending.set(id, {
      resolve: result => { clearTimeout(timer); resolve(result) },
      reject: error => { clearTimeout(timer); reject(error) },
    })
    current.channel.postMessage({ type: 'request', id, method, value })
  })

  return {
    supported,
    browser: true,
    get setupUrl() {
      const url = new URL('audio-sharing.html', document.baseURI)
      url.hash = nextHandle
      return url.href
    },
    async devices() {
      // Only called by the explicit Find/Refresh button, after explaining the
      // permission. Chrome uses mic permission to reveal all output devices.
      if (navigator.mediaDevices.selectAudioOutput) {
        await navigator.mediaDevices.selectAudioOutput()
      } else {
        const permission = await navigator.permissions.query({ name: 'microphone' })
        if (permission.state !== 'granted') {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audiooutput' && device.deviceId
        && !['default', 'communications'].includes(device.deviceId))
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Audio output ${index + 1}` }))
    },
    async start(options) {
      stop()
      const ticket = generation
      // The Sync & play anchor opens the tab natively after this click handler.
      // Connect by a private session channel, never by window.open or opener.
      const handle = nextHandle
      nextHandle = crypto.randomUUID()
      navigator.mediaDevices.setCaptureHandleConfig({ handle, exposeOrigin: true, permittedOrigins: [location.origin] })
      try {
        const current = { channel: new BroadcastChannel(`rajify-audio-${handle}`), pending: new Map(), ready: false,
          status: { ...idle(''), waiting: true } }
        session = current
        current.channel.onmessage = ({ data }) => {
          if (ticket !== generation) return
          if (data.type === 'ready') current.channel.postMessage({ type: 'prepare', options, handle })
          if (data.type === 'heartbeat') current.channel.postMessage({ type: 'alive' })
          if (data.type === 'status') { current.ready = true; current.status = data.status }
          if (data.type === 'result') {
            const pending = current.pending.get(data.id)
            current.pending.delete(data.id)
            if (data.error) pending?.reject(new Error(data.error))
            else pending?.resolve(data.result)
          }
        }
        window.addEventListener('pagehide', stop)
        const deadline = Date.now() + 15000
        while (ticket === generation) {
          if (!current.ready && Date.now() > deadline) {
            throw new Error('The audio tab did not connect. Reload Rajify, then click Sync & play again.')
          }
          const status = current.status
          if (status.active) return status
          if (!status.waiting) throw new Error(status.message || 'Sharing could not start.')
          await pause()
        }
        throw new Error('Audio setup was cancelled.')
      } catch (error) {
        if (ticket === generation) stop()
        throw error
      }
    },
    async status() {
      if (!session) return idle('Sharing stopped. Normal playback has been restored.')
      if (!session.status.waiting && !session.status.active) return session.status
      return request(session, 'status')
    },
    async update(options) {
      if (!session) throw new Error('The audio tab closed. Start sharing again.')
      return request(session, 'update', options)
    },
    async stop() { return stop() },
  }
}
