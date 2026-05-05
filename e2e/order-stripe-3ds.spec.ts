import { test, expect, type Frame } from '@playwright/test'

// Stripe test card that always requires 3DS authentication
const TEST_CARD_3DS = '4000002500003155'
const TEST_EXPIRY = '12/29'
const TEST_CVC = '123'

test.describe('Stripe 3DS redirect', () => {
  let orderId: string | null = null

  test.afterEach(async ({ page }) => {
    if (orderId) {
      await page.request.delete(`/api/orders/${orderId}`).catch(() => {})
      orderId = null
    }
  })

  test('completes 3DS authentication and lands on order status page', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/shalimar/menu')
    await expect(page.getByRole('button', { name: /Add .+ to cart/i }).first()).toBeVisible()
    await page.getByRole('button', { name: /Add .+ to cart/i }).first().click()

    const sidebar = page.getByRole('complementary', { name: 'Shopping cart' })
    await sidebar.getByRole('button', { name: 'Place Order' }).click()

    // Uncheck wallet to force card
    const walletCheckbox = sidebar.getByRole('checkbox', { name: /wallet/i })
    if (await walletCheckbox.isVisible().catch(() => false)) {
      if (await walletCheckbox.isChecked()) await walletCheckbox.uncheck()
    }

    await sidebar.getByRole('button', { name: /confirm|pay/i }).click()

    // Fill 3DS test card in Stripe Payment Element (same iframe as the regular card test)
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
    await expect(stripeFrame.getByPlaceholder('1234 1234 1234 1234')).toBeVisible({ timeout: 20_000 })
    await stripeFrame.getByPlaceholder('1234 1234 1234 1234').fill(TEST_CARD_3DS)
    await stripeFrame.getByPlaceholder('MM / YY').fill(TEST_EXPIRY)
    await stripeFrame.getByPlaceholder('CVC').fill(TEST_CVC)

    const zipField = stripeFrame.getByPlaceholder('ZIP')
    if (await zipField.isVisible().catch(() => false)) await zipField.fill('10001')

    await page.getByRole('button', { name: /pay/i }).last().click()

    // Stripe renders 3DS as nested iframes. `frameLocator('iframe').first()` is
    // unreliable because Stripe's Payment Element also uses iframes that may
    // appear first in DOM order. Instead, iterate page.frames() (which includes
    // ALL frames in the tree, including nested ones) to find the frame that
    // actually contains the Complete button, then click through the Frame object.
    let challengeFrame: Frame | undefined
    const deadline = Date.now() + 20_000
    while (!challengeFrame && Date.now() < deadline) {
      for (const frame of page.frames()) {
        try {
          if (await frame.locator('button:has-text("Complete")').isVisible({ timeout: 200 })) {
            challengeFrame = frame
            break
          }
        } catch { /* not this frame */ }
      }
      if (!challengeFrame) await page.waitForTimeout(300)
    }
    if (!challengeFrame) throw new Error('3DS Complete button not found in any frame')

    const completeBtn = challengeFrame.locator('button:has-text("Complete")')
    await expect(completeBtn).toBeVisible()

    // Give the 3DS frame's JS a moment to attach its click listeners
    await page.waitForTimeout(500)

    // Playwright's synthetic click() sends pointer events that are silently dropped
    // by cross-origin sandboxed iframes. Calling .click() via frame.evaluate() uses
    // CDP Runtime.callFunctionOn which executes directly in the frame's JS context,
    // bypassing the pointer simulation layer and reliably triggering event listeners.
    await Promise.all([
      page.waitForURL(/\/order\/[a-z0-9-]+/, { timeout: 60_000 }),
      challengeFrame.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find((b) => b.textContent?.includes('Complete')) as HTMLButtonElement | undefined
        btn?.click()
      }),
    ])
    const match = page.url().match(/\/order\/([a-z0-9-]+)/)
    orderId = match ? match[1] : null

    // redirect_status should be 'succeeded' — no error banner
    await expect(page.getByText(/could not be authorised/i)).not.toBeVisible()
    await expect(page.getByText(/pending|preparing/i)).toBeVisible()
  })
})
