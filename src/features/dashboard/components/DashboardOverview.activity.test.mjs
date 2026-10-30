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
      const file=importer?.replaceAll('\\','/') || '';
      if (!file.endsWith('/src/features/dashboard/components/DashboardOverview.jsx') && !file.endsWith('/src/hooks/useActivityActions.js')) return null;
      if (source.endsWith('/services/scopedRecordActions')) return '\0dashboard-shared-writer';
      if (source === 'react-router-dom') return '\0dashboard-activity-router';
      if (source === 'lucide-react') return '\0dashboard-activity-icons';
      if (source.includes('/components/') || ['./DashboardActivityEditor', './DashboardGreeting'].includes(source)) return `\0dashboard-activity-child:${source.split('/').at(-1)}`;
      if (source.endsWith('/store/useAppStore')) return '\0dashboard-activity-app';
      if (source.endsWith('/store/useEventStore')) return '\0dashboard-activity-events';
      if (source.endsWith('/dev/sampleData')) return '\0dashboard-activity-sample';
      return null;
    }, load(id) {
      const fixture = `globalThis[${JSON.stringify(key)}]`;
      if (id === '\0dashboard-activity-react') return `export const useState=${fixture}.state,useRef=${fixture}.ref,useEffect=${fixture}.effect; export const useMemo=(fn)=>fn();`;
      if (id === '\0dashboard-activity-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
      if (id === '\0dashboard-activity-router') return `export const useNavigate=()=>${fixture}.navigate;`;
      if (id === '\0dashboard-activity-icons') return 'export const Copy="icon",Download="icon",Sparkles="icon",Pencil="icon",BookOpen="icon",Check="icon",RotateCcw="icon",XCircle="icon";';
      if (id.startsWith('\0dashboard-activity-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const buildGreetingCardHtml=()=>"", MomentSummaryPhotos="photos", sortedSummaryActivities=(items)=>items || [];`;
      if (id === '\0dashboard-shared-writer') return `import {createScopedRecordActions} from '/src/utils/scopedRecordActions.js'; export const scopedRecordActions=createScopedRecordActions({getSession:()=>${fixture}.app,getEvents:()=>${fixture}.eventStore,getSample:()=>${fixture}.sample});`;
      if (id === '\0dashboard-activity-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
      if (id === '\0dashboard-activity-events') return `const useStore=()=>${fixture}.eventStore; useStore.getState=useStore; export default useStore;`;
      if (id === '\0dashboard-activity-sample') return `export const getActiveSampleScenario=()=>${fixture}.sample;`;
      return null;
    } }],
  });
  t.after(async () => { unmount(); await server.close(); delete globalThis[key]; });
  const { DashboardOverviewContent: Dashboard } = await server.ssrLoadModule('/src/features/dashboard/components/DashboardOverview.jsx');
  const render = () => { cursor = 0; const tree = Dashboard(); const pending = effects; effects = []; pending.forEach((effect) => effect()); return tree; };
  const actions=()=>nodes(render()).find((node)=>node.type==='ActivityActionDialogs').props.actions;
  const editor=()=>{const a=actions(); return a.draft ? {props:{draft:a.draft,onChange:a.changeDraft,onSubmit:a.save,onClose:a.closeEditor,busy:a.busy,error:a.error}}:undefined;};
  const row = (title = 'First task') => nodes(render()).find((node) => node.type === 'button' && node.props['aria-label'] === `Open ${title}`);
  const card = (title = 'First task') => nodes(render()).find((node) => node.type === 'SwipeActionCard' && node.props.label === title);
  const menuAction = (title, label) => card(title)?.props.otherActions.find((action) => action.label === label);
  const openEditor=(title='First task')=>{nodes(render()).find((node)=>node.type==='SwipeActionCard' && node.props.label===title).props.otherActions.find((action)=>action.label==='Edit').onClick();return editor();};
  const save = () => editor().props.onSubmit({ preventDefault() {} });
  render();
  return { api, first, second, activity, writes, toasts, navigations, render, editor, row, card, menuAction, openEditor, save, unmount, actions };
};

test('normal Dashboard tap opens the exact nested Activity page; Edit remains explicit', async (t) => {
  const h=await openDashboard(t);
  h.row('Second task').props.onClick();
  assert.deepEqual(h.navigations,[['/events/moment-two/activities/same-child-id']]);
  assert.equal(h.editor(),undefined);
  const editor=h.openEditor('Second task');
  assert.equal(editor.props.draft.momentId,'moment-two');
  assert.equal(editor.props.draft.description,'**Existing notes**');
  assert.deepEqual(h.writes,[]);
});

test('explicit edits resolve latest parent/child and retain siblings, expenses and unknown fields', async (t) => {
  const h=await openDashboard(t);
  h.openEditor('Second task').props.onChange({title:' Updated task ', description:'**New notes**'});
  const latest={...h.second,custom:'latest parent',activities:[{...h.second.activities[0],metadata:'latest child'}, {id:'sibling',title:'Keep me',custom:42}]};
  h.api.eventStore.events=[h.first,latest];
  await h.save();
  assert.equal(h.writes.length,1);
  const saved=h.writes[0][2];
  assert.equal(saved.custom,'latest parent');
  assert.equal(saved.activities[0].title,'Updated task');
  assert.equal(saved.activities[0].metadata,'latest child');
  assert.deepEqual(saved.activities[0].expenses,latest.activities[0].expenses);
  assert.deepEqual(saved.activities[1],latest.activities[1]);
  assert.equal(h.api.eventStore.events[0],h.first);
  assert.equal(h.editor(),undefined);
  assert.equal(h.actions().announcement,'Activity updated');
});

test('failed edit retains the draft and duplicate submit/close are blocked until retry settles', async (t) => {
  const h=await openDashboard(t);
  h.openEditor().props.onChange({description:'Retain draft'});
  const pending=deferred(); h.api.persist=()=>pending.promise;
  const saving=h.save(); await new Promise(resolve=>setImmediate(resolve));
  h.editor().props.onClose(); await h.save();
  assert.equal(h.writes.length,1); assert.ok(h.editor());
  pending.reject(new Error('Connection unavailable')); await saving;
  assert.equal(h.editor().props.draft.description,'Retain draft');
  assert.match(h.editor().props.error,/Connection unavailable/);
  assert.equal(h.editor().props.busy,false);
  h.api.persist=async()=>{}; await h.save();
  assert.equal(h.writes.length,2); assert.equal(h.editor(),undefined);
});

test('explicit menu completion uses the latest record and rejects duplicate in-flight requests', async(t)=>{
  const h=await openDashboard(t); const complete=h.menuAction('Second task', 'Complete').onClick;
  const pending=deferred(); h.api.persist=()=>pending.promise;
  const saving=complete(); await new Promise(resolve=>setImmediate(resolve)); await complete();
  assert.equal(h.writes.length,1); assert.equal(h.writes[0][2].id,'moment-two');
  assert.equal(h.writes[0][2].activities[0].completed,true);
  assert.equal(h.writes[0][2].activities[0].description,'**Existing notes**');
  assert.equal(h.first.activities[0].completed,false);
  pending.resolve(); await saving;
  assert.equal(h.actions().announcement,'Activity completed');
});

test('stale scope, Sample change and unmounted Activity actions cannot write', async(t)=>{
  const h=await openDashboard(t); const complete=h.menuAction('First task', 'Complete').onClick;
  h.api.app.user={uid:'other'}; await assert.rejects(complete(),/session changed/);
  h.api.app.user={uid:'owner'}; h.api.sample='new'; await assert.rejects(complete(),/session changed/);
  assert.equal(h.writes.length,0);
  h.api.sample=null; h.unmount(); await complete(); assert.equal(h.writes.length,0);
});

test('On This Day opens Activity Detail and exposes deliberate reopening and menu actions', async(t)=>{
  const h=await openDashboard(t);
  const group=nodes(h.render()).find(node=>node.props?.['aria-label']==='Activity dates');
  nodes(group).find(node=>node.type==='button'&&node.props.children==='On This Day').props.onClick();
  const row=nodes(h.render()).find(node=>node.type==='button'&&node.props['aria-label']==='Open Historical task');
  row.props.onClick();
  assert.deepEqual(h.navigations,[['/events/historical/activities/history']]);
  const card=h.card('Historical task'); assert.equal(card.props.swipeEnabled,true);
  assert.equal(h.menuAction('Historical task', 'Reopen').label,'Reopen');
  assert.equal(typeof card.props.onDelete,'function');
  assert.equal(h.writes.length,0);
});

test('Moment and Activity date toggles share their heading with Hide and retain the chosen view after showing again', async (t) => {
  const h = await openDashboard(t);
  const section = (label) => nodes(h.render()).find((node) => node.type === 'section' && node.props['aria-label'] === label);
  const heading = (label) => nodes(section(label)).find((node) => node.type === 'header');
  for (const [label, dates] of [['Moments', 'Moment dates'], ['Activities', 'Activity dates']]) {
    const header = heading(label);
    const actions = nodes(header).find((node) => node.props?.className === 'dashboard-section-actions');
    const group = nodes(actions).find((node) => node.props?.['aria-label'] === dates);
    assert.ok(group, `${dates} belongs to the heading actions`);
    assert.ok(nodes(actions).some((node) => node.props?.['aria-label'] === `Hide ${label} on dashboard`));
    assert.equal(nodes(section(label)).filter((node) => node.props?.['aria-label'] === dates).length, 1);
    nodes(group).find((node) => node.type === 'button' && node.props.children === 'On This Day').props.onClick();
    nodes(heading(label)).find((node) => node.props?.['aria-label'] === `Hide ${label} on dashboard`).props.onClick();
    assert.equal(nodes(section(label)).some((node) => node.props?.['aria-label'] === dates), false);
    nodes(heading(label)).find((node) => node.props?.['aria-label'] === `Show ${label} on dashboard`).props.onClick();
    const restored = nodes(heading(label)).find((node) => node.props?.['aria-label'] === dates);
    assert.equal(nodes(restored).find((node) => node.type === 'button' && node.props.children === 'On This Day').props['aria-pressed'], true);
  }
  assert.equal(h.writes.length, 0);
});

test('business read failures keep meaningful list retries while the greeting receives only the clock', async (t) => {
  const h = await openDashboard(t);
  h.api.eventStore.error = 'Unable to load events.';
  const tree = h.render(), greeting = nodes(tree).find((node) => node.type === 'DashboardGreeting');
  assert.deepEqual(Object.keys(greeting.props), ['now']);
  const alerts = nodes(tree).filter((node) => node.props?.role === 'alert' && node.props?.className === 'financial-load-error');
  assert.equal(alerts.length, 2);
  assert.ok(alerts.every((node) => nodes(node).some((child) => child.type === 'button' && child.props.children === 'Try again')));
});
