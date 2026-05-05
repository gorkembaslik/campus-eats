import { test, expect, type Page } from '@playwright/test'

const TEST_ITEM = `E2E Test Item ${Date.now()}`
const UPDATED_NAME = `${TEST_ITEM} (edited)`

async function gotoAdminMenu(page: Page) {
  await page.goto('/admin/menu')
  await expect(page.getByRole('heading', { name: 'Menu Management' })).toBeVisible()
  // Wait for the items table to render — confirms restaurant + items data are loaded.
  // handleSave has an early `if (!restaurant) return` guard, so we must not interact
  // with the form until the useEffect fetch completes.
  await expect(page.getByRole('button', { name: /^Edit /i }).first()).toBeVisible({ timeout: 15_000 })
}

test.describe('Admin menu management', () => {
  test('page loads and shows existing items', async ({ page }) => {
    await gotoAdminMenu(page)
    await expect(page.getByRole('button', { name: /^Edit /i }).first()).toBeVisible()
  })

  test('creates a new menu item', async ({ page }) => {
    await gotoAdminMenu(page)

    await page.getByRole('button', { name: 'New item' }).click()
    await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible()

    await page.getByPlaceholder('e.g. Wiener Schnitzel').fill(TEST_ITEM)
    await page.getByPlaceholder('0.00').fill('9.99')
    await page.getByPlaceholder('0 = auto from € price').fill('1')

    await page.getByRole('button', { name: 'Create item' }).click()

    await expect(page.getByText('Item created.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'New item' })).not.toBeVisible()
    await expect(page.getByText(TEST_ITEM)).toBeVisible()
  })

  test('edits the created item', async ({ page }) => {
    await gotoAdminMenu(page)

    await page.getByRole('button', { name: `Edit ${TEST_ITEM}` }).click()
    await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible()

    await expect(page.getByPlaceholder('e.g. Wiener Schnitzel')).toHaveValue(TEST_ITEM)
    await page.getByPlaceholder('e.g. Wiener Schnitzel').clear()
    await page.getByPlaceholder('e.g. Wiener Schnitzel').fill(UPDATED_NAME)

    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Item updated.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Edit item' })).not.toBeVisible()
    await expect(page.getByText(UPDATED_NAME)).toBeVisible()
  })

  test('toggles availability of the edited item', async ({ page }) => {
    await gotoAdminMenu(page)

    const row = page.locator('tr').filter({ hasText: UPDATED_NAME })
    const toggleBtn = row.getByRole('button', { name: /Hide item|Show item/i })
    const initialLabel = await toggleBtn.getAttribute('aria-label')

    await toggleBtn.click()

    await expect(
      page.getByText(/Item marked available\.|Item hidden from menu\./i)
    ).toBeVisible({ timeout: 15_000 })

    const next = initialLabel === 'Hide item' ? 'Show item' : 'Hide item'
    await expect(row.getByRole('button', { name: next })).toBeVisible()
  })

  test('deletes the created item', async ({ page }) => {
    await gotoAdminMenu(page)

    await page.getByRole('button', { name: `Edit ${UPDATED_NAME}` }).click()
    await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete item' }).click()

    await expect(page.getByText('Item deleted.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(UPDATED_NAME)).not.toBeVisible()
  })
})
