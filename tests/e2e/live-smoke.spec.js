import { test, expect } from '@playwright/test';

const APP_NAME = /DN|LifeHub/i;

test('Firebase site serves the app document', async ({ page, request }) => {
  const response = await request.get('/');
  expect(response.status(), 'The deployed homepage should respond successfully').toBeLessThan(400);
  const html = await response.text();
  expect(html).toMatch(/<html[\s>]/i);
  expect(html).toMatch(/<div[^>]+id=["']root["']/i);
  await page.goto('/');
  await expect(page.locator('body')).not.toBeEmpty();
});

test('About route loads or redirects to device setup without a fatal screen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/settings/about', { waitUntil: 'domcontentloaded' });
  expect(response, 'About navigation should produce a document response').not.toBeNull();
  expect(response.status()).toBeLessThan(500);

  await expect(page.locator('body')).not.toBeEmpty();
  await page.waitForTimeout(1500);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length, 'The app should render visible content').toBeGreaterThan(10);
  expect(bodyText, 'The app should not remain on its route-crash fallback').not.toContain('This page couldn’t load');
  expect(pageErrors, 'No uncaught JavaScript exceptions should occur during initial load').toEqual([]);
});

test('PWA manifest is served and contains app metadata', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name || manifest.short_name).toBeTruthy();
  expect(manifest.display).toMatch(/standalone|minimal-ui/i);
});

test('mobile viewport does not introduce document-level horizontal overflow', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/settings/about', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    title: document.title,
  }));

  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(pageErrors).toEqual([]);
});
