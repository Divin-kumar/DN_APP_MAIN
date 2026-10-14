import { test, expect } from '@playwright/test';

const APP_NAME = /DN|LifeHub/i;

async function openActivitiesWithFreshDevice(page) {
  // Start at the protected target. If this browser context already has a
  // device principal, the app should let us straight through; otherwise the
  // guard sends us to the local-device setup screen.
  await page.goto('/activities', { waitUntil: 'domcontentloaded' });

  const activitiesHeading = page.getByRole('heading', { name: 'Activities' }).first();
  const continueButton = page.getByRole('button', { name: 'Continue on this device' });

  // Wait for either the protected page or the setup screen to finish rendering.
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return text.includes('Activities') || text.includes('Continue on this device');
  }, { timeout: 30000 }).catch(async () => {
    throw new Error(
      'Neither Activities nor device setup rendered. URL: ' + page.url() +
      '; page text: ' + (await page.locator('body').innerText().catch(() => '')).slice(0, 500)
    );
  });

  if (await activitiesHeading.isVisible().catch(() => false)) return;

  await expect(continueButton).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Device name').fill('Playwright isolated test device');
  await expect(continueButton).toBeEnabled({ timeout: 10000 });
  await continueButton.click();

  // Setup returns to the originally requested protected route.
  await expect(activitiesHeading).toBeVisible({ timeout: 30000 }).catch(async () => {
    const message = await page.getByRole('alert').allInnerTexts().catch(() => []);
    throw new Error(
      'Device setup did not open Activities. URL: ' + page.url() +
      '; setup message: ' + message.join(' | ')
    );
  });
}

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


test('Activities page opens its create form and keeps controls usable on mobile', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openActivitiesWithFreshDevice(page);

  await page.getByRole('button', { name: /New Activity/i }).click();
  await expect(page.getByRole('heading', { name: 'Create Activity' })).toBeVisible();
  await expect(page.getByLabel('Activity title')).toBeVisible();
  await expect(page.getByLabel('Date')).toBeVisible();
  await expect(page.getByLabel('Priority')).toBeVisible();
  await expect(page.getByLabel(/Notes & Context/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Activity' })).toBeVisible();

  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dialogLeft: rect?.left ?? 0,
      dialogRight: rect?.right ?? 0,
      dialogWidth: rect?.width ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.dialogWidth, 'Create form dialog should be rendered').toBeGreaterThan(0);
  expect(layout.dialogLeft, 'Dialog should not extend beyond the left edge').toBeGreaterThanOrEqual(-1);
  expect(layout.dialogRight, 'Dialog should not extend beyond the right edge').toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(pageErrors).toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Create Activity' })).toHaveCount(0);
});

test('Activities form validates a blank title without saving anything', async ({ page }) => {
  await openActivitiesWithFreshDevice(page);
  await page.getByRole('button', { name: /New Activity/i }).click();
  await page.getByRole('button', { name: 'Save Activity' }).click();
  await expect(page.getByRole('alert')).toContainText('Please provide an activity title.');
  await expect(page.getByRole('heading', { name: 'Create Activity' })).toBeVisible();
});
