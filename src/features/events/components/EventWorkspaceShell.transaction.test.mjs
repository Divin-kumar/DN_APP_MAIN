import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const children = (node) => Array.isArray(node) ? node : node?.props?.children ?? [];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(children(node))] : [];
const text = (node) => Array.isArray(node) ? node.map(text).join('')
  : node && typeof node === 'object' ? text(children(node)) : String(node ?? '');

// Render the real workspace handlers with inert child components. The fixture
// never initializes Firebase or a browser account and does not write storage.
const openWorkspace = async (t) => {
  const key = `__dnWorkspaceTransaction${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  let cursor = 0;
  let saver = async () => ({ id: 'new-expense' });
  const activity = { id: 'activity-one', title: 'Synthetic check-up', date: '2026-08-24',
    priority: 'medium', description: 'Original notes', completed: true };
  const moment = { id: 'moment-one', name: 'Synthetic Moment', type: 'Personal',
    date: '2027-03-01', activities: [activity], memories: [], attachments: [] };
  const calls = [];
  const navigations = [];
  const toasts = [];
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    ref(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    location: { pathname: '/events/moment-one/activities', search: '', hash: '' },
    params: { eventId: 'moment-one' },
    navigate: (...args) => navigations.push(args),
    app: { user: null, isGuest: true, adminValues: { eventTypes: [], activityPriorities: [] },
      preferences: {}, showToast: (...args) => toasts.push(args) },
    eventStore: { events: [moment], loading: false, error: '', loadEvents: () => {},
      updateEventItem: async () => { throw new Error('Unexpected Moment write'); },
      deleteEventItem: async () => { throw new Error('Unexpected Moment deletion'); } },
    expenseStore: { expenses: [], loadExpenses: () => {} },
    save: async (form) => { calls.push(form); return saver(form); },
  };
  globalThis[key] = api;
  const server = await createServer({ configFile: false, envFile: false,
    esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'react-router-dom', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-workspace-transaction', enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/') || '';
        if (source === 'react') return '\0workspace-transaction-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0workspace-transaction-jsx';
        if (!file.endsWith('/src/features/events/components/EventWorkspaceShell.jsx')) return null;
        if (source === 'react-router-dom') return '\0workspace-transaction-router';
        if (source === 'lucide-react') return '\0workspace-transaction-icons';
        if (source.includes('/components/')) return `\0workspace-transaction-child:${source.split('/').at(-1)}`;
        if (source.endsWith('/store/useAppStore')) return '\0workspace-transaction-app';
        if (source.endsWith('/store/useEventStore')) return '\0workspace-transaction-events';
        if (source.endsWith('/store/useExpenseStore')) return '\0workspace-transaction-expenses';
        if (source.endsWith('/hooks/useTransactionManager')) return '\0workspace-transaction-manager';
        if (source.endsWith('/hooks/usePersistentSort')) return '\0workspace-transaction-sort';
        if (source.endsWith('/hooks/usePersistentListState')) return '\0workspace-transaction-filters';
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0workspace-transaction-react') return `export const useState=${fixture}.state, useRef=${fixture}.ref; export const useEffect=()=>{}, useLayoutEffect=()=>{}, useMemo=(fn)=>fn(), useCallback=(fn)=>fn();`;
        if (id === '\0workspace-transaction-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx, jsxDEV=jsx, Fragment="fragment";';
        if (id === '\0workspace-transaction-router') return `export const Link="Link", useLocation=()=>${fixture}.location, useNavigate=()=>${fixture}.navigate, useParams=()=>${fixture}.params;`;
        if (id === '\0workspace-transaction-icons') return 'export const Archive="icon",ArchiveRestore="icon",ArrowLeft="icon",BookHeart="icon",CalendarDays="icon",Check="icon",CircleCheck="icon",Clock3="icon",Download="icon",FileText="icon",Heart="icon",Images="icon",ListChecks="icon",Pencil="icon",Plus="icon",Save="icon",Search="icon",Sparkles="icon",Trash2="icon",Upload="icon",X="icon";';
        if (id.startsWith('\0workspace-transaction-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const ConfirmDialog="ConfirmDialog";`;
        if (id === '\0workspace-transaction-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
        if (id === '\0workspace-transaction-events') return `const useStore=()=>${fixture}.eventStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0workspace-transaction-expenses') return `const useStore=()=>${fixture}.expenseStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0workspace-transaction-manager') return `export default ()=>({saveTransaction:${fixture}.save});`;
        if (id === '\0workspace-transaction-sort') return 'export default ()=>({field:"date",direction:"asc",setField:()=>{},toggleDirection:()=>{}});';
        if (id === '\0workspace-transaction-filters') return 'export default (_key, defaults)=>[defaults,()=>{},()=>{}];';
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const { default: Workspace } = await server.ssrLoadModule('/src/features/events/components/EventWorkspaceShell.jsx');
  const render = () => { cursor = 0; return Workspace(); };
  const find = (type) => nodes(render()).find((node) => node.type === type);
  const open = () => { find('ActivityList').props.onAddExpense(activity); return find('TransactionForm'); };
  return { activity, api, calls, navigations, toasts, render, find, open,
    setSaver: (next) => { saver = next; } };
};

test('activity transaction opens in place with its Moment, activity and historical date', async (t) => {
  const harness = await openWorkspace(t);
  const form = harness.open();
  assert.ok(form, 'the real ActivityList callback opens the shared TransactionForm');
  assert.equal(form.props.defaultKind, 'expense');
  assert.equal(form.props.presetLink.eventId, 'moment-one');
  assert.equal(form.props.presetLink.activityId, 'activity-one');
  assert.equal(form.props.presetLink.date, '2026-08-24');
  assert.equal(form.props.events, harness.api.eventStore.events);
  assert.deepEqual(harness.navigations, [], 'opening never changes the Activities route');
  form.props.onCancel();
  assert.equal(harness.find('TransactionForm'), undefined);
  assert.deepEqual(harness.navigations, [], 'cancel also keeps the original route');
});

test('workspace transaction save blocks repeated submissions and closing until completion', async (t) => {
  const harness = await openWorkspace(t);
  let complete;
  harness.setSaver(() => new Promise((resolve) => { complete = resolve; }));
  const form = harness.open();
  const values = { transactionKind: 'expense', title: 'Synthetic tablets', amount: 419,
    category: 'Medical', date: '2026-08-24', notes: 'Unchanged notes',
    eventId: 'moment-one', activityId: 'activity-one' };
  const saving = form.props.onSubmit(values);
  await form.props.onSubmit(values);
  assert.equal(harness.calls.length, 1, 'the synchronous ref guard prevents duplicate coordinator calls');
  assert.deepEqual(harness.calls[0], values, 'the existing transaction coordinator receives the entire form');
  let current = harness.find('TransactionForm');
  assert.equal(current.props.busy, true);
  current.props.onCancel();
  assert.ok(harness.find('TransactionForm'), 'Cancel cannot dismiss an in-flight write');
  const modal = nodes(harness.render()).find((node) => node.type === 'ModalDialog' && node.props.title === 'Add Transaction');
  modal.props.onClose();
  assert.ok(harness.find('TransactionForm'), 'Escape/backdrop close uses the same guard');
  complete({ id: 'saved-expense' });
  await saving;
  assert.equal(harness.find('TransactionForm'), undefined);
  assert.equal(harness.toasts.length, 1);
  assert.deepEqual(harness.navigations, [], 'successful save leaves Activities open');
});

test('workspace transaction failures keep the form and its context available for retry', async (t) => {
  const harness = await openWorkspace(t);
  harness.setSaver(async () => { throw new Error('Synthetic write failure'); });
  const form = harness.open();
  await assert.rejects(form.props.onSubmit({ title: 'Synthetic failure' }), /Synthetic write failure/);
  const current = harness.find('TransactionForm');
  assert.ok(current, 'failure does not close the draft');
  assert.equal(current.props.busy, false);
  assert.equal(current.props.presetLink.activityId, 'activity-one');
  assert.match(text(harness.render()), /Synthetic write failure/);
  assert.deepEqual(harness.navigations, []);
  harness.setSaver(async () => ({ id: 'retry-expense' }));
  await current.props.onSubmit({ title: 'Synthetic retry' });
  assert.equal(harness.calls.length, 2, 'failure releases the submission guard for an explicit retry');
  assert.equal(harness.find('TransactionForm'), undefined);
});

test('Add transaction in the link-existing dialog uses the same in-place form', async (t) => {
  const harness = await openWorkspace(t);
  harness.find('ActivityList').props.onLinkExpense(harness.activity);
  let tree = harness.render();
  assert.ok(nodes(tree).find((node) => node.type === 'ModalDialog' && node.props.title.startsWith('Link expense')));
  const add = nodes(tree).find((node) => node.type === 'button' && text(node).trim() === 'Add transaction');
  assert.ok(add);
  add.props.onClick();
  const form = harness.find('TransactionForm');
  assert.equal(form.props.presetLink.activityId, 'activity-one');
  assert.equal(form.props.presetLink.date, '2026-08-24');
  tree = harness.render();
  assert.equal(nodes(tree).some((node) => node.type === 'ModalDialog' && node.props.title.startsWith('Link expense')), false);
  assert.deepEqual(harness.navigations, []);
});
