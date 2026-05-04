import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true';
const runAllBrowsers = process.env.E2E_ALL_BROWSERS === 'true';
const e2eHost = process.env.E2E_HOST || '127.0.0.1';
const e2eFrontendPort = process.env.E2E_FRONTEND_PORT || (isCI ? '4173' : '4174');
const e2eBackendPort = process.env.E2E_BACKEND_PORT || (isCI ? '8000' : '8002');
const e2eBaseUrl = process.env.E2E_BASE_URL || `http://${e2eHost}:${e2eFrontendPort}`;
const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || `http://${e2eHost}:${e2eBackendPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  globalTimeout: isCI ? 20 * 60_000 : 0,
  expect: {
    timeout: 15_000,
  },
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
    ...((isCI || runAllBrowsers) ? [{
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'tests/e2e/.auth/firefox.json' },
    }] : []),
    // WebKit remains opt-in locally because storage/session behavior differs across engines.
    ...(!isCI && runAllBrowsers ? [{
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'tests/e2e/.auth/webkit.json' },
    }] : []),
  ],

  ...(isCI
    ? {}
    : {
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
      }),
});
