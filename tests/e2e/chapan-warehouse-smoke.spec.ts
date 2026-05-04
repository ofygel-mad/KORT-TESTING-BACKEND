import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

async function loginOwner(page: Page) {
  await preparePage(page);
}

test('chapan orders route opens without crashing', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/workzone/chapan/orders', { waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/workzone\/chapan\/orders$/);
  await expect(page.getByText('Чапан', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Заказы' })).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ Создать заказ/i })).toBeVisible();
});

test('chapan warehouse route opens without crashing', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/workzone/chapan/warehouse', { waitUntil: 'networkidle' });

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
