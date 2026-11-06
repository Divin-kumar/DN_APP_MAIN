import { test, expect } from '@playwright/test';
import { seedGuest, addOriginal, calendarDate } from './fixtures.js';

for (const [width, theme] of [[320,'light'],[390,'dark'],[430,'light'],[1280,'dark']]) {
  test(`shared quiet list surfaces preserve records at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = await seedGuest(page, { theme });
    await addOriginal(page);
    await page.evaluate(task => localStorage.setItem('dn_guest_tasks', JSON.stringify([task])), {
      id:'list-style-task', title:'Check travel documents', status:'in-progress', priority:'high', dueDate:calendarDate(1), dueTime:'09:30',
    });
    const records = await page.evaluate(() => [localStorage.getItem('dn_guest_eventGroups'),localStorage.getItem('dn_guest_tasks')]);
    for (const [route, selector, name] of [
      ['/tasks','.dn-independent-task-row','tasks'],
      ['/activities','.dn-v2-activity-card','activities'],
      ['/events','.dn-v2-moment-card','moments'],
      ['/events/moment-one/activities','.dn-v2-activity-card','moment-activities'],
      ['/financials/transactions','.dn-v2-transaction-card','transactions'],
      ['/events/moment-one/gallery','.dn-attachment-open','attachments'],
      ['/settings/code-lists','.code-list-item','code-lists'],
    ]) {
      await page.goto(route);
      const row = page.locator(selector).first();
      await expect(row).toBeVisible();
      const style = await row.evaluate(node => { const s=getComputedStyle(node);return {border:s.borderTopWidth, shadow:s.boxShadow}; });
      expect(style.border, name).toBe('0px');
      expect(style.shadow, name).toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),name).toBe(true);
      if(name==='tasks') {
        const calendar=await row.locator('.dn-task-calendar').boundingBox();
        expect(Math.abs(calendar.width-calendar.height)).toBeLessThan(1);
        await row.click();
        await expect(page.getByRole('menu')).toBeVisible();
        await page.keyboard.press('Escape');
      }
      if(name==='attachments') {
        const image=row.locator('img');
        await expect(image).toBeVisible();
        expect((await image.boundingBox()).width).toBe(40);
        await row.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button',{name:'Close dialog',exact:true}).click();
      }
      await page.screenshot({path:info.outputPath(`${name}-${width}-${theme}.png`)});
    }
    expect(await page.evaluate(() => [localStorage.getItem('dn_guest_eventGroups'),localStorage.getItem('dn_guest_tasks')])).toEqual(records);
    expect(errors).toEqual([]);
  });
}
