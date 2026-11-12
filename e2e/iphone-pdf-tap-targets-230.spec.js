import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

// Mobile/coarse-pointer Chromium emulates iPhone gestures, not native Safari.
test.use({ isMobile: true, hasTouch: true });
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark'], [844, 390, 'light']]) {
  test(`PDF Studio iPhone actions meet touch sizes at ${width}x${height} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    await expect(studio.getByRole('button', { name: 'Download customized PDF' }))
      .toBeEnabled({ timeout: 30000 });
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ]);
    const controls = studio.locator('.dn-pdf-preview-tools');
    const buttons = controls.getByRole('button');
    await expect(buttons).toHaveCount(5);
    const rects = await buttons.evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    }));
    for (const r of rects) {
      expect(r.width).toBeGreaterThanOrEqual(43.9);
      expect(r.height).toBeGreaterThanOrEqual(43.9);
      expect(r.left).toBeGreaterThanOrEqual(-1);
      expect(r.right).toBeLessThanOrEqual(width + 1);
    }
    if (width === 320) {
      const geometry = await controls.evaluate((node) => {
        const box = (child) => {
          const { x, y, right, bottom } = child.getBoundingClientRect();
          return { x, y, right, bottom };
        };
        return {
          layout: getComputedStyle(node).display,
          pages: box(node.firstElementChild),
          zoom: box(node.querySelector('.dn-pdf-preview-zoom-controls')),
          fullscreen: box(node.lastElementChild),
          right: node.getBoundingClientRect().right,
        };
      });
      expect(geometry.layout).toBe('grid');
      expect(Math.abs(geometry.pages.y - geometry.fullscreen.y)).toBeLessThan(2);
      expect(geometry.zoom.y).toBeGreaterThanOrEqual(geometry.pages.bottom + 4);
      expect(geometry.zoom.right).toBeLessThanOrEqual(geometry.right + 1);
    }
    await controls.getByRole('button', { name: 'Zoom in PDF preview' }).tap();
    await expect(controls.getByRole('button', { name: 'Reset PDF preview zoom' })).toHaveText('125%');
    await controls.getByRole('button', { name: 'Reset PDF preview zoom' }).tap();
    await expect(controls.getByRole('button', { name: 'Reset PDF preview zoom' })).toHaveText('100%');

    await controls.getByRole('button', { name: 'Open full-screen PDF preview' }).tap();
    const viewer = page.locator('dialog.dn-pdf-fullscreen-dialog');
    await expect(viewer).toBeVisible();
    const close = viewer.getByRole('button', { name: 'Close full-screen PDF preview' });
    const closeBox = await close.boundingBox();
    expect(closeBox.width).toBeGreaterThanOrEqual(43.9);
    expect(closeBox.height).toBeGreaterThanOrEqual(43.9);
    await close.tap();
    await expect(viewer).not.toBeVisible();

    await studio.getByRole('button', { name: 'PDF design Minimal' }).tap();
    const restore = studio.getByRole('button', { name: 'Use saved default' });
    await expect(restore).toBeVisible();
    const target = await restore.boundingBox();
    expect(target.height).toBeGreaterThanOrEqual(43.9);
    expect(target.x).toBeGreaterThanOrEqual(-1);
    expect(target.x + target.width).toBeLessThanOrEqual(width + 1);
    await testInfo.attach(`iPhone-PDF-${width}-${height}-${theme}`, {
      body: await page.screenshot(), contentType: 'image/png',
    });
    // A visible button can still sit underneath a sticky rail on tiny screens.
    // Verify the actual touch-center receives this button, not a nearby control.
    await restore.scrollIntoViewIfNeeded();
    const hittable = await restore.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      return y >= 0 && y <= window.innerHeight
        && node.contains(document.elementFromPoint(x, y));
    });
    if (height > width) expect(hittable).toBe(true);
    const savedStyle = (await studio.locator('.dn-pdf-style-default small').innerText())
      .replace(/^Saved default:\s*/, '').trim();
    const pageThemeBeforeRestore = await studio.getByRole('button', { name: 'Light', exact: true })
      .getAttribute('aria-pressed');
    await restore.tap();
    await expect(restore).toHaveCount(0);
    await expect(studio.getByRole('button', { name: `PDF design ${savedStyle}` }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(await studio.getByRole('button', { name: 'Light', exact: true })
      .getAttribute('aria-pressed')).toBe(pageThemeBeforeRestore);
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}


// A page change should never show the next PDF page at the former page's
// scrolled midsection. Synthetic scroll geometry only, not native Safari.
for (const [width, height, theme] of [[320, 740, 'dark'], [390, 844, 'light']]) {
  test(`iPhone PDF page changes reset preview/fullscreen scroll at ${width}px ${theme}`, async ({ page }) => {
    const moments = fixtureMoments();
    moments[0].activities = [0, 1, 2, 3].map((index) => ({
      id: 'page-scroll-' + index, title: 'Chapter ' + (index + 1),
      date: calendarDate(-12 + index), status: 'in-progress',
      description: 'A chapter written for this page navigation check.',
    }));
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { moments, incomes: [], expenses: [], theme });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    const download = studio.getByRole('button', { name: 'Download customized PDF' });
    await expect(download).toBeEnabled({ timeout: 30000 });
    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));

    await studio.getByRole('radio', { name: 'Start each Activity on a new PDF page' }).click();
    await studio.getByRole('button', { name: 'Update preview' }).click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    const pageCount = Number.parseInt(await studio.locator('.dn-pdf-page-count').innerText(), 10);
    expect(pageCount).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < 3; i += 1) {
      await studio.getByRole('button', { name: 'Zoom in PDF preview' }).click();
    }
    await expect(studio.getByRole('button', { name: 'Reset PDF preview zoom' }))
      .toHaveText('200%');
    const viewport = studio.locator('.dn-pdf-preview-viewport');
    const scrolled = await viewport.evaluate((node) => {
      node.scrollTop = 175;
      node.scrollLeft = 95;
      return [node.scrollTop, node.scrollLeft];
    });
    expect(scrolled[0]).toBeGreaterThan(40);
    expect(scrolled[1]).toBeGreaterThan(30);
    await studio.getByRole('button', { name: 'Next PDF page' }).click();
    await expect(studio.getByRole('img', { name: 'Rendered PDF page 2' })).toBeVisible();
    await expect.poll(() => viewport.evaluate((node) => [node.scrollTop, node.scrollLeft]))
      .toEqual([0, 0]);
    await expect(studio.getByRole('button', { name: 'Reset PDF preview zoom' }))
      .toHaveText('200%');

    await studio.getByRole('button', { name: 'Toggle PDF page thumbnails' }).click();
    await studio.getByRole('navigation', { name: 'PDF page thumbnails' })
      .getByRole('button', { name: 'Go to PDF page 3' }).click();
    await expect(studio.getByRole('img', { name: 'Rendered PDF page 3' })).toBeVisible();

    await studio.getByRole('button', { name: 'Open full-screen PDF preview' }).click();
    const dialog = studio.getByRole('dialog', { name: 'Full-screen PDF preview' });
    await expect(dialog).toBeVisible();
    const fullViewport = dialog.locator('.dn-pdf-fullscreen-viewport');
    const fullscreenScroll = await fullViewport.evaluate((node) => {
      const img = node.querySelector('img');
      // Controlled test-only viewport overflow: fullscreen normally scales to fit.
      img.style.width = '700px';
      img.style.maxWidth = 'none';
      img.style.height = '1400px';
      node.scrollTop = 135;
      node.scrollLeft = 80;
      return [node.scrollTop, node.scrollLeft];
    });
    expect(fullscreenScroll[0]).toBeGreaterThan(40);
    expect(fullscreenScroll[1]).toBeGreaterThan(30);
    await dialog.getByRole('button', { name: 'Next fullscreen page' }).click();
    await expect(dialog.getByRole('img', { name: 'Fullscreen PDF page 4' })).toBeVisible();
    await expect.poll(() => fullViewport.evaluate((node) => [node.scrollTop, node.scrollLeft]))
      .toEqual([0, 0]);
    await dialog.getByRole('button', { name: 'Close full-screen PDF preview' }).click();
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
