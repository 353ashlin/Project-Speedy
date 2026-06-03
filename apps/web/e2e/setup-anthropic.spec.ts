import { expect, test } from '@playwright/test'

test('welcome page links to the Anthropic setup step', async ({ page }) => {
  await page.goto('/setup/welcome')
  await expect(page.getByRole('heading', { name: 'Welcome to Project Speedy' })).toBeVisible()
  await page.getByRole('link', { name: /get started/i }).click()
  await expect(page).toHaveURL(/\/setup\/anthropic$/)
})

test('Anthropic setup form rejects empty input', async ({ page }) => {
  await page.goto('/setup/anthropic')
  await page.getByRole('button', { name: /validate and continue/i }).click()
  await expect(page.getByRole('alert')).toContainText(/paste your api key/i)
})

test('Anthropic setup form submits a JSON POST with the trimmed key', async ({ page }) => {
  let captured: { apiKey?: string } | null = null
  await page.route('**/api/setup/anthropic', async (route) => {
    captured = (await route.request().postDataJSON()) as { apiKey?: string }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, next: '/setup/google-credentials' }),
    })
  })

  await page.goto('/setup/anthropic')
  await page.getByLabel('API key').fill('  sk-ant-test-key  ')
  await page.getByRole('button', { name: /validate and continue/i }).click()

  await expect(page).toHaveURL(/\/setup\/google-credentials$/)
  expect(captured).toEqual({ apiKey: 'sk-ant-test-key' })
})

test('Anthropic setup form shows server-returned error message on failure', async ({ page }) => {
  await page.route('**/api/setup/anthropic', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'Anthropic rejected the key: invalid_request_error',
      }),
    })
  })

  await page.goto('/setup/anthropic')
  await page.getByLabel('API key').fill('sk-ant-bad')
  await page.getByRole('button', { name: /validate and continue/i }).click()

  await expect(page.getByRole('alert')).toContainText(/invalid_request_error/i)
})
