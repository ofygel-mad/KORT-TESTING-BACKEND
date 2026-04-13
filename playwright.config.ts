import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  globalSetup: path.resolve(__dirname, './tests/e2e/globalSetup.ts'),
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: 'tests/e2e/.auth/user.json',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/chromium.json' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'tests/e2e/.auth/firefox.json' },
    },
    // WebKit requires libwoff2dec which is unavailable on GitHub Actions Linux runners
    ...(process.env.CI ? [] : [{
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'tests/e2e/.auth/webkit.json' },
    }]),
  ],

  webServer: [
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -File tests/e2e/start-backend.ps1',
      url: 'http://127.0.0.1:8001/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -File tests/e2e/start-frontend.ps1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
