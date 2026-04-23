import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eHost = process.env.E2E_HOST || '127.0.0.1';
const e2eFrontendPort = process.env.E2E_FRONTEND_PORT || '4174';
const e2eBackendPort = process.env.E2E_BACKEND_PORT || '8002';
const e2eBaseUrl = `http://${e2eHost}:${e2eFrontendPort}`;
const e2eApiBaseUrl = `http://${e2eHost}:${e2eBackendPort}`;

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
    baseURL: e2eBaseUrl,
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
      url: `${e2eApiBaseUrl}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -File tests/e2e/start-frontend.ps1',
      url: e2eBaseUrl,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
