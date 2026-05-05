import { test, expect } from '@playwright/test'

test.describe('Menu page', () => {
  test('loads Dahlia Oven menu with items and prices', async ({ page }) => {
    await page.goto('/dahlia-oven/menu')

    // Hero banner: restaurant name
    await expect(page.getByRole('heading', { name: 'Dahlia Oven' })).toBeVisible()

    // At least one menu item card
    const firstAddBtn = page.getByRole('button', { name: /Add .+ to cart/i }).first()
    await expect(firstAddBtn).toBeVisible()

    // EUR price visible
    await expect(page.getByText(/€\d+\.\d{2}/).first()).toBeVisible()
  })

  test('loads Shalimar menu', async ({ page }) => {
    await page.goto('/shalimar/menu')
    await expect(page.getByRole('heading', { name: 'Shalimar' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Add .+ to cart/i }).first()).toBeVisible()
  })

  test('sticky category tabs are visible', async ({ page }) => {
    await page.goto('/dahlia-oven/menu')
    // Category nav should appear (at least one tab button)
    await expect(page.getByRole('button').filter({ hasText: /\w+/ }).first()).toBeVisible()
  })
})
