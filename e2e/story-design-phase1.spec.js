import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

test('Story designs are independently configurable and persist without rewriting Memories', async ({ page }) => {
  const basic = fixtureMoments()[0];
  const moments = [
    { ...basic, id: 'style-journal', name: 'Styled Journal', type: 'Vacation' },
    { ...basic, id: 'style-diary', name: 'Styled Diary', type: 'Diary' },
    { ...basic, id: 'style-tasks', name: 'Styled Tasks', type: 'Tasks' },
  ];
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings/appearance');
  const editor = page.getByRole('region', { name: 'Story and PDF appearance' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Journal: Heritage' }).click();
  await editor.getByRole('button', { name: 'Diary: Editorial' }).click();
  await editor.getByRole('button', { name: 'Tasks: Heritage' }).click();
  await editor.getByRole('button', { name: 'Save designs' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_story_pdf_design_v1:guest')));
  expect(stored.styles).toEqual({ journey: 'heritage', diary: 'editorial', chronicle: 'heritage' });
  for (const [id, format, style] of [
    ['style-journal', 'journey', 'heritage'],
    ['style-diary', 'diary', 'editorial'],
    ['style-tasks', 'chronicle', 'heritage'],
  ]) {
    await page.goto('/events/' + id + '/story');
    const story = page.locator('.dn-v2-story');
    await expect(story).toHaveAttribute('data-presentation', format);
    await expect(story).toHaveAttribute('data-design-style', style);
  }
  await page.goto('/settings/appearance');
  await expect(editor.getByRole('button', { name: 'Journal: Heritage' })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: 'Suggested defaults' }).click();
  await editor.getByRole('button', { name: 'Save designs' }).click();
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_story_pdf_design_v1:guest')));
  expect(reset.styles).toEqual({ journey: 'editorial', diary: 'heritage', chronicle: 'minimal' });
  const savedMoments = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  expect(savedMoments.map(m => m.name)).toEqual(moments.map(m => m.name));
  expect(errors).toEqual([]);
});
