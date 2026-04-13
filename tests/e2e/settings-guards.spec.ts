import { expect, test } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('pending first-login employee is redirected to set password step', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);
  await page.goto('/auth/login');

  await page.getByText('Войти как сотрудник').click();
  const phoneInput = page.locator('form input').first();
  await phoneInput.fill('+77010000003');
  await page.locator('form button[type="submit"]').click();

  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  await expect(page.locator('[class*="submitBtn"]')).toBeVisible();
});
