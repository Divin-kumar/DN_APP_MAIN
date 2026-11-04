import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
import { mkdir } from 'node:fs/promises';

for (const width of [320,430]) {
  test(`Owner Settings refinements remain contained at ${width}`, async ({page},testInfo) => {
    await page.setViewportSize({width,height:844});
    await seedGuest(page);
    await page.goto('/settings/list-defaults');
    for (const sort of await page.locator('.dn-defaults-sort-card .dn-refine-sort-chips').all()) {
      expect(await sort.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
      for (const button of await sort.getByRole('button').all()) expect(await button.evaluate(el=>getComputedStyle(el).justifyContent)).toBe('center');
    }
    await testInfo.attach(`centered-sorts-${width}`, {body:await page.screenshot(),contentType:'image/png'});
    await page.goto('/settings/code-lists');
    const add=page.locator('#code-list-eventTypes .moment-type-add-button');
    const rect=await add.boundingBox();
    const sectionRect=await page.locator('#code-list-eventTypes').boundingBox();
    expect(rect.x+rect.width).toBeLessThanOrEqual(sectionRect.x+sectionRect.width+1);
    const rail=page.locator('.dn-code-list-index-scroll');
    await expect(page.locator('.dn-code-list-nav-arrow')).toHaveCount(0);
    expect(await rail.evaluate(el=>el.clientWidth)).toBeGreaterThan(150);
    expect(await page.locator('.code-list-item').first().evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))).toBe(14);
    await testInfo.attach(`rounded-code-lists-${width}`, {body:await page.screenshot(),contentType:'image/png'});
    await page.goto('/settings/appearance');
    const actions=page.locator('.dn-story-design-actions');
    await actions.scrollIntoViewIfNeeded();
    const cancel=await actions.getByRole('button',{name:'Cancel',exact:true}).boundingBox();
    const save=await actions.getByRole('button',{name:'Save designs'}).boundingBox();
    expect(Math.abs(cancel.y-save.y)).toBeLessThan(2);
    expect(save.x+save.width).toBeLessThanOrEqual(width);
    await testInfo.attach(`appearance-footer-${width}`, {body:await page.screenshot(),contentType:'image/png'});
  });
}

test('PDF dark page theme reaches rendered pages and downloadable files for all formats',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=await seedGuest(page);
  await page.goto('/events/moment-one/pdf');
  const studio=page.locator('.dn-pdf-studio-page');
  const download=studio.getByRole('button',{name:'Download customized PDF'});
  await expect(download).toBeEnabled({timeout:20000});
  const records=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
  const pixel=()=>page.locator('.dn-pdf-preview-page img').first().evaluate(async img=>{
    await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(3,3,1,1).data].slice(0,3);
  });
  expect((await pixel()).every(x=>x>230)).toBe(true);
  await studio.getByRole('group',{name:'PDF page theme'}).getByRole('button',{name:'Dark',exact:true}).click();
  await expect(download).toBeDisabled();
  await mkdir('.verification/owner-polish',{recursive:true});
  for (const [format,style] of [['Journal','Editorial'],['Diary','Heritage'],['Tasks','Minimal']]) {
    await studio.getByRole('combobox',{name:'PDF story format'}).click();
    await page.getByRole('option',{name:new RegExp('^'+format)}).click();
    await studio.getByRole('button',{name:'PDF design '+style,exact:true}).click();
    await studio.getByRole('button',{name:'Update preview',exact:true}).click();
    await expect(download).toBeEnabled({timeout:20000});
    expect((await pixel()).every(x=>x<65)).toBe(true);
    const pending=page.waitForEvent('download');await download.click();
    await (await pending).saveAs(`.verification/owner-polish/dark-${format}.pdf`);
    await testInfo.attach(`dark-pdf-${format}`,{body:await page.screenshot(),contentType:'image/png'});
  }
  expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(records);
  expect(errors).toEqual([]);
});
