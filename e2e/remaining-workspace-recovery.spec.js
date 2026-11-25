import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

const story = '/events/moment-one/story';
async function workspaceMenu(page, name) {
  const actions = page.getByRole('button', { name: /^Actions for Weekend in Ooty/ });
  await actions.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name, exact: true }).click();
}

// Pause one real writer so that repeat submission, failure and retry can be
// exercised separately. The retry uses the original Guest writer.
async function holdWriter(page, kind) {
  await page.evaluate(async (kind) => {
    const store = kind === 'income' ? (await import('/src/store/useIncomeStore.js')).default
      : (await import('/src/store/useEventStore.js')).default;
    const method = kind === 'income' ? 'deleteIncomeItem' : 'updateEventItem';
    const original = store.getState()[method];
    window.writeAttempts = 0;
    store.setState({ [method]: () => {
      window.writeAttempts++;
      return new Promise((_, reject) => {
        window.rejectSave = () => {
          store.setState({ [method]: original });
          reject(new Error('Simulated write failure'));
        };
      });
    } });
  }, kind);
}

test('Moment workspace Edit opens its form and keeps independent changes made while it is open', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto(story);
  await workspaceMenu(page, 'Edit');
  const dialog = page.getByRole('dialog', { name:'Edit Moment' });
  await dialog.getByRole('textbox', { name:'Moment name' }).fill('Renamed from Story');
  await page.evaluate(async () => {
    const { scopedRecordActions: records } = await import('/src/services/scopedRecordActions.js');
    await records.mutateMoment(records.capture(), 'moment-one', (latest) => ({
      ...latest, notes:'Newer introduction', activities:[...latest.activities, {id:'extra', title:'A simultaneous addition'}],
    }));
  });
  await dialog.getByRole('button',{name:'Update Moment'}).click();
  await expect(dialog).toHaveCount(0);
  const item = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0]);
  expect(item.name).toBe('Renamed from Story');
  expect(item.notes).toBe('Newer introduction');
  expect(item.activities.some(a => a.id === 'extra')).toBe(true);
  expect(errors).toEqual([]);
});

for (const editor of ['introduction','greeting']) {
  test(editor + ' protects a changed draft, accepts one pending save and retries in place', async ({ page }) => {
    const errors = await seedGuest(page);
    await page.goto(story);
    await page.getByRole('button',{name:editor === 'greeting' ? 'Preview and edit greeting card' : /introduction/i}).first().click();
    const dialog=page.getByRole('dialog');
    const draft=editor === 'greeting' ? dialog.getByRole('textbox',{name:'Greeting title'}) : dialog.locator('[contenteditable=true]');
    await draft.fill('Keep this draft');
    await dialog.getByRole('button',{name:'Close dialog'}).click();
    await dialog.getByRole('button',{name:'Keep editing'}).click();
    await holdWriter(page,'moment');
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(dialog.getByRole('button',{name:'Saving…'})).toBeDisabled();
    await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.writeAttempts)).toBe(1);
    await page.evaluate(() => window.rejectSave());
    await expect(dialog.getByRole('alert')).toContainText('Try again');
    await dialog.getByRole('button',{name:editor === 'greeting' ? 'Save greeting' : 'Save notes'}).click();
    await expect(dialog).toHaveCount(0);
    const stored=await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0]);
    expect(editor === 'greeting' ? stored.greetingCard.title : stored.notes).toContain('Keep this draft');
    expect(errors).toEqual([]);
  });
}

test('Insights cannot export partial data and recovers genuine totals and dated Moment links', async ({ page }) => {
  const moments=fixtureMoments();moments[1].date=calendarDate(-3);
  await seedGuest(page,{moments});
  await page.goto('/insights');
  const totals=page.getByRole('region',{name:'Life overview'});
  await expect(totals).toBeVisible();
  await page.evaluate(async () => {
    (await import('/src/store/useIncomeStore.js')).default.setState({loadedFor:null,loading:true,error:null});
  });
  await expect(page.getByRole('status').filter({hasText:'Loading Moments and transactions'})).toBeVisible();
  await expect(totals).toHaveCount(0);
  const download=page.getByRole('button',{name:'Export Insights data'});
  await expect(download).toHaveCount(0);
  await page.evaluate(async () => {
    (await import('/src/store/useIncomeStore.js')).default.setState({loading:false,error:'Unable to load incomes.'});
  });
  await expect(page.getByRole('alert')).toContainText('Transactions couldn’t be loaded');
  await expect(download).toHaveCount(0);
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(totals).toBeVisible();
  await expect(page.locator('.insights-timeline-stats')).toContainText('1 past');
  const finished=page.waitForEvent('download');
  await download.click();
  const data=JSON.parse(await readFile(await (await finished).path(),'utf8'));
  expect(data.overview).toMatchObject({archived:0,past:1,income:1000});
  const link=page.getByRole('link',{name:/A separate Moment/});
  await link.click();
  await expect(page).toHaveURL(/\/events\/moment-two\/story$/);
});

test('Task status and failed reads recover without showing invented counts or losing keyboard focus', async ({ page }) => {
  await seedGuest(page);
  await page.addInitScript(() => {localStorage.setItem('dn_guest_tasks',JSON.stringify([{id:'t1',title:'Call the library',status:'in-progress',priority:'medium',dueDate:'2026-11-25'}]));});
  await page.goto('/tasks');
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
  await page.getByRole('button',{name:/Completed/}).first().click();
  await page.getByRole('button',{name:'Show all statuses'}).click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
  await page.evaluate(async () => (await import('/src/store/useTaskStore.js')).default.setState({loadedFor:null,error:'A simulated read error'}));
  await expect(page.locator('.dn-task-metrics strong')).toHaveText(['—','—','—']);
  await expect(page.locator('.dn-task-discovery-summary .dn-list-controls-context')).toHaveCount(0);
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
});

test('ledger deletion disables conflicting actions, keeps the confirmation on failure and returns to the summary', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errors=await seedGuest(page);
  await page.goto('/financials/transactions');
  await expect(page.getByRole('button',{name:'Actions for Trip fund'})).toBeAttached();
  await holdWriter(page,'income');
  const actions=page.getByRole('button',{name:'Actions for Trip fund'});
  await actions.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Delete transaction?'});
  await dialog.getByRole('button',{name:'Delete',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect(dialog.getByRole('button',{name:'Deleting…'})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'Cancel'})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>window.writeAttempts)).toBe(1);
  await page.evaluate(()=>window.rejectSave());
  await expect(dialog.getByRole('alert')).toContainText('Try again');
  await dialog.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Financial totals for matching transactions'})).toBeFocused();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_incomes')).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('primary navigation can be bypassed and no-result recovery returns focus on the three transaction and activity lists', async ({ page }) => {
  await seedGuest(page);
  await page.setViewportSize({width:1220,height:900});
  await page.goto('/tasks');
  const skip=page.getByRole('link',{name:'Skip to page content'});
  await skip.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#dn-page-content')).toBeFocused();
  for(const path of ['/financials/transactions','/events/moment-one/transactions','/events/moment-one/activities']){
    await page.goto(path);
    const search=page.getByRole('searchbox');
    await search.fill('unmatchedfixture');
    const clear=page.locator('.dn-empty-recovery-actions').getByRole('button',{name:'Clear search'});
    await clear.click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
  }
});

test('Gallery removal keeps the attachment selected after failure until an explicit retry succeeds', async ({ page }) => {
  const moments=fixtureMoments();moments[0].attachments=[{id:'manual',name:'Packing list.txt',type:'text/plain'}];
  await seedGuest(page,{moments});
  await page.goto('/events/moment-one/gallery');
  await page.getByRole('button',{name:'Remove Packing list.txt'}).click();
  await holdWriter(page,'moment');
  const dialog=page.getByRole('dialog',{name:'Remove attachment?'});
  await dialog.getByRole('button',{name:'Remove attachment'}).click();
  await expect(dialog.getByRole('button',{name:'Removing…'})).toBeDisabled();
  await page.evaluate(()=>window.rejectSave());
  await expect(dialog.getByRole('alert')).toContainText('Try again');
  await dialog.getByRole('button',{name:'Remove attachment'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.workspace-empty-surface')).toBeVisible();
});

test('large totals stay readable on a narrow phone and empty transaction results have valid list semantics', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 705 });
  const errors = await seedGuest(page, {
    incomes: [{ id: 'fund', name: 'Income', type: 'Other', amount: 9876543211, date: '2026-11-25', eventId: 'moment-one' }],
    expenses: [{ id: 'cost', name: 'Expense', category: 'Other', amount: 12345678912, date: '2026-11-25', eventId: 'moment-one' }],
  });
  await page.goto('/financials/transactions');
  const amounts = page.locator('.dn-finance-summary-grid .dn-finance-metric > strong');
  await expect(amounts).toHaveCount(3);
  const lineCounts = await amounts.evaluateAll(nodes => nodes.map(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.y))).size;
  }));
  expect(lineCounts).toEqual([1, 1, 1]);
  await page.getByRole('searchbox').fill('unmatchedfixture');
  await expect(page.getByRole('region', { name: 'Filtered transactions' }).getByRole('status')).toContainText('No matching transactions');
  await page.goto('/events/moment-one/story');
  const spending = page.getByRole('group', { name: 'Moment highlights' }).locator('.is-financial > strong');
  await expect(spending).toContainText('₹');
  expect(await spending.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.y))).size;
  })).toBe(1);
  expect(errors).toEqual([]);
});

test('Task Refine describes a sort-only change before applying it', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Refine Tasks' });
  await sheet.getByRole('button', { name: /^Sort by Title/ }).click();
  await expect(sheet.getByRole('status')).toContainText('Title');
  await sheet.getByRole('button', { name: 'Apply sort' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Task list' })).toBeAttached();
});
