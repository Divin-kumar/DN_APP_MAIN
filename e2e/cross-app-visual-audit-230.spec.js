import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source-controlled screenshot evidence. Synthetic Guest only, read-only.
const routes = [
  ['01-dashboard', '/dashboard'],
  ['02-tasks', '/tasks'],
  ['03-moments', '/events'],
  ['04-activities', '/activities'],
  ['05-story', '/events/moment-one/story'],
  ['06-gallery', '/events/moment-one/gallery'],
  ['07-moment-activities', '/events/moment-one/activities'],
  ['08-activity-detail', '/events/moment-one/activities/shared'],
  ['09-moment-transactions', '/events/moment-one/transactions'],
  ['10-all-transactions', '/financials/transactions'],
  ['11-insights', '/insights'],
  ['12-settings', '/settings'],
  ['12a-settings-appearance', '/settings/appearance'],
  ['13-settings-list-defaults', '/settings/list-defaults'],
  ['14-settings-code-lists', '/settings/code-lists'],
  ['15-settings-backup', '/settings/data-backup'],
  ['16-settings-about', '/settings/about'],
  ['17-pdf-studio', '/events/moment-one/pdf'],
];
const viewportModes = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 320, height: 740, theme: 'dark' },
  { width: 1280, height: 900, theme: 'light' },
];

for (const { width, height, theme } of viewportModes) {
  test('read-only cross-app Guest UI audit ' + width + 'px ' + theme, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors = await seedGuest(page, { theme });
    await page.setViewportSize({ width, height });
    const findings = [];
    const snapshots = [];
    for (const [step, path] of routes) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main').first()).toBeVisible({ timeout: 12000 });
        if (step === '17-pdf-studio') {
          await expect(page.locator('.dn-pdf-studio-page')).toBeVisible({ timeout: 20000 });
          await expect(page.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled({ timeout: 35000 });
        }
        if (step === '12a-settings-appearance') {
          await expect(page.getByRole('group', { name: 'Color theme' })).toBeVisible();
        }
        if (step === '13-settings-list-defaults') {
          const filter = page.getByRole('button', { name: /Activities filters/ });
          if (await filter.count()) await filter.click();
        }
        await page.waitForTimeout(320);
        const details = await page.evaluate(() => {
          const visible = (node) => node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
          const topHeadings = [...document.querySelectorAll('main h1,main h2,main h3')]
            .filter(visible).slice(0, 8).map((el) => el.textContent.trim().slice(0, 100));
          const viewportWidth = document.documentElement.clientWidth;
          const tabs = document.querySelector('.mobile-tabbar');
          const menus = [...document.querySelectorAll('button, [role="combobox"]')].filter(visible);
          const tiny = menus.map(el => ({ el, box: el.getBoundingClientRect() }))
            .filter(({ box }) => box.height > 0 && box.height < 36 && box.width > 0 && box.width < 36)
            .slice(0, 8).map(({ el, box }) => ({ text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0,45),
              w: Math.round(box.width), h: Math.round(box.height) }));
          const overflowing = [...document.querySelectorAll('main *')].filter(visible)
            .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -2 || r.right > viewportWidth + 2); })
            .slice(0, 8).map(el => ({ className: String(el.className || '').slice(0, 72), tag: el.tagName }));
          return {
            theme: document.documentElement.dataset.theme,
            viewportWidth, scrollWidth: document.documentElement.scrollWidth,
            headings: topHeadings, smallTargets: tiny, overflowing,
            dialogCount: document.querySelectorAll('[role="dialog"]').length,
            dockVisible: Boolean(tabs && visible(tabs) && getComputedStyle(tabs).display !== 'none'),
          };
        });
        snapshots.push({ step, path, ...details });
        if (details.scrollWidth > details.viewportWidth + 1) findings.push(step + ': document overflow ' + details.scrollWidth + '-' + details.viewportWidth);
        if (details.theme !== theme) findings.push(step + ': theme ' + details.theme + ' instead of ' + theme);
        const screenshot = await page.screenshot({ animations: 'disabled', fullPage: false });
        await testInfo.attach(step + '-' + width + '-' + theme, { body: screenshot, contentType: 'image/png' });
      } catch (error) {
        findings.push(step + ': ' + String(error?.message || error).slice(0, 340));
        await testInfo.attach(step + '-error-' + width + '-' + theme, { body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
          contentType: 'image/png' }).catch(() => {});
      }
    }
    await testInfo.attach('audit-report-' + width + '-' + theme, {
      body: Buffer.from(JSON.stringify({ width, theme, findings, snapshots, errors }, null, 2)),
      contentType: 'application/json',
    });
    console.log('DN_AUDIT_RESULT ' + JSON.stringify({ width, theme, findings, snapshots: snapshots.map(x => ({
      step:x.step, scrollWidth:x.scrollWidth, viewportWidth:x.viewportWidth,
      headings:x.headings, smallTargets:x.smallTargets.length, overflowing:x.overflowing.length
    })) }));
    expect(errors).toEqual([]);
    expect(findings).toEqual([]);
  });
}
