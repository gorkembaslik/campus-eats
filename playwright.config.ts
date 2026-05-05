import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Desktop viewport so the cart sidebar auto-expands (no mobile sticky bar)
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
      testIgnore: /admin/,
    },
    { name: 'admin-setup', testMatch: /admin\.setup\.ts/ },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['admin-setup'],
      testMatch: /admin-menu\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
