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

test('played songs appear in Recently Played', async ({ page }) => {
  await mockYouTubeApi(page)
  await enterAsGuest(page)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByLabel('Search music').fill('test')
  await page.getByText('Test Song', { exact: true }).click()
  await page.getByRole('button', { name: 'Recently Played' }).click()

  await expect(page.getByRole('heading', { name: 'Recently Played' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Test Song', { exact: true })).toBeVisible()
})

test('interactive controls use a pointer cursor', async ({ page }) => {
  await enterAsGuest(page)

  await expect(page.getByRole('button', { name: 'Search' })).toHaveCSS('cursor', 'pointer')
})
