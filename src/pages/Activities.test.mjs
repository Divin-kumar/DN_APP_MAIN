import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const children = (node) => Array.isArray(node) ? node : node?.props?.children ?? [];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(children(node))] : [];
const text = (node) => Array.isArray(node) ? node.map(text).join('')
  : node && typeof node === 'object' ? text(children(node)) : String(node ?? '');
const settled = () => new Promise((resolve) => setImmediate(resolve));

// Run the exported page's real handlers with inert children and scoped in-memory
// stores. No Firebase SDK, browser storage or signed-in account is initialized.
const openActivities = async (t) => {
  const key = `__dnActivities${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  let cursor = 0;
  let saver = async () => ({ id: 'new-expense' });
  const makeActivity = (title, eventId) => ({ id: 'shared-activity', eventId, title,
    date: '2026-08-24', description: 'Original notes', priority: 'medium', completed: false,
    completedAt: null, cancelled: false, status: 'in-progress', createdAt: '2024-03-01T10:30:00.000Z',
    expenses: [{ id: `nested-${eventId}`, amount: 17 }], customMetadata: { retained: eventId } });
  const first = { id: 'moment-one', name: 'Synthetic first Moment', type: 'Personal',
    date: '2027-03-01', activities: [makeActivity('Synthetic first activity', 'moment-one')],
    memories: [{ id: 'memory-one' }], attachments: [{ id: 'attachment-one', name: 'photo.jpg' }] };
  const second = { id: 'moment-two', name: 'Synthetic second Moment', type: 'Personal',
    date: '2027-03-02', activities: [makeActivity('Synthetic second activity', 'moment-two'),
      { id: 'unrelated', eventId: 'moment-two', title: 'Unrelated activity', date: '2026-10-01' }],
    memories: [{ id: 'memory-two' }], attachments: [{ id: 'attachment-two', name: 'receipt.jpg' }] };
  const writes = [];
  const saves = [];
  const toasts = [];
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    ref(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    memo(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || previous.dependencies.length !== dependencies.length
        || dependencies.some((value, offset) => !Object.is(value, previous.dependencies[offset]))) {
        slots[index] = { value: factory(), dependencies: [...dependencies] };
      }
      return slots[index].value;
    },
    filters: null,
    app: { user: { uid: 'synthetic-owner' }, isGuest: false,
      adminValues: { eventTypes: [], activityPriorities: [] },
      showToast: (...args) => toasts.push(args) },
    eventStore: { events: [first, second], loading: false, error: '',
      loadedFor: 'user:synthetic-owner', activeLoadKey: 'user:synthetic-owner', loadEvents: () => {},
      updateEventItem: async (uid, isGuest, moment) => {
        writes.push({ uid, isGuest, moment });
        api.eventStore.events = api.eventStore.events.map((item) => item.id === moment.id ? moment : item);
        return moment;
      } },
    expenseStore: { expenses: [
      { id: 'expense-one', eventId: 'moment-one', activityId: 'shared-activity', amount: 41 },
      { id: 'expense-two', eventId: 'moment-two', activityId: 'shared-activity', amount: 82 },
      { id: 'unlinked-expense', eventId: 'moment-two', amount: 9 },
    ], loadedFor: 'user:synthetic-owner', activeLoadKey: 'user:synthetic-owner',
    loading: false, error: '', loadExpenses: () => {} },
    save: async (...args) => { saves.push(args); return saver(...args); },
  };
  globalThis[key] = api;
  const server = await createServer({ configFile: false, envFile: false,
    esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'react-router-dom', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-activities-handlers', enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/') || '';
        if (source === 'react') return '\0activities-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0activities-jsx';
        if (!file.endsWith('/src/pages/Activities.jsx')) return null;
        if (source.endsWith('/services/scopedRecordActions')) return '\0activities-writer';
        if (source === 'react-router-dom') return '\0activities-router';
        if (source === 'lucide-react') return '\0activities-icons';
        if (source.includes('/components/')) return `\0activities-child:${source.split('/').at(-1)}`;
        if (source.endsWith('/store/useAppStore')) return '\0activities-app';
        if (source.endsWith('/store/useEventStore')) return '\0activities-events';
        if (source.endsWith('/store/useExpenseStore')) return '\0activities-expenses';
        if (source.endsWith('/hooks/useTransactionManager')) return '\0activities-manager';
        if (source.endsWith('/hooks/usePersistentListState')) return '\0activities-filters';
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0activities-react') return `export const useState=${fixture}.state,useRef=${fixture}.ref,useMemo=${fixture}.memo; export const useEffect=()=>{};`;
        if (id === '\0activities-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
        if (id === '\0activities-router') return 'export const Link="Link",useNavigate=()=>()=>{};';
        if (id === '\0activities-icons') return 'export const ListChecks="icon",Plus="icon";';
        if (id.startsWith('\0activities-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const ConfirmDialog="ConfirmDialog";`;
        if (id === '\0activities-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
        if (id === '\0activities-events') return `const useStore=()=>${fixture}.eventStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0activities-expenses') return `const useStore=()=>${fixture}.expenseStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0activities-writer') return `import {createScopedRecordActions} from '/src/utils/scopedRecordActions.js'; export const scopedRecordActions=createScopedRecordActions({getSession:()=>${fixture}.app,getEvents:()=>${fixture}.eventStore});`;
        if (id === '\0activities-manager') return `export default ()=>({saveTransaction:${fixture}.save});`;
        if (id === '\0activities-filters') return `export default (_key,defaults)=>{const api=${fixture}; api.filters??=defaults; return [api.filters,(patch)=>{api.filters={...api.filters,...patch}},()=>{api.filters=defaults}];};`;
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const { ActivitiesContent } = await server.ssrLoadModule('/src/pages/Activities.jsx');
  const render = () => { cursor = 0; return ActivitiesContent({ uid: 'synthetic-owner', isGuest: false, scope: 'user:synthetic-owner' }); };
  const find = (type) => nodes(render()).find((node) => node.type === type);
  const list = () => find('ActivityList');
  const view = (title = 'Synthetic second activity') => list().props.allActivities.find((item) => item.title === title);
  return { api, first, second, writes, saves, toasts, render, find, list, view,
    setSaver: (next) => { saver = next; } };
};

test('Moment filter excludes archived choices by default and preserves explicit visibility on selection', async (t) => {
  const h = await openActivities(t);
  h.second.archived = true;
  const control = (id) => nodes(h.render()).find((node) => node.props?.id === id);
  const values = () => nodes(control('activities-moment-filter')).filter((node) => node.type === 'option').map((node) => node.props.value);
  assert.deepEqual(values(), ['', 'moment-one']);
  assert.equal(nodes(h.render()).some((node) => node.type === 'details'), false);
  control('activities-moment-filter').props.onChange({ target: { value: 'moment-one' } });
  assert.equal(h.api.filters.parentScope, 'active');
  control('activities-parent-filter').props.onChange({ target: { value: 'archived' } });
  assert.equal(h.api.filters.momentId, '', 'incompatible selection is cleared');
  assert.deepEqual(values(), ['', 'moment-two']);
  control('activities-moment-filter').props.onChange({ target: { value: 'moment-two' } });
  assert.equal(h.api.filters.parentScope, 'archived');
  control('activities-status-filter').props.onChange({ target: { value: 'completed' } });
  assert.equal(h.api.filters.momentId, 'moment-two');
  h.find('ListControls').props.onReset();
  assert.deepEqual(values(), ['', 'moment-one']);
  assert.equal(h.writes.length, 0);
});

test('Moment type narrows picker, activities and progress together without writing records', async (t) => {
  const h = await openActivities(t);
  h.second.type = 'Other';
  h.second.customType = 'Travel';
  const control = (id) => nodes(h.render()).find((node) => node.props?.id === id);
  const values = (id) => nodes(control(id)).filter((node) => node.type === 'option').map((node) => node.props.value);
  assert.deepEqual(values('activities-status-filter'), ['all', 'in-progress', 'completed', 'cancelled']);
  control('activities-moment-filter').props.onChange({ target: { value: 'moment-one' } });
  control('activities-type-filter').props.onChange({ target: { value: 'Travel' } });
  assert.equal(h.api.filters.momentId, '');
  assert.deepEqual(values('activities-moment-filter'), ['', 'moment-two']);
  assert.equal(h.list().props.activities.length, 2);
  assert.equal(h.list().props.allActivities.length, 2);
  control('activities-moment-filter').props.onChange({ target: { value: 'moment-two' } });
  assert.equal(h.api.filters.momentType, 'Travel');
  h.find('ListControls').props.onReset();
  assert.equal(h.api.filters.momentType, '');
  assert.equal(h.list().props.allActivities.length, 3);
  assert.equal(h.writes.length, 0);
});

test('duplicate activity IDs complete and cancel only their chosen Moment', async (t) => {
  const harness = await openActivities(t);
  const originalFirst = structuredClone(harness.first);
  harness.list().props.onToggleComplete('shared-activity', harness.view());
  await settled();
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.writes[0].uid, 'synthetic-owner');
  assert.equal(harness.writes[0].isGuest, false);
  assert.equal(harness.writes[0].moment.id, 'moment-two');
  let updated = harness.api.eventStore.events[1].activities[0];
  assert.equal(updated.completed, true);
  assert.ok(Number.isFinite(Date.parse(updated.completedAt)));
  assert.equal(updated.eventId, 'moment-two');
  assert.equal(updated.id, 'shared-activity');
  assert.deepEqual(updated.expenses, harness.second.activities[0].expenses);
  assert.deepEqual(harness.api.eventStore.events[0], originalFirst);
  harness.list().props.onToggleCancelled('shared-activity', harness.view());
  await settled();
  updated = harness.api.eventStore.events[1].activities[0];
  assert.equal(updated.cancelled, true);
  assert.equal(updated.status, 'cancelled');
  assert.equal(updated.completed, true, 'cancelling preserves completion metadata');
  assert.deepEqual(harness.api.eventStore.events[0], originalFirst);
  assert.deepEqual(harness.api.eventStore.events[1].activities[1], harness.second.activities[1]);
});

test('editing one duplicate retains nested expenses, cancellation, completion and unrelated data', async (t) => {
  const harness = await openActivities(t);
  Object.assign(harness.second.activities[0], { completed: true, completedAt: '2025-09-01T08:00:00.000Z', cancelled: true, status: 'cancelled' });
  const originalFirst = structuredClone(harness.first);
  const originalSecond = structuredClone(harness.second);
  harness.list();
  harness.api.filters = { ...harness.api.filters, filter: 'cancelled' };
  harness.list().props.onEdit(harness.view());
  const titleInput = nodes(harness.render()).find((node) => node.type === 'input' && node.props['aria-label'] === 'Activity title');
  titleInput.props.onChange({ target: { value: 'Updated synthetic title' } });
  const editor = nodes(harness.render()).find((node) => node.type === 'form');
  editor.props.onSubmit({ preventDefault() {} });
  await settled();
  assert.equal(harness.writes.length, 1);
  assert.deepEqual(harness.api.eventStore.events[0], originalFirst);
  assert.deepEqual(harness.writes[0].moment, { ...originalSecond,
    activities: [{ ...originalSecond.activities[0], title: 'Updated synthetic title' }, originalSecond.activities[1]] });
  assert.equal(harness.find('ModalDialog'), undefined, 'successful save closes the editor');
});

test('confirmed deletion removes only the chosen duplicate and leaves other Moment content intact', async (t) => {
  const harness = await openActivities(t);
  const originalFirst = structuredClone(harness.first);
  harness.list().props.onDelete('shared-activity', harness.view());
  assert.equal(harness.writes.length, 0, 'opening confirmation never deletes records');
  const confirm = harness.find('ConfirmDialog');
  assert.ok(confirm);
  confirm.props.onConfirm();
  await settled();
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.writes[0].moment.id, 'moment-two');
  assert.deepEqual(harness.api.eventStore.events[0], originalFirst);
  assert.deepEqual(harness.api.eventStore.events[1].activities, [harness.second.activities[1]]);
  assert.deepEqual(harness.api.eventStore.events[1].memories, harness.second.memories);
  assert.deepEqual(harness.api.eventStore.events[1].attachments, harness.second.attachments);
  assert.equal(harness.find('ConfirmDialog'), undefined);
});

test('expense presentation uses composite Moment/activity keys and hides stale expense scope', async (t) => {
  const harness = await openActivities(t);
  const list = harness.list().props;
  const first = harness.view('Synthetic first activity');
  const second = harness.view();
  const firstKey = list.getActivityKey(first);
  const secondKey = list.getActivityKey(second);
  assert.notEqual(firstKey, secondKey);
  assert.deepEqual(list.expensesByActivity[firstKey].map((expense) => expense.id), ['expense-one']);
  assert.deepEqual(list.expensesByActivity[secondKey].map((expense) => expense.id), ['expense-two']);
  assert.equal(list.getEventName(second).props.to, '/events/moment-two/activities');
  assert.equal('momentId' in second, false, 'presentation context does not alter stored activity fields');
  harness.api.expenseStore.activeLoadKey = 'user:another-owner';
  assert.deepEqual(harness.list().props.expensesByActivity[firstKey], []);
  assert.deepEqual(harness.list().props.expensesByActivity[secondKey], []);
});

test('captured activity actions reject a changed account or stale Moment load scope', async (t) => {
  for (const change of [
    (api) => { api.app.user = { uid: 'another-owner' }; },
    (api) => { api.eventStore.loadedFor = 'user:another-owner'; },
    (api) => { api.eventStore.activeLoadKey = 'user:another-owner'; },
  ]) {
    const harness = await openActivities(t);
    const list = harness.list().props;
    const selected = harness.view();
    change(harness.api);
    list.onToggleComplete('shared-activity', selected);
    await settled();
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.saves.length, 0);
    if (harness.api.app.user.uid === 'synthetic-owner') {
      assert.match(text(harness.render()), /active account changed or its Moments are still loading/);
      assert.equal(harness.find('ActivityList'), undefined, 'stale scoped data is not displayed');
    }
  }
});

test('Activities delegates transaction creation to universal + without contextual mutation callbacks', async (t) => {
  const harness = await openActivities(t);
  const list = harness.list();
  assert.equal(list.props.onAddExpense, undefined);
  assert.equal(list.props.onLinkExpense, undefined);
  assert.equal(harness.find('TransactionForm'), undefined);
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.saves, []);
});

test('attachment previews resolve the containing Moment when activity IDs are reused', async (t) => {
  const harness = await openActivities(t);
  harness.first.attachments.push({ id: 'photo-one', activityId: 'shared-activity', assetId: 'first-original' });
  harness.second.attachments.push({ id: 'photo-two', activityId: 'shared-activity', assetId: 'second-original' });
  const list = harness.list().props;
  const first = list.renderAttachments(harness.view('Synthetic first activity'));
  const second = list.renderAttachments(harness.view());
  assert.deepEqual(first.props.attachments.map((item) => item.id), ['photo-one']);
  assert.deepEqual(second.props.attachments.map((item) => item.id), ['photo-two']);
  assert.equal(second.props.uid, 'synthetic-owner');
  assert.equal(second.props.compact, true);
  assert.deepEqual(harness.writes, []);
});
