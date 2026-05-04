import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

test('seeded customer opens in CRM drawer', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/crm/customers', { waitUntil: 'domcontentloaded' });

  await page.getByRole('row', { name: /aidana@example\.kz/i }).click();

  await expect(page.getByRole('link', { name: 'aidana@example.kz' })).toBeVisible();
});

test('team settings show seeded employees', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/settings/team', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /\+77010000003/ })).toBeVisible();
});
