import { expect, test, type Page } from '@playwright/test';
import { preparePage } from './helpers';

const CHAPAN_ROUTES = [
  '/workzone/chapan/orders',
  '/workzone/chapan/orders/new',
  '/workzone/chapan/production',
  '/workzone/chapan/ready',
  '/workzone/chapan/shipping',
  '/workzone/chapan/archive',
  '/workzone/chapan/invoices',
  '/workzone/chapan/warehouse',
  '/workzone/chapan/returns',
  '/workzone/chapan/purchase',
  '/workzone/chapan/analytics',
  '/workzone/chapan/clients',
] as const;

async function loginOwner(page: Page) {
  await preparePage(page);
}

test.describe('Chapan production regression', () => {
  test('all main Chapan sections open without client crashes', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginOwner(page);

    for (const route of CHAPAN_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      await expect(page.locator('body')).not.toContainText('Нет доступа');
      await expect(page.locator('body')).not.toContainText('внутренняя ошибка сервера');
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('purchase form keeps typed data through the 40-second activity window and saves', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await loginOwner(page);
    await page.goto('/workzone/chapan/purchase', { waitUntil: 'networkidle' });

    const stableUrl = page.url();
    const unexpectedNavigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && page.url() !== stableUrl) {
        unexpectedNavigations.push(page.url());
      }
    });

    await page.getByRole('button', { name: /Новая накладная/i }).click();

    const title = page.getByPlaceholder(/Закуп ткани/i);
    const product = page.getByPlaceholder('Название товара');
    const quantity = page.locator('input[type="number"]').nth(0);
    const unitPrice = page.locator('input[type="number"]').nth(1);
    const invoiceTitle = `E2E закуп ${Date.now()}`;

    await title.fill(invoiceTitle);
    await product.fill('Ткань e2e');
    await quantity.fill('2');
    await unitPrice.fill('1500');

    for (let i = 0; i < 9; i += 1) {
      await page.mouse.move(120 + i, 140 + i);
      await page.keyboard.press('Shift');
      await page.waitForTimeout(5_000);
      await expect(title).toHaveValue(invoiceTitle);
      await expect(product).toHaveValue('Ткань e2e');
    }

    expect(unexpectedNavigations).toEqual([]);
    await expect(page).toHaveURL(stableUrl);
    await expect(title).toBeVisible();

    await page.getByRole('button', { name: /^Сохранить$/ }).click();
    await expect(page.getByText(invoiceTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ткань e2e')).not.toBeVisible();

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
