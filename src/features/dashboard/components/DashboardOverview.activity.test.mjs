import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(node.props?.children ?? [])] : [];
const sameDependencies = (first, second) => Array.isArray(first) && Array.isArray(second)
  && first.length === second.length && first.every((value, index) => Object.is(value, second[index]));
const dateString = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

const openDashboard = async (t) => {
  const key = `__dnDashboardActivity${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  let cursor = 0;
  let effects = [];
  const writes = [], toasts = [], navigations = [];
  const activity = { id: 'same-child-id', title: 'First task', date: dateString(), description: '**Existing notes**', priority: 'medium',
    completed: false, expenses: [{ id: 'expense', amount: 37 }], custom: 'child metadata' };
  const first = { id: 'moment-one', name: 'First Moment', date: dateString(), type: 'Personal', activities: [activity,
    { id: 'sibling', title: 'Sibling', date: dateString(), completed: true }], attachments: [{ id: 'photo' }], custom: 'parent metadata' };
  const second = { id: 'moment-two', name: 'Second Moment', date: dateString(), type: 'Personal', activities: [{ ...activity, title: 'Second task' }] };
  const historyDate = new Date(); historyDate.setFullYear(historyDate.getFullYear() - 1);
  const historical = { id: 'historical', name: 'Past Moment', date: dateString(historyDate), type: 'Personal', activities: [
    { id: 'history', title: 'Historical task', date: dateString(historyDate), completed: true },
  ] };
  const api = {
    state(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    ref(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    effect(factory, dependencies) { const index = cursor++; const previous = slots[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return;
      slots[index] = { dependencies, cleanup: previous?.cleanup };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = factory(); }); },
    sample: null,
    app: { user: { uid: 'owner' }, isGuest: false, preferences: {}, adminValues: {}, showToast: (...args) => toasts.push(args) },
    navigate: (...args) => navigations.push(args),
    eventStore: { events: [first, second, historical], loading: false, error: '', loadedFor: 'user:owner', activeLoadKey: 'user:owner', loadEvents: () => {},
      updateEventItem: async (...args) => { writes.push(args); return api.persist(...args); } },
    persist: async (_uid, _guest, item) => { api.eventStore.events = api.eventStore.events.map((existing) => existing.id === item.id ? item : existing); return item; },
  };
  globalThis[key] = api;
  const unmount = () => { for (const slot of slots) if (typeof slot?.cleanup === 'function') { slot.cleanup(); slot.cleanup = undefined; } };
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react', 'react-router-dom', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-dashboard-activity', enforce: 'pre', resolveId(source, importer) {
      if (source === 'react') return '\0dashboard-activity-react';
      if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0dashboard-activity-jsx';
      if (!importer?.replaceAll('\\', '/').endsWith('/src/features/dashboard/components/DashboardOverview.jsx')) return null;
      if (source === 'react-router-dom') return '\0dashboard-activity-router';
      if (source === 'lucide-react') return '\0dashboard-activity-icons';
      if (source.includes('/components/') || source === './DashboardActivityEditor') return `\0dashboard-activity-child:${source.split('/').at(-1)}`;
      if (source.endsWith('/store/useAppStore')) return '\0dashboard-activity-app';
      if (source.endsWith('/store/useEventStore')) return '\0dashboard-activity-events';
      if (source.endsWith('/dev/sampleData')) return '\0dashboard-activity-sample';
      return null;
    }, load(id) {
      const fixture = `globalThis[${JSON.stringify(key)}]`;
      if (id === '\0dashboard-activity-react') return `export const useState=${fixture}.state,useRef=${fixture}.ref,useEffect=${fixture}.effect; export const useMemo=(fn)=>fn();`;
      if (id === '\0dashboard-activity-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
      if (id === '\0dashboard-activity-router') return `export const useNavigate=()=>${fixture}.navigate;`;
      if (id === '\0dashboard-activity-icons') return 'export const Copy="icon",Download="icon",Sparkles="icon";';
      if (id.startsWith('\0dashboard-activity-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const buildGreetingCardHtml=()=>"";`;
      if (id === '\0dashboard-activity-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
      if (id === '\0dashboard-activity-events') return `const useStore=()=>${fixture}.eventStore; useStore.getState=useStore; export default useStore;`;
      if (id === '\0dashboard-activity-sample') return `export const getActiveSampleScenario=()=>${fixture}.sample;`;
      return null;
    } }],
  });
  t.after(async () => { unmount(); await server.close(); delete globalThis[key]; });
  const { default: Dashboard } = await server.ssrLoadModule('/src/features/dashboard/components/DashboardOverview.jsx');
  const render = () => { cursor = 0; const tree = Dashboard(); const pending = effects; effects = []; pending.forEach((effect) => effect()); return tree; };
  const editor = () => nodes(render()).find((node) => node.type === 'DashboardActivityEditor');
  const row = (title = 'First task') => nodes(render()).find((node) => node.type === 'button' && node.props['aria-label'] === `Edit ${title}`);
  const swipe = (title = 'First task') => nodes(render()).find((node) => node.type === 'SwipeToComplete' && node.props.label === title);
  const openEditor = (title) => { row(title).props.onClick(); return editor(); };
  const save = () => editor().props.onSubmit({ preventDefault() {} });
  render();
  return { api, first, second, activity, writes, toasts, navigations, render, editor, row, swipe, openEditor, save, unmount };
};

test('Upcoming row opens the particular prefilled activity editor on Home without navigation', async (t) => {
  const h = await openDashboard(t);
  const modal = h.openEditor('Second task');
  assert.equal(modal.props.draft.momentId, 'moment-two');
  assert.equal(modal.props.draft.activityId, 'same-child-id');
  assert.equal(modal.props.draft.title, 'Second task');
  assert.equal(modal.props.draft.date, dateString());
  assert.equal(modal.props.draft.description, '**Existing notes**');
  assert.equal(modal.props.draft.priority, 'medium');
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(h.writes, []);
});

test('saving uses latest parent and child while retaining expenses, metadata, siblings and duplicate child IDs in other Moments', async (t) => {
  const h = await openDashboard(t);
  h.openEditor('Second task').props.onChange({ title: ' Edited task ', description: '**New notes**', priority: 'high' });
  const latestSecond = { ...h.second, custom: 'new parent value', attachments: [{ id: 'new attachment' }], activities: [
    { ...h.second.activities[0], expenses: [{ id: 'new expense', amount: 88 }], metadata: 'latest child' },
    { id: 'new sibling', title: 'Added while editing', description: 'Keep me' },
  ] };
  h.api.eventStore.events = [h.first, latestSecond];
  await h.save();
  assert.equal(h.writes.length, 1);
  const [uid, guest, saved] = h.writes[0];
  assert.equal(uid, 'owner'); assert.equal(guest, false); assert.equal(saved.id, 'moment-two');
  assert.equal(saved.custom, 'new parent value'); assert.deepEqual(saved.attachments, latestSecond.attachments);
  assert.equal(saved.activities[0].title, 'Edited task'); assert.equal(saved.activities[0].description, '**New notes**');
  assert.equal(saved.activities[0].metadata, 'latest child'); assert.deepEqual(saved.activities[0].expenses, latestSecond.activities[0].expenses);
  assert.deepEqual(saved.activities[1], latestSecond.activities[1]);
  assert.equal(h.api.eventStore.events[0], h.first);
  assert.equal(h.editor(), undefined); assert.deepEqual(h.toasts, [['Activity updated', 'success']]);
  assert.deepEqual(h.navigations, []);
});

test('Guest saving resolves canonical numeric IDs without changing stored identity or account scope', async (t) => {
  const h = await openDashboard(t);
  h.api.app.user = null; h.api.app.isGuest = true;
  const moment = { ...h.first, id: 42, activities: [{ ...h.activity, id: 7 }] };
  Object.assign(h.api.eventStore, { events: [moment], loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous' });
  h.openEditor().props.onChange({ description: 'Guest notes' });
  await h.save();
  const [uid, guest, saved] = h.writes[0];
  assert.equal(uid, null); assert.equal(guest, true); assert.equal(saved.id, 42);
  assert.equal(saved.activities[0].id, 7); assert.equal(saved.activities[0].description, 'Guest notes');
  assert.deepEqual(saved.activities[0].expenses, h.activity.expenses);
});

test('duplicate submit and close are blocked until persistence succeeds; failure retains notes and supports retry', async (t) => {
  const h = await openDashboard(t);
  h.openEditor().props.onChange({ description: 'Retain this draft' });
  const pending = deferred(); h.api.persist = () => pending.promise;
  const saving = h.save();
  h.editor().props.onClose(); await h.save();
  assert.equal(h.writes.length, 1); assert.ok(h.editor()); assert.equal(h.editor().props.busy, true);
  assert.deepEqual(h.toasts, []);
  pending.reject(new Error('Connection unavailable')); await saving;
  assert.equal(h.editor().props.draft.description, 'Retain this draft');
  assert.match(h.editor().props.error, /Connection unavailable/); assert.equal(h.editor().props.busy, false);
  assert.deepEqual(h.toasts, []);
  h.api.persist = async () => {};
  await h.save(); assert.equal(h.writes.length, 2); assert.equal(h.editor(), undefined);
});

test('stale save closures reject changed account, loaded scope, sample, missing activity and unmount before writes', async (t) => {
  const h = await openDashboard(t);
  for (const invalidate of [
    () => { h.api.app.user = { uid: 'another-owner' }; },
    () => { h.api.app.user = null; h.api.app.isGuest = true; },
    () => { h.api.eventStore.loadedFor = 'user:another-owner'; },
    () => { h.api.eventStore.activeLoadKey = 'user:another-owner'; },
    () => { h.api.eventStore.loading = true; },
    () => { h.api.sample = 'another-sample'; },
    () => { h.api.eventStore.events = []; },
  ]) {
    h.api.app.user = { uid: 'owner' }; h.api.app.isGuest = false; h.api.sample = null;
    Object.assign(h.api.eventStore, { events: [h.first, h.second], loading: false, loadedFor: 'user:owner', activeLoadKey: 'user:owner' });
    const save = h.openEditor().props.onSubmit;
    invalidate(); await save({ preventDefault() {} });
    assert.equal(h.writes.length, 0); assert.deepEqual(h.toasts, []);
  }
  h.api.eventStore.events = [h.first];
  const save = h.openEditor().props.onSubmit;
  h.unmount(); await save({ preventDefault() {} });
  assert.deepEqual(h.writes, []);
});

test('completion uses the latest particular activity and its lock survives optimistic removal from Upcoming', async (t) => {
  const h = await openDashboard(t);
  const completion = h.swipe('Second task').props.onComplete;
  const latest = { ...h.second, activities: [{ ...h.activity, title: 'Second task', description: 'Latest notes', custom: 'Latest child' }] };
  h.api.eventStore.events = [h.first, latest];
  const pending = deferred();
  h.api.persist = async (_uid, _guest, item) => {
    h.api.eventStore.events = [h.first, item];
    return pending.promise;
  };
  const result = completion();
  assert.equal(h.swipe('Second task'), undefined, 'the optimistic completed row leaves Upcoming');
  await completion();
  assert.equal(h.writes.length, 1, 'a stale gesture callback cannot duplicate the in-flight write');
  assert.deepEqual(h.toasts, []);
  const saved = h.writes[0][2];
  assert.equal(saved.id, 'moment-two'); assert.equal(saved.activities[0].completed, true);
  assert.ok(saved.activities[0].completedAt); assert.equal(saved.activities[0].description, 'Latest notes');
  assert.equal(saved.activities[0].custom, 'Latest child'); assert.deepEqual(saved.activities[0].expenses, h.activity.expenses);
  assert.equal(h.first.activities[0].completed, false);
  pending.resolve(); await result;
  assert.deepEqual(h.toasts, [['Activity completed', 'success']]); assert.deepEqual(h.navigations, []);
});

test('same-Moment aggregate writes serialize even when different activities are swiped', async (t) => {
  const h = await openDashboard(t);
  h.api.eventStore.events = [{ ...h.first, activities: [h.activity, { ...h.activity, id: 'sibling-task', title: 'Sibling task' }] }];
  const first = h.swipe().props.onComplete;
  const sibling = h.swipe('Sibling task').props.onComplete;
  const pending = deferred(); h.api.persist = () => pending.promise;
  const result = first(); await sibling();
  assert.equal(h.writes.length, 1, 'a second aggregate cannot overwrite the first in-flight sibling update');
  assert.equal(h.swipe('Sibling task').props.disabled, true);
  pending.resolve(); await result;
  assert.equal(h.swipe('Sibling task').props.disabled, false);
});

test('failed completion reports failure and can be retried; completed/cancelled/deleted and stale targets do not write', async (t) => {
  const h = await openDashboard(t);
  const completion = h.swipe().props.onComplete;
  h.api.persist = async () => { throw new Error('Write failed'); };
  await assert.rejects(completion(), /Write failed/);
  assert.equal(h.writes.length, 1); assert.equal(h.toasts.some(([, kind]) => kind === 'success'), false);
  h.api.persist = async () => {};
  await completion(); assert.equal(h.writes.length, 2);
  for (const activity of [{ ...h.activity, completed: true }, { ...h.activity, cancelled: true }]) {
    h.api.eventStore.events = [{ ...h.first, activities: [activity] }];
    await completion().catch(() => {});
    assert.equal(h.writes.length, 2);
  }
  h.api.eventStore.events = [];
  await assert.rejects(completion(), /no longer available/); assert.equal(h.writes.length, 2);
  h.api.app.user = { uid: 'another' };
  await assert.rejects(completion(), /session changed/); assert.equal(h.writes.length, 2);
});

test('late persistence settlement after account change or unmount gives no success in another session', async (t) => {
  const h = await openDashboard(t);
  const pending = deferred(); h.api.persist = () => pending.promise;
  const result = h.swipe().props.onComplete();
  h.api.app.user = { uid: 'another-owner' }; h.unmount();
  pending.resolve(); await result;
  assert.deepEqual(h.toasts, []); assert.deepEqual(h.navigations, []);
});

test('settling an old-scope write releases its row lock when returning to that account', async (t) => {
  const h = await openDashboard(t);
  const pending = deferred(); h.api.persist = () => pending.promise;
  const result = h.swipe().props.onComplete();
  assert.equal(h.row().props.disabled, true);
  h.api.app.user = { uid: 'another-owner' };
  Object.assign(h.api.eventStore, { events: [], loadedFor: 'user:another-owner', activeLoadKey: 'user:another-owner' });
  h.render();
  pending.resolve(); await result;
  h.api.app.user = { uid: 'owner' };
  Object.assign(h.api.eventStore, { events: [h.first], loadedFor: 'user:owner', activeLoadKey: 'user:owner' });
  h.render();
  assert.equal(h.row().props.disabled, false);
  assert.equal(h.swipe().props.disabled, false);
  assert.deepEqual(h.toasts, []);
});

test('On This Day retains navigation without completion wrappers or edit actions', async (t) => {
  const h = await openDashboard(t);
  const group = nodes(h.render()).find((node) => node.props?.['aria-label'] === 'Activity dates');
  nodes(group).find((node) => node.type === 'button' && node.props.children === 'On This Day').props.onClick();
  const tree = h.render();
  assert.equal(nodes(tree).some((node) => node.type === 'SwipeToComplete'), false);
  const row = nodes(tree).find((node) => node.type === 'button' && nodes(node).some((child) => child.type === 'strong' && child.props.children === 'Historical task'));
  row.props.onClick();
  assert.deepEqual(h.navigations, [['/events/historical/activities']]); assert.deepEqual(h.writes, []);
  assert.equal(h.editor(), undefined);
});
