import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const authFile = 'e2e/.auth/customer.json'

setup('authenticate as test customer', async ({ page }) => {
  const email = process.env.TEST_CUSTOMER_EMAIL
  const password = process.env.TEST_CUSTOMER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD must be set in .env.test'
    )
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await page.goto('/login')

  // Wait past the session-checking spinner
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('/dashboard', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})
