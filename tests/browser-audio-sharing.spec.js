import { test, expect, chromium } from '@playwright/test'

// Exercise the real browser adapter, popup, and Web Audio graph. Only hardware
// permissions, device IDs, and the browser's native capture picker are fixtures.
async function browserFixture(context, page) {
  await context.addInitScript(() => {
    const media = navigator.mediaDevices
    const nativeConstraints = media.getSupportedConstraints.bind(media)
    Object.defineProperty(media, 'getSupportedConstraints', { value: () => ({ ...nativeConstraints(), suppressLocalAudioPlayback: true }) })
    Object.defineProperty(media, 'setCaptureHandleConfig', { value: config => { window.__captureConfig = config } })
    MediaStreamTrack.prototype.getCaptureHandle = function () { return null }
    Object.defineProperty(media, 'selectAudioOutput', { value: undefined })
    Object.defineProperty(navigator.permissions, 'query', { value: async () => ({ state: 'prompt' }) })
    Object.defineProperty(media, 'enumerateDevices', { value: async () => [
      { kind: 'audiooutput', deviceId: 'default', label: 'Default' },
      { kind: 'audiooutput', deviceId: 'pair-a', label: 'First earbuds' },
      { kind: 'audiooutput', deviceId: 'pair-b', label: 'Second earbuds' },
    ] })
    Object.defineProperty(media, 'getUserMedia', { value: async () => {
      if (window.__denyDevices) throw new DOMException('Permission denied', 'NotAllowedError')
      window.__micStopped = false
      return { getTracks: () => [{ stop: () => { window.__micStopped = true } }] }
    } })
    const NativeContext = window.AudioContext
    window.__contexts = []
    window.AudioContext = class extends NativeContext {
      constructor(options) { super(options); window.__contexts.push(this) }
      async setSinkId(id) { this.__sink = id }
      get sinkId() { return this.__sink }
    }
    Object.defineProperty(media, 'getDisplayMedia', { value: async options => {
      window.__captureOptions = options
      if (window.opener.__captureFailure === 'denied') throw new DOMException('Cancelled', 'NotAllowedError')
      const canvas = document.createElement('canvas')
      canvas.width = 8; canvas.height = 8
      canvas.getContext('2d').fillRect(0, 0, 8, 8)
      const stream = canvas.captureStream(1)
      const video = stream.getVideoTracks()[0]
      Object.defineProperty(video, 'getCaptureHandle', { value: () => ({
        origin: location.origin,
        handle: window.opener.__captureFailure === 'wrong-tab' ? 'wrong' : window.opener.__captureConfig.handle,
      }) })
      Object.defineProperty(video, 'getSettings', { value: () => ({ displaySurface: 'browser' }) })
      if (window.opener.__captureFailure !== 'no-audio') {
        const source = new NativeContext()
        const destination = source.createMediaStreamDestination()
        // A silent real audio track: tests never play sound on the user's device.
        const audio = destination.stream.getAudioTracks()[0]
        Object.defineProperty(audio, 'getSettings', { value: () => ({ suppressLocalAudioPlayback: true }) })
        stream.addTrack(audio)
        window.__sourceContext = source
      }
      window.__stream = stream
      return stream
    } })
    window.YT = {
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
      Player: class {
        constructor(_id, options) { this.options = options; setTimeout(() => options.events.onReady({ target: this }), 0) }
        setVolume() {}
        loadVideoById() { this.playVideo() }
        playVideo() { this.options.events.onStateChange({ data: 1 }) }
        pauseVideo() {}
        getCurrentTime() { return 0 }
        getDuration() { return 120 }
        destroy() {}
      },
    }
  })
  await page.route('**/api/youtube**', route => {
    const url = new URL(route.request().url())
    const snippet = { title: 'Browser Sharing Song', channelTitle: 'Test Artist', thumbnails: {} }
    const items = url.searchParams.get('endpoint') === 'videos'
      ? [{ id: 'test1234567', snippet, contentDetails: { duration: 'PT2M' }, status: { embeddable: true } }]
      : url.searchParams.get('type') === 'video' ? [{ id: { videoId: 'test1234567' }, snippet }] : []
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items }) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
}

async function selectDevicesAndSong(page) {
  await page.getByRole('button', { name: 'Connect Bluetooth', exact: true }).click()
  await page.getByRole('button', { name: 'Find audio devices' }).click()
  await page.getByLabel('First earbuds', { exact: true }).check()
  await page.getByRole('button', { name: 'Connect next Bluetooth' }).click()
  await page.getByLabel('Second earbuds', { exact: true }).check()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByLabel('Search music').fill('browser sharing')
  await page.getByText('Browser Sharing Song', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
}

async function openAudioWindow(page) {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Sync & play' }).click()
  const popup = await popupPromise
  await expect(popup.getByRole('button', { name: 'Share Rajify audio' })).toBeEnabled()
  return popup
}

test('browser connects two outputs, routes tab audio, updates timing and stops on popup close', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  expect(await page.evaluate(() => window.__micStopped)).toBe(true)
  await expect(page.getByLabel('Default', { exact: true })).toHaveCount(0)
  const popup = await openAudioWindow(page)
  await popup.getByRole('button', { name: 'Share Rajify audio' }).click()
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  expect(await popup.evaluate(() => window.__contexts.map(context => context.sinkId))).toEqual(['pair-a', 'pair-b'])
  expect(await popup.evaluate(() => window.__captureOptions.selfBrowserSurface)).toBe('exclude')
  await page.getByLabel('Extra delay for Second earbuds').fill('100')
  await expect.poll(() => popup.evaluate(() => window.rajifyAudio('status').outputs[1].delayMs)).toBe(100)
  await popup.close()
  await expect(page.getByRole('alert')).toContainText('audio window closed')
  await expect(page.getByRole('button', { name: 'Sync & play' })).toBeEnabled()
})

for (const [failure, expected] of [['wrong-tab', 'original Rajify music tab'], ['no-audio', 'No tab audio'], ['denied', 'cancelled or blocked']]) {
  test(`browser recovers from capture ${failure}`, async ({ context, page }) => {
    await browserFixture(context, page)
    await selectDevicesAndSong(page)
    await page.evaluate(value => { window.__captureFailure = value }, failure)
    const popup = await openAudioWindow(page)
    await popup.getByRole('button', { name: 'Share Rajify audio' }).click()
    await expect(page.getByRole('alert')).toContainText(expected)
    await expect(page.getByRole('button', { name: 'Sync & play' })).toBeEnabled()
    await expect.poll(() => popup.isClosed()).toBe(true)
  })
}

test('browser device denial and popup blocking leave setup recoverable', async ({ context, page }) => {
  await browserFixture(context, page)
  await page.evaluate(() => { window.__denyDevices = true })
  await page.getByRole('button', { name: 'Find audio devices' }).click()
  await expect(page.getByRole('alert')).toContainText('Audio-device access was cancelled or blocked')
  await page.evaluate(() => { window.__denyDevices = false })
  await selectDevicesAndSong(page)
  await page.evaluate(() => { window.open = () => null })
  await page.getByRole('button', { name: 'Sync & play' }).click()
  await expect(page.getByRole('alert')).toContainText('Allow pop-ups')
  await expect(page.getByRole('button', { name: 'Sync & play' })).toBeEnabled()
})

test('browser can cancel setup before capture starts', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  const popup = await openAudioWindow(page)
  await page.getByRole('button', { name: 'Cancel setup' }).click()
  await expect.poll(() => popup.isClosed()).toBe(true)
  await expect(page.getByRole('button', { name: 'Sync & play' })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  const nextPopup = await openAudioWindow(page)
  await page.reload()
  await expect.poll(() => nextPopup.isClosed()).toBe(true)
})

test('native Chromium tab capture supplies audio and verifies source identity', async () => {
  // Capture Handle intentionally hides identity in incognito contexts.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: ['--auto-select-tab-capture-source-by-title=Rajify capture integration', '--autoplay-policy=no-user-gesture-required'],
  })
  try {
    const source = await context.newPage()
    await source.route('**/capture-integration', route => route.fulfill({
      contentType: 'text/html', body: '<title>Rajify capture integration</title><p>Silent test tab</p>',
    }))
    await source.goto('http://127.0.0.1:5181/capture-integration')
    await source.evaluate(() => {
      navigator.mediaDevices.setCaptureHandleConfig({ handle: 'native-capture-test', exposeOrigin: true, permittedOrigins: [location.origin] })
    })
    const output = await context.newPage()
    await output.route('**/capture-output', route => route.fulfill({ contentType: 'text/html', body: '<button id="start">Share test tab</button>' }))
    await output.goto('http://127.0.0.1:5181/capture-output')
    await output.evaluate(async () => {
      const { captureRajifyAudio } = await import('/src/audio-sharing/capture.js')
      document.querySelector('#start').onclick = () => {
        captureRajifyAudio('native-capture-test').then(({ stream, isSource }) => {
          window.__result = { verified: isSource(), audio: stream.getAudioTracks()[0].readyState }
          stream.getTracks().forEach(track => track.stop())
        }, error => { window.__error = error.message })
      }
    })
    await output.getByRole('button', { name: 'Share test tab' }).click()
    await expect.poll(() => output.evaluate(() => Boolean(window.__error || window.__result)), { timeout: 15000 }).toBe(true)
    expect(await output.evaluate(() => window.__error || window.__result)).toEqual({ verified: true, audio: 'live' })
  } finally {
    await context.close()
  }
})
