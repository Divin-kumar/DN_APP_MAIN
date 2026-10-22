import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { createBackupDocument } from '../services/backupService.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

const children = (node) => Array.isArray(node) ? node : node?.props?.children ?? [];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(children(node))] : [];
const label = (node) => Array.isArray(node) ? node.map(label).join('')
  : node && typeof node === 'object' ? label(children(node)) : String(node ?? '');

const openSettings = async (t, initialStorage) => {
  const values = new Map(Object.entries(initialStorage));
  const storage = { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
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
      preferences: { currency: 'INR', notifications: {} }, showToast: () => {},
      setAdminValues: async () => { throw new Error('Fixture configuration should not be restored.'); } },
    cloud: () => { throw new Error('Guest restore must not access Firebase.'); },
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
        if (id === '\0guest-restore-icons') return 'export const UserCircle="icon", Settings2="icon", Database="icon", Download="icon", Upload="icon", Trash2="icon", Bell="icon", Clock3="icon", Info="icon", ChevronRight="icon", RotateCcw="icon", Plus="icon";';
        if (id === '\0guest-restore-component') return 'export default "component";';
        if (id === '\0guest-restore-app') return `export default (select) => select(${fixture}.app);`;
        if (id === '\0guest-restore-store') return 'const useStore = () => ({}); useStore.getState = useStore; export default useStore;';
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
  const restore = async (backup) => {
    let tree = render();
    const toggle = nodes(tree).find((node) => node.type === 'button' && label(node).includes('Data & Backup'));
    if (!toggle.props['aria-expanded']) { toggle.props.onClick(); tree = render(); }
    const input = nodes(tree).find((node) => node.type === 'input' && node.props.type === 'file');
    await input.props.onChange({ target: { value: 'synthetic-backup.json', files: [{ size: 1, text: async () => JSON.stringify(backup) }] } });
    tree = render();
    const confirm = nodes(tree).find((node) => node.type === 'button' && label(node) === 'Confirm restore');
    assert.ok(confirm, 'the real Settings import handler must present restore confirmation');
    await confirm.props.onClick();
    return label(render());
  };
  return { values, expenseService, eventService, restore, reloads: () => reloads };
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
