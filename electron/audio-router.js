// Runs only in the dedicated audio window. Playback must stay outside the
// captured window: routing a tab's capture back into itself causes feedback.
export const MAX_OUTPUTS = 8
// Ask for render buffering, rather than delaying already-rendered audio. This
// gives the browser more scheduling headroom at the cost of ~120 ms latency.
export const OUTPUT_BUFFER_SECONDS = 0.12

export function validateShareOptions(value) {
  if (!value || typeof value.mono !== 'boolean' || !Array.isArray(value.outputs)
    || value.outputs.length < 1 || value.outputs.length > MAX_OUTPUTS) {
    throw new Error(`Choose between 1 and ${MAX_OUTPUTS} audio outputs.`)
  }
  const ids = new Set()
  const outputs = value.outputs.map(output => {
    if (!output || typeof output.deviceId !== 'string' || !output.deviceId
      || output.deviceId.length > 512 || ['default', 'communications'].includes(output.deviceId)
      || ids.has(output.deviceId)) throw new Error('Choose distinct, specific audio outputs.')
    ids.add(output.deviceId)
    if (!Number.isFinite(output.volume) || output.volume < 0 || output.volume > 1
      || !Number.isFinite(output.delayMs) || output.delayMs < 0 || output.delayMs > 500) {
      throw new Error('Volume must be 0–100% and extra delay must be 0–500 ms.')
    }
    return { deviceId: output.deviceId, volume: output.volume, delayMs: output.delayMs }
  })
  return { mono: value.mono, outputs }
}

export class AudioRouter {
  constructor() {
    this.outputs = []
    this.stream = null
    this.active = false
    this.message = ''
    this.generation = 0
    this.mono = true
    navigator.mediaDevices?.addEventListener('devicechange', () => {
      void this.checkDevices().catch(() => this.fail('Audio devices could not be checked.'))
    })
  }

  async devices() {
    if (!navigator.mediaDevices?.getDisplayMedia || !globalThis.AudioContext?.prototype.setSinkId) {
      throw new Error('This desktop runtime does not support shared audio.')
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    // Default and communications are aliases, not additional physical outputs.
    return devices.filter(device => device.kind === 'audiooutput' && device.deviceId
      && !['default', 'communications'].includes(device.deviceId))
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Audio output ${index + 1}` }))
  }

  status() {
    return { active: this.active, mono: this.mono, message: this.message,
      outputs: this.outputs.map(({ deviceId, volume, delayMs }) => ({ deviceId, volume, delayMs })) }
  }

  async start(value, capturedStream = null) {
    const options = validateShareOptions(value)
    await this.stop()
    this.message = ''
    const generation = this.generation
    const pending = []
    let stream = capturedStream
    try {
      const available = await this.devices()
      if (options.outputs.some(output => !available.some(device => device.deviceId === output.deviceId))) {
        throw new Error('An output is no longer available. Connect it and refresh devices.')
      }
      // Open every sink before muting the original player. A partial start must
      // never leave only some friends listening or leave the player silent.
      for (const output of options.outputs) {
        const context = new AudioContext({ latencyHint: OUTPUT_BUFFER_SECONDS })
        const item = { ...output, context }
        pending.push(item)
        await context.setSinkId(output.deviceId)
        await context.resume()
        if (context.state !== 'running') throw new Error('An audio output could not start.')
      }
      // Electron grants exactly the Rajify source tab, never system loopback.
      // The video track is required by getDisplayMedia; it is never displayed,
      // recorded or transmitted. Keep it alive for the capture session.
      stream ??= await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: { width: 1, height: 1, frameRate: 1 },
      })
      if (!stream.getAudioTracks().some(track => track.readyState === 'live')) {
        throw new Error('Windows did not provide the player audio. Sharing could not start.')
      }
      if (generation !== this.generation) throw new Error('Sharing was cancelled.')

      this.mono = options.mono
      const latency = context => {
        const seconds = (context.baseLatency || 0) + (context.outputLatency || 0)
        return Number.isFinite(seconds) ? Math.min(2, Math.max(0, seconds)) : 0
      }
      for (const item of pending) item.reportedLatency = latency(item.context)
      const slowest = Math.max(...pending.map(item => item.reportedLatency))
      for (const item of pending) {
        const { context } = item
        item.source = context.createMediaStreamSource(stream)
        item.mix = context.createGain()
        item.mix.channelCountMode = 'explicit'
        item.mix.channelInterpretation = 'speakers'
        item.mix.channelCount = options.mono ? 1 : 2
        // Align reported output buffering first. Bluetooth devices can add
        // unreported latency, so listeners can also adjust each pair manually.
        item.alignmentSeconds = slowest - item.reportedLatency
        item.delay = context.createDelay(3)
        item.gain = context.createGain()
        item.source.connect(item.mix).connect(item.delay).connect(item.gain).connect(context.destination)
        item.gain.gain.value = item.volume
        item.delay.delayTime.value = item.alignmentSeconds + item.delayMs / 1000
      }
      this.outputs = pending
      this.stream = stream
      this.active = true
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => {
          if (generation === this.generation) void this.fail('The audio sharing session ended.')
        }, { once: true })
      }
      for (const item of pending) {
        item.context.addEventListener('statechange', () => {
          if (generation === this.generation && this.active && item.context.state !== 'running') {
            void this.recoverOutput(item, generation)
          }
        })
        item.context.addEventListener('sinkchange', () => {
          if (generation === this.generation && item.context.sinkId !== item.deviceId) {
            void this.fail('An audio output changed. Select your earbuds again.')
          }
        })
      }
      await this.checkDevices()
      return this.status()
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      await Promise.allSettled(pending.map(item => item.context.close()))
      await this.stop()
      this.message = error.message || 'Sharing could not start.'
      throw new Error(this.message)
    }
  }

  async update(value) {
    const options = validateShareOptions(value)
    if (!this.active) throw new Error(this.message || 'Start sharing before adjusting the outputs.')
    if (options.outputs.length !== this.outputs.length
      || options.outputs.some(output => !this.outputs.some(item => item.deviceId === output.deviceId))) {
      throw new Error('Stop sharing before changing the selected devices.')
    }
    this.mono = options.mono
    for (const item of this.outputs) {
      const output = options.outputs.find(value => value.deviceId === item.deviceId)
      const channels = options.mono ? 1 : 2
      if (item.mix.channelCount !== channels) item.mix.channelCount = channels
      if (item.volume !== output.volume) item.gain.gain.setTargetAtTime(output.volume, item.context.currentTime, 0.02)
      if (item.delayMs !== output.delayMs) {
        item.delay.delayTime.setTargetAtTime(item.alignmentSeconds + output.delayMs / 1000, item.context.currentTime, 0.02)
      }
      Object.assign(item, output)
    }
    return this.status()
  }

  async recoverOutput(item, generation) {
    if (item.recovering) return
    item.recovering = true
    let timer
    try {
      // Resume the existing graph and live source; never reopen capture or
      // restart the song for a temporary OS/browser audio interruption.
      if (item.context.state !== 'closed') {
        await Promise.race([
          item.context.resume(),
          new Promise(resolve => { timer = setTimeout(resolve, 2000) }),
        ])
      }
    } catch { /* If resuming is denied, release capture below. */ }
    finally { clearTimeout(timer); item.recovering = false }
    if (generation === this.generation && this.active && item.context.state !== 'running') {
      await this.fail('An audio output could not resume. Start sharing again.')
    }
  }

  async checkDevices() {
    const generation = this.generation
    if (!this.active) return
    const devices = await this.devices()
    if (generation === this.generation && this.outputs.some(output => !devices.some(device => device.deviceId === output.deviceId))) {
      await this.fail('An output disconnected. Reconnect your earbuds and start sharing again.')
    }
  }

  async fail(message) {
    // Preserve the cause immediately: a queued volume update can arrive while
    // contexts are closing and must not replace it with a generic setup error.
    this.message = `${message} Normal playback has been restored.`
    await this.stop()
  }

  async stop() {
    this.generation++
    this.active = false
    const outputs = this.outputs
    this.outputs = []
    // Silence routed outputs before capture ends and unmutes normal playback.
    for (const item of outputs) item.source?.disconnect()
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    await Promise.allSettled(outputs.map(item => item.context.close()))
    return this.status()
  }
}
