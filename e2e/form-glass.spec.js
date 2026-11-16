import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const width of [320, 430]) for (const theme of ['light', 'dark']) {
  test(`Shared form surfaces and permanent Repeat under More options: ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, { theme, moments: [], incomes: [], expenses: [] });
    await page.goto('/dashboard');
    for (const name of ['Browse Moments', 'Browse Activities']) {
      const link = page.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      expect(await link.evaluate(el => {
        const parent = el.closest('.dashboard-empty-browse');
        const text = parent.querySelector('p').getBoundingClientRect();
        const action = el.getBoundingClientRect();
        return action.left >= text.right && action.right <= parent.getBoundingClientRect().right + 1;
      })).toBe(true);
    }
    const titles = {
      Transaction: 'Add Transaction', Task: 'New Task', Moment: 'Create a life moment', Activity: 'Add an activity',
    };
    let transactionMaterial;
    await page.getByRole('button', { name: 'Open profile and account menu' }).click();
    const profile = page.getByRole('menu', { name: 'Profile and account' });
    await expect(profile).toBeVisible();
    const profileGlass = await profile.evaluate(el => getComputedStyle(el).backgroundImage);
    await profile.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    const settingsGlass = await page.locator('.settings-navigation-hub').evaluate(el => getComputedStyle(el).backgroundImage);
    await page.goto('/dashboard');
    for (const kind of ['Transaction', 'Task', 'Moment', 'Activity']) {
      await page.getByRole('button', { name: 'Open quick create menu' }).click();
      await page.getByRole('button', { name: kind === 'Moment' ? 'Life moment' : kind, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: titles[kind], exact: true });
      await expect(dialog).toBeVisible();
      const material = await dialog.evaluate(el => ({
        background: getComputedStyle(el).backgroundImage,
        blur: getComputedStyle(el).backdropFilter,
        border: getComputedStyle(el).borderTopColor,
        scrimBlur: getComputedStyle(el.parentElement).backdropFilter,
      }));
      expect(material.background).not.toBe('none');
      expect(material.blur).toContain('blur');
      expect(material.scrimBlur).toBe('none');
      if (kind === 'Transaction') {
        transactionMaterial = material;
        expect(material.background).toBe(profileGlass);
        expect(material.background).toBe(settingsGlass);
      } else expect(material).toEqual(transactionMaterial);
      if (kind === 'Task') {
        const title = dialog.getByRole('textbox', { name: 'Task title' });
        expect(await title.evaluate(el => el.getBoundingClientRect().width / el.closest('label').getBoundingClientRect().width)).toBeGreaterThan(.95);
      }
      const expectSameRow = async (first, second) => {
        const positions = await dialog.evaluate((element, selectors) => selectors.map(selector => {
          const box = element.querySelector(selector).getBoundingClientRect();
          return { x: box.x, y: box.y, height: box.height, width: box.width };
        }), [first, second]);
        expect(Math.abs(positions[0].y - positions[1].y)).toBeLessThan(4);
        expect(positions[1].x).toBeGreaterThan(positions[0].x);
        expect(Math.min(...positions.map(box => box.height))).toBeGreaterThanOrEqual(42);
        return positions;
      };
      if (kind === 'Transaction') {
        const [title, amount] = await expectSameRow('input[type="text"]', 'input[type="number"]');
        expect(Math.abs(title.width - amount.width)).toBeLessThan(1);
        await expectSameRow('[aria-label="Transaction Type"]', '[aria-label="Category"]');
      }
      if (kind === 'Task' || kind === 'Transaction') {
        const time = dialog.locator('input[type="time"]');
        await expect(time).toBeVisible();
        const [date, clock] = await expectSameRow('input[type="date"]', '.activity-time-control');
        expect(Math.abs(date.width - clock.width)).toBeLessThan(1);
        expect(Math.abs(date.height - clock.height)).toBeLessThan(1);
        expect(await dialog.locator('summary').evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
        const more = dialog.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'More options' }) });
        await expect(dialog.getByRole('radio', { name: 'Monthly', exact: true })).toBeHidden();
        const summary = more.locator('summary');
        const summaryIsInline = () => summary.evaluate(row => {
          const label = row.querySelector(':scope > span').getBoundingClientRect();
          const hint = row.querySelector('small');
          const info = hint.getBoundingClientRect();
          return Math.abs(label.top - info.top) < 2 && info.left > label.right
            && info.height <= parseFloat(getComputedStyle(hint).lineHeight) + 1;
        });
        expect(await summaryIsInline()).toBe(true);
        await summary.click();
        await expect(more.locator('details')).toHaveCount(0);
        const momentName = kind === 'Transaction' ? 'Linked Moment' : 'Moment (optional)';
        const activityName = kind === 'Transaction' ? 'Linked Activity' : 'Activity (optional)';
        const moment = more.getByRole('combobox', { name: momentName, exact: true });
        const activity = more.getByRole('combobox', { name: activityName, exact: true });
        const [momentBox, activityBox, repeatBox] = await Promise.all([
          moment.boundingBox(), activity.boundingBox(), more.getByRole('group', { name: 'Repeat', exact: true }).boundingBox(),
        ]);
        expect(Math.abs(momentBox.y - activityBox.y)).toBeLessThan(1);
        expect(Math.abs(momentBox.width - activityBox.width)).toBeLessThan(1);
        expect(activityBox.x).toBeGreaterThan(momentBox.x);
        expect(repeatBox.y).toBeGreaterThanOrEqual(activityBox.y + activityBox.height);
        await expect(activity).toBeDisabled();
        await expect(activity.locator('.dropdown-label-short')).toHaveText('No activity');
        expect(await activity.evaluate(el => el.firstElementChild.scrollWidth <= el.firstElementChild.clientWidth + 1)).toBe(true);
        if (kind === 'Transaction') {
          await testInfo.attach(`transaction-options-${theme}`, {
            body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
          });
        }
        await expect(more.locator('.dn-repeat-preview')).toHaveCount(0);
        await more.getByRole('radio', { name: 'Monthly', exact: true }).check();
        await expect(more.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
        await more.locator('summary').click();
        await expect(summary).toContainText('Monthly');
        expect(await summaryIsInline()).toBe(true);
        await more.locator('summary').click();
        await expect(more.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
      }
      if (kind === 'Activity') {
        const more = dialog.locator('details.dn-form-disclosure').filter({ has: page.getByText('More options', { exact: true }) });
        const description = more.getByRole('textbox', { name: 'Description (optional)' });
        await expect(dialog.locator('summary > span').filter({ hasText: /^Description$/ })).toHaveCount(0);
        await expect(description).toBeHidden();
        await more.getByText('More options', { exact: true }).click();
        await expect(description).toBeVisible();
        await expectSameRow('input[type="date"]', 'input[type="time"]');
        await expectSameRow('#quick-activity-type', '#quick-activity-moment');
        await expect(dialog.locator('form details')).toHaveCount(1);
      }
      const actions = dialog.locator('button[type="submit"]').locator('..');
      const actionOrder = await actions.getByRole('button').allTextContents();
      expect(actionOrder[0]).toBe('Cancel');
      expect(await actions.evaluate(row => {
        const parent = row.closest('.dn-modal-fixed-actions');
        const transparent = node => {
          const style = getComputedStyle(node);
          return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none'
            && style.borderTopWidth === '0px' && style.boxShadow === 'none';
        };
        const [cancel, save] = [...row.querySelectorAll('button')].map(button => button.getBoundingClientRect());
        return transparent(row) && !parent && Boolean(row.closest('form'))
          && Math.abs(cancel.top - save.top) < 1 && Math.abs(cancel.width - save.width) < 1
          && cancel.height >= 44 && save.height >= 44;
      })).toBe(true);
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await testInfo.attach(`${kind}-${theme}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      await dialog.getByRole('button', { name: 'Close dialog' }).click();
    }
    expect(errors).toEqual([]);
  });
}
