import { test, expect } from '@playwright/test'

// Stripe test card: no authentication required, always succeeds
const TEST_CARD = '4242424242424242'
const TEST_EXPIRY = '12/29'
const TEST_CVC = '123'
const TEST_ZIP = '10001'

async function fillStripePaymentElement(page: import('@playwright/test').Page) {
  // The Stripe Payment Element renders inside iframes. Each field may live in
  // its own iframe depending on the Stripe SDK version. We locate by field label.
  const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()

  await stripeFrame.getByPlaceholder('1234 1234 1234 1234').fill(TEST_CARD)
  await stripeFrame.getByPlaceholder('MM / YY').fill(TEST_EXPIRY)
  await stripeFrame.getByPlaceholder('CVC').fill(TEST_CVC)

  // Some Payment Elements include a billing postal code field
  const zipField = stripeFrame.getByPlaceholder('ZIP')
  if (await zipField.isVisible().catch(() => false)) {
    await zipField.fill(TEST_ZIP)
  }
}

test.describe('Card (Stripe) order', () => {
  let orderId: string | null = null

  test.afterEach(async ({ page }) => {
    if (orderId) {
      await page.request.delete(`/api/orders/${orderId}`).catch(() => {})
      orderId = null
    }
  })

  test('places a card-only order with Stripe test card and reaches order status page', async ({ page }) => {
    // Use Shalimar (all items have price_wallet_units = 0 and auto-convert)
    await page.goto('/shalimar/menu')
    await expect(page.getByRole('button', { name: /Add .+ to cart/i }).first()).toBeVisible()

    // Add the first available item
    await page.getByRole('button', { name: /Add .+ to cart/i }).first().click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Place Order' }).click()

    // Uncheck wallet if it's checked, to force card-only
    const walletCheckbox = sidebar.getByRole('checkbox', { name: /wallet/i })
    if (await walletCheckbox.isVisible().catch(() => false)) {
      if (await walletCheckbox.isChecked()) {
        await walletCheckbox.uncheck()
      }
    }

    // Confirm to create the Stripe PaymentIntent and open Stripe Checkout view
    await sidebar.getByRole('button', { name: /confirm|pay/i }).click()

    // Stripe Payment Element loads
    await expect(page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
      .getByPlaceholder('1234 1234 1234 1234')).toBeVisible({ timeout: 20_000 })

    await fillStripePaymentElement(page)

    // Submit payment
    await page.getByRole('button', { name: /pay/i }).last().click()

    // Should navigate to /order/[id]
    await page.waitForURL(/\/order\/[a-z0-9-]+/, { timeout: 30_000 })
    const match = page.url().match(/\/order\/([a-z0-9-]+)/)
    orderId = match ? match[1] : null

    // No payment error banner
    await expect(page.getByText(/could not be authorised/i)).not.toBeVisible()

    // Order status page should render
    await expect(page.getByText(/pending|preparing/i)).toBeVisible()
  })
})
