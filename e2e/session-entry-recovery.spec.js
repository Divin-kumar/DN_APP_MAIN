import { expect, test } from '@playwright/test';

const guestButton = (page) => page.getByRole('button', { name: 'Continue as Guest', exact: true });
const googleButton = (page) => page.getByRole('button', { name: 'Continue with Google', exact: true });

// Exercise the real router, provider, store and UI with a disposable identity.
// The fixture controls the order of popup, auth observer and record transfer.
async function installSessionFixture(page) {
  await page.route('https://**.googleapis.com/**', (route) => route.abort());
  await page.route('**/src/services/firebase.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      const session = window.sessionFixture = { signIns: 0, signOuts: 0 };
      export const authService = {
        onAuthChange(notify) {
          session.notify = notify;
          queueMicrotask(() => { if (session.notify === notify) notify(null); });
          return () => { if (session.notify === notify) session.notify = null; };
        },
        signInWithGoogle() {
          session.signIns++;
          return new Promise((resolve, reject) => {
            session.acceptPopup = resolve;
            session.rejectPopup = code => reject(Object.assign(new Error(code), { code }));
          });
        },
        signOutUser() {
          session.signOuts++;
          return new Promise((resolve, reject) => {
            session.acceptLogout = () => { session.notify(null); resolve(); };
            session.rejectLogout = () => reject(new Error('Interrupted logout'));
          });
        },
      };`,
  }));
  await page.route('**/src/services/codeListService.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `import { DEFAULT_CODE_LISTS } from '/src/utils/codeLists.js';
      export const loadCodeListsForUser = async () => structuredClone(DEFAULT_CODE_LISTS);
      export const saveCodeListsForUser = async () => {};`,
  }));
  await page.route('**/src/services/guestMergeService.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export function mergeGuestDataIntoAccount(uid) {
      const s = window.sessionFixture;
      return new Promise((resolve, reject) => {
        s.transfer = { uid, finish: resolve, fail: () => reject(new Error('Interrupted transfer')) };
      });
    }`,
  }));
}

async function startAccount(page, uid = 'sample-account') {
  await page.evaluate((id) => window.sessionFixture.notify({ uid: id, displayName: 'Sample account' }), uid);
  await page.waitForFunction((id) => window.sessionFixture.transfer?.uid === id, uid);
}

test('the New Task shortcut opens its editor after Guest login', async ({ page }) => {
  await page.goto('/tasks?create=1');
  await expect(page).toHaveURL(/\/login$/);
  await guestButton(page).click();
  const editor = page.getByRole('dialog', { name: 'New Task', exact: true });
  await expect(editor.getByLabel('Task title')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Create Task', exact: true })).toBeDisabled();
});

test('Guest login restores query and section, including after a browser-storage failure', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    window.blockGuest = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dn_guest_mode' && window.blockGuest) throw new Error('Storage blocked');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/settings/data-backup?origin=menu#data-guide');
  await guestButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Guest mode needs browser storage');
  await page.evaluate(() => { window.blockGuest = false; });
  await guestButton(page).click();
  await expect(page).toHaveURL(/\/settings\/data-backup\?origin=menu#data-guide$/);
  await expect(page.locator('#data-guide')).toBeFocused();
});

test('Google login waits for the prepared workspace and preserves the full destination', async ({ page }) => {
  await installSessionFixture(page);
  await page.goto('/settings/data-backup?entry=direct#data-guide');
  await googleButton(page).click();
  await page.locator('.dn-login-google').evaluate((button) => button.click());
  await expect(guestButton(page)).toBeDisabled();
  expect(await page.evaluate(() => window.sessionFixture.signIns)).toBe(1);
  await page.evaluate(() => window.sessionFixture.acceptPopup());
  await expect(page.getByRole('status')).toHaveText('Opening your workspace…');
  await startAccount(page);
  await expect(page).toHaveURL(/\/login$/);
  await expect(guestButton(page)).toBeDisabled();
  await page.evaluate(() => window.sessionFixture.transfer.finish({}));
  await expect(page).toHaveURL(/\/settings\/data-backup\?entry=direct#data-guide$/);
  await expect(page.locator('#data-guide')).toBeFocused();
  await expect(page.locator('.app-toast')).toHaveCount(0);
});

test('popup and connection failures give a specific next action and permit retry', async ({ page }) => {
  await installSessionFixture(page);
  await page.goto('/login');
  for (const [code, message] of [
    ['auth/popup-blocked', 'Allow pop-ups for DN'],
    ['auth/popup-closed-by-user', 'Sign-in was closed'],
    ['auth/network-request-failed', 'Check your connection'],
    ['auth/cancelled-popup-request', 'Sign-in was interrupted'],
  ]) {
    await googleButton(page).click();
    await page.evaluate((error) => window.sessionFixture.rejectPopup(error), code);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(guestButton(page)).toBeEnabled();
  }
  await googleButton(page).click();
  await startAccount(page);
  await page.evaluate(() => window.sessionFixture.notify(null));
  await expect(page.getByRole('alert')).toContainText('Sign-in ended');
  await page.evaluate(() => {
    window.sessionFixture.acceptPopup();
    window.sessionFixture.transfer.fail();
  });
  await expect(googleButton(page)).toBeEnabled();
  await expect(page.locator('.app-toast')).toHaveCount(0);
});

for (const [name, result, message] of [
  ['failed transfer', null, 'transfer didn’t finish'],
  ['retained Task', { tasksRetainedLocally: 1 }, 'Guest Task data is still'],
  ['retained plans and Tasks', { tasksRetainedLocally: 2, expensePlansRetainedLocally: true }, 'expense plans and Tasks remain'],
]) {
  test(name + ' opens the recovery instructions for the correct workspace', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('dn_guest_tasks', JSON.stringify([{ id: 'kept-task', title: 'Collect the parcel' }])));
    await installSessionFixture(page);
    await page.goto('/settings');
    await googleButton(page).click();
    await startAccount(page);
    await page.evaluate((outcome) => {
      window.sessionFixture.acceptPopup();
      if (outcome) window.sessionFixture.transfer.finish(outcome);
      else window.sessionFixture.transfer.fail();
    }, result);
    const notice = page.locator('.app-toast[role="alert"]');
    await expect(notice).toContainText(message);
    await notice.getByRole('button', { name: 'Backup guide' }).click();
    await expect(page).toHaveURL(/\/settings\/data-backup#data-guide$/);
    await expect(page.locator('#data-guide')).toBeFocused();
    await expect(page.locator('#data-guide')).toContainText('continue as Guest on this device');
  });
}

for (const width of [320, 1280]) {
  test('interrupted logout keeps the workspace and can be retried at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await installSessionFixture(page);
    await page.goto('/settings');
    await expect(googleButton(page)).toBeEnabled();
    await startAccount(page);
    await page.evaluate(() => window.sessionFixture.transfer.finish({}));
    await expect(page).toHaveURL(/\/settings$/);
    const compact = width < 760;
    const trigger = page.getByRole('button', { name: 'Open profile and account menu' });
    if (compact) await trigger.click();
    const logout = page.getByRole(compact ? 'menuitem' : 'button', { name: 'Logout', exact: true });
    await logout.click();
    const loggingOut = page.getByRole(compact ? 'menuitem' : 'button', { name: 'Logging out…', exact: true });
    await expect(loggingOut).toBeDisabled();
    await loggingOut.evaluate(button => button.click());
    expect(await page.evaluate(() => window.sessionFixture.signOuts)).toBe(1);
    await page.evaluate(() => window.sessionFixture.rejectLogout());
    const notice = page.locator('.app-toast[role="alert"]');
    await expect(notice).toContainText('Your workspace is still open');
    if (compact) await expect(trigger).toBeFocused();
    await notice.getByRole('button', { name: 'Retry logout' }).click();
    await page.evaluate(() => window.sessionFixture.acceptLogout());
    await expect(guestButton(page)).toBeEnabled();
    expect(await page.evaluate(() => window.sessionFixture.signOuts)).toBe(2);
    await guestButton(page).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test('offline sign-in keeps Guest available and re-enables Google on reconnect', async ({ page }) => {
  await installSessionFixture(page);
  await page.goto('/login');
  await expect(googleButton(page)).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(googleButton(page)).toBeDisabled();
  await expect(guestButton(page)).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Continue as Guest or reconnect');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(googleButton(page)).toBeEnabled();
  await expect(googleButton(page)).toHaveAccessibleDescription(/Signing in with Google starts transferring/);
});

test('a device without personal Guest records receives no transfer-failure notice', async ({ page }) => {
  await installSessionFixture(page);
  await page.goto('/settings');
  await expect(googleButton(page)).toBeEnabled();
  await startAccount(page);
  await page.evaluate(() => window.sessionFixture.transfer.fail());
  await expect(page.getByRole('button', { name: 'Open profile and account menu' })).toBeVisible();
  await expect(page.locator('.app-toast')).toHaveCount(0);
});

test('sign-in still opens when the saved Guest session cannot be read', async ({ page }) => {
  await installSessionFixture(page);
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'dn_guest_mode') throw new Error('Storage read blocked');
      return getItem.call(this, key);
    };
  });
  await page.goto('/tasks?create=1');
  await expect(page).toHaveURL(/\/login$/);
  await expect(googleButton(page)).toBeEnabled();
});
