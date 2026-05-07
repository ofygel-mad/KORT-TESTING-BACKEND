import { expect, test } from '@playwright/test';
import { loginAs, openCompanyRegistration } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test('company registration creates an account that can log in again', async ({ page }) => {
  const unique = Date.now();
  const companyName = `Test Company ${unique}`;
  const ownerName = `Test Owner ${unique}`;
  const email = `owner+${unique}@demo.kz`;
  const password = 'superpass1';

  const fields = await openCompanyRegistration(page);

  await fields.nth(0).fill(companyName);
  await fields.nth(1).fill(ownerName);
  await fields.nth(2).fill(email);
  await fields.nth(4).fill(password);
  await fields.nth(5).fill(password);

  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding|\/$/);

  await loginAs(page, email, password);
  await expect(page).not.toHaveURL(/\/auth\/login$/);
});
