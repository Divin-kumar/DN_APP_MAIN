import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test('mobile form slides both ways and Repeat and More options animate in place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'light' });
  await page.goto('/dashboard');
  const menu = page.getByRole('dialog', { name: 'Navigate & create' });
  // dispatchEvent bypasses Playwright's stability wait so the test detects a queued first tap.
  await page.getByRole('button', { name: 'Open quick create menu' }).dispatchEvent('click', { detail: 1 });
  expect(await menu.count()).toBe(1);
  const handoff = await menu.getByRole('button', { name: 'Task', exact: true }).evaluate(async button => {
    const menuSheet = button.closest('section[role="dialog"]');
    button.click();
    await new Promise(requestAnimationFrame);
    return {
      formMounted: Boolean(document.querySelector('.dn-task-dialog')),
      menuInert: menuSheet.inert,
    };
  });
  expect(handoff.formMounted).toBe(true);
  expect(handoff.menuInert).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'New Task' });
  await expect.poll(() => dialog.evaluate(node => Math.abs(node.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(16);

  const title = dialog.getByRole('textbox', { name: 'Task title' });
  await title.fill('Draft title');
  const summary = dialog.locator('summary');
  const disclosure = dialog.locator('details');
  const panel = disclosure.locator('.dn-form-disclosure-panel');
  await summary.focus();
  const opening = await panel.evaluate(node => {
    node.previousElementSibling.click();
    const [animation] = node.getAnimations();
    const duration = animation.effect.getTiming().duration;
    animation.pause();
    animation.currentTime = duration / 2;
    const middle = node.getBoundingClientRect().height;
    animation.currentTime = duration;
    const end = node.getBoundingClientRect().height;
    animation.play();
    return { middle, end };
  });
  expect(opening.middle).toBeGreaterThan(0);
  expect(opening.end - opening.middle).toBeGreaterThan(1);
  await expect(panel).not.toHaveAttribute('data-moving', 'true');
  const once = dialog.getByRole('radio', { name: 'Once', exact: true });
  const monthly = dialog.getByRole('radio', { name: 'Monthly', exact: true });
  const preview = dialog.locator('.dn-form-reveal').filter({ has: page.locator('.dn-repeat-preview') });
  const measureRepeat = (choice) => choice.evaluate(async (radio) => {
    const group = radio.closest('fieldset');
    const heights = [];
    radio.click();
    for (let frame = 0; frame < 13; frame += 1) {
      await new Promise(requestAnimationFrame);
      heights.push(group.querySelector('.dn-form-reveal')?.getBoundingClientRect().height ?? 0);
    }
    return heights;
  });
  const repeatOpening = await measureRepeat(monthly);
  expect(repeatOpening.at(-1)).toBeGreaterThan(Math.min(...repeatOpening) + 2);
  await expect(dialog.getByRole('status')).toContainText('Next repeat');
  const repeatClosing = await measureRepeat(once);
  expect(Math.max(...repeatClosing)).toBeGreaterThan(repeatClosing.at(-1) + 2);
  await expect(preview).toHaveCount(0);

  const collapsing = await panel.evaluate(async node => {
    const start = node.getBoundingClientRect().height;
    node.previousElementSibling.click();
    const [animation] = node.getAnimations();
    const duration = animation.effect.getTiming().duration;
    animation.pause();
    animation.currentTime = duration / 2;
    const middle = node.getBoundingClientRect().height;
    animation.play();
    return { start, middle };
  });
  expect(collapsing.middle).toBeGreaterThan(0);
  expect(collapsing.start - collapsing.middle).toBeGreaterThan(10);
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(monthly).toBeHidden();
  await expect(title).toHaveValue('Draft title');

  const exit = await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(async button => {
    const sheet = button.closest('section[role="dialog"]');
    const readY = () => {
      const transform = getComputedStyle(sheet).transform;
      return transform === 'none' ? 0 : new DOMMatrix(transform).m42;
    };
    const initialY = readY();
    const positions = [];
    button.click();
    for (let i = 0; i < 12; i += 1) {
      await new Promise(requestAnimationFrame);
      if (!sheet.isConnected) break;
      positions.push(readY());
    }
    return { initialY, positions };
  });
  expect(Math.max(...exit.positions)).toBeGreaterThan(exit.initialY + 10);
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('page-local Activity editor animates on Escape and supports reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/events/moment-one/activities/shared');
  const open = () => page.getByRole('button', { name: 'Edit original activity writing' }).click();
  await open();
  const dialog = page.getByRole('dialog', { name: 'Edit activity' });
  await expect(dialog.getByRole('textbox', { name: 'Activity title' })).toBeVisible();
  await expect.poll(() => dialog.evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('data-closing', 'true');
  await expect(dialog).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open();
  const panel = dialog.locator('.dn-form-disclosure-panel');
  const summary = dialog.locator('summary');
  await summary.click();
  expect(await panel.evaluate(node => node.getAnimations().length)).toBe(0);
  await expect(dialog.getByRole('textbox', { name: 'Description (optional)' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
