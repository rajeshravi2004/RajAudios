import { expect, test } from '@playwright/test'

test('presents a clear sign-in experience', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'One place for every sound you come back to.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeVisible()
})

test('guest can reach professional settings and session API controls', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'YouTube API access' })).toBeVisible()
  await expect(page.getByLabel('Personal YouTube Data API key')).toHaveAttribute('autocomplete', 'off')
  await expect(page.getByText('Never saved or synced.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'User Admin' })).toHaveCount(0)
})

test('personal API key stays in memory and disappears after reload', async ({ page }) => {
  const testKey = `AIzaSy${'x'.repeat(33)}`
  await page.route('https://www.googleapis.com/youtube/v3/videos**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [{ id: 'dQw4w9WgXcQ' }] }),
  }))

  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Personal YouTube Data API key').fill(testKey)
  await page.getByRole('button', { name: 'Use for session' }).click()
  await expect(page.getByText('Personal key active')).toBeVisible()

  const persistedValues = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ].join(' '))
  expect(persistedValues).not.toContain(testKey)

  await page.reload()
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText('Using Rajify shared access')).toBeVisible()
})
