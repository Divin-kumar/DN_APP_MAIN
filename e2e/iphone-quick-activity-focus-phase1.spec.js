import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium verifies focus intent, not real iOS virtual-keyboard geometry.
for (const [width, height, theme] of [[320,640,'dark'],[390,844,'dark'],[430,932,'light']]) {
  test('universal Activity opens without phone text autofocus and preserves Guest data at '+width+'px',async ({page})=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme});
    await page.goto('/activities');
    const before=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k=>localStorage.getItem(k)));
    await page.getByRole('button',{name:'Open quick create menu',exact:true}).click();
    await page.getByRole('button',{name:'Activity',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Add an activity',exact:true});
    const title=dialog.getByRole('textbox',{name:/^(Activity|Entry) title$/});
    await expect(title).toBeVisible();
    await expect(title).not.toBeFocused();
    expect(await dialog.evaluate(node=>Boolean(node.querySelector('input:focus,textarea:focus,[contenteditable=true]:focus')))).toBe(false);
    await expect(dialog.getByRole('combobox',{name:'Life moment',exact:true})).toBeVisible();
    await expect(dialog.locator('input[type="date"]')).toBeHidden();
    await dialog.locator('.dn-form-disclosure:not(.dn-activity-moment-disclosure) > summary').click();
    await expect(dialog.locator('input[type="date"]')).toBeVisible();
    await dialog.locator('.dn-form-disclosure:not(.dn-activity-moment-disclosure) > summary').click();
    await title.click();
    await expect(title).toBeFocused();
    await title.fill('Unsaved phone draft');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    const after=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k=>localStorage.getItem(k)));
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}