import { test, expect } from '@playwright/test'

// Dahlia Oven: Margherita has an explicit 1-ticket price and is always available
const ITEM_NAME = 'Margherita'

test.describe('Cart interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dahlia-oven/menu')
    // Wait for menu to load
    await expect(page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` })).toBeVisible()
  })

  test('adding an item shows it in the cart sidebar', async ({ page }) => {
    await page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` }).click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    // Desktop: sidebar auto-expands when cart is non-empty
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText(ITEM_NAME)).toBeVisible()
  })

  test('incrementing quantity updates the count', async ({ page }) => {
    await page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` }).click()
    // Use the sidebar controls — avoids ambiguity with the menu card's own +/- buttons
    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Add one more' }).click()
    // MenuCard renders aria-label="{qty} in cart" on the quantity span
    await expect(page.getByLabel('2 in cart')).toBeVisible()
  })

  test('decrementing quantity to zero removes item', async ({ page }) => {
    await page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` }).click()
    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Remove one' }).click()

    // Sidebar should show empty state after removal
    await expect(sidebar.getByText(ITEM_NAME)).not.toBeVisible()
  })

  test('Place Order button advances to payment selector', async ({ page }) => {
    await page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` }).click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Place Order' }).click()

    // Payment selector should now be visible (shows the total card)
    await expect(sidebar.getByText(/Pay with/i)).toBeVisible()
  })

  test('Back from payment selector returns to cart view', async ({ page }) => {
    await page.getByRole('button', { name: `Add ${ITEM_NAME} to cart` }).click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Place Order' }).click()
    await expect(sidebar.getByText(/Pay with/i)).toBeVisible()

    await sidebar.getByRole('button', { name: /Back/i }).click()
    await expect(sidebar.getByText('Place Order')).toBeVisible()
  })
})
