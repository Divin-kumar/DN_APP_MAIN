import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

const records = () => {
  const original = fixtureMoments()[0];
  const common = [
    { id: 'earlier', title: 'Recorded chapter', date: calendarDate(-10), completed: true,
      description: '<p>The notes that remain attached to this chapter.</p>' },
    { id: 'later', title: 'Another chapter', date: calendarDate(-2), completed: true },
    { id: 'planned', title: 'Future plan', date: calendarDate(8), completed: false },
    { id: 'undated', title: 'No date supplied', date: '', completed: false },
  ];
  return [
    { ...original, id: 'journey', type: 'Vacation', name: 'Journey example',
      date: calendarDate(-11), notes: '<p>Our original introduction</p>',
      activities: structuredClone(common), attachments: [], memories: [{ id: 'memory', title: 'Old reflection', body: '<p>Still here</p>' }] },
    { id: 'diary', name: 'Diary example', type: 'Diary', date: calendarDate(-11),
      notes: '<p>My diary introduction</p>', activities: structuredClone(common), attachments: [],
      memories: [{ id: 'memory', title: 'Old reflection', body: '<p>Still here</p>' }] },
    { id: 'chronicle', name: 'Career example', type: 'Career', date: calendarDate(-11),
      notes: '<p>My project context</p>', activities: structuredClone(common), attachments: [],
      memories: [{ id: 'memory', title: 'Old reflection', body: '<p>Still here</p>' }] },
  ];
};

test('Journey, Diary and Chronicle render distinct layouts over the same original records', async ({ page }) => {
  const moments = records();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  for (const [id, mode, title, chapterHeading] of [
    ['journey', 'journey', 'The moments along the way', 'The journey so far'],
    ['diary', 'diary', 'Pages from this Moment', 'Dated entries'],
    ['chronicle', 'chronicle', 'The record of progress', 'Milestone log'],
  ]) {
    await page.goto('/events/' + id + '/overview');
    const story = page.locator('.dn-v2-story');
    await expect(story).toHaveAttribute('data-presentation', mode);
    await expect(story.getByRole('heading', { name: title })).toBeVisible();
    await expect(story.getByRole('heading', { name: chapterHeading })).toBeVisible();
    await expect(story.getByRole('region', { name: 'Recorded chapters' }).locator('[data-story-activity]')).toHaveCount(2);
    await expect(story.getByRole('region', { name: 'Upcoming activities' })).toContainText('Future plan');
    await expect(story.getByRole('region', { name: 'Activities without dates' })).toContainText('No date supplied');
    await expect(story.getByRole('region', { name: 'Legacy reflections' })).toContainText('Old reflection');
    await expect(story.getByRole('region', { name: 'Moment introduction' })).toContainText('introduction');
    if (mode === 'chronicle') {
      await expect(story.getByLabel('Milestone 1')).toHaveText('01');
      await expect(story.getByLabel('Milestone 2')).toHaveText('02');
    } else {
      await expect(story.locator('.dn-v2-story-sequence')).toHaveCount(0);
    }
    const ids = await story.getByRole('region', { name: 'Recorded chapters' }).locator('[data-story-activity]').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-story-activity')));
    expect(ids).toEqual(['earlier', 'later']);
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test('Moment Type editor changes Story presentation without changing saved Moments', async ({ page }) => {
  const moments = records();
  moments.push({ ...moments[0], id: 'personal', name: 'Personal example', type: 'Personal' });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/personal/overview');
  await expect(page.locator('.dn-v2-story')).toHaveAttribute('data-presentation', 'journey');
  await page.goto('/settings/code-lists');
  await page.getByRole('button', { name: 'Personal. Tap or swipe either direction for actions.', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit moment type' });
  await expect(editor.getByRole('combobox', { name: 'Story presentation' })).toBeVisible();
  await editor.getByRole('combobox', { name: 'Story presentation' }).click();
  await page.getByRole('option', { name: 'Diary · Journal pages' }).click();
  await editor.getByRole('button', { name: 'Save moment type' }).click();
  await page.goto('/events/personal/overview');
  await expect(page.locator('.dn-v2-story')).toHaveAttribute('data-presentation', 'diary');
  await page.goto('/events/journey/overview');
  await expect(page.locator('.dn-v2-story')).toHaveAttribute('data-presentation', 'journey');
  await page.goto('/settings/code-lists');
  await page.getByRole('button', { name: 'Personal. Tap or swipe either direction for actions.', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit moment type' }).getByRole('combobox', { name: 'Story presentation' })).toContainText('Diary');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test('all Story presentations avoid horizontal overflow at 320px through desktop', async ({ page }) => {
  const moments = records();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  for (const id of ['journey', 'diary', 'chronicle']) {
    await page.goto('/events/' + id + '/overview');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.dn-v2-story')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow, id + ' at ' + width + 'px').toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('Phase 4 visual identity includes three structurally different recorded experiences', async ({ page }) => {
  const moments = records();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  const expected = [
    ['journey','journey-trail','.dn-journey-stop','.dn-diary-sheet','.dn-chronicle-record'],
    ['diary','diary-pages','.dn-diary-sheet','.dn-journey-stop','.dn-chronicle-record'],
    ['chronicle','chronicle-ledger','.dn-chronicle-record','.dn-diary-sheet','.dn-journey-stop'],
  ];
  for (const [id, layout, present, absentA, absentB] of expected) {
    await page.goto('/events/' + id + '/overview');
    const story = page.locator('.dn-v2-story');
    await expect(story.locator('[data-story-layout="' + layout + '"]')).toBeVisible();
    await expect(story.locator(present)).toHaveCount(2);
    await expect(story.locator(absentA)).toHaveCount(0);
    await expect(story.locator(absentB)).toHaveCount(0);
    await expect(story.locator('[data-story-activity]')).toHaveCount(4);
    const styles = await story.locator(present).first().evaluate(node => {
      const style = getComputedStyle(node);
      return { display: style.display, background: style.backgroundImage, grid: style.gridTemplateColumns };
    });
    if (id === 'diary') expect(styles.background).toContain('repeating-linear-gradient');
    if (id === 'chronicle') expect(styles.display).toBe('grid');
    if (id === 'journey') expect(styles.display).toBe('grid');
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});
