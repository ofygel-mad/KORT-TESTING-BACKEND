import { chromium, expect, type StorageState } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, '.auth');
const E2E_HOST = process.env.E2E_HOST || '127.0.0.1';
const E2E_FRONTEND_PORT = process.env.E2E_FRONTEND_PORT || '4174';
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://${E2E_HOST}:${E2E_FRONTEND_PORT}`;

async function globalSetup() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  async function authenticate() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('[chromium] Browser console error:', msg.text());
      });

      console.log('[chromium] Navigating to login page...');
      await page.goto(`${E2E_BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForURL(/\/auth\/login$/, { timeout: 30000 }).catch(() => {});
      console.log('[chromium] Login page loaded');

      const email = 'admin@kort.local';
      const password = 'demo1234';

      console.log('[chromium] Filling login form...');
      const fields = page.locator('form input:not([type="checkbox"])');
      await expect(fields).toHaveCount(2, { timeout: 30000 });
      await fields.nth(0).fill(email);
      await fields.nth(1).fill(password);

      console.log('[chromium] Submitting login form...');
      await page.locator('form button[type="submit"]').click();

      console.log('[chromium] Waiting for redirect from login page (30s timeout)...');
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });
      console.log('[chromium] Successfully redirected from login page');

      await page.evaluate(() => {
        window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
      });

      const rawState = await page.context().storageState();
      const sanitizedState: StorageState = {
        cookies: rawState.cookies,
        origins: rawState.origins.map((origin) => ({
          origin: origin.origin,
          localStorage: origin.localStorage ?? [],
        })),
      };

      for (const browserName of ['chromium', 'firefox', 'webkit'] as const) {
        const stateFile = path.join(authDir, `${browserName}.json`);
        fs.writeFileSync(stateFile, JSON.stringify(sanitizedState, null, 2));
        console.log(`[${browserName}] Saved auth state to ${stateFile}`);
      }
    } catch (error) {
      console.error('[chromium] Global setup failed:', error);
      throw new Error('Failed to authenticate during global setup');
    } finally {
      await browser.close();
    }
  }

  await authenticate();
}

export default globalSetup;
