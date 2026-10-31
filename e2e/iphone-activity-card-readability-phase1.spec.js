import { test, expect } from '@playwright/test';
import { addOriginal, fixtureMoments, seedGuest, swipe } from './fixtures.js';

// Browser geometry checks do not establish native installed-iPhone behavior.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Activity titles and inline status at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const title = 'Book a lakeside weekend with family and thoughtful plans '.repeat(2).trim();
    moments[0].activities[0].title = title;
    moments[0].name = 'Weekend in Ooty with everyone and a longer Moment name to keep recognizable';
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/activities');
    const card = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await expect(card).toBeVisible();
    await expect(card.locator('.event-activity-status')).toHaveText('In progress');
    await expect(card.locator('.event-activity-moment-name')).toContainText('Weekend in Ooty');
    await expect(card.locator('.event-activity-context > span:last-child')).toContainText(/Due|Past due/);
    await expect(card.locator('.event-activity-priority, .event-activity-context a')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
    const metrics = await card.evaluate((node) => {
      const title = node.querySelector('.event-activity-title-row > strong');
      const status = node.querySelector('.event-activity-status');
      const copy = node.querySelector('.event-activity-copy');
      const moment = node.querySelector('.event-activity-moment-name');
      const due = node.querySelector('.event-activity-context > span:last-child');
      return {
        titleSize: parseFloat(getComputedStyle(title).fontSize),
        titleWidth: title.getBoundingClientRect().width,
        textWidth: copy.getBoundingClientRect().width,
        titleTop: title.getBoundingClientRect().top,
        titleBottom: title.getBoundingClientRect().bottom,
        titleRight: title.getBoundingClientRect().right,
        statusTop: status.getBoundingClientRect().top,
        statusLeft: status.getBoundingClientRect().left,
        statusRight: status.getBoundingClientRect().right,
        statusBottom: status.getBoundingClientRect().bottom,
        copyRight: copy.getBoundingClientRect().right,
        contextTop: node.querySelector('.event-activity-context').getBoundingClientRect().top,
        statusSize: parseFloat(getComputedStyle(status).fontSize),
        momentSize: parseFloat(getComputedStyle(moment).fontSize),
        dueSize: parseFloat(getComputedStyle(due).fontSize),
        titleWrap: getComputedStyle(title).whiteSpace,
        clamp: getComputedStyle(title).webkitLineClamp,
        momentWrap: getComputedStyle(moment).whiteSpace,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.titleSize).toBeGreaterThanOrEqual(15);
    // A compact status shares the title's FIRST line, rather than consuming
    // a separate second row or overlaying the 15px readable title.
    expect(metrics.titleWidth).toBeGreaterThanOrEqual(metrics.textWidth * .5);
    expect(metrics.titleWrap).toBe('normal');
    expect(metrics.clamp).toBe('3');
    expect(metrics.statusTop).toBeGreaterThanOrEqual(metrics.titleTop - 2);
    expect(metrics.statusTop).toBeLessThanOrEqual(metrics.titleTop + 8);
    expect(metrics.statusLeft).toBeGreaterThanOrEqual(metrics.titleRight + 4);
    expect(metrics.statusRight).toBeLessThanOrEqual(metrics.copyRight + 1);
    expect(metrics.statusBottom).toBeLessThanOrEqual(metrics.titleTop + 30);
    expect(metrics.contextTop).toBeGreaterThanOrEqual(metrics.titleBottom - 1);
    expect(metrics.statusSize).toBeGreaterThanOrEqual(11);
    expect(metrics.momentSize).toBeGreaterThanOrEqual(12);
    expect(metrics.dueSize).toBeGreaterThanOrEqual(11);
    expect(metrics.momentWrap).toBe('normal');
    expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);
    // Every visible status, including completed/cancelled where listed,
    // must stay beside its own title at phone widths in both themes.
    const statuses = await page.locator('.activities-page .event-activity-card .event-activity-title-row').evaluateAll((rows) => rows.map((row) => {
      const title = row.querySelector('strong').getBoundingClientRect();
      const status = row.querySelector('.event-activity-status').getBoundingClientRect();
      return { titleTop: title.top, titleRight: title.right, statusTop: status.top, statusLeft: status.left };
    }));
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    for (const row of statuses) {
      expect(row.statusTop).toBeGreaterThanOrEqual(row.titleTop - 2);
      expect(row.statusTop).toBeLessThanOrEqual(row.titleTop + 8);
      expect(row.statusLeft).toBeGreaterThanOrEqual(row.titleRight + 4);
    }

    const source = () => page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const before = await source();
    await card.click();
    await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
    await page.goto('/events/moment-one/activities');
    const momentCard = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await expect(momentCard).toBeVisible();
    await expect(momentCard.locator('.event-activity-title-row > strong')).toHaveCSS('font-size', '15px');
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Open ' + title, exact: true })).toBeVisible();
    await page.goto('/activities');
    const again = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await swipe(page, again, { distance: 140 });
    const menu = page.getByRole('menu', { name: /Actions for Book a lakeside weekend/ });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    expect(await source()).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('Activity cover stays with its owner and reflects the chosen Detail photo', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page, { count: 2 });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.goto('/activities');
  const own = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  const unrelated = page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true });
  await expect(own.locator('.dn-v2-activity-cover img')).toBeVisible();
  await expect(unrelated.locator('.dn-v2-activity-cover img')).toHaveCount(0);
  await expect(unrelated.locator('.dn-v2-activity-cover-symbol')).toBeVisible();
  await page.goto('/events/moment-one/activities/shared');
  await page.getByRole('button', { name: 'Choose cover photo', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose cover photo' });
  const option = picker.getByRole('button', { name: 'Use as cover: Activity photo 1.png' });
  await expect(option).toBeEnabled();
  await option.click();
  await page.goto('/activities');
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true }).locator('.dn-v2-activity-cover img')).toBeVisible();
  const prefs = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes('activity-cover%3A'))
    .map(([,raw]) => JSON.parse(raw).imageKey).filter(Boolean));
  expect(prefs.some((value) => value.includes('photo-1'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(before);
  expect(errors).toEqual([]);
});
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Activity photo cards stay readable at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/activities');
    const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
    await expect(card.locator('.dn-v2-activity-cover')).toBeVisible();
    const m = await card.evaluate((node) => {
      const photo = node.querySelector('.dn-v2-activity-cover').getBoundingClientRect();
      const copy = node.querySelector('.event-activity-copy').getBoundingClientRect();
      const title = node.querySelector('.event-activity-title-row strong').getBoundingClientRect();
      const status = node.querySelector('.event-activity-status').getBoundingClientRect();
      return { photoWidth:photo.width, photoRight:photo.right, copyLeft:copy.left,
        titleTop:title.top, titleRight:title.right, statusTop:status.top, statusLeft:status.left,
        pageWidth:document.documentElement.scrollWidth };
    });
    expect(m.photoWidth).toBeGreaterThanOrEqual(79.9);
    expect(m.photoWidth).toBeLessThanOrEqual(94.1);
    expect(m.copyLeft).toBeGreaterThanOrEqual(m.photoRight - 1);
    expect(m.statusTop).toBeLessThanOrEqual(m.titleTop + 8);
    expect(m.statusLeft).toBeGreaterThanOrEqual(m.titleRight + 4);
    expect(m.pageWidth).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}

test('Activity photo choice is available on the list without changing originals', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page, { count: 2 });
  await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await card.getByRole('button', { name: 'Choose cover photo for Book a lakeside stay' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose activity cover photo' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Use as cover: Activity photo 1.png' }).click();
  await expect(picker).toHaveCount(0);
  await expect(card.locator('.dn-v2-activity-cover img')).toBeVisible();
  const prefs = await page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.includes('activity-cover%3A'))
    .map(([, raw]) => JSON.parse(raw).imageKey).filter(Boolean));
  expect(prefs.some((value) => value.includes('photo-1'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  const other = page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true });
  await expect(other.locator('.dn-v2-activity-cover img')).toHaveCount(0);
  await other.getByRole('button', { name: 'Manage photos for A different activity with the same ID' }).click();
  await expect(page).toHaveURL(/\/events\/moment-two\/activities\/shared$/);
  expect(errors).toEqual([]);
});
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test('Activity photo action is touch-safe and the first fold stays compact at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/activities');
    const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
    const action = card.getByRole('button', { name: 'Manage photos for Book a lakeside stay' });
    await expect(action).toBeVisible();
    const metrics = await page.evaluate(() => {
      const title = document.querySelector('.dn-header .dn-shell-page-title');
      const duplicateHeading = document.querySelector('.activities-page .life-timeline-heading');
      const progress = document.querySelector('.activities-page .event-activity-progress');
      const button = document.querySelector('.activities-page .dn-v2-activity-cover-action');
      const cover = button.closest('.dn-v2-activity-cover');
      const b = button.getBoundingClientRect(), c = cover.getBoundingClientRect();
      return { duplicateHeadingCount:Number(Boolean(duplicateHeading)), title: title?.textContent,
        progressBorder:getComputedStyle(progress).borderTopWidth,
        buttonWidth:b.width, buttonHeight:b.height,
        inside:b.left >= c.left - 1 && b.right <= c.right + 1,
        pageWidth:document.documentElement.scrollWidth };
    });
    expect(metrics.duplicateHeadingCount).toBe(0);
    expect(metrics.title).toBe('Activities');
    expect(metrics.progressBorder).toBe('0px');
    expect(metrics.buttonWidth).toBeGreaterThanOrEqual(43.9);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(43.9);
    expect(metrics.inside).toBe(true);
    expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);
    await action.click();
    await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
    expect(errors).toEqual([]);
  });
}
