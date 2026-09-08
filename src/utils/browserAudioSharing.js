const pause = () => new Promise(resolve => setTimeout(resolve, 200))
const idle = message => ({ active: false, outputs: [], mono: true, message })

export function createBrowserAudioSharing() {
  const supported = Boolean(window.isSecureContext && navigator.mediaDevices?.getDisplayMedia
    && navigator.mediaDevices?.setCaptureHandleConfig && globalThis.AudioContext?.prototype.setSinkId
    && globalThis.MediaStreamTrack?.prototype.getCaptureHandle
    && navigator.mediaDevices?.getSupportedConstraints().suppressLocalAudioPlayback)
  let helper = null
  let generation = 0
  const stop = () => {
    generation++
    window.removeEventListener('pagehide', stop)
    if (helper && !helper.closed) helper.close()
    helper = null
    if (supported) navigator.mediaDevices.setCaptureHandleConfig({})
    return idle('')
  }

  return {
    supported,
    browser: true,
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
      const handle = crypto.randomUUID()
      navigator.mediaDevices.setCaptureHandleConfig({ handle, exposeOrigin: true, permittedOrigins: [location.origin] })
      // Open synchronously in the click event, before awaiting anything.
      helper = window.open(new URL('audio-sharing.html', document.baseURI), `rajify-audio-${handle}`, 'popup,width=540,height=650')
      if (!helper) {
        stop()
        throw new Error('Allow pop-ups for Rajify, then click Sync & play again.')
      }
      const current = helper
      window.addEventListener('pagehide', stop)
      try {
        const deadline = Date.now() + 30000
        while (!current.rajifyAudio) {
          if (current.closed || ticket !== generation) throw new Error('Audio setup was closed. Click Sync & play to try again.')
          if (Date.now() > deadline) throw new Error('The audio window could not load. Please try again.')
          await pause()
        }
        current.rajifyAudio('prepare', { options, handle })
        while (ticket === generation && !current.closed) {
          const status = current.rajifyAudio('status')
          if (status.active) return status
          if (!status.waiting) throw new Error(status.message || 'Sharing could not start.')
          await pause()
        }
        throw new Error('Audio setup was closed. Click Sync & play to try again.')
      } catch (error) {
        if (ticket === generation) stop()
        throw error
      }
    },
    async status() {
      return helper && !helper.closed ? helper.rajifyAudio('status') : idle('The audio window closed. Normal playback has been restored.')
    },
    async update(options) {
      if (!helper || helper.closed) throw new Error('The audio window closed. Start sharing again.')
      return helper.rajifyAudio('update', options)
    },
    async stop() { return stop() },
  }
}
