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

  const metricsButton = page.getByRole('button', { name: /^Метрики$/ });
  await expect(metricsButton).toBeVisible();
  await metricsButton.click();
  await expect(page.getByText('Всего позиций')).toBeVisible();

  const addButton = page.getByRole('button', { name: /^Добавить$/ });
  await expect(addButton).toBeVisible();
  await addButton.click();
  await expect(page.getByText('Добавить позицию')).toBeVisible();
});
