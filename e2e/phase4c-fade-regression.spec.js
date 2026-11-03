import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Diagnostic acceptance only. Each specimen uses synthetic Guest data.
// A ready business record alone does not prove a settled transition.
const scenarios = [
  { name: 'Moments light 320', theme: 'light', width: 320, height: 740,
    path: '/events', locator: '.dn-v2-moment-card' },
  { name: 'Activities dark 390', theme: 'dark', width: 390, height: 844,
    path: '/activities', locator: '.dn-v2-activity-card' },
  { name: 'Moments dark 390 control', theme: 'dark', width: 390, height: 844,
    path: '/events', locator: '.dn-v2-moment-card' },
  { name: 'Activities light 320 control', theme: 'light', width: 320, height: 740,
    path: '/activities', locator: '.dn-v2-activity-card' },
];
const presentation = (locator) => locator.evaluate((target) => {
  const node = target;
  const rect = node.getBoundingClientRect();
  const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
  const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
  const samples = [];
  let parent = node;
  let effectiveOpacity = 1;
  while (parent && parent.nodeType === 1) {
    const style = getComputedStyle(parent);
    const opacity = Number(style.opacity);
    effectiveOpacity *= Number.isFinite(opacity) ? opacity : 1;
    samples.push({
      tag: parent.tagName.toLowerCase(),
      className: String(parent.className || '').slice(0, 140),
      opacity: style.opacity,
      visibility: style.visibility,
      filter: style.filter,
      animation: style.animationName,
      transition: style.transitionProperty,
      pointerEvents: style.pointerEvents,
    });
    parent = parent.parentElement;
  }
  const stack = document.elementsFromPoint(x, y).slice(0, 9).map((element) => ({
    tag: element.tagName.toLowerCase(),
    className: String(element.className || '').slice(0, 100),
    opacity: getComputedStyle(element).opacity,
    z: getComputedStyle(element).zIndex,
  }));
  return { effectiveOpacity, bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    ancestors: samples, hitStack: stack,
    overlays: [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].map((element) => ({
      tag: element.tagName.toLowerCase(), className: String(element.className || '').slice(0, 80),
      visible: getComputedStyle(element).visibility,
    })) };
});

for (const scenario of scenarios) {
  test('4C visual stability: ' + scenario.name, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    const errors = await seedGuest(page, { theme: scenario.theme });
    await page.goto(scenario.path);
    const content = page.locator(scenario.locator).first();
    await expect(content).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.loading-skeleton')).toHaveCount(0);
    const before = await presentation(content);
    await page.screenshot({ path: testInfo.outputPath('01-ready.png'), animations: 'disabled' });
    await page.waitForTimeout(850);
    const after = await presentation(content);
    await page.screenshot({ path: testInfo.outputPath('02-settled.png'), animations: 'disabled' });
    console.log('PHASE4C_VISUAL_STABILITY ' + JSON.stringify({
      scenario: scenario.name,
      before: { effectiveOpacity: before.effectiveOpacity,
        ancestors: before.ancestors.filter((item) => item.opacity !== '1' || item.filter !== 'none'),
        hitStack: before.hitStack, overlays: before.overlays },
      after: { effectiveOpacity: after.effectiveOpacity,
        ancestors: after.ancestors.filter((item) => item.opacity !== '1' || item.filter !== 'none'),
        hitStack: after.hitStack, overlays: after.overlays },
    }));
    // Loaded content must be legible immediately, before the 140ms shell
    // animation finishes. A 0.94 shell fade is acceptable; stacked inner
    // page/card fades that produce 0.001–0.06 effective opacity are not.
    expect(before.effectiveOpacity, 'immediate visible content opacity').toBeGreaterThanOrEqual(.9);
    expect(after.effectiveOpacity).toBeGreaterThanOrEqual(.98);
    expect(after.hitStack[0].className).not.toContain('loading-skeleton');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(scenario.width + 1);
    expect(errors).toEqual([]);
  });
}
