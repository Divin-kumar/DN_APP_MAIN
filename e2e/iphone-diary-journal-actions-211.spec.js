import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const load = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
const moments = () => [
  { id:'diary', name:'Daily diary', type:'Diary', date:'2026-10-31',
    activities:[
      { id:'morning', title:'Morning thoughts', date:'2026-10-31', time:'08:00', description:'A fresh start' },
      { id:'evening', title:'Evening thoughts', date:'2026-10-31', time:'21:00', description:'Quiet finish' },
    ], attachments:[] },
  { id:'journal', name:'Travel journal', type:'Journal', date:'2026-10-31',
    activities:[{ id:'chapter', title:'Day one', date:'2026-10-31', priority:'medium',
      description:'The story begins', entries:[
        { id:'continuation', title:'New details', date:'2026-10-31', time:'13:15',
          priority:'medium', description:'More memories' },
      ] }], attachments:[] },
];

for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
  test(`Diary day and appended Journal actions share one form at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height:844 });
    const errors = await seedGuest(page, { moments:moments(), incomes:[], expenses:[], theme });

    await page.goto('/events/diary/activities/morning');
    const dayMenu = page.locator('.activity-detail-more').getByRole('button', { name:'Activity options' });
    await dayMenu.click();
    await page.getByRole('menuitem', { name:'Complete', exact:true }).click();
    await expect(page.locator('.activity-status-pill')).toContainText('Completed');
    await dayMenu.click();
    await page.getByRole('menuitem', { name:'Reopen', exact:true }).click();
    await expect(page.locator('.activity-status-pill')).toContainText('In progress');

    const first = page.locator('.dn-activity-entry-item').first();
    await first.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Complete', exact:true }).click();
    await expect(first.locator('.dn-activity-entry-status')).toContainText('Completed');
    await first.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Reopen', exact:true }).click();
    await first.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Edit', exact:true }).click();
    const form = page.getByRole('dialog', { name:'Edit entry' });
    await expect(form.getByRole('textbox', { name:'Entry title' })).toHaveValue('Morning thoughts');
    await form.getByRole('button', { name:'More options' }).click();
    await expect(form.locator('input[type="date"]')).toBeDisabled();
    await expect(form.getByLabel('Activity priority')).toBeVisible();
    await form.getByRole('textbox', { name:'Entry title' }).fill('Morning revised');
    await form.getByRole('button', { name:'Save entry' }).click();
    await expect(form).toHaveCount(0);
    let diary = (await load(page)).find((m) => m.id === 'diary');
    expect(diary.activities).toHaveLength(1);
    expect(diary.activities[0].entries.map((e) => e.title)).toEqual(['Morning revised', 'Evening thoughts']);

    await page.goto('/events/journal/activities/chapter');
    const appended = page.locator('.dn-activity-entry-item');
    await expect(appended).toHaveCount(1);
    await appended.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Complete', exact:true }).click();
    await expect(appended.locator('.dn-activity-entry-status')).toContainText('Completed');
    await appended.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Reopen', exact:true }).click();
    await appended.getByRole('button', { name:/Entry options/ }).click();
    await page.getByRole('menuitem', { name:'Edit', exact:true }).click();
    const journalForm = page.getByRole('dialog', { name:'Edit entry' });
    await journalForm.getByRole('button', { name:'More options' }).click();
    await expect(journalForm.locator('input[type="date"]')).toBeEnabled();
    await expect(journalForm.getByLabel('Activity priority')).toBeVisible();
    await journalForm.getByRole('textbox', { name:'Entry title' }).fill('Details revised');
    await journalForm.getByRole('button', { name:'Save entry' }).click();
    await expect(journalForm).toHaveCount(0);
    const journal = (await load(page)).find((m) => m.id === 'journal');
    expect(journal.activities[0].title).toBe('Day one');
    expect(journal.activities[0].entries[0].title).toBe('Details revised');
    expect(errors).toEqual([]);
  });
}
