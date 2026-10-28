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
    eventStore: { loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous', events: [moment], loading: false, error: '', loadEvents: () => {},
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
        if (source.endsWith('/services/scopedRecordActions')) return '\0workspace-shared-writer';
        if (source.endsWith('/hooks/useMomentFinance')) return '\0workspace-shared-finance';
        if (source === './MomentContents') return '\0workspace-transaction-child:MomentContents';
        if (source === './MomentStory') return '\0workspace-transaction-child:MomentContents';
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
        if (id === '\0workspace-transaction-icons') return 'export const Archive="icon",ArchiveRestore="icon",ArrowLeft="icon",BookHeart="icon",CalendarDays="icon",Check="icon",CircleCheck="icon",Clock3="icon",Download="icon",FileText="icon",Heart="icon",Images="icon",ListChecks="icon",Pencil="icon",Plus="icon",Receipt="icon",Save="icon",Search="icon",Sparkles="icon",Trash2="icon",Upload="icon",X="icon";';
        if (id.startsWith('\0workspace-transaction-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const ConfirmDialog="ConfirmDialog";`;
        if (id === '\0workspace-shared-writer') return `import {createScopedRecordActions} from '/src/utils/scopedRecordActions.js'; export const scopedRecordActions=createScopedRecordActions({getSession:()=>${fixture}.app,getEvents:()=>${fixture}.eventStore});`;
        if (id === '\0workspace-shared-finance') return `export default ()=>({ready:true,transactions:[],summary:{income:0,expense:0,balance:0},error:null});`;
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
  const { EventWorkspaceContent: Workspace } = await server.ssrLoadModule('/src/features/events/components/EventWorkspaceShell.jsx');
  const render = () => { cursor = 0; return Workspace(); };
  const find = (type) => nodes(render()).find((node) => node.type === type);
  return { activity, api, calls, navigations, toasts, render, find };
};

test('Moment Activities exposes read-only cards without record or finance mutation callbacks', async (t) => {
  const harness = await openWorkspace(t);
  const list = harness.find('ActivityList');
  assert.equal(list.props.readOnly, true);
  for (const action of ['onEdit', 'onDelete', 'onToggleComplete', 'onToggleCancelled', 'onAddExpense', 'onLinkExpense']) {
    assert.equal(list.props[action], undefined, action + ' is unavailable in this tab');
  }
  assert.equal(harness.find('TransactionForm'), undefined);
  assert.deepEqual(harness.calls, []);
});

test('read-only Moment Activity selection opens the canonical nested Detail route', async (t) => {
  const harness = await openWorkspace(t);
  harness.find('ActivityList').props.onOpen(harness.activity);
  assert.equal(harness.navigations[0][0], '/events/moment-one/activities/activity-one');
  assert.deepEqual(harness.navigations[0][1].state, {
    activityOrigin: '/events/moment-one/activities',
    activitySequence: { scope: JSON.stringify(['guest:anonymous', null]),
      ids: [['moment-one', 'activity-one']], momentId: 'moment-one' },
  });
  assert.deepEqual(harness.calls, []);
});

test('retired Timeline links display Overview without a Timeline tab or record writes', async (t) => {
  const harness = await openWorkspace(t);
  harness.api.location.pathname = '/events/moment-one/timeline';
  assert.ok(harness.find('MomentContents'));
  assert.equal(harness.find('ActivityList'), undefined);
  assert.doesNotMatch(text(harness.render()), /Timeline/);
  assert.deepEqual(harness.calls, []);
});
