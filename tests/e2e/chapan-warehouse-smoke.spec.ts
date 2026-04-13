import { expect, test } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('chapan orders route opens without crashing', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/workzone/chapan/orders');

  await expect(page).toHaveURL(/\/workzone\/chapan\/orders$/);
  await expect(page.getByText('Чапан', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Заказы' })).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ Создать заказ/i })).toBeVisible();
});

test('chapan warehouse route opens without crashing', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/workzone/chapan/warehouse');

  await expect(page).toHaveURL(/\/workzone\/chapan\/warehouse$/);
  await expect(page.getByRole('heading', { name: 'Склад' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Заказы/i })).toBeVisible();
});
