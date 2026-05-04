import { test, expect, type Locator, type Page } from '@playwright/test';
import { preparePage } from './helpers';

const E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || `http://${process.env.E2E_HOST || '127.0.0.1'}:${process.env.E2E_BACKEND_PORT || '8002'}/api/v1`;

test.use({ storageState: { cookies: [], origins: [] } });

async function expectFullyVisibleInViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const viewportHeight = page.viewportSize()?.height ?? 0;
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
}

test('company registration submits on Enter from password confirmation', async ({ page }) => {
  const unique = Date.now();

  await preparePage(page);
  await page.goto('/auth/register');

  const fields = page.locator('form input:not([type="checkbox"])');
  await expect(fields).toHaveCount(6);

  await fields.nth(0).fill(`Test Company ${unique}`);
  await fields.nth(1).fill(`Test Owner ${unique}`);
  await fields.nth(2).fill(`owner+enter-${unique}@demo.kz`);
  await fields.nth(4).fill('superpass');
  await fields.nth(5).fill('superpass');
  await fields.nth(5).press('Enter');

  await expect(page).not.toHaveURL(/\/auth\/register$/);
  await expect(page).toHaveURL(/\/onboarding|\/$/);
});

test('company registration footer stays visible on short desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await preparePage(page);
  await page.goto('/auth/register');

  const fields = page.locator('form input:not([type="checkbox"])');
  await expect(fields).toHaveCount(6);

  await fields.nth(0).fill('Test');
  await fields.nth(1).fill('Zhasaral Askhat');
  await fields.nth(2).fill('ofygel@gmail.com');
  await fields.nth(3).fill('+7 747 456-86-61');
  await fields.nth(4).fill('12345678');
  await fields.nth(5).fill('12345679');

  const formViewport = page.locator('[class*="formViewport"]');
  const submitButton = page.locator('form button[type="submit"]');
  await expect.poll(async () => formViewport.evaluate((node) => Math.round(node.scrollTop))).toBe(0);
  await expectFullyVisibleInViewport(page, submitButton);
  await submitButton.click();
  await expect(page.locator('[class*="errorMessage"]').first()).toBeVisible();
  await expect.poll(async () => formViewport.evaluate((node) => Math.round(node.scrollTop))).toBe(0);
  await expectFullyVisibleInViewport(page, submitButton);
});

test('login rejects an invalid password for an existing account', async ({ page, request }) => {
  const unique = Date.now();
  const email = `invalid-password+${unique}@demo.kz`;
  const password = 'superpass1';

  await request.post(`${E2E_API_BASE_URL}/auth/register/company`, {
    data: {
      company_name: `Password Check ${unique}`,
      full_name: `Password Owner ${unique}`,
      email,
      password,
    },
  });

  await preparePage(page);
  await page.goto('/auth/login');

  const fields = page.locator('form input:not([type="checkbox"])');
  await expect(fields).toHaveCount(2);

  await fields.nth(0).fill(email);
  await fields.nth(1).fill('wrong-password');
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.locator('[class*="errorMessage"]').first()).toBeVisible();
});
