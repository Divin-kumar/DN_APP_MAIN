import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { createBackupDocument } from '../services/backupService.js';
import { restoreAttachmentFiles } from '../services/attachmentService.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

const children = (node) => Array.isArray(node) ? node : node?.props?.children ?? [];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(children(node))] : [];
const label = (node) => Array.isArray(node) ? node.map(label).join('')
  : node && typeof node === 'object' ? label(children(node)) : String(node ?? '');

const openSettings = async (t, initialStorage) => {
  const values = new Map(Object.entries(initialStorage));
  const storageWrites = [];
  const toasts = [];
  const storage = { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { storageWrites.push([key, String(value)]); values.set(key, String(value)); }, removeItem: (key) => values.delete(key) };
  const key = `__dnGuestRestoreTest${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  let cursor = 0;
  let reloads = 0;
  const api = {
    state: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    app: { user: null, isGuest: true, adminValues: DEFAULT_CODE_LISTS,
      preferences: { currency: 'INR', notifications: {} }, showToast: (...args) => toasts.push(args),
      setAdminValues: async () => { throw new Error('Fixture configuration should not be restored.'); } },
    cloud: () => { throw new Error('Guest restore must not access Firebase.'); },
    restoreOriginals: restoreAttachmentFiles,
  };
  const globals = new Map(['localStorage', 'window'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { reload: () => { reloads += 1; } } } });
  globalThis[key] = api;
  const server = await createServer({ configFile: false, envFile: false,
    esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'react-router-dom', 'lucide-react', 'firebase'] },
    // Attach HMR to an unlistened server; parallel module tests need no socket.
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-guest-restore', enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/') || '';
        if (file.endsWith('/src/pages/Settings.jsx')) {
          if (source === 'react') return '\0guest-restore-react';
          if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0guest-restore-jsx';
          if (source === 'react-router-dom') return '\0guest-restore-router';
          if (source === 'lucide-react') return '\0guest-restore-icons';
          if (source.startsWith('../components/common/')) return '\0guest-restore-component';
          if (source === '../store/useAppStore') return '\0guest-restore-app';
          if (source.startsWith('../store/')) return '\0guest-restore-store';
          if (source === '../services/attachmentService') return '\0guest-restore-attachments';
        }
        if (/\/src\/services\/(?:expenseService|incomeService|eventService|accountTransactionService)\.js$/.test(file)) {
          if (source === 'firebase/firestore') return '\0guest-restore-firestore';
          if (source === '../firebase/config') return '\0guest-restore-db';
        }
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0guest-restore-react') return `export const useState = ${fixture}.state; export const useMemo = (fn) => fn(); export const useEffect = () => {};`;
        if (id === '\0guest-restore-jsx') return 'export const jsx = (type, props) => ({type, props}); export const jsxs = jsx; export const jsxDEV = jsx; export const Fragment = "fragment";';
        if (id === '\0guest-restore-router') return 'export const Link = "link"; export const useLocation = () => ({hash: ""});';
        if (id === '\0guest-restore-icons') return 'export const UserCircle="icon", Settings2="icon", Database="icon", Download="icon", Upload="icon", Trash2="icon", Bell="icon", Clock3="icon", Info="icon", ChevronRight="icon", RotateCcw="icon", Plus="icon", ArrowRight="icon", RefreshCw="icon";';
        if (id === '\0guest-restore-component') return 'export default "component";';
        if (id === '\0guest-restore-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
        if (id === '\0guest-restore-store') return 'const useStore = () => ({}); useStore.getState = useStore; export default useStore;';
        if (id === '\0guest-restore-attachments') return `export const restoreAttachmentFiles=(...args)=>${fixture}.restoreOriginals(...args); export const exportAttachmentFiles=()=>{throw new Error("Unexpected attachment export");};`;
        if (id === '\0guest-restore-db') return 'export const db = {};';
        if (id === '\0guest-restore-firestore') return `export const addDoc=${fixture}.cloud, collection=${fixture}.cloud, deleteDoc=${fixture}.cloud, doc=${fixture}.cloud, getDocs=${fixture}.cloud, updateDoc=${fixture}.cloud, writeBatch=${fixture}.cloud;`;
        return null;
      },
    }],
  });
  t.after(async () => {
    await server.close(); delete globalThis[key];
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const { default: Settings } = await server.ssrLoadModule('/src/pages/Settings.jsx');
  const expenseService = await server.ssrLoadModule('/src/services/expenseService.js');
  const eventService = await server.ssrLoadModule('/src/services/eventService.js');
  const render = () => { cursor = 0; return Settings(); };
  const prepareRestore = async (backup) => {
    let tree = render();
    const toggle = nodes(tree).find((node) => node.type === 'button' && label(node).includes('Data & Backup'));
    if (!toggle.props['aria-expanded']) { toggle.props.onClick(); tree = render(); }
    const input = nodes(tree).find((node) => node.type === 'input' && node.props.type === 'file');
    await input.props.onChange({ target: { value: 'synthetic-backup.json', files: [{ size: 1, text: async () => JSON.stringify(backup) }] } });
    tree = render();
    const confirm = nodes(tree).find((node) => node.type === 'button' && label(node) === 'Confirm restore');
    assert.ok(confirm, 'the real Settings import handler must present restore confirmation');
    return confirm;
  };
  const restore = async (backup) => {
    const confirm = await prepareRestore(backup);
    await confirm.props.onClick();
    return label(render());
  };
  return { api, values, storageWrites, toasts, render, expenseService, eventService, prepareRestore, restore, reloads: () => reloads };
};

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const moment = (expenses) => ({ id: 'guest-moment', name: 'Synthetic Moment', date: '2026-10-22',
  activities: [{ id: 'guest-activity', title: 'Synthetic Activity', expenses }] });
const expense = (id, amount) => ({ id, name: 'Synthetic expense', amount, date: '2026-10-22',
  eventId: 'guest-moment', activityId: 'guest-activity' });
const backupFor = (expenses, standalone = []) => createBackupDocument({ moments: [moment(expenses)],
  expenses: standalone, codeLists: DEFAULT_CODE_LISTS, settings: { restoreCodeLists: false } });

test('guest Settings restore retains raw standalone masters through retry and parent removal', async (t) => {
  const master = { ...expense(41, 99), customField: 'Preserve original raw fields' };
  const nested = expense('nested-only', 7);
  const harness = await openSettings(t, { dn_guest_expenses: JSON.stringify([master]),
    dn_guest_eventGroups: JSON.stringify([moment([nested])]) });
  const backup = backupFor([expense('41', 1), nested], [{ id: 'new-standalone', name: 'New standalone', amount: 13, date: '2026-10-22' }]);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await harness.restore(backup);
    assert.equal(harness.reloads(), attempt, 'the actual Settings handler completes each restore');
    const masters = harness.expenseService.getGuestExpenseMasters();
    assert.deepEqual(masters[0], master, 'existing raw master identity, values and unknown fields stay intact');
    assert.deepEqual(masters.map((item) => item.id), [41, 'new-standalone'], 'retry neither removes the master nor copies a nested-only projection');
    const restored = harness.eventService.getGuestEvents();
    assert.equal(restored[0].activities[0].expenses.find((item) => item.id === '41').amount, 99, 'the added mirror uses destination master values');
    assert.equal(harness.expenseService.getGuestExpenses().filter((item) => item.id === '41').length, 1, 'reporting still counts the mirrored master once');
  }
  const afterParentRemoval = harness.eventService.removeGuestEvent('guest-moment');
  assert.deepEqual(afterParentRemoval, []);
  harness.eventService.setGuestEvents(afterParentRemoval);
  assert.deepEqual(harness.expenseService.getGuestExpenses().map((item) => item.id), ['41', 'new-standalone'], 'removing the parent leaves independent financial masters available');
});

test('guest Settings restore leaves nested-only expenses out of the standalone ledger', async (t) => {
  const nested = expense('nested-only', 7);
  const harness = await openSettings(t, { dn_guest_expenses: '[]', dn_guest_eventGroups: JSON.stringify([moment([nested])]) });
  await harness.restore(backupFor([nested]));
  assert.equal(harness.reloads(), 1);
  assert.deepEqual(harness.expenseService.getGuestExpenseMasters(), []);
  assert.deepEqual(harness.expenseService.getGuestExpenses().map((item) => item.id), ['nested-only']);
});

test('guest Settings restore rejects a corrupt raw master ledger before changing stored records', async (t) => {
  const harness = await openSettings(t, { dn_guest_expenses: '{"not":"an array"}',
    dn_guest_eventGroups: JSON.stringify([moment([])]) });
  const before = [...harness.values];
  t.mock.method(console, 'error', () => {});
  const result = await harness.restore(backupFor([expense('new-nested', 5)]));
  assert.match(result, /Guest expense storage is invalid/);
  assert.equal(harness.reloads(), 0);
  assert.deepEqual([...harness.values], before, 'strict raw-ledger validation prevents partial guest record writes');
});

test('Settings restore rejects an obsolete confirmation after the active session changes', async (t) => {
  const harness = await openSettings(t, { dn_guest_expenses: '[]', dn_guest_eventGroups: '[]' });
  const confirm = await harness.prepareRestore(backupFor([]));
  const before = [...harness.values];
  let originalCalls = 0;
  harness.api.restoreOriginals = async () => { originalCalls += 1; throw new Error('Stale confirmation must not restore originals'); };
  harness.api.app.user = { uid: 'different-owner' };
  harness.api.app.isGuest = false;
  t.mock.method(console, 'error', () => {});
  await confirm.props.onClick();
  assert.match(label(harness.render()), /session changed/i);
  assert.equal(originalCalls, 0);
  assert.deepEqual(harness.storageWrites, []);
  assert.deepEqual([...harness.values], before);
  assert.equal(harness.reloads(), 0);
  assert.equal(harness.toasts.some(([, kind]) => kind === 'success'), false);
});

test('Settings restore rechecks the session after awaiting originals before any record write', async (t) => {
  const harness = await openSettings(t, { dn_guest_expenses: '[]', dn_guest_eventGroups: '[]' });
  const pending = deferred();
  let restoreContext;
  let imported;
  harness.api.restoreOriginals = async (groups, _files, context) => {
    context.assertCurrent();
    restoreContext = context;
    imported = groups;
    await pending.promise;
    return groups;
  };
  const confirm = await harness.prepareRestore(backupFor([]));
  const restoring = confirm.props.onClick();
  assert.ok(imported, 'the real handler starts with original restoration');
  assert.deepEqual(harness.storageWrites, []);
  harness.api.app.user = { uid: 'different-owner' };
  harness.api.app.isGuest = false;
  assert.throws(() => restoreContext.assertCurrent(), /session changed/i);
  t.mock.method(console, 'error', () => {});
  pending.resolve();
  await restoring;
  assert.match(label(harness.render()), /session changed/i);
  assert.deepEqual(harness.storageWrites, []);
  assert.equal(harness.reloads(), 0);
  assert.equal(harness.toasts.some(([, kind]) => kind === 'success'), false);
});

test('Settings restores verified destination file references before writing any guest records', async (t) => {
  const harness = await openSettings(t, { dn_guest_expenses: '[]', dn_guest_eventGroups: '[]' });
  const assetId = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; // SHA-256 of abc.
  const backup = createBackupDocument({
    moments: [{ ...moment([]), attachments: [{ id: 'original-photo', name: 'photo.png', type: 'image/png',
      size: 3, assetId, storage: 'firebase', activityId: 'guest-activity' }] }],
    attachmentFiles: [{ assetId, type: 'image/png', size: 3, base64: 'YWJj' }],
    codeLists: DEFAULT_CODE_LISTS, settings: { restoreCodeLists: false },
  });
  const pending = deferred();
  let fileCalls = 0;
  harness.api.restoreOriginals = async (groups, files, context) => {
    fileCalls += 1;
    assert.equal(context.uid, null);
    assert.equal(context.isGuest, true);
    context.assertCurrent();
    assert.deepEqual(files, backup.attachmentFiles);
    await pending.promise;
    context.assertCurrent();
    return groups.map((group) => ({ ...group, attachments: group.attachments.map((entry) => ({ ...entry, storage: 'local' })) }));
  };
  const confirm = await harness.prepareRestore(backup);
  const restoring = confirm.props.onClick();
  assert.equal(fileCalls, 1);
  assert.deepEqual(harness.storageWrites, [], 'record writes wait for file persistence to succeed');
  assert.equal(harness.reloads(), 0);
  pending.resolve();
  await restoring;
  const [written] = harness.eventService.getGuestEvents();
  assert.equal(written.attachments[0].storage, 'local');
  assert.equal(written.attachments[0].assetId, assetId);
  assert.equal(written.attachments[0].activityId, 'guest-activity');
  assert.equal(harness.reloads(), 1);
  assert.equal(harness.toasts.some(([message, kind]) => message === 'Backup restore finished' && kind === 'success'), true);
});

test('Settings original restoration failure leaves every guest record unchanged and reports no successful restore', async (t) => {
  const harness = await openSettings(t, { dn_guest_expenses: '[]', dn_guest_eventGroups: JSON.stringify([moment([])]) });
  const before = [...harness.values];
  harness.api.restoreOriginals = async () => { throw new Error('Original file could not be stored'); };
  t.mock.method(console, 'error', () => {});
  const result = await harness.restore(backupFor([expense('new-expense', 10)]));
  assert.match(result, /Original file could not be stored/);
  assert.deepEqual(harness.storageWrites, []);
  assert.deepEqual([...harness.values], before);
  assert.equal(harness.reloads(), 0);
  assert.equal(harness.toasts.some(([, kind]) => kind === 'success'), false);
});


test('Guest demo restore confirmation switches to personal storage and merges backup without copying demo records', async (t) => {
  const privateMoment = { id: 'private-guest', name: 'My existing Guest Moment', date: '2026-10-28',
    activities: [], attachments: [], memories: [] };
  const demoMoment = { id: 'tour-only', name: 'Sample Journey', activities: [], attachments: [], memories: [] };
  const tour = { scenario: 'tour', demoVersion: '2026.10.28.2',
    events: [demoMoment], incomes: [], expenses: [] };
  const harness = await openSettings(t, {
    dn_guest_eventGroups: JSON.stringify([privateMoment]),
    dn_guest_expenses: '[]', dn_guest_incomes: '[]',
    dn_dev_fixture_scenario: 'tour', dn_dev_fixture_data: JSON.stringify(tour),
  });
  const imported = { id: 'backup-new', name: 'Restored private Moment', date: '2026-10-21',
    activities: [], attachments: [], memories: [] };
  const backup = createBackupDocument({ moments: [imported], codeLists: DEFAULT_CODE_LISTS,
    settings: { restoreCodeLists: false } });
  const confirm = await harness.prepareRestore(backup);
  assert.equal(harness.values.get('dn_dev_fixture_scenario'), 'tour',
    'selecting and validating a file must not exit or destroy the demo');
  assert.match(label(harness.render()), /leave the demo and merge this backup/i);
  await confirm.props.onClick();
  assert.equal(harness.reloads(), 1);
  assert.equal(harness.values.has('dn_dev_fixture_scenario'), false);
  assert.equal(harness.values.get('dn_guest_tour_declined'), 'true');
  const saved = harness.eventService.getGuestEvents();
  assert.deepEqual(saved.map((item) => item.id), ['private-guest', 'backup-new']);
  assert.equal(saved.some((item) => item.id === demoMoment.id), false,
    'guided demo data is never imported into personal Guest records');
  assert.equal(harness.toasts.some(([message, kind]) => message === 'Backup restore finished' && kind === 'success'), true);
});

test('Guest demo restore preflight preserves demo on invalid personal Guest ledger', async (t) => {
  const tour = { scenario: 'tour', events: [{id:'tour',name:'Example',activities:[]}],
    incomes: [], expenses: [] };
  const harness = await openSettings(t, {
    dn_dev_fixture_scenario: 'tour', dn_dev_fixture_data: JSON.stringify(tour),
    dn_guest_eventGroups: '{"malformed":true}', dn_guest_expenses: '[]', dn_guest_incomes: '[]',
  });
  t.mock.method(console, 'error', () => {});
  const restore = await harness.prepareRestore(backupFor([]));
  assert.equal(harness.values.get('dn_dev_fixture_scenario'), 'tour');
  await restore.props.onClick();
  assert.match(label(harness.render()), /Guest Moment storage is invalid/i);
  assert.equal(harness.values.get('dn_dev_fixture_scenario'), 'tour',
    'a failed preflight must not exit the demo or alter personal data');
  assert.equal(harness.values.get('dn_guest_eventGroups'), '{"malformed":true}');
  assert.equal(harness.reloads(), 0);
});
