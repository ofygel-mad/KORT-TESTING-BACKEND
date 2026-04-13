import { expect, test } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('create customer adds a new row in CRM customers', async ({ page }) => {
  const customerName = `E2E Customer ${Date.now()}`;

  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/customers');

  const addButton = page.locator('main').getByRole('button', { name: /add/i }).or(
    page.locator('main').getByRole('button').first(),
  );
  await expect(addButton).toBeVisible();
  await addButton.click({ force: true });

  const createForm = page.locator('main form');
  await expect(createForm).toBeVisible();
  await createForm.locator('input').nth(0).fill(customerName);
  await createForm.locator('input').nth(1).fill('+7 701 555 44 33');
  await createForm.evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(page.getByRole('cell', { name: customerName })).toBeVisible();
});

test('create deal adds a new card in CRM deals', async ({ page }) => {
  const dealTitle = `E2E Deal ${Date.now()}`;

  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/deals');

  const addButton = page.locator('main').getByRole('button', { name: /add/i }).or(
    page.locator('main').getByRole('button').first(),
  );
  await expect(addButton).toBeVisible();
  await addButton.click({ force: true });

  const titleInput = page.locator('main input').first();
  await expect(titleInput).toBeVisible();
  await titleInput.fill(dealTitle);
  await titleInput.press('Enter');

  await expect(page.getByRole('button', { name: new RegExp(dealTitle) })).toBeVisible();
});
