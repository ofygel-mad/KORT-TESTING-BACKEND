import { test, expect } from '@playwright/test';
import { preparePage } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test('auth page opens', async ({ page }) => {
  await preparePage(page);
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/auth\/login/);
});
