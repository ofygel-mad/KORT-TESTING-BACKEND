import { test, expect } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('auth page opens', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/auth\/login/);
});
