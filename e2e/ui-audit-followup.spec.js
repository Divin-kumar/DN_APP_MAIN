import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

for (const theme of ['light', 'dark']) {
  test(`desktop audit controls stay with their content in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1363, height: 936 });
    const moments = fixtureMoments();
    moments[0].notes = 'A lake at the end of the road. We took the long way and had the shore to ourselves. The next morning we walked back before breakfast.';
    const photo = 'https://images.example.test/cover.png';
    moments[1].attachments = [{ id: 'cover', type: 'image/png', name: 'Cover', url: photo }];
    await page.route(photo, route => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxXkAAAAASUVORK5CYII=', 'base64'),
    }));
    await seedGuest(page, { moments, theme });
    await page.goto('/events');
    const scope = page.getByRole('note', { name: /Guest mode: your data is stored locally on this device/ });
    await expect(scope).toHaveText('Guest · Local');
    const fits = await scope.locator('span').evaluate(node => node.scrollWidth <= node.clientWidth);
    expect(fits).toBe(true);

    const dateTile = page.getByRole('button', { name: 'Open ' + moments[0].name })
      .locator('.dn-v2-moment-cover');
    const photoTile = page.getByRole('button', { name: 'Open ' + moments[1].name })
      .locator('.dn-v2-moment-cover');
    await expect(dateTile.locator('.dn-v2-moment-cover-date')).toBeVisible();
    await expect(photoTile.locator('img')).toBeVisible();
    expect((await dateTile.boundingBox()).width).toBeLessThan((await photoTile.boundingBox()).width * 0.65);
    expect((await dateTile.boundingBox()).height).toBeLessThan((await photoTile.boundingBox()).height / 2);

    await page.getByRole('button', { name: 'Open ' + moments[0].name }).click();
    const intro = page.getByRole('region', { name: 'Moment introduction' });
    const edit = intro.getByRole('button', { name: 'Edit introduction' });
    await expect(edit).toBeVisible();
    const readingColumn = await intro.locator('.dn-v2-story-intro-text').boundingBox();
    const editBox = await edit.boundingBox();
    expect(Math.abs(editBox.x + editBox.width - readingColumn.x - readingColumn.width)).toBeLessThan(2);
    expect(readingColumn.width).toBeLessThan((await intro.boundingBox()).width * 0.9);
    await edit.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.dn-moment-nav').getByRole('link', { name: 'PDF Studio' }).click();
    const download = page.getByRole('button', { name: 'Download customized PDF' });
    await expect(download).toHaveCount(1);
    await expect(download).toBeEnabled({ timeout: 25000 });
    await expect(download).toBeInViewport({ ratio: 1 });
    const downloadBox = await download.boundingBox();
    expect(downloadBox.y + downloadBox.height).toBeLessThanOrEqual(
      (await page.locator('.dn-pdf-preview-tools').boundingBox()).y,
    );
  });

  test(`short browser viewport keeps page actions outside the dock in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 454, height: 312 });
    await seedGuest(page, { theme });
    const content = page.locator('.dn-content');
    const docked = page.locator('.dn-command-trigger');
    async function expectClear(control) {
      await expect(docked).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => {
        const scrollport = await content.boundingBox();
        const dock = await docked.boundingBox();
        return dock.y - (scrollport.y + scrollport.height);
      }).toBeGreaterThanOrEqual(3);
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
      expect(await control.evaluate(node => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      })).toBe(true);
    }

    await page.goto('/events/moment-one/pdf');
    const tab = page.locator('.dn-moment-nav').getByRole('link', { name: 'PDF Studio' });
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expectClear(tab);

    await page.goto('/settings');
    const defaults = page.getByRole('link', { name: 'Open List defaults' });
    await expectClear(defaults);
    await defaults.click();
    await expect(page).toHaveURL(/\/settings\/list-defaults$/);
    await expect(page.getByRole('heading', { name: 'List defaults', exact: true, level: 1 })).toBeVisible();

    await docked.click();
    await page.getByRole('dialog').getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const hide = page.getByRole('button', { name: 'Hide Moments on dashboard' });
    await expectClear(hide);
    await hide.click();
    await expect(page.getByRole('button', { name: 'Show Moments on dashboard' })).toBeVisible();
  });
}

test('PDF cover renders its edition once and keeps the running header on reading pages', async ({ page }) => {
  await seedGuest(page);
  // Observe the actual text painted onto the raster pages shared by the preview and export.
  await page.addInitScript(() => {
    window.__dnPdfLabels = [];
    const pages = new WeakMap();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      if (text === 'JOURNAL') {
        if (!pages.has(this.canvas)) {
          const labels = [];
          pages.set(this.canvas, labels);
          window.__dnPdfLabels.push(labels);
        }
        pages.get(this.canvas).push(y);
      }
      return fillText.call(this, text, x, y, ...rest);
    };
  });
  await page.goto('/events/moment-one/pdf');
  const download = page.getByRole('button', { name: 'Download customized PDF' });
  await expect(download).toBeEnabled({ timeout: 25000 });
  const pages = await page.evaluate(() => window.__dnPdfLabels);
  expect(pages).toContainEqual([23]);
  expect(pages.some(([y]) => y > 80)).toBe(true);
  for (const labels of pages) expect(labels).toHaveLength(1);
  await page.getByText('Book sections', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Cover page.*dedicated opening page/ }).uncheck();
  await expect(download).toBeDisabled();
  await page.evaluate(() => { window.__dnPdfLabels = []; });
  await page.getByRole('button', { name: 'Update preview' }).click();
  await expect(download).toBeEnabled({ timeout: 25000 });
  const withoutCover = await page.evaluate(() => window.__dnPdfLabels);
  expect(withoutCover.length).toBeGreaterThan(0);
  for (const labels of withoutCover) expect(labels).toEqual([23]);
});
