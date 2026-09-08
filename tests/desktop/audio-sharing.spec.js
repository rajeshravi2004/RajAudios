import { test, expect, _electron as electron } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { validateShareOptions } from '../../electron/audio-router.js'

test('rejects duplicate aliases, invalid gains, and excessive outputs', () => {
  const output = { deviceId: 'headphones', volume: 0.8, delayMs: 0 }
  expect(() => validateShareOptions({ mono: true, outputs: [output, output] })).toThrow()
  expect(() => validateShareOptions({ mono: true, outputs: [{ ...output, deviceId: 'default' }] })).toThrow()
  expect(() => validateShareOptions({ mono: true, outputs: [{ ...output, volume: NaN }] })).toThrow()
  expect(() => validateShareOptions({ mono: true, outputs: [{ ...output, delayMs: -1 }] })).toThrow()
  expect(() => validateShareOptions({ mono: true, outputs: Array.from({ length: 9 }, (_, n) => ({ ...output, deviceId: `${n}` })) })).toThrow()
})

test('desktop bridge routes one source to real outputs and releases capture', async () => {
  test.skip(process.platform !== 'win32', 'Windows desktop integration')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [fileURLToPath(new URL('./fixture-main.cjs', import.meta.url))], env })
  try {
    const page = await app.firstWindow()
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
    await expect.poll(() => page.evaluate(() => Boolean(window.electronAPI?.audioSharing))).toBe(true)
    const devices = await page.evaluate(() => window.electronAPI.audioSharing.devices())
    expect(devices.every(device => !['default', 'communications'].includes(device.deviceId))).toBe(true)
    test.skip(devices.length === 0, 'No physical audio output is available on this test machine')
    const host = (await app.windows()).find(window => window !== page)
    await host.evaluate(() => {
      const NativeContext = window.AudioContext
      window.__outputContexts = []
      window.AudioContext = class extends NativeContext {
        constructor(options) {
          super(options)
          this.__gains = []
          window.__outputContexts.push(this)
        }
        createGain() {
          const gain = super.createGain()
          this.__gains.push(gain)
          return gain
        }
      }
    })
    const options = { mono: true, outputs: devices.slice(0, 2).map(device => ({ deviceId: device.deviceId, volume: 0, delayMs: 0 })) }
    // All output gains stay at zero, so the test does not play sound to the user.
    const started = await page.evaluate(options => window.electronAPI.audioSharing.start(options), options)
    expect(started.active).toBe(true)
    expect(started.outputs).toHaveLength(options.outputs.length)
    const windows = await app.windows()
    expect(windows).toHaveLength(2)
    const check = await host.evaluate(async () => {
      const media = await navigator.mediaDevices.enumerateDevices()
      return { hasRouter: typeof window.rajifyAudio === 'function', outputs: media.filter(device => device.kind === 'audiooutput').length }
    })
    expect(check.hasRouter).toBe(true)

    // Probe the real graph before its zero-volume output gain. Both channels of
    // one stereo WAV must reach each mono earbud output; pause must drain them.
    await host.evaluate(() => {
      window.__probes = window.__outputContexts.map(context => {
        const splitter = context.createChannelSplitter(2)
        const analyser = context.createAnalyser()
        analyser.fftSize = 4096
        analyser.smoothingTimeConstant = 0
        context.__gains[0].connect(splitter)
        splitter.connect(analyser, 0)
        return { analyser, context }
      })
      window.__readSignal = () => window.__probes.map(({ analyser, context }) => {
        const bins = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(bins)
        const peak = hz => {
          const bin = Math.round(hz * analyser.fftSize / context.sampleRate)
          return Math.max(...bins.slice(bin - 2, bin + 3))
        }
        return { left: peak(440), right: peak(880) }
      })
    })
    await page.evaluate(async () => {
      const rate = 48000
      const frames = rate * 2
      const buffer = new ArrayBuffer(44 + frames * 4)
      const data = new DataView(buffer)
      const text = (at, value) => [...value].forEach((char, n) => data.setUint8(at + n, char.charCodeAt(0)))
      text(0, 'RIFF'); data.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE')
      text(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true)
      data.setUint16(22, 2, true); data.setUint32(24, rate, true)
      data.setUint32(28, rate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true)
      text(36, 'data'); data.setUint32(40, frames * 4, true)
      for (let n = 0; n < frames; n++) {
        data.setInt16(44 + n * 4, Math.sin(2 * Math.PI * 440 * n / rate) * 8000, true)
        data.setInt16(46 + n * 4, Math.sin(2 * Math.PI * 880 * n / rate) * 8000, true)
      }
      const player = document.querySelector('video')
      player.src = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
      await player.play()
    })
    await expect.poll(() => host.evaluate(() => window.__readSignal().every(signal => signal.left > -50 && signal.right > -50))).toBe(true)

    const updated = await page.evaluate(options => window.electronAPI.audioSharing.update(options), {
      ...options, mono: false, outputs: options.outputs.map(output => ({ ...output, delayMs: 80 })),
    })
    expect(updated.mono).toBe(false)
    expect(updated.outputs.every(output => output.delayMs === 80)).toBe(true)
    await expect.poll(() => host.evaluate(() => window.__readSignal().every(signal => signal.left > -50 && signal.right < -65))).toBe(true)
    await page.evaluate(() => document.querySelector('video').pause())
    await expect.poll(() => host.evaluate(() => window.__readSignal().every(signal => signal.left < -80 && signal.right < -80))).toBe(true)
    await expect(page.evaluate(options => window.electronAPI.audioSharing.update(options), {
      ...options, outputs: [{ deviceId: 'missing', volume: 0, delayMs: 0 }],
    })).rejects.toThrow('Stop sharing')
    expect((await page.evaluate(() => window.electronAPI.audioSharing.status())).active).toBe(true)
    await page.evaluate(() => window.electronAPI.audioSharing.stop())
    expect((await page.evaluate(() => window.electronAPI.audioSharing.status())).active).toBe(false)
    expect(await app.windows()).toHaveLength(1)

    await expect(page.evaluate(() => window.electronAPI.audioSharing.start({ mono: true,
      outputs: [{ deviceId: 'disconnected', volume: 0, delayMs: 0 }] }))).rejects.toThrow('no longer available')
    expect((await page.evaluate(() => window.electronAPI.audioSharing.status())).active).toBe(false)
    // A failed start is recoverable, and source navigation releases the host.
    await page.evaluate(options => window.electronAPI.audioSharing.start(options), options)
    const reconnectHost = (await app.windows()).find(window => window !== page)
    // A devicechange that removes an output must release every sink and capture.
    await reconnectHost.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => []
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'))
    })
    await expect.poll(() => page.evaluate(() => window.electronAPI.audioSharing.status())).toMatchObject({
      active: false, outputs: [], message: expect.stringContaining('disconnected'),
    })
    await page.evaluate(() => window.electronAPI.audioSharing.stop())
    await page.evaluate(options => window.electronAPI.audioSharing.start(options), options)
    await page.reload()
    expect((await page.evaluate(() => window.electronAPI.audioSharing.status())).active).toBe(false)
    expect(await app.windows()).toHaveLength(1)
    await page.goto('data:text/html,<h1>Untrusted page</h1>')
    await expect.poll(() => page.evaluate(() => Boolean(window.electronAPI?.audioSharing))).toBe(true)
    await expect(page.evaluate(() => window.electronAPI.audioSharing.devices())).rejects.toThrow('only inside Rajify')
  } finally { await app.close() }
})
