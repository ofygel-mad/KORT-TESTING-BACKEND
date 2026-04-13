import { expect, test } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('seeded customer opens in CRM drawer', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/customers');

  await page.getByRole('row', { name: /aidana@example\.kz/i }).click();

  await expect(page.getByRole('link', { name: 'aidana@example.kz' })).toBeVisible();
});

test('team settings show seeded employees', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/settings/team');

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /\+77010000003/ })).toBeVisible();
});
