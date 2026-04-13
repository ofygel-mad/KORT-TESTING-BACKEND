import { test, expect } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('login screen exposes primary auth actions', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);
  await page.goto('/auth/login');

  const fields = page.locator('form input:not([type="checkbox"])');
  await expect(fields).toHaveCount(2);
  await expect(page.locator('form button[type="submit"]')).toBeVisible();
  await expect(page.locator('.footerRow button, [class*="footerRow"] button')).toHaveCount(2);
});
