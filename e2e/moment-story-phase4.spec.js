import { test, expect } from '@playwright/test';
import { addOriginal, calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

// Shared synthetic records deliberately include open future work, long prose,
// same-day ties, undated Activities and earlier read-only Memory notes.
const records = () => {
  const common = [
    { id: 'earlier', title: 'Recorded chapter', date: calendarDate(-10), completed: true,
      description: '<p>The notes that remain attached to this chapter.</p>' },
    { id: 'later', title: 'Another chapter', date: calendarDate(-2), completed: true,
      description: '<p>Long-form writing belongs inside the same monthly notebook.</p>' },
    { id: 'planned', title: 'Future plan', date: calendarDate(8), completed: false },
    { id: 'undated', title: 'No date supplied', date: '', completed: false },
  ];
  return [
    { ...fixtureMoments()[0], id: 'journal', type: 'Vacation', name: 'Journal example',
      date: calendarDate(-11), notes: '<p>Our original introduction</p>',
      activities: structuredClone(common), attachments: [],
      memories: [{ id: 'legacy-journal', title: 'Old reflection', body: '<p>Still here</p>' }] },
    { id: 'diary', name: 'Diary example', type: 'Diary', date: calendarDate(-11),
      notes: '<p>My diary introduction</p>', activities: structuredClone(common), attachments: [],
      memories: [{ id: 'legacy-diary', title: 'Old reflection', body: '<p>Still here</p>' }] },
    { id: 'tasks', name: 'Tasks example', type: 'Tasks', date: calendarDate(-11),
      notes: '<p>My project context</p>', activities: structuredClone(common), attachments: [],
      memories: [{ id: 'legacy-tasks', title: 'Old reflection', body: '<p>Still here</p>' }] },
  ];
};

test('Journal, Diary and Tasks show different data-safe layouts with no duplicate entries', async ({ page }) => {
  const moments = records();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  const presentations = [
    ['journal', 'journey', 'A book of beautiful memories', 'journal-book', '.dn-journal-page'],
    ['diary', 'diary', 'My monthly diary', 'diary-monthbook', '.dn-diary-entry'],
    ['tasks', 'chronicle', 'Tasks & progress', 'task-board', '.dn-task-row'],
  ];
  for (const [id, mode, heading, layout, selector] of presentations) {
    await page.goto('/events/' + id + '/overview');
    const story = page.locator('.dn-v2-story');
    await expect(story).toHaveAttribute('data-presentation', mode);
    await expect(story.getByRole('heading', { name: heading })).toBeVisible();
    await expect(story.locator('[data-story-layout="' + layout + '"]')).toBeVisible();
    await expect(story.locator(selector)).toHaveCount(mode === 'chronicle' ? 4 : 2);
    await expect(story.locator('[data-story-activity]')).toHaveCount(4);
    await expect(story.getByRole('region', { name: 'Legacy reflections' })).toContainText('Old reflection');
    await expect(story.getByRole('region', { name: 'Moment introduction' })).toContainText('introduction');
    if (mode === 'chronicle') {
      await expect(story.getByRole('region', { name: 'Task status groups' })).toContainText('Future plan');
      await expect(story.getByRole('region', { name: 'Upcoming activities' })).toHaveCount(0);
      await expect(story.getByRole('region', { name: 'Activities without dates' })).toHaveCount(0);
      await expect(story.locator('.dn-v2-story img')).toHaveCount(0);
    } else {
      await expect(story.getByRole('region', { name: 'Recorded chapters' }).locator('[data-story-activity]')).toHaveCount(2);
      await expect(story.getByRole('region', { name: 'Upcoming activities' })).toContainText('Future plan');
      await expect(story.getByRole('region', { name: 'Activities without dates' })).toContainText('No date supplied');
    }
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test('Moment Type setting switches presentation without modifying any Guest records', async ({ page }) => {
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
  await page.getByRole('option', { name: 'Diary · Monthly writing' }).click();
  await editor.getByRole('button', { name: 'Save moment type' }).click();
  await page.goto('/events/personal/overview');
  await expect(page.locator('.dn-v2-story')).toHaveAttribute('data-presentation', 'diary');
  await page.goto('/events/journal/overview');
  await expect(page.locator('.dn-v2-story')).toHaveAttribute('data-presentation', 'journey');
  await page.goto('/settings/code-lists');
  await page.getByRole('button', { name: 'Personal. Tap or swipe either direction for actions.', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit moment type' }).getByRole('combobox', { name: 'Story presentation' })).toContainText('Diary');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test('Journal photo pages display actual linked originals large and without boxed Activity cards', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page, { width: 600, height: 900, count: 2 });
  await page.goto('/events/moment-one/overview');
  const story = page.locator('.dn-v2-story');
  await expect(story).toHaveAttribute('data-presentation', 'journey');
  await expect(story.locator('[data-story-layout="journal-book"]')).toBeVisible();
  const card = story.locator('[data-story-activity="shared"]');
  const image = card.locator('img').first();
  await card.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  const styles = await image.evaluate(node => {
    const imageStyle = getComputedStyle(node), cardStyle = getComputedStyle(node.closest('[data-story-activity]'));
    return { width: node.getBoundingClientRect().width, border: cardStyle.borderTopWidth, radius: imageStyle.borderRadius };
  });
  expect(styles.width).toBeGreaterThan(200);
  expect(styles.border).toBe('0px');
  await expect(story.locator('.dn-journey-stop')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Diary treats its Moment as one month, not a nested stack of month volumes or photo cards', async ({ page }) => {
  const moments = records();
  moments[1].activities.push({ id: 'earlier-month', title: 'Still a diary entry', date: '2026-01-05',
    description: '<p>A longer reflection that flows with all the other writing.</p>' });
  moments[1].attachments = [{ id: 'metadata-only', name: 'Archive.jpg', type: 'image/jpeg',
    activityId: 'earlier', size: 100 }];
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/diary/overview');
  await expect(page.locator('.dn-diary-month-heading')).toHaveCount(1);
  await expect(page.locator('.dn-diary-entry')).toHaveCount(3);
  await expect(page.locator('.dn-diary-volume')).toHaveCount(0);
  await expect(page.locator('.dn-v2-story img')).toHaveCount(0);
  await expect(page.locator('.dn-v2-story')).toContainText('A longer reflection');
  expect(errors).toEqual([]);
});

test('Tasks are status-first and chronological within each status without any photos', async ({ page }) => {
  const moment = {
    id: 'task-sort', name: 'Task priorities', type: 'Tasks', date: calendarDate(-5),
    notes: 'Work to finish', memories: [], attachments: [{
      id: 'metadata-only', name: 'Not displayed.jpg', type: 'image/jpeg', size: 100, activityId: 'new-task',
    }],
    activities: [
      { id: 'done', title: 'Completed task', status: 'completed', date: '2026-10-02' },
      { id: 'later', title: 'Open late', date: '2026-10-05', time: '17:30' },
      { id: 'cancel', title: 'Cancelled task', status: 'cancelled', date: '2026-09-01' },
      { id: 'new-task', title: 'Open earlier', date: '2026-10-05', time: '08:15' },
      { id: 'future', title: 'Future open', date: '2030-01-01' },
      { id: 'undated', title: 'Undated open', date: '' },
    ],
  };
  const errors = await seedGuest(page, { moments: [moment], incomes: [], expenses: [] });
  await page.goto('/events/task-sort/overview');
  const groups = page.locator('.dn-task-group');
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0)).toHaveAttribute('data-task-status', 'in-progress');
  await expect(groups.nth(1)).toHaveAttribute('data-task-status', 'completed');
  await expect(groups.nth(2)).toHaveAttribute('data-task-status', 'cancelled');
  await expect(groups.nth(0).locator('[data-story-activity]')).toHaveCount(4);
  expect(await groups.nth(0).locator('[data-story-activity]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-story-activity')))).toEqual(['new-task','later','future','undated']);
  await expect(page.locator('.dn-v2-story img')).toHaveCount(0);
  await expect(page.locator('.dn-task-files-note')).toContainText('available in Activity detail');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual([moment]);
  expect(errors).toEqual([]);
});

test('all three Story views keep text and original files responsive from 320px to desktop', async ({ page }) => {
  const moments = records();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  for (const id of ['journal','diary','tasks']) {
    await page.goto('/events/' + id + '/overview');
    for (const width of [320,390,768,1280]) {
      await page.setViewportSize({ width,height:844 });
      await expect(page.locator('.dn-v2-story')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow, id + ' at ' + width + 'px').toBe(false);
    }
  }
  expect(errors).toEqual([]);
});


test('Journal album prioritizes one hero photo, preserves portraits, and stays legible on iPhone', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page, { width: 600, height: 900, count: 3 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/events/moment-one/overview');
  const story = page.locator('.dn-v2-story');
  const photos = story.locator('[data-story-activity="shared"] .dn-journal-gallery[data-album-layout="series"] .dn-attachment-tile');
  await expect(photos).toHaveCount(3);
  await photos.first().scrollIntoViewIfNeeded();
  await expect(photos.first().locator('img')).toBeVisible();
  const lead = await photos.first().evaluate(node => ({
    width: node.getBoundingClientRect().width,
    column: getComputedStyle(node).gridColumn,
    fit: getComputedStyle(node.querySelector('img')).objectFit,
  }));
  const following = await photos.nth(1).evaluate(node => node.getBoundingClientRect().width);
  expect(lead.width).toBeGreaterThan(following * 1.4);
  expect(lead.fit).toBe('contain');
  await page.setViewportSize({ width: 390, height: 844 });
  await photos.nth(1).scrollIntoViewIfNeeded();
  await expect(photos.nth(1).locator('img')).toBeVisible();
  const mobile = await photos.nth(1).evaluate(node => ({
    fit: getComputedStyle(node.querySelector('img')).objectFit,
    width: node.getBoundingClientRect().width,
    clipped: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  expect(mobile.fit).toBe('contain');
  expect(mobile.width).toBeLessThan(390);
  expect(mobile.clipped).toBe(false);
  expect(errors).toEqual([]);
});

test('Tasks status controls persist, re-group, and confirm cancellation without changing other records', async ({ page }) => {
  const moments = records();
  const originalDiary = structuredClone(moments[1]);
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/tasks/overview');
  const groups = page.locator('.dn-task-group');
  const open = groups.nth(0);
  const completed = groups.nth(1);
  const cancelled = groups.nth(2);
  const future = page.getByRole('combobox', { name: 'Change status for Future plan' });
  await expect(future).toHaveValue('in-progress');
  await future.selectOption('completed');
  await expect(completed.locator('[data-story-activity="planned"]')).toBeVisible();
  const completedSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[2].activities.find(a => a.id === 'planned'));
  expect(completedSaved.completed).toBe(true);
  expect(completedSaved.status).toBe('completed');
  expect(completedSaved.completedAt).toBeTruthy();

  const changed = page.getByRole('combobox', { name: 'Change status for Future plan' });
  await changed.selectOption('cancelled');
  await expect(page.getByRole('dialog', { name: 'Cancel task?' })).toBeVisible();
  // The status control stays bound to saved state until confirmation.
  await expect(changed).toHaveValue('completed');
  await page.getByRole('dialog', { name: 'Cancel task?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(changed).toHaveValue('completed');
  await changed.selectOption('cancelled');
  await page.getByRole('dialog', { name: 'Cancel task?' }).getByRole('button', { name: 'Cancel task' }).click();
  await expect(cancelled.locator('[data-story-activity="planned"]')).toBeVisible();
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[2].activities.find(a => a.id === 'planned'))).cancelled).toBe(true);

  await page.getByRole('combobox', { name: 'Change status for Future plan' }).selectOption('in-progress');
  await expect(open.locator('[data-story-activity="planned"]')).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[2].activities.find(a => a.id === 'planned'));
  expect(restored.completed).toBe(false);
  expect(restored.cancelled).toBe(false);
  expect(restored.completedAt).toBe(null);
  expect(restored.status).toBe('in-progress');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))))[1]).toEqual(originalDiary);
  expect(errors).toEqual([]);
});

test('Task completion is disabled for an archived parent and original Activity detail stays reachable', async ({ page }) => {
  const moments = records();
  moments[2].archived = true;
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/tasks/overview');
  const control = page.getByRole('combobox', { name: 'Change status for Future plan' });
  await expect(control).toBeVisible();
  await expect(control.locator('option[value="completed"]')).toBeDisabled();
  await page.locator('.dn-task-row[data-story-activity="planned"] .dn-task-row-heading a').click();
  await expect(page).toHaveURL(/\/events\/tasks\/activities\/planned/);
  expect(errors).toEqual([]);
});
