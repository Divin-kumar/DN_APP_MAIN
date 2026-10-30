import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium coverage. Installed iPhone Safari and signed-in Code Lists remain release gates.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Code Lists are easy to browse and add controls stay compact at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/code-lists');
      await expect(page.getByRole('heading', { name: 'Code Lists', exact: true })).toBeVisible();

      const index = page.getByRole('navigation', { name: 'Code List sections' });
      const links = index.getByRole('link');
      await expect(links).toHaveCount(7);
      await expect(index.getByRole('link', { name: 'Moment Types' })).toHaveAttribute('href', '#code-list-eventTypes');
      await expect(index.getByRole('link', { name: 'Payment Methods' })).toHaveAttribute('href', '#code-list-paymentMethods');
      await expect(index.getByRole('link', { name: 'Sorting & filters' })).toHaveAttribute('href', '#list-order');
      await expect(page.locator('.dn-code-list-editor-section')).toHaveCount(6);

      const layout = await page.evaluate(() => {
        const rail = document.querySelector('.dn-code-list-index-scroll');
        const inputs = [...document.querySelectorAll('.dn-premium-code-lists .code-list-add-row.has-labels')];
        const rect = (element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          pageWidth: document.documentElement.scrollWidth,
          railWidth: rail.clientWidth, railContentWidth: rail.scrollWidth,
          railHeight: rect(rail).height,
          editors: inputs.map((editor) => {
            const [value, label] = editor.querySelectorAll('input');
            const button = editor.querySelector('button');
            return {
              value: rect(value), label: rect(label), button: rect(button),
              inputSize: Number.parseFloat(getComputedStyle(value).fontSize),
              labelSize: Number.parseFloat(getComputedStyle(label).fontSize),
            };
          }),
          actions: [...document.querySelectorAll('.dn-code-list-editor-section .code-list-row')].slice(0, 4)
            .map((button) => ({ hint: Boolean(button.querySelector('.dn-code-list-row-more')), height: rect(button).height })),
        };
      });
      expect(layout.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(layout.railContentWidth).toBeGreaterThan(layout.railWidth);
      expect(layout.railHeight).toBeGreaterThanOrEqual(44);
      expect(layout.editors).toHaveLength(2);
      for (const row of layout.editors) {
        expect(row.button.height).toBeGreaterThanOrEqual(44);
        expect(row.button.height).toBeLessThanOrEqual(52);
        expect(row.value.height).toBeGreaterThanOrEqual(44);
        expect(row.label.height).toBeGreaterThanOrEqual(44);
        expect(row.inputSize).toBeGreaterThanOrEqual(16);
        expect(row.labelSize).toBeGreaterThanOrEqual(16);
        expect(row.value.y + row.value.height).toBeLessThanOrEqual(row.label.y + 1);
        expect(Math.abs(row.label.y - row.button.y)).toBeLessThanOrEqual(2);
      }
      expect(layout.actions.length).toBeGreaterThan(0);
      expect(layout.actions.every(({ hint, height }) => hint && height >= 44)).toBe(true);

      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      await index.getByRole('link', { name: 'Activity Priorities' }).click();
      await expect(page).toHaveURL(/#code-list-activityPriorities$/);
      await expect(page.locator('#code-list-activityPriorities')).toBeVisible();

      await page.locator('#code-list-activityPriorities .code-list-row').first().click();
      await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);

      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
