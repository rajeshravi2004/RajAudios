import { test, expect } from '@playwright/test'

async function openSettings(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
}

async function desktopFixture(page) {
  await page.addInitScript(() => {
    const devices = [{ deviceId: 'pair-a', label: 'My earbuds' }, { deviceId: 'pair-b', label: 'Friend’s earbuds' }]
    window.__share = { active: false, outputs: [], mono: true, message: '' }
    window.__shareCalls = []
    window.electronAPI = { audioSharing: {
      supported: true,
      devices: async () => devices,
      status: async () => ({ ...window.__share }),
      start: async options => {
        if (window.__startError) throw new Error(window.__startError)
        window.__share = { ...options, active: true, message: '' }
        return { ...window.__share }
      },
      update: async options => { window.__share = { ...window.__share, ...options }; return { ...window.__share } },
      stop: async () => { window.__share.active = false; return { ...window.__share } },
      openBluetooth: async () => { window.__shareCalls.push('bluetooth') },
    } }
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
    const snippet = { title: 'Shared Test Song', channelTitle: 'Test Artist', thumbnails: {} }
    const items = url.searchParams.get('endpoint') === 'videos'
      ? [{ id: 'test1234567', snippet, contentDetails: { duration: 'PT2M' }, status: { embeddable: true } }]
      : url.searchParams.get('type') === 'video' ? [{ id: { videoId: 'test1234567' }, snippet }] : []
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items }) })
  })
  await openSettings(page)
}

async function chooseSong(page) {
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByLabel('Search music').fill('shared test')
  await page.getByText('Shared Test Song', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
}

test('browser explains desktop sharing without pretending to pair earbuds', async ({ page }) => {
  await openSettings(page)
  await expect(page.getByRole('heading', { name: 'Bluetooth & shared listening' })).toBeVisible()
  await expect(page.getByText('Open Rajify for Windows to share with multiple outputs.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start sharing' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Connect Bluetooth' })).toHaveCount(0)
})

test('two pairs share with mono, live controls, navigation and explicit stop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await desktopFixture(page)
  await page.getByRole('button', { name: 'Connect Bluetooth' }).click()
  expect(await page.evaluate(() => window.__shareCalls)).toEqual(['bluetooth'])
  await page.getByRole('button', { name: 'Refresh devices' }).click()
  await page.getByLabel('My earbuds', { exact: true }).check()
  await page.getByLabel('Friend’s earbuds', { exact: true }).check()
  await expect(page.getByRole('button', { name: 'Start sharing' })).toBeDisabled()
  await expect(page.getByLabel('One earbud each (mono audio)', { exact: false })).toBeChecked()
  await chooseSong(page)
  await page.getByRole('button', { name: 'Start sharing' }).click()
  await expect(page.getByText('Sharing on', { exact: true })).toBeVisible()
  await page.locator('.audio-sharing-card').screenshot({ path: testInfo.outputPath('shared-listening.png') })
  await expect(page.getByLabel('My earbuds', { exact: true })).toBeDisabled()
  await page.getByLabel('Volume for My earbuds').fill('0.4')
  await page.getByLabel('Extra delay for Friend’s earbuds').fill('80')
  await expect.poll(() => page.evaluate(() => window.__share.outputs)).toEqual([
    { deviceId: 'pair-a', volume: 0.4, delayMs: 0 }, { deviceId: 'pair-b', volume: 0.8, delayMs: 80 },
  ])
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sharing with 2 outputs · Mono' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__share.active)).toBe(false)
  await expect(page.getByRole('button', { name: 'Sharing with 2 outputs · Mono' })).toHaveCount(0)
})

test('failed starts and disconnected outputs remain recoverable', async ({ page }) => {
  await desktopFixture(page)
  await page.getByRole('button', { name: 'Refresh devices' }).click()
  await page.getByLabel('My earbuds', { exact: true }).check()
  await chooseSong(page)
  await page.evaluate(() => { window.__startError = 'An output is no longer available.' })
  await page.getByRole('button', { name: 'Start sharing' }).click()
  await expect(page.getByRole('alert')).toContainText('no longer available')
  await expect(page.getByRole('button', { name: 'Start sharing' })).toBeEnabled()
  await page.evaluate(() => { window.__startError = '' })
  await page.getByRole('button', { name: 'Start sharing' }).click()
  await expect(page.getByText('Sharing on', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.__share.active = false
    window.__share.message = 'An output disconnected. Normal playback has been restored.'
  })
  await expect(page.getByRole('alert')).toContainText('disconnected')
  await expect(page.getByRole('button', { name: 'Start sharing' })).toBeEnabled()
  await expect(page.getByLabel('My earbuds', { exact: true })).toBeEnabled()
})
