import { chromium, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, '.auth');

async function globalSetup() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Browser console error:', msg.text());
    });

    console.log('Navigating to login page...');
    await page.goto('http://127.0.0.1:4173/auth/login', { waitUntil: 'networkidle' });
    console.log('Login page loaded');

    const email = 'admin@kort.local';
    const password = 'demo1234';

    console.log('Filling login form...');
    const fields = page.locator('form input:not([type="checkbox"])');
    await expect(fields).toHaveCount(2);
    await fields.nth(0).fill(email);
    await fields.nth(1).fill(password);

    console.log('Submitting login form...');
    await page.locator('form button[type="submit"]').click();

    console.log('Waiting for redirect from login page (30s timeout)...');
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });
    console.log('Successfully redirected from login page');

    await page.evaluate(() => {
      window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
    });

    const state = await page.context().storageState();

    fs.writeFileSync(path.join(authDir, 'chromium.json'), JSON.stringify(state, null, 2));
    fs.writeFileSync(path.join(authDir, 'firefox.json'), JSON.stringify(state, null, 2));
    fs.writeFileSync(path.join(authDir, 'webkit.json'), JSON.stringify(state, null, 2));

    console.log('Global setup: Authentication successful');
    console.log(`Saved auth state to ${authDir}`);
  } catch (error) {
    console.error('Global setup failed:', error);
    throw new Error('Failed to authenticate during global setup');
  } finally {
    await browser.close();
  }
}

export default globalSetup;
