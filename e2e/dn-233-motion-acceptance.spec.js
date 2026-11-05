import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const width of [320, 390, 1280]) {
  test(`Dashboard section transitions preserve data, scroll, and button semantics at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const errors = await seedGuest(page);
    await page.goto('/dashboard');
    const sections = ['Tasks', 'Moments', 'Activities'];
    const baseline = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    for (const name of sections) {
      const section = page.locator(name === 'Tasks' ? '.dn-dashboard-tasks'
        : `[aria-label="${name}"]`).filter({ has: page.locator('.dashboard-section-heading') }).first();
      const show = section.getByRole('button', { name: `Show ${name} on dashboard` });
      const hide = section.getByRole('button', { name: `Hide ${name} on dashboard` });
      if (await hide.count()) await hide.click();
      await expect(section.locator('.dn-dashboard-reveal')).toHaveCount(0);
      await show.click();
      await expect(section.locator('.dn-dashboard-reveal')).toBeVisible();
      await expect(hide).toHaveAttribute('aria-expanded', 'true');
      await hide.click();
      await expect(section.locator('.dn-dashboard-reveal')).toHaveCount(0);
      await expect(show).toHaveAttribute('aria-expanded', 'false');
    }
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(baseline);
    expect(errors).toEqual([]);
  });
}

test('Swipe actions are a spring-driven portal, not a sliding card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/activities');
  const row = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(row).toBeVisible();
  const baseline = await row.boundingBox();
  await row.focus();
  await page.keyboard.press('ArrowRight');
  const popup = page.getByRole('menu', { name: /Actions for Book a lakeside stay/ });
  await expect(popup).toHaveAttribute('data-dn-motion', 'swipe-spring');
  await expect(popup.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  const settled = await row.boundingBox();
  expect(Math.abs(settled.x - baseline.x)).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Success toast rises on entrance, with all motion disabled by reduced-motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/dashboard');
  const publish = async () => page.evaluate(async () => {
    const store = (await import('/src/store/useAppStore.js')).default;
    store.getState().showToast('Saved with care', 'success', { label: 'View', to: '/tasks' });
  });
  await publish();
  const toast = page.locator('.app-toast');
  await expect(toast).toBeVisible();
  await expect.poll(() => toast.evaluate((node) => getComputedStyle(node).animationName)).toBe('dn-toast-rise-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => toast.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Hide Moments on dashboard' }).click();
  await expect(page.locator('[aria-label="Moments"] .dn-dashboard-reveal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Moments on dashboard' }).click();
  await expect(page.locator('[aria-label="Moments"] .dn-dashboard-reveal')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Filter release settles actual sibling order and removes the raised ghost', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters and sort/ }).first().click();
  const modal = page.getByRole('dialog', { name: 'Activity filters' });
  await modal.getByRole('button', { name: 'Clear all', exact: true }).click();
  await modal.getByRole('button', { name: 'Add filter', exact: true }).click();
  await modal.getByRole('button', { name: 'Add filter', exact: true }).click();
  const rows = modal.locator('.dn-condition-rule');
  const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.conditionId));
  const handle = rows.first().getByRole('button', { name: 'Drag to reorder filter' });
  const from = await handle.boundingBox(), to = await rows.last().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await expect(rows.first()).toHaveClass(/is-drag-source/);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await expect(rows.last()).toHaveClass(/is-drag-target/);
  await page.mouse.up();
  await expect(rows.first()).toHaveAttribute('data-condition-id', ids[1]);
  await expect(rows.last()).toHaveAttribute('data-condition-id', ids[0]);
  await expect(page.locator('body > .dn-condition-drag-float')).toHaveCount(0);
  await expect(modal.locator('.is-drag-target,.is-drag-source')).toHaveCount(0);
  expect(errors).toEqual([]);
});
