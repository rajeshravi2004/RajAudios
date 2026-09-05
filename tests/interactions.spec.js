import { expect, test } from '@playwright/test'

const videoItem = {
  id: { videoId: 'video123456' },
  snippet: {
    title: 'Test Song',
    channelTitle: 'Test Artist',
    thumbnails: { medium: { url: 'https://example.com/song.jpg' } },
  },
}

const playlistItem = {
  id: { playlistId: 'playlist123' },
  snippet: {
    title: 'Test Playlist',
    channelTitle: 'Test Curator',
    thumbnails: { medium: { url: 'https://example.com/playlist.jpg' } },
  },
}

async function mockYouTubeApi(page) {
  await page.route('**/api/youtube**', route => {
    const url = new URL(route.request().url())
    const endpoint = url.searchParams.get('endpoint')
    const type = url.searchParams.get('type')

    if (endpoint === 'search' && type === 'video') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [videoItem] }) })
    }
    if (endpoint === 'search' && type === 'playlist') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [playlistItem] }) })
    }
    if (endpoint === 'videos') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            id: 'video123456',
            snippet: videoItem.snippet,
            contentDetails: { duration: 'PT3M42S' },
            statistics: { viewCount: '12345' },
            status: { embeddable: true },
          }],
        }),
      })
    }

    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) })
  })
}

async function enterAsGuest(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
}

test('creates playlists with the custom dialog', async ({ page }) => {
  await enterAsGuest(page)

  await page.getByRole('button', { name: 'Create new playlist' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a playlist' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Playlist name').fill('Road Trip')
  await dialog.getByRole('button', { name: 'Create playlist' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /Road Trip/ })).toBeVisible()
})

test('destructive actions use a custom confirmation dialog', async ({ page }) => {
  await enterAsGuest(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Reset local data' }).click()

  const dialog = page.getByRole('dialog', { name: 'Reset local data?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('This clears listening history')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('search playlists can be opened', async ({ page }) => {
  await mockYouTubeApi(page)
  await enterAsGuest(page)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByLabel('Search music').fill('test')
  await page.getByRole('button', { name: /Playlists \(1\)/ }).click()
  await page.getByRole('button', { name: 'Open playlist: Test Playlist' }).click()

  await expect(page.getByRole('heading', { name: 'Test Playlist' })).toBeVisible()
  await expect(page.getByText('By Test Curator')).toBeVisible()
})

test('played and liked songs keep their duration metadata', async ({ page }) => {
  await mockYouTubeApi(page)
  await enterAsGuest(page)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByLabel('Search music').fill('test')
  await expect(page.getByText('3:42', { exact: true })).toBeVisible()
  await page.getByText('Test Song', { exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Like' }).click()
  await page.getByRole('button', { name: 'Recently Played' }).click()

  await expect(page.getByRole('heading', { name: 'Recently Played' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Test Song', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText('3:42', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Liked Songs', exact: true }).click()
  await expect(page.getByRole('main').getByText('Test Song', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText('3:42', { exact: true })).toBeVisible()
})

test('video fullscreen targets and fills the real player container', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ytPlayerCalls = []
    window.YT = {
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
      Player: class {
        constructor(_id, options) {
          this.options = options
          setTimeout(() => options.events.onReady({ target: this }), 0)
        }
        setVolume() {}
        loadVideoById(id) { window.__ytPlayerCalls.push(`load:${id}`) }
        playVideo() {
          window.__ytPlayerCalls.push('play')
          this.options.events.onStateChange({ data: window.YT.PlayerState.PLAYING })
        }
        pauseVideo() {}
        getCurrentTime() { return 0 }
        getDuration() { return 222 }
        destroy() {}
      },
    }
  })
  await mockYouTubeApi(page)
  await enterAsGuest(page)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByLabel('Search music').fill('test')
  await page.getByText('Test Song', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__ytPlayerCalls)).toEqual([
    'load:video123456',
    'play',
  ])
  await page.getByRole('button', { name: 'Toggle Video Mode' }).click()
  await page.getByRole('button', { name: 'Fullscreen video' }).click()

  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('yt-player-container')
  const playerBox = await page.locator('#yt-player-container').boundingBox()
  const viewport = page.viewportSize()
  expect(playerBox?.width).toBe(viewport?.width)
  expect(playerBox?.height).toBe(viewport?.height)
  await page.evaluate(() => document.exitFullscreen())
})

test('interactive controls use a pointer cursor', async ({ page }) => {
  await enterAsGuest(page)

  await expect(page.getByRole('button', { name: 'Search' })).toHaveCSS('cursor', 'pointer')
})

test('primary navigation stays free of runtime errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await mockYouTubeApi(page)
  await enterAsGuest(page)

  const sidebar = page.locator('.sidebar')
  for (const destination of ['Trending', 'My Playlists', 'Recently Played', 'Settings', 'Search', 'Home']) {
    await sidebar.getByRole('button', { name: destination, exact: true }).click()
  }

  expect(pageErrors).toEqual([])
})
