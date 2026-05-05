import { test, expect } from '@playwright/test'

// Dahlia Oven: Margherita costs 1.00 ticket (explicit price_wallet_units)
// Test user must have >= 1 ticket balance at dahlia-oven

test.describe('Wallet order', () => {
  let orderId: string | null = null

  test.afterEach(async ({ page }) => {
    if (orderId) {
      // Best-effort cancel so pending orders don't accumulate
      await page.request.delete(`/api/orders/${orderId}`).catch(() => {})
      orderId = null
    }
  })

  test('places a wallet-only order and reaches the order status page', async ({ page }) => {
    await page.goto('/dahlia-oven/menu')
    await expect(page.getByRole('button', { name: 'Add Margherita to cart' })).toBeVisible()

    // Add the 1-ticket item
    await page.getByRole('button', { name: 'Add Margherita to cart' }).click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Place Order' }).click()

    // Payment selector: wallet checkbox should be visible and checked
    const walletCheckbox = sidebar.getByRole('checkbox', { name: /wallet/i })
    await expect(walletCheckbox).toBeVisible({ timeout: 10_000 })
    await expect(walletCheckbox).toBeChecked()

    // Confirm the order
    await sidebar.getByRole('button', { name: /confirm|pay/i }).click()

    // Should navigate to /order/[id] — capture orderId
    await page.waitForURL(/\/order\/[a-z0-9-]+/, { timeout: 20_000 })
    const match = page.url().match(/\/order\/([a-z0-9-]+)/)
    orderId = match ? match[1] : null

    // Order status page should render
    await expect(page.getByText(/pending|preparing/i)).toBeVisible()
  })
})
