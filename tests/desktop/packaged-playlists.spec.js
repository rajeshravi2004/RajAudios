import { test, expect, _electron as electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

test('packaged Windows app persists playlist additions and removals', async () => {
  const executablePath = resolve('release/win-unpacked/Rajify.exe')
  test.skip(process.platform !== 'win32' || !existsSync(executablePath), 'Build the Windows app first')
  const userData = await mkdtemp(join(tmpdir(), 'rajify-playlist-test-'))
  if (dirname(resolve(userData)) !== resolve(tmpdir()) || !userData.startsWith(join(tmpdir(), 'rajify-playlist-test-'))) {
    throw new Error('Unexpected test data directory')
  }
  const env = { ...process.env, NODE_ENV: 'production' }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.YOUTUBE_API_KEY
  delete env.YOUTUBE_API_KEYS
  delete env.VITE_YOUTUBE_API_KEYS
  delete env.VITE_YOUTUBE_API_KEY
  const app = await electron.launch({ executablePath, args: [`--user-data-dir=${userData}`], cwd: userData, env })
  try {
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      for (const window of BrowserWindow.getAllWindows()) window.hide()
      const snippet = { title: 'Test Song', channelTitle: 'Test Artist', thumbnails: {} }
      for (const method of ['search', 'getVideos', 'getPlaylistItems', 'getPlaylists', 'searchPlaylists', 'getChannels', 'getTrending']) {
        ipcMain.removeHandler(`youtube:${method}`)
        ipcMain.handle(`youtube:${method}`, () => ({ items: method === 'search'
          ? [{ id: { videoId: 'video123456' }, snippet }]
          : method === 'getVideos' ? [{ id: 'video123456', snippet, contentDetails: { duration: 'PT3M42S' }, statistics: { viewCount: '12345' }, status: { embeddable: true } }]
          : [] }))
      }
    })
    const page = await app.firstWindow()

    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByLabel('Search music').fill('test')
    await page.getByRole('button', { name: 'Add Test Song to playlist', exact: true }).first().click()
    const saveDialog = page.getByRole('dialog', { name: 'Add to playlist', exact: true })
    await saveDialog.getByLabel('New playlist name').fill('Road Trip')
    await saveDialog.getByRole('button', { name: 'Create playlist & add song' }).click()
    await expect(saveDialog).not.toBeVisible()
    await page.getByTitle('Road Trip', { exact: true }).click()
    const main = page.getByRole('main')
    await expect(main.getByText('Test Song', { exact: true })).toBeVisible()
    await main.getByRole('button', { name: 'Remove Test Song from playlist' }).click()
    await expect(main.getByText('No tracks in this playlist yet.')).toBeVisible()
    await main.getByRole('button', { name: 'Add songs', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Add songs to Road Trip' })
    await picker.getByLabel('Search songs').fill('test')
    await picker.getByRole('button', { name: 'Search', exact: true }).click()
    await picker.getByRole('button', { name: 'Add Test Song', exact: true }).click()
    await expect(picker.getByRole('button', { name: 'Test Song added' })).toBeDisabled()
    await picker.getByRole('button', { name: 'Done' }).click()
    await expect(main.getByText('Test Song', { exact: true })).toHaveCount(1)
    await page.reload()
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await page.getByTitle('Road Trip', { exact: true }).click()
    await expect(main.getByText('Test Song', { exact: true })).toHaveCount(1)
    await main.getByRole('button', { name: 'Remove Test Song from playlist' }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await page.getByTitle('Road Trip', { exact: true }).click()
    await expect(main.getByText('No tracks in this playlist yet.')).toBeVisible()

  } finally {
    await app.close()
    await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
