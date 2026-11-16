import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const sampleFrames = async (locator, measure, count = 12) => locator.evaluate(async (node, { measure, count }) => {
  const values = [];
  for (let i = 0; i < count; i += 1) {
    await new Promise(requestAnimationFrame);
    if (!node.isConnected) break;
    const style = getComputedStyle(node);
    if (measure === 'y') values.push(style.transform === 'none' ? 0 : new DOMMatrix(style.transform).m42);
    else values.push(node.getBoundingClientRect().height);
  }
  return values;
}, { measure, count });

test('mobile form slides both ways and Repeat and More options animate in place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'light' });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Task' });
  const entrance = await sampleFrames(dialog, 'y');
  expect(entrance.some(value => value > 4)).toBe(true);
  expect(new Set(entrance.map(value => Math.round(value))).size).toBeGreaterThan(2);
  await expect.poll(() => dialog.evaluate(node => Math.abs(node.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(16);

  const title = dialog.getByRole('textbox', { name: 'Task title' });
  await title.fill('Draft title');
  const summary = dialog.locator('summary');
  const disclosure = dialog.locator('details');
  const panel = disclosure.locator('.dn-form-disclosure-panel');
  await summary.focus();
  await page.keyboard.press('Enter');
  const opening = await sampleFrames(panel, 'height');
  expect(opening.at(-1)).toBeGreaterThan(opening[0] + 10);
  const once = dialog.getByRole('radio', { name: 'Once', exact: true });
  const monthly = dialog.getByRole('radio', { name: 'Monthly', exact: true });
  await monthly.check();
  const preview = dialog.locator('.dn-form-reveal').filter({ has: page.locator('.dn-repeat-preview') });
  const repeatOpening = await sampleFrames(preview, 'height');
  expect(repeatOpening.at(-1)).toBeGreaterThan(repeatOpening[0] + 2);
  await expect(dialog.getByRole('status')).toContainText('Next repeat');
  await once.check();
  const repeatClosing = await sampleFrames(preview, 'height');
  expect(repeatClosing[0]).toBeGreaterThan(repeatClosing.at(-1) + 2);
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

  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-closing', 'true');
  const exit = await sampleFrames(dialog, 'y', 9);
  expect(exit.at(-1)).toBeGreaterThan(exit[0] + 10);
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
