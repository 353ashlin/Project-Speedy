import { expect, test } from '@playwright/test'

test('home page shows the placeholder', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Project Speedy' })).toBeVisible()
  await expect(page.getByText('Coming soon.')).toBeVisible()
})
