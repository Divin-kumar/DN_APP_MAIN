import { expect, test } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const restingStyle = (control) => control.evaluate((element) => {
  const { backgroundColor, boxShadow, color, outlineStyle, filter, transform } = getComputedStyle(element);
  return { backgroundColor, boxShadow, color, outlineStyle, filter, transform };
});

test.describe('touch feedback', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const [theme, width, height] of [['light', 320, 640], ['dark', 430, 932]]) {
    test(`touch release clears feedback while selections remain at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);

      const activities = page.getByRole('region', { name: 'Activities', exact: true });
      const toggle = activities.getByRole('button', { name: /Activities on dashboard/ });
      const dates = activities.getByRole('group', { name: 'Activity dates' });
      await expect(dates).toBeVisible();
      const initial = await restingStyle(toggle);
      await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(dates).toHaveCount(0);
      await expect.poll(() => restingStyle(toggle)).toEqual(initial);
      await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => restingStyle(toggle)).toEqual(initial);
      await toggle.hover();
      await expect.poll(() => restingStyle(toggle)).toEqual(initial);

      const upcoming = dates.getByRole('button', { name: 'Upcoming' });
      const onThisDay = dates.getByRole('button', { name: 'On This Day' });
      await onThisDay.tap();
      await expect(onThisDay).toHaveAttribute('aria-pressed', 'true');
      await expect(upcoming).toHaveAttribute('aria-pressed', 'false');
      await expect(onThisDay).toHaveCSS('filter', 'none');
      expect(await onThisDay.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('""');

      const profile = page.getByRole('button', { name: 'Open profile and account menu' });
      const closedProfile = await restingStyle(profile);
      await profile.tap();
      await expect(profile).toHaveAttribute('aria-expanded', 'true');
      await profile.tap();
      await expect(profile).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => restingStyle(profile)).toEqual(closedProfile);

      await page.goto('/activities');
      const refine = page.getByRole('button', { name: /^Filters and sort/ });
      const sheet = page.getByRole('dialog', { name: 'Activity filters' });
      await expect(refine).toBeVisible();
      const closedRefine = await restingStyle(refine);
      await refine.tap();
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: 'Cancel', exact: true }).tap();
      await expect(sheet).toHaveCount(0);
      await expect.poll(() => restingStyle(refine)).toEqual(closedRefine);
      expect(errors).toEqual([]);
    });
  }
});

test('desktop hover, transient press and keyboard focus each remain visible', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedGuest(page);
  await page.goto('/dashboard');

  const dates = page.getByRole('group', { name: 'Activity dates' });
  const button = dates.getByRole('button', { name: 'On This Day' });
  await expect(button).toBeVisible();
  const idleColor = await button.evaluate((element) => getComputedStyle(element).color);
  await button.hover();
  await expect(button).not.toHaveCSS('color', idleColor);
  const initial = await button.boundingBox();

  await page.mouse.down();
  await expect(button).toHaveCSS('filter', 'brightness(1.13)');
  expect(await button.boundingBox()).toEqual(initial);
  await page.mouse.up();
  await expect(button).toHaveCSS('filter', 'none');
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  await dates.getByRole('button', { name: 'Upcoming' }).focus();
  // WebKit's default Tab setting includes all controls with Option+Tab.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
});
