import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium geometry is a guard, not a claim of native iOS validation.
for (const [width,height] of [[320,640],[390,844],[430,932]]) for (const theme of ['light','dark']) {
  test('premium Finance totals are centered in one quiet strip at '+width+'px '+theme, async({page})=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme,
      incomes:[{id:'salary',name:'Salary',amount:12000,date:'2026-10-24',type:'Other'}],
      expenses:[{id:'subscription',name:'Subscription',amount:2450,date:'2026-10-25',category:'Other'}]});
    await page.goto('/financials/transactions');
    const before=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map(key=>localStorage.getItem(key)));
    const summary=page.getByRole('region',{name:'Financial totals for matching transactions'});
    const tiles=summary.locator('.dn-finance-summary-grid .dn-finance-metric');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0).locator('strong')).toHaveText('₹12,000');
    await expect(tiles.nth(1).locator('strong')).toHaveText('₹2,450');
    await expect(tiles.nth(2).locator('strong')).toHaveText('₹9,550');
    const geometry=await summary.evaluate(node=>{
      const rail=node.querySelector('.dn-finance-summary-grid'), railRect=rail.getBoundingClientRect();
      const tiles=[...node.querySelectorAll('.dn-finance-metric')].map(tile=>{
        const rect=tile.getBoundingClientRect();
        const head=tile.querySelector('.dn-finance-metric-heading').getBoundingClientRect();
        const value=tile.querySelector('strong').getBoundingClientRect();
        return {
          x:rect.x,right:rect.right,y:rect.y,width:rect.width,height:rect.height,
          headingMid:head.left+head.width/2,valueMid:value.left+value.width/2,
          tileMid:rect.left+rect.width/2,
          labelStyle:getComputedStyle(tile.querySelector('.dn-finance-metric-heading')).textAlign,
          valueStyle:getComputedStyle(tile.querySelector('strong')).textAlign,
          font:parseFloat(getComputedStyle(tile.querySelector('strong')).fontSize),
          valueScroll:tile.querySelector('strong').scrollWidth,
          valueClient:tile.querySelector('strong').clientWidth,
        };
      });
      const styles=getComputedStyle(rail);
      return { tiles,borderRadius:parseFloat(styles.borderTopLeftRadius),
        railLeft:railRect.left,railRight:railRect.right,railHeight:railRect.height,
        pageWidth:document.documentElement.scrollWidth };
    });
    expect(geometry.borderRadius).toBeGreaterThanOrEqual(14);
    expect(geometry.tiles[0].y).toBeCloseTo(geometry.tiles[2].y,0);
    expect(geometry.tiles[0].right).toBeLessThanOrEqual(geometry.tiles[1].x+1);
    expect(geometry.tiles[1].right).toBeLessThanOrEqual(geometry.tiles[2].x+1);
    expect(Math.max(...geometry.tiles.map(t=>t.width))-Math.min(...geometry.tiles.map(t=>t.width))).toBeLessThan(2);
    expect(geometry.railHeight).toBeLessThanOrEqual(130);
    for (const tile of geometry.tiles) {
      expect(Math.abs(tile.headingMid-tile.tileMid)).toBeLessThanOrEqual(2);
      expect(Math.abs(tile.valueMid-tile.tileMid)).toBeLessThanOrEqual(2);
      expect(tile.valueStyle).toBe('center');
      expect(tile.font).toBeGreaterThanOrEqual(14);
      expect(tile.valueScroll).toBeLessThanOrEqual(tile.valueClient+1);
    }
    expect(geometry.railLeft).toBeGreaterThanOrEqual(-1);
    expect(geometry.railRight).toBeLessThanOrEqual(width+1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(width+1);
    expect(await page.locator('.dn-transactions-page .dn-transaction-add').count()).toBe(0);
    const search=page.getByRole('searchbox',{name:'Search transactions'});
    await search.fill('Subscription');
    await expect(tiles.nth(0).locator('strong')).toHaveText('₹0');
    await expect(tiles.nth(1).locator('strong')).toHaveText('₹2,450');
    await expect(tiles.nth(2).locator('strong')).toHaveText('-₹2,450');
    await expect(tiles.nth(2)).toHaveClass(/is-negative/);
    await expect(page.getByRole('button',{name:'Open quick create menu'})).toBeVisible();
    expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map(key=>localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('large finance amounts remain inside all three columns on the narrowest phone',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  const errors=await seedGuest(page,{
    incomes:[{id:'large-in',name:'Income',amount:987654321,date:'2026-10-20',type:'Other'}],
    expenses:[{id:'large-out',name:'Expense',amount:123456789,date:'2026-10-21',category:'Other'}],
  });
  await page.goto('/financials');
  const tiles=page.locator('.dn-finance-summary-grid .dn-finance-metric');
  await expect(tiles).toHaveCount(3);
  const fit=await tiles.evaluateAll(nodes=>nodes.map(n=>{
    const rect=n.getBoundingClientRect(),value=n.querySelector('strong');
    return { top:rect.top,right:rect.right,scroll:value.scrollWidth,client:value.clientWidth,height:rect.height,
      mid:Math.abs(value.getBoundingClientRect().left+value.getBoundingClientRect().width/2-(rect.left+rect.width/2)) };
  }));
  expect(Math.max(...fit.map(x=>x.top))-Math.min(...fit.map(x=>x.top))).toBeLessThanOrEqual(1);
  expect(fit.every(x=>x.scroll<=x.client+1&&x.mid<2&&x.right<=321)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
