import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium geometry and behavior, not installed Safari/VoiceOver QA.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Shared status feedback is quiet and actionable on ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const originalRecords = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const duration = await page.evaluate(async () => {
        const { default: useAppStore } = await import('/src/store/useAppStore.js');
        useAppStore.getState().showToast('Your Moment was saved', 'success', { label: 'View', to: '/events' });
        return useAppStore.getState().toast.duration;
      });
      expect(duration).toBeGreaterThanOrEqual(6000);
      const toast = page.getByRole('status').filter({ hasText: 'Your Moment was saved' });
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('data-tone', 'success');
      await expect(toast).toHaveAttribute('aria-atomic', 'true');
      const view = toast.getByRole('button', { name: 'View' });
      await expect(view).toBeVisible();
      const geometry = await toast.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const action = element.querySelector('button').getBoundingClientRect();
        const tone = getComputedStyle(element);
        return {
          left: rect.left, right: rect.right, top: rect.top,
          actionWidth: action.width, actionHeight: action.height,
          background: tone.backgroundColor, foreground: tone.color,
          pageWidth: document.documentElement.scrollWidth,
          theme: document.documentElement.dataset.theme,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(-.5);
      expect(geometry.right).toBeLessThanOrEqual(width + .5);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.actionWidth).toBeGreaterThanOrEqual(43.9);
      expect(geometry.actionHeight).toBeGreaterThanOrEqual(43.9);
      expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(geometry.background).not.toBe(geometry.foreground);
      expect(geometry.theme).toBe(theme);
      await view.click();
      await expect(page).toHaveURL(/\/events$/);
      await expect(page.locator('.app-toast')).toHaveCount(0);
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(originalRecords);
      expect(errors).toEqual([]);
    });
  }
}

test('Animated success feedback keeps its 44px action target during the entire entrance', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await seedGuest(page, { theme: 'light' });
  await page.goto('/dashboard');

  const measurements = await page.evaluate(async () => {
    const { default: useAppStore } = await import('/src/store/useAppStore.js');
    useAppStore.getState().showToast('Moment saved', 'success', { label: 'View', to: '/events' });
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let action = null;
    for (let attempt = 0; attempt < 6 && !action; attempt += 1) {
      await nextFrame();
      action = document.querySelector('.app-toast-action');
    }
    if (!action) throw new Error('The animated success action was not rendered');
    const toast = action.closest('.app-toast');
    const animation = getComputedStyle(toast).animationName;
    const heights = [action.getBoundingClientRect().height];
    for (let frame = 0; frame < 16; frame += 1) {
      await nextFrame();
      heights.push(action.getBoundingClientRect().height);
    }
    return { animation, heights };
  });

  expect(measurements.animation).toContain('dn-toast-rise-in');
  expect(measurements.heights).toHaveLength(17);
  expect(Math.min(...measurements.heights)).toBeGreaterThanOrEqual(43.9);
  expect(errors).toEqual([]);
});

test('Error feedback is announced as an alert and does not change saved records', async ({ page }) => {
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/dashboard');
  const originalRecords = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.evaluate(async () => {
    const { default: useAppStore } = await import('/src/store/useAppStore.js');
    useAppStore.getState().showToast('Could not save', 'error');
  });
  const toast = page.getByRole('alert').filter({ hasText: 'Could not save' });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute('data-tone', 'error');
  await expect(toast).toHaveAttribute('aria-live', 'assertive');
  const appearance = await toast.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, border: style.borderLeftColor };
  });
  expect(appearance.border).not.toBe(appearance.color);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(originalRecords);
  expect(errors).toEqual([]);
});
