import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic coarse-pointer Chromium layout/interaction checks. Native Safari,
// iOS text scaling and VoiceOver still require real-device acceptance.
test.use({ hasTouch: true, isMobile: true });

for (const [width, height, theme] of [
  [320, 640, 'dark'], [390, 844, 'light'],
  [430, 932, 'dark'], [844, 390, 'light'],
]) {
  test(`Appearance choices stay legible and tappable at ${width}x${height} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/settings/appearance');
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ]);

    const themeOptions = page.getByRole('group', { name: 'Color theme' });
    await expect(themeOptions.getByRole('button')).toHaveCount(2);
    for (const name of ['Soft light', 'Dark']) {
      const choice = themeOptions.getByRole('button', { name: new RegExp(name) });
      const details = await choice.evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        textSize: parseFloat(getComputedStyle(node.querySelector('strong')).fontSize),
        hintSize: parseFloat(getComputedStyle(node.querySelector('small')).fontSize),
        right: node.getBoundingClientRect().right,
      }));
      expect(details.height).toBeGreaterThanOrEqual(44);
      expect(details.textSize).toBeGreaterThanOrEqual(13);
      expect(details.hintSize).toBeGreaterThanOrEqual(11.9);
      expect(details.right).toBeLessThanOrEqual(width + 1);
    }

    const region = page.getByRole('region', { name: 'Story and PDF appearance' });
    await expect(region).toBeVisible();
    for (const format of ['Journal', 'Diary', 'Tasks']) {
      const group = region.getByRole('group', { name: new RegExp(format) });
      const choices = group.locator('.dn-story-design-choice');
      await expect(choices).toHaveCount(3);
      const items = await choices.evaluateAll((nodes) => nodes.map((node) => {
        const name = node.querySelector('.dn-story-design-choice-name');
        const note = node.querySelector('.dn-story-design-choice-note');
        const box = node.getBoundingClientRect();
        return {
          height: box.height, left: box.left, right: box.right,
          nameFont: parseFloat(getComputedStyle(name).fontSize),
          noteFont: parseFloat(getComputedStyle(note).fontSize),
          border: getComputedStyle(node).borderBottomWidth,
        };
      }));
      for (const item of items) {
        expect(item.height).toBeGreaterThanOrEqual(44);
        expect(item.nameFont).toBeGreaterThanOrEqual(12.9);
        expect(item.noteFont).toBeGreaterThanOrEqual(11.9);
        expect(item.left).toBeGreaterThanOrEqual(-1);
        expect(item.right).toBeLessThanOrEqual(width + 1);
      }
      if (width <= 390) {
        // The iPhone layout is a single list of three full-width choices,
        // without horizontal scrolling or clipped secondary text.
        const positions = await choices.evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().left));
        expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
      }
    }

    const journal = region.getByRole('button', { name: 'Journal: Heritage' });
    await journal.tap();
    await expect(journal).toHaveAttribute('aria-pressed', 'true');
    await testInfo.attach(`appearance-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await region.getByRole('button', { name: 'Save designs' }).tap();
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('dn_story_pdf_design_v1:guest')).styles.journey
    )).toBe('heritage');
    await page.reload();
    await expect(region.getByRole('button', { name: 'Journal: Heritage' }))
      .toHaveAttribute('aria-pressed', 'true');

    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
