import { expect, test } from '@playwright/test'

test('Google credentials form rejects empty input', async ({ page }) => {
  await page.goto('/setup/google-credentials')
  await page.getByRole('button', { name: /save and continue/i }).click()
  await expect(page.getByRole('alert')).toContainText(/paste both/i)
})

test('Google credentials form posts trimmed JSON and redirects on success', async ({ page }) => {
  let captured: { clientId?: string; clientSecret?: string } | null = null
  await page.route('**/api/setup/google-credentials', async (route) => {
    captured = (await route.request().postDataJSON()) as {
      clientId?: string
      clientSecret?: string
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, next: '/setup/google-signin' }),
    })
  })

  await page.goto('/setup/google-credentials')
  await page.getByLabel('Client ID').fill('  123-abc.apps.googleusercontent.com  ')
  await page.getByLabel('Client Secret').fill('  GOCSPX-test  ')
  await page.getByRole('button', { name: /save and continue/i }).click()

  await expect(page).toHaveURL(/\/setup\/google-signin$/)
  expect(captured).toEqual({
    clientId: '123-abc.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-test',
  })
})

test('Google sign-in page shows error from query string', async ({ page }) => {
  await page.goto('/setup/google-signin?error=state_mismatch')
  await expect(page.getByRole('alert')).toContainText(/sign-in failed.*state_mismatch/i)
})

test('Google sign-in page renders the start link', async ({ page }) => {
  await page.goto('/setup/google-signin')
  await expect(page.getByRole('link', { name: /sign in with google/i })).toHaveAttribute(
    'href',
    '/api/setup/google-signin/start',
  )
})
