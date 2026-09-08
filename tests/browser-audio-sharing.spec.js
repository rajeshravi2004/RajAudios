import { test, expect, chromium } from '@playwright/test'

// Keep Chromium's real popup blocker enabled for the native-link flow.
test.use({ launchOptions: { ignoreDefaultArgs: ['--disable-popup-blocking'] } })

// Exercise the real browser adapter, audio tab, and Web Audio graph. Only hardware
// permissions, device IDs, and the browser's native capture picker are fixtures.
async function browserFixture(context, page) {
  await context.addInitScript(() => {
    const media = navigator.mediaDevices
    const nativeConstraints = media.getSupportedConstraints.bind(media)
    Object.defineProperty(media, 'getSupportedConstraints', { value: () => ({ ...nativeConstraints(), suppressLocalAudioPlayback: true }) })
    Object.defineProperty(media, 'setCaptureHandleConfig', { value: config => { window.__captureConfig = config; localStorage.setItem('captureConfig', JSON.stringify(config)) } })
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
      createDelay(max) { this.__delay = super.createDelay(max); return this.__delay }
    }
    Object.defineProperty(media, 'getDisplayMedia', { value: async options => {
      window.__captureCount = (window.__captureCount || 0) + 1
      window.__captureOptions = options
      if (localStorage.getItem('captureFailure') === 'denied') throw new DOMException('Cancelled', 'NotAllowedError')
      const canvas = document.createElement('canvas')
      canvas.width = 8; canvas.height = 8
      canvas.getContext('2d').fillRect(0, 0, 8, 8)
      const stream = canvas.captureStream(1)
      const video = stream.getVideoTracks()[0]
      Object.defineProperty(video, 'getCaptureHandle', { value: () => ({
        origin: location.origin,
        handle: localStorage.getItem('captureFailure') === 'wrong-tab' ? 'wrong' : JSON.parse(localStorage.getItem('captureConfig')).handle,
      }) })
      Object.defineProperty(video, 'getSettings', { value: () => ({ displaySurface: 'browser' }) })
      if (localStorage.getItem('captureFailure') !== 'no-audio') {
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
        constructor(_id, options) { this.options = options; window.__ytPlayer = this; setTimeout(() => options.events.onReady({ target: this }), 0) }
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
  await page.getByRole('link', { name: 'Sync & play' }).click()
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
  expect(await popup.evaluate(() => window.__contexts.every(context => context.baseLatency >= 0.1))).toBe(true)
  expect(await popup.evaluate(() => window.__captureOptions.selfBrowserSurface)).toBe('exclude')
  await page.getByLabel('Extra delay for Second earbuds').fill('100')
  await expect.poll(() => popup.evaluate(() => window.__contexts[1].__delay.delayTime.value)).toBeCloseTo(0.1)
  await popup.close()
  await expect(page.getByRole('alert')).toContainText('audio tab closed')
  await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
})

test('both outputs recover from a temporary interruption without restarting capture', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  const audioTab = await openAudioWindow(page)
  await audioTab.getByRole('button', { name: 'Share Rajify audio' }).click()
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  await audioTab.evaluate(() => Promise.all(window.__contexts.map(context => context.suspend())))
  await expect.poll(() => audioTab.evaluate(() => window.__contexts.map(context => context.state))).toEqual(['running', 'running'])
  expect(await audioTab.evaluate(() => window.__captureCount)).toBe(1)
  expect(await audioTab.evaluate(() => window.__stream.getTracks().every(track => track.readyState === 'live'))).toBe(true)
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('region', { name: 'Bluetooth & shared listening' }).getByRole('button', { name: 'Stop sharing', exact: true }).click()
  await expect.poll(() => audioTab.isClosed()).toBe(true)
})

for (const failure of ['denied', 'unresponsive']) test(`an output with ${failure} recovery releases sharing and allows retry`, async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  const audioTab = await openAudioWindow(page)
  await audioTab.getByRole('button', { name: 'Share Rajify audio' }).click()
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  await audioTab.evaluate(async failure => {
    window.__contexts[0].resume = async () => {
      if (failure === 'denied') throw new DOMException('Denied', 'NotAllowedError')
      await new Promise(() => {})
    }
    await window.__contexts[0].suspend()
  }, failure)
  await expect(page.getByRole('alert')).toContainText('An audio output could not resume')
  await expect.poll(() => audioTab.isClosed()).toBe(true)
  await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
  const nextTab = await openAudioWindow(page)
  await page.getByRole('button', { name: 'Cancel setup' }).click()
  await expect.poll(() => nextTab.isClosed()).toBe(true)
})

test('YouTube buffering is shown without restarting either output', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  const audioTab = await openAudioWindow(page)
  await audioTab.getByRole('button', { name: 'Share Rajify audio' }).click()
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  await page.evaluate(() => window.__ytPlayer.options.events.onStateChange({ data: 3 }))
  await expect(page.locator('.sharing-banner')).toContainText('YouTube is buffering')
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  await page.evaluate(() => window.__ytPlayer.options.events.onStateChange({ data: 1 }))
  await expect(page.locator('.sharing-banner')).not.toContainText('buffering')
  expect(await audioTab.evaluate(() => window.__captureCount)).toBe(1)
  expect(await audioTab.evaluate(() => window.__contexts.map(context => context.state))).toEqual(['running', 'running'])
  await page.evaluate(() => window.__ytPlayer.options.events.onStateChange({ data: 3 }))
  await page.evaluate(() => window.__ytPlayer.options.events.onStateChange({ data: 2 }))
  await expect(page.locator('.sharing-banner')).not.toContainText('buffering')
})

for (const [failure, expected] of [['wrong-tab', 'original Rajify music tab'], ['no-audio', 'No tab audio'], ['denied', 'cancelled or blocked']]) {
  test(`browser recovers from capture ${failure}`, async ({ context, page }) => {
    await browserFixture(context, page)
    await selectDevicesAndSong(page)
    await page.evaluate(value => { localStorage.setItem('captureFailure', value) }, failure)
    const popup = await openAudioWindow(page)
    await popup.getByRole('button', { name: 'Share Rajify audio' }).click()
    await expect(page.getByRole('alert')).toContainText(expected)
    await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
    await expect.poll(() => popup.isClosed()).toBe(true)
  })
}

test('native audio link works with script popups blocked and no opener', async ({ context, page }) => {
  await browserFixture(context, page)
  await page.evaluate(() => { window.__denyDevices = true })
  await page.getByRole('button', { name: 'Find audio devices' }).click()
  await expect(page.getByRole('alert')).toContainText('Audio-device access was cancelled or blocked')
  await page.evaluate(() => { window.__denyDevices = false })
  await selectDevicesAndSong(page)
  await page.evaluate(() => {
    window.__openAttempts = 0
    window.open = () => { window.__openAttempts++; return null }
  })
  const audioTab = await openAudioWindow(page)
  expect(await page.evaluate(() => window.__openAttempts)).toBe(0)
  expect(await audioTab.evaluate(() => window.opener)).toBeNull()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await audioTab.getByRole('button', { name: 'Share Rajify audio' }).click()
  await expect(page.locator('.sharing-badge.is-active')).toBeVisible()
  expect(await audioTab.evaluate(() => window.__contexts.map(context => context.sinkId))).toEqual(['pair-a', 'pair-b'])
  await page.getByRole('region', { name: 'Bluetooth & shared listening' }).getByRole('button', { name: 'Stop sharing', exact: true }).click()
  await expect.poll(() => audioTab.isClosed()).toBe(true)
  await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
  expect(await page.evaluate(() => window.__captureConfig)).toEqual({})
})

test('an audio tab that cannot load reports a connection error and can be retried', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  await context.route('**/audio-sharing.html', route => route.abort())
  await page.clock.install()
  const tabPromise = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Sync & play' }).click()
  const failedTab = await tabPromise
  await page.clock.runFor(16000)
  await expect(page.getByRole('alert')).toContainText('The audio tab did not connect')
  await expect(page.getByRole('alert')).not.toContainText('blocked')
  await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
  expect(await page.evaluate(() => window.__captureConfig)).toEqual({})
  await failedTab.close()
  await context.unroute('**/audio-sharing.html')
  await page.clock.resume()
  const audioTab = await openAudioWindow(page)
  await page.getByRole('button', { name: 'Cancel setup' }).click()
  await expect.poll(() => audioTab.isClosed()).toBe(true)
})

test('browser can cancel setup before capture starts', async ({ context, page }) => {
  await browserFixture(context, page)
  await selectDevicesAndSong(page)
  const popup = await openAudioWindow(page)
  await page.getByRole('button', { name: 'Cancel setup' }).click()
  await expect.poll(() => popup.isClosed()).toBe(true)
  await expect(page.getByRole('link', { name: 'Sync & play' })).toBeEnabled()
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
          const video = stream.getVideoTracks()[0].getSettings()
          window.__result = { verified: isSource(), audio: stream.getAudioTracks()[0].readyState,
            smallVideo: video.width <= 320 && video.height <= 180 && video.frameRate <= 1 }
          stream.getTracks().forEach(track => track.stop())
        }, error => { window.__error = error.message })
      }
    })
    await output.getByRole('button', { name: 'Share test tab' }).click()
    await expect.poll(() => output.evaluate(() => Boolean(window.__error || window.__result)), { timeout: 15000 }).toBe(true)
    expect(await output.evaluate(() => window.__error || window.__result)).toEqual({ verified: true, audio: 'live', smallVideo: true })
  } finally {
    await context.close()
  }
})
