import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

test('Phase 5 new Cash expense is required, persisted, edited to Online, and shown in list', async ({page}) => {
  const errors = await seedGuest(page,{moments:fixtureMoments(), incomes:[], expenses:[]});
  await page.goto('/financials/transactions?create=transaction');
  const dialog=page.getByRole('dialog',{name:'Add Transaction'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('spinbutton').fill('89');
  await dialog.getByRole('textbox',{name:'Title *',exact:true}).fill('Coffee from Phase 5');
  await dialog.getByRole('button',{name:'Add Transaction'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Choose an available payment method');
  const methods=dialog.getByRole('radio');
  await expect(methods).toHaveCount(2);
  await expect(dialog.getByRole('radio',{name:'Cash'})).not.toBeChecked();
  await dialog.getByRole('radio',{name:'Cash'}).check();
  await dialog.getByRole('button',{name:'Add Transaction'}).click();
  await expect(dialog).toHaveCount(0);
  const card=page.locator('.dn-transaction-card').filter({hasText:'Coffee from Phase 5'}).first();
  await expect(card).toContainText('Cash');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_expenses')));
  const item=saved.find(x=>x.name==='Coffee from Phase 5');
  expect(item.paymentMethod).toBe('Cash');
  await card.locator('.dn-transaction-copy > strong').click();
  await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Edit Transaction'});
  await expect(editor.getByRole('radio',{name:'Cash'})).toBeChecked();
  await editor.getByRole('radio',{name:'Online'}).check();
  await editor.getByRole('button',{name:'Save Changes'}).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.dn-transaction-card').filter({hasText:'Coffee from Phase 5'}).first()).toContainText('Online');
  const edited=await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_expenses')));
  expect(edited.find(x=>x.id===item.id).paymentMethod).toBe('Online');
  expect(edited.find(x=>x.id===item.id).amount).toBe(89);
  expect(errors).toEqual([]);
});

test('Phase 5 historical payments remain Not specified and Income also stores Online', async ({page}) => {
  const legacy={id:'old-expense',name:'Historical',amount:50,date:'2026-10-21',category:'Other'};
  const errors=await seedGuest(page,{moments:fixtureMoments(),expenses:[legacy],incomes:[]});
  await page.goto('/financials');
  const card=page.locator('.dn-transaction-card').filter({hasText:'Historical'}).first();
  await expect(card).toContainText('Not specified');
  await card.locator('.dn-transaction-copy > strong').click();
  await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Edit Transaction'});
  await expect(editor).toContainText('Previously not specified');
  await expect(editor.getByRole('radio',{name:'Cash'})).not.toBeChecked();
  await editor.getByRole('button',{name:'Save Changes'}).click();
  await expect(editor.getByRole('alert')).toContainText('Choose an available payment method');
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_expenses'))))[0].paymentMethod).toBeUndefined();
  await page.goto('/financials/transactions?create=income');
  const incomeDialog=page.getByRole('dialog',{name:'Add Transaction'});
  await expect(incomeDialog).toBeVisible();
  await incomeDialog.getByRole('spinbutton').fill('3500');
  await incomeDialog.getByRole('textbox',{name:'Title *',exact:true}).fill('October refund');
  await incomeDialog.getByRole('radio',{name:'Online'}).check();
  await incomeDialog.getByRole('button',{name:'Add Transaction'}).click();
  await expect(incomeDialog).toHaveCount(0);
  const income=await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_incomes')).find(x=>x.name==='October refund'));
  expect(income.paymentMethod).toBe('Online');
  expect(income.amount).toBe(3500);
  expect(errors).toEqual([]);
});

test('Phase 5 payment choice remains usable on a narrow iPhone viewport', async({page})=>{
 const errors=await seedGuest(page);
 await page.setViewportSize({width:320,height:740});
 await page.goto('/financials/transactions?create=expense');
 const dialog=page.getByRole('dialog',{name:'Add Transaction'});
 await expect(dialog.getByRole('radio',{name:'Cash'})).toBeVisible();
 await dialog.getByRole('radio',{name:'Online'}).check();
 await expect(dialog.getByRole('radio',{name:'Online'})).toBeChecked();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 expect(overflow).toBe(false);
 expect(errors).toEqual([]);
});


// CHG-511: date/payment and existing expanded notes must be legible without
// disturbing amount layout or original Guest records. Synthetic browser only.
for (const [width, height, theme] of [[320, 740, 'dark'], [390, 844, 'light'], [1280, 900, 'dark']]) {
  test(`Transaction detail text and disclosure remain readable at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, {
      theme, moments: fixtureMoments(),
      incomes: [{ id: 'reading-income', name: 'Project payment', amount: 25000,
        date: '2026-10-21', type: 'Other', paymentMethod: 'Online' }],
      expenses: [{ id: 'reading-expense', name: 'School materials for the family',
        amount: 1750, date: '2026-10-22', category: 'Supplies',
        paymentMethod: 'Cash', eventId: 'moment-one',
        notes: 'Keep the receipt and the original payment details together.' }],
    });
    await page.goto('/financials/transactions');
    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes']
      .map(key => localStorage.getItem(key)));
    const card = page.locator('.dn-transactions-page .dn-v2-transaction-card.is-expense')
      .filter({ hasText: 'School materials for the family' });
    await expect(card).toBeVisible();
    await expect(card.locator('.dn-transaction-value')).toContainText('₹1,750');
    const meta = card.locator('.dn-transaction-meta');
    await expect(meta).toContainText('Cash');
    // Phone metadata has a 13px floor; unchanged desktop captions use the
    // existing 12.5px semantic scale while expanded details still reach 13px.
    expect(await meta.evaluate(node => parseFloat(getComputedStyle(node).fontSize)))
      .toBeGreaterThanOrEqual(width <= 760 ? 13 : 12.5);
    const summary = card.locator('.dn-transaction-details > summary');
    await expect(summary).toBeVisible();
    const size = await summary.boundingBox();
    // The existing desktop disclosure is intentionally mouse-compact;
    // the 44px touch target belongs to the narrower phone presentation.
    expect(size.height).toBeGreaterThanOrEqual(width <= 760 ? 43.9 : 27.9);
    expect(await summary.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
    await summary.click();
    const detail = card.locator('.dn-transaction-details');
    await expect(detail).toHaveAttribute('open', '');
    const note = detail.locator('.dn-transaction-note');
    await expect(note).toContainText('Keep the receipt');
    expect(await note.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
    const labels = detail.locator('.dn-transaction-details-content > small');
    for (const label of await labels.all()) {
      expect(await label.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
    }
    await summary.click();
    await expect(detail).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes']
      .map(key => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
