import { test, expect } from '@playwright/test';
import { addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

async function openStory(page) {
  await page.goto('/events/moment-one/story');
  const story = page.locator('.dn-v2-story');
  await expect(story).toBeVisible();
  return story;
}

async function assertViewport(page, locator) {
  // Measure the presented dialog after its entrance, not its clipped incoming
  // transform. Both ordinary motion and reduced-motion settings are supported.
  await locator.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  const rect = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.y).toBeGreaterThanOrEqual(-1);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [{ width:390, height:844 }, { width:820, height:900 }, { width:1440, height:960 }]) {
  test(`story ownership and compact Activity cards at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const moments = fixtureMoments();
    moments[0].notes = 'All Moment notes remain visible. END_NOTES';
    moments[0].activities[0].description = 'The owner Activity details precede its photographs. END_DETAILS';
    const errors = await seedGuest(page, { moments });
    const reference = await addOriginal(page, { count:3 });
    await page.evaluate((reference) => {
      const moments = JSON.parse(localStorage.getItem('dn_guest_eventGroups'));
      moments[0].attachments.push(
        { id:'train-photo', name:'Train photo.png', type:'image/png', activityId:'completed', ...reference },
        { id:'legacy-photo', name:'Legacy Moment photo.png', type:'image/png', activityId:'removed-activity', ...reference },
      );
      localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments));
    }, reference);
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const story = await openStory(page);
    await expect(story.getByRole('region', { name:'Moment introduction' })).toContainText('END_NOTES');
    await expect(story.getByRole('region', { name:'Moment introduction' }).locator('.dn-attachment-tile')).toHaveCount(2);
    const owner = story.locator('[data-story-activity="shared"]');
    await expect(owner.locator('.dn-attachment-tile')).toHaveCount(3);
    await expect(owner).toContainText('END_DETAILS');
    await expect(story.locator('[data-story-activity="completed"]').locator('.dn-attachment-tile')).toHaveCount(1);
    expect(await story.locator('.dn-attachment-tile').evaluateAll((nodes) => nodes.every((node) => node.closest('[data-story-activity], .dn-v2-story-intro')))).toBe(true);
    await page.goto('/dashboard');
    await page.locator('.dashboard-moment-row').filter({ hasText:moments[0].name }).locator('.dashboard-upcoming-row').click();
    await expect(page).toHaveURL(/\/events\/moment-one\/story$/);
    await expect(story.getByRole('region', { name:'Moment introduction' }).locator('.dn-attachment-tile')).toHaveCount(2);
    await expect(owner.locator('.dn-attachment-tile')).toHaveCount(3);
    await page.goto('/activities');
    const card = page.getByRole('group', { name:'Open Book a lakeside stay', exact:true });
    await expect(card).toBeVisible();
    expect((await card.boundingBox()).height).toBeLessThan(115);
    await expect(card.getByRole('button', { name:'Activity options', exact:true })).toHaveCount(0);
    await expect(card.locator('.event-activity-priority, .event-activity-context a')).toHaveCount(0);
    const columns = await page.locator('.event-activity-list').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(viewport.width < 768 ? 1 : viewport.width < 1440 ? 2 : 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name:/^Filters and sort/ }).click();
    await page.getByRole('button', { name:'Clear all', exact:true }).click();
    await expect(page.getByRole('group', { name:'Open A cancelled plan', exact:true })).toBeAttached();
    await expect(page.locator('.event-activity-card')).toHaveCount(4);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}

test('Activity transaction section appears and disappears with its actual linked data; failed reads offer retry', async ({ page }) => {
  const moments = fixtureMoments(); moments[0].activities[0].expenses = [];
  await seedGuest(page, { moments, incomes:[], expenses:[{ id:'unrelated', name:'Other Activity cost', amount:75, date:'2026-10-01', eventId:'moment-one', activityId:'completed', category:'Other' }] });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await expect(page.locator('.moment-transactions')).toHaveCount(0);
  await expect(page.getByText(/No transactions|Totals for this Activity/)).toHaveCount(0);
  const changeExpense = async (present) => page.evaluate(async (present) => {
    const store = (await import('/src/store/useEventStore.js')).default;
    const moment = store.getState().events.find((item) => item.id === 'moment-one');
    await store.getState().updateEventItem(null, true, { ...moment, activities:moment.activities.map((item) => item.id === 'shared'
      ? { ...item, expenses:present ? [{ id:'new-cost', name:'New linked cost', amount:125, date:'2026-10-01', category:'Other' }] : [] } : item) });
  }, present);
  await changeExpense(true);
  await expect(page.getByRole('list', { name:'Linked transactions', exact:true })).toContainText('New linked cost');
  await expect(page.locator('.moment-transactions.has-linked-transactions')).toBeVisible();
  await expect(page.getByRole('group', { name:'Totals for this Activity', exact:true }).locator('dd')).toHaveText(['₹0', '₹125', '-₹125']);
  await changeExpense(false);
  await expect(page.locator('.moment-transactions')).toHaveCount(0);
  await expect(page.locator('.moment-transactions.has-linked-transactions')).toHaveCount(0);
  // A failed read has no completed loaded scope. Model that state, rather than
  // attaching an impossible load error to an already-completed cache hit.
  await page.evaluate(async () => (await import('/src/store/useExpenseStore.js')).default.setState({ error:'Unable to load expenses.', loadedFor:null, loading:false }));
  await expect(page.getByRole('alert')).toContainText('Transactions couldn’t be loaded.');
  await page.getByRole('button', { name:'Try again', exact:true }).click();
  await expect(page.locator('.moment-transactions')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Story, original preview and Activity menu remain within a reduced viewport', async ({ page }) => {
  await page.setViewportSize({ width:320, height:480 });
  await seedGuest(page); await addOriginal(page);
  const story = await openStory(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const preview = story.getByRole('button', { name:'Preview Activity photo 0.png', exact:true });
  await preview.scrollIntoViewIfNeeded(); await preview.click();
  const original = page.getByRole('dialog', { name:'Activity photo 0.png', exact:true });
  await assertViewport(page, original);
  await page.keyboard.press('Escape'); await expect(preview).toBeFocused();
  await page.goto('/events/moment-one/activities/shared');
  await page.getByRole('button', { name:'Activity options', exact:true }).click();
  await assertViewport(page, page.getByRole('menu'));
  await expect(page.getByRole('menuitem', { name:'Edit', exact:true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/activities');
  const activityCard = page.getByRole('group', { name:'Open Book a lakeside stay', exact:true });
  await expect(activityCard.getByRole('button', { name:'Activity options', exact:true })).toHaveCount(0);
  await activityCard.click();
  await page.getByRole('button', { name:'Activity options', exact:true }).click();
  await expect(page.getByRole('menuitem', { name:'Edit', exact:true })).toBeVisible();
  await assertViewport(page, page.getByRole('menu'));
});
