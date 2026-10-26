import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const children = (node) => Array.isArray(node) ? node : node?.props?.children ?? [];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(children(node))] : [];
const sameDependencies = (first, second) => Array.isArray(first) && Array.isArray(second)
  && first.length === second.length && first.every((value, index) => Object.is(value, second[index]));

// Install the real workspace effects on an in-memory EventTarget. Hook slots,
// child components, file input and scoped stores are inert; no Firebase or real
// file picker is initialized and every unexpected record write is recorded.
const openWorkspace = async (t) => {
  const key = `__dnWorkspaceCreate${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];
  const listeners = new Map();
  const windowTarget = new EventTarget();
  const originalAdd = windowTarget.addEventListener.bind(windowTarget);
  const originalRemove = windowTarget.removeEventListener.bind(windowTarget);
  windowTarget.addEventListener = (type, callback, options) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
    originalAdd(type, callback, options);
  };
  windowTarget.removeEventListener = (type, callback, options) => {
    listeners.get(type)?.delete(callback);
    originalRemove(type, callback, options);
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: windowTarget });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: new EventTarget() });
  const writes = [];
  const fileClicks = [];
  const originalSaves = [];
  const toasts = [];
  const moment = { id: 'synthetic-moment', name: 'Synthetic Moment', type: 'Personal',
    date: '2026-08-24', activities: [], memories: [], attachments: [] };
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
    effect(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return;
      slots[index] = { dependencies, cleanup: previous?.cleanup };
      pendingEffects.push(() => {
        previous?.cleanup?.();
        const cleanup = factory();
        slots[index].cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      });
    },
    dispatching: false,
    location: { pathname: '/events/synthetic-moment/overview', search: '', hash: '' },
    params: { eventId: 'synthetic-moment' },
    navigate: () => { throw new Error('Opening a contextual create action must not navigate'); },
    app: { user: { uid: 'synthetic-owner' }, isGuest: false,
      adminValues: { eventTypes: [], activityPriorities: [] }, preferences: {}, showToast: (...args) => toasts.push(args) },
    eventStore: { events: [moment], loading: false, error: '',
      loadedFor: 'user:synthetic-owner', activeLoadKey: 'user:synthetic-owner',
      loadEvents: () => {}, updateEventItem: async (...args) => { writes.push(args); },
      deleteEventItem: async (...args) => { writes.push(args); } },
    expenseStore: { expenses: [], loadExpenses: () => {} },
    persistOriginal: async () => ({ assetId: 'a'.repeat(64), storage: 'local' }),
    saveOriginal: async (file, context) => {
      originalSaves.push({ file, context });
      context.assertCurrent?.();
      return api.persistOriginal(file, context);
    },
  };
  globalThis[key] = api;
  const unmount = () => {
    for (const slot of slots) {
      if (slot && typeof slot.cleanup === 'function') { slot.cleanup(); slot.cleanup = undefined; }
    }
  };
  const server = await createServer({ configFile: false, envFile: false,
    esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'react-router-dom', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-workspace-create', enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/') || '';
        if (source === 'react') return '\0workspace-create-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0workspace-create-jsx';
        if (!file.endsWith('/src/features/events/components/EventWorkspaceShell.jsx')) return null;
        if (source.endsWith('/services/scopedRecordActions')) return '\0workspace-shared-writer';
        if (source.endsWith('/hooks/useMomentFinance')) return '\0workspace-shared-finance';
        if (source === './MomentContents') return '\0workspace-create-child:MomentContents';
        if (source === 'react-router-dom') return '\0workspace-create-router';
        if (source === 'lucide-react') return '\0workspace-create-icons';
        if (source.includes('/components/')) return `\0workspace-create-child:${source.split('/').at(-1)}`;
        if (source.endsWith('/store/useAppStore')) return '\0workspace-create-app';
        if (source.endsWith('/store/useEventStore')) return '\0workspace-create-events';
        if (source.endsWith('/store/useExpenseStore')) return '\0workspace-create-expenses';
        if (source.endsWith('/hooks/useTransactionManager')) return '\0workspace-create-manager';
        if (source.endsWith('/hooks/usePersistentListState')) return '\0workspace-create-filters';
        if (source.endsWith('/services/attachmentService')) return '\0workspace-create-attachments';
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0workspace-create-react') return `export const useState=${fixture}.state,useRef=${fixture}.ref,useEffect=${fixture}.effect; export const useLayoutEffect=()=>{},useMemo=(fn)=>fn(),useCallback=(fn)=>fn();`;
        if (id === '\0workspace-create-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
        if (id === '\0workspace-create-router') return `export const Link="Link",useLocation=()=>${fixture}.location,useNavigate=()=>${fixture}.navigate,useParams=()=>${fixture}.params;`;
        if (id === '\0workspace-create-icons') return 'export const Archive="icon",ArchiveRestore="icon",ArrowLeft="icon",BookHeart="icon",CalendarDays="icon",Check="icon",CircleCheck="icon",Clock3="icon",Download="icon",FileText="icon",Heart="icon",Images="icon",ListChecks="icon",Pencil="icon",Plus="icon",Receipt="icon",Save="icon",Search="icon",Sparkles="icon",Trash2="icon",Upload="icon",X="icon";';
        if (id.startsWith('\0workspace-create-child:')) return `export default ${JSON.stringify(id.split(':').at(-1))}; export const ConfirmDialog="ConfirmDialog";`;
        if (id === '\0workspace-shared-writer') return `import {createScopedRecordActions} from '/src/utils/scopedRecordActions.js'; export const scopedRecordActions=createScopedRecordActions({getSession:()=>${fixture}.app,getEvents:()=>${fixture}.eventStore});`;
        if (id === '\0workspace-shared-finance') return `export default ()=>({ready:true,transactions:[],summary:{income:0,expense:0,balance:0},error:null});`;
        if (id === '\0workspace-create-app') return `const useStore=(select)=>select(${fixture}.app); useStore.getState=()=>${fixture}.app; export default useStore;`;
        if (id === '\0workspace-create-events') return `const useStore=()=>${fixture}.eventStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0workspace-create-expenses') return `const useStore=()=>${fixture}.expenseStore; useStore.getState=useStore; export default useStore;`;
        if (id === '\0workspace-create-manager') return 'export default ()=>({saveTransaction:async()=>{throw new Error("Unexpected transaction write")}});';
        if (id === '\0workspace-create-filters') return 'export default (_key,defaults)=>[defaults,()=>{},()=>{}];';
        if (id === '\0workspace-create-attachments') return `export const MAX_ATTACHMENT_BYTES=10*1024*1024; export const attachmentRepository={save:(...args)=>${fixture}.saveOriginal(...args)};`;
        return null;
      },
    }],
  });
  t.after(async () => {
    unmount();
    await server.close();
    delete globalThis[key];
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  const { EventWorkspaceContent: Workspace } = await server.ssrLoadModule('/src/features/events/components/EventWorkspaceShell.jsx');
  const render = () => {
    cursor = 0;
    const tree = Workspace();
    for (const node of nodes(tree)) {
      if (node.type === 'input' && node.props.type === 'file' && node.props.ref) {
        node.props.ref.current = { click: () => fileClicks.push({ duringDispatch: api.dispatching, pathname: api.location.pathname }) };
      }
    }
    const effects = pendingEffects;
    pendingEffects = [];
    effects.forEach((effect) => effect());
    return tree;
  };
  const findModal = (title = 'Add memory') => nodes(render()).find((node) => node.type === 'ModalDialog' && node.props.title === title);
  const emit = (detail = {}) => {
    const event = new Event('dn:moment-create');
    Object.defineProperty(event, 'detail', { value: detail });
    api.dispatching = true;
    try { return windowTarget.dispatchEvent(event); } finally { api.dispatching = false; }
  };
  const detail = (kind = 'memory') => ({ eventId: 'synthetic-moment', scope: 'user:synthetic-owner', kind });
  const pickAttachment = (file = new File(['synthetic original bytes'], 'synthetic.jpg', { type: 'image/jpeg' })) => {
    const input = nodes(render()).find((node) => node.type === 'input' && node.props.type === 'file');
    emit(detail('attachment'));
    const target = { files: file ? [file] : [], value: 'selected-file' };
    input.props.onChange({ target });
    return { file, target, modal: findModal('Save attachment') };
  };
  render();
  return { api, moment, writes, originalSaves, toasts, fileClicks, listeners, render, findModal, pickAttachment, emit, detail, unmount };
};

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const submitForm = (modal) => nodes(modal).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });

test('matching contextual create event opens the existing Memory dialog without writes', async (t) => {
  const harness = await openWorkspace(t);
  assert.equal(harness.listeners.get('dn:moment-create')?.size, 1);
  assert.equal(harness.findModal(), undefined);
  harness.emit(harness.detail());
  assert.ok(harness.findModal());
  assert.equal(harness.fileClicks.length, 0);
  assert.deepEqual(harness.writes, []);
  harness.findModal().props.onClose();
  assert.equal(harness.findModal(), undefined);
});

test('contextual create rejects mismatched Moment, scope, and unsupported action', async (t) => {
  const harness = await openWorkspace(t);
  for (const detail of [
    { ...harness.detail(), eventId: 'another-moment' },
    { ...harness.detail(), scope: 'guest:anonymous' },
    { ...harness.detail(), kind: 'delete' },
    { ...harness.detail('attachment'), eventId: 'another-moment' },
  ]) {
    harness.emit(detail);
    assert.equal(harness.findModal(), undefined);
  }
  assert.equal(harness.fileClicks.length, 0);
  assert.deepEqual(harness.writes, []);
});

test('contextual create rechecks current account, loaded scope, active load and Moment existence', async (t) => {
  const harness = await openWorkspace(t);
  const restore = () => {
    harness.api.app.user = { uid: 'synthetic-owner' };
    harness.api.app.isGuest = false;
    harness.api.eventStore.loadedFor = 'user:synthetic-owner';
    harness.api.eventStore.activeLoadKey = 'user:synthetic-owner';
    harness.api.eventStore.events = [harness.moment];
  };
  for (const invalidate of [
    () => { harness.api.app.user = { uid: 'another-owner' }; },
    () => { harness.api.app.user = null; },
    () => { harness.api.app.isGuest = true; },
    () => { harness.api.eventStore.loadedFor = 'user:another-owner'; },
    () => { harness.api.eventStore.activeLoadKey = 'user:another-owner'; },
    () => { harness.api.eventStore.events = []; },
  ]) {
    restore();
    invalidate();
    // Do not rerender before dispatch: the installed listener must inspect live
    // stores rather than trusting values captured when the workspace opened.
    harness.emit(harness.detail());
    harness.emit(harness.detail('attachment'));
    assert.equal(harness.fileClicks.length, 0);
    restore();
    assert.equal(harness.findModal(), undefined);
  }
  assert.deepEqual(harness.writes, []);
});

test('Attachment input remains mounted across sections and clicks during synchronous dispatch', async (t) => {
  const harness = await openWorkspace(t);
  for (const section of ['overview', 'activities', 'memories', 'attachments']) {
    harness.api.location = { pathname: `/events/synthetic-moment/${section}`, search: '', hash: '' };
    const tree = harness.render();
    const input = nodes(tree).find((node) => node.type === 'input' && node.props.type === 'file');
    assert.ok(input, `the Attachment input is available from ${section}`);
    assert.equal(input.props['aria-label'], 'Add attachment');
    const previousClicks = harness.fileClicks.length;
    harness.emit(harness.detail('attachment'));
    assert.equal(harness.fileClicks.length, previousClicks + 1, 'the click happens before dispatch returns');
    assert.equal(harness.fileClicks.at(-1).duringDispatch, true);
    assert.equal(harness.fileClicks.at(-1).pathname, `/events/synthetic-moment/${section}`);
  }
  assert.equal(harness.listeners.get('dn:moment-create')?.size, 1, 'section navigation does not duplicate listeners');
  assert.equal(harness.findModal(), undefined);
  assert.deepEqual(harness.writes, []);
});

test('Memory submission and delayed file selection recheck the account before writing', async (t) => {
  const harness = await openWorkspace(t);
  harness.emit(harness.detail());
  let modal = harness.findModal();
  const title = nodes(modal).find((node) => node.type === 'input' && node.props.placeholder === 'Memory title');
  title.props.onChange({ target: { value: 'Synthetic memory draft' } });
  modal = harness.findModal();
  const form = nodes(modal).find((node) => node.type === 'form');
  harness.api.app.user = { uid: 'another-owner' };
  await form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(harness.writes, [], 'a draft opened by the previous account cannot write');

  harness.api.app.user = { uid: 'synthetic-owner' };
  harness.findModal().props.onClose();
  const input = nodes(harness.render()).find((node) => node.type === 'input' && node.props.type === 'file');
  harness.emit(harness.detail('attachment'));
  assert.equal(harness.fileClicks.length, 1);
  harness.api.app.user = { uid: 'another-owner' };
  const fileInput = { files: [{ name: 'synthetic.jpg', type: 'image/jpeg', size: 1234 }], value: 'selected-file' };
  await input.props.onChange({ target: fileInput });
  assert.equal(fileInput.value, '', 'the delayed picker result is cleared even when rejected');
  assert.deepEqual(harness.writes, [], 'a file selected after an account switch cannot write');
});

test('workspace effect cleanup unregisters the create listener and blocks later actions', async (t) => {
  const harness = await openWorkspace(t);
  assert.equal(harness.listeners.get('dn:moment-create')?.size, 1);
  harness.unmount();
  assert.equal(harness.listeners.get('dn:moment-create')?.size, 0);
  harness.emit(harness.detail());
  harness.emit(harness.detail('attachment'));
  assert.equal(harness.findModal(), undefined);
  assert.equal(harness.listeners.get('dn:moment-create')?.size, 0);
  assert.equal(harness.fileClicks.length, 0);
  assert.deepEqual(harness.writes, []);
});

test('picking an original only opens confirmation and cancel leaves records and originals untouched', async (t) => {
  const harness = await openWorkspace(t);
  const { file, target, modal } = harness.pickAttachment();
  assert.ok(modal, 'original selection opens the Save attachment form');
  assert.equal(target.value, '');
  assert.match(JSON.stringify(nodes(modal).filter((node) => node.type === 'p').map(children)), /synthetic\.jpg/);
  assert.ok(file instanceof Blob);
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.originalSaves, []);
  modal.props.onClose();
  assert.equal(harness.findModal('Save attachment'), undefined);
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.originalSaves, []);
});

test('confirmed original save preserves the latest parent and creates one stable activity-linked reference', async (t) => {
  const harness = await openWorkspace(t);
  harness.moment.activities = [{ id: 'activity-1', title: 'Keep the original' }];
  const { file } = harness.pickAttachment();
  const selector = nodes(harness.findModal('Save attachment')).find((node) => node.props?.id === 'attachment-activity');
  selector.props.onChange({ target: { value: 'activity-1' } });
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const save = submitForm(harness.findModal('Save attachment'));
  assert.equal(harness.originalSaves.length, 1);
  assert.equal(harness.originalSaves[0].file, file);
  assert.equal(harness.originalSaves[0].context.uid, 'synthetic-owner');
  assert.equal(harness.originalSaves[0].context.isGuest, false);
  assert.equal(typeof harness.originalSaves[0].context.assertCurrent, 'function');
  assert.deepEqual(harness.writes, [], 'the record is not created before durable original save finishes');
  const concurrentAttachment = { id: 'earlier-photo', name: 'another.png', assetId: 'b'.repeat(64), storage: 'local' };
  const latest = { ...harness.moment, name: 'Latest parent name', notes: 'Concurrent parent edit',
    memories: [{ id: 'new-memory', body: 'Keep the edit' }], attachments: [concurrentAttachment],
    activities: [{ id: 'activity-1', title: 'Latest activity title', completed: true }] };
  harness.api.eventStore.events = [latest];
  pending.resolve({ assetId: 'a'.repeat(64), storage: 'local' });
  await save;
  assert.equal(harness.writes.length, 1);
  const [uid, isGuest, written] = harness.writes[0];
  assert.equal(uid, 'synthetic-owner');
  assert.equal(isGuest, false);
  assert.equal(written.name, latest.name);
  assert.equal(written.notes, latest.notes);
  assert.deepEqual(written.memories, latest.memories);
  assert.deepEqual(written.activities, latest.activities);
  assert.deepEqual(written.attachments[0], concurrentAttachment);
  const reference = written.attachments[1];
  assert.equal(reference.activityId, 'activity-1');
  assert.equal(reference.assetId, 'a'.repeat(64));
  assert.equal(reference.storage, 'local');
  assert.equal(reference.name, file.name);
  assert.equal(reference.type, file.type);
  assert.equal(reference.size, file.size);
  assert.match(reference.id, /^[\da-f-]{36}$/);
  assert.ok(Number.isFinite(new Date(reference.createdAt).getTime()));
  assert.equal(harness.findModal('Save attachment'), undefined);
  assert.deepEqual(harness.toasts, [['Original file saved', 'success']]);
});

test('original confirmation guards duplicate submit and dismissal while pending, then permits retry after failure', async (t) => {
  const harness = await openWorkspace(t);
  harness.pickAttachment();
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const modal = harness.findModal('Save attachment');
  const first = submitForm(modal);
  await submitForm(modal);
  assert.equal(harness.originalSaves.length, 1, 'repeated taps cannot save twice');
  const busyModal = harness.findModal('Save attachment');
  busyModal.props.onClose();
  assert.ok(harness.findModal('Save attachment'), 'Escape/backdrop close is guarded while saving');
  const actions = nodes(busyModal).filter((node) => node.type === 'button');
  assert.ok(actions.every((node) => node.props.disabled), 'submit and cancel are both disabled while pending');
  pending.reject(new Error('Storage permission denied'));
  await first;
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.toasts, [], 'a rejected original never reports success');
  assert.match(JSON.stringify(nodes(harness.findModal('Save attachment')).map(children)), /Storage permission denied/);
  harness.api.persistOriginal = async () => ({ assetId: 'a'.repeat(64), storage: 'local' });
  await submitForm(harness.findModal('Save attachment'));
  assert.equal(harness.originalSaves.length, 2);
  assert.equal(harness.writes.length, 1);
  assert.deepEqual(harness.toasts, [['Original file saved', 'success']]);
  assert.equal(harness.findModal('Save attachment'), undefined);
});

test('session changes before confirmation prevent original save and record creation', async (t) => {
  const harness = await openWorkspace(t);
  const { modal } = harness.pickAttachment();
  harness.api.app.user = { uid: 'different-owner' };
  await submitForm(modal);
  assert.deepEqual(harness.originalSaves, []);
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.toasts, []);
});

test('session changes after original save starts reject its scope callback and prevent stale record creation', async (t) => {
  const harness = await openWorkspace(t);
  harness.pickAttachment();
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const save = submitForm(harness.findModal('Save attachment'));
  const originalContext = harness.originalSaves[0].context;
  harness.api.app.user = { uid: 'different-owner' };
  harness.api.eventStore.loadedFor = 'user:different-owner';
  harness.api.eventStore.activeLoadKey = 'user:different-owner';
  assert.throws(() => originalContext.assertCurrent(), /session changed/i);
  pending.resolve({ assetId: 'a'.repeat(64), storage: 'local' });
  await save;
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.toasts, []);
  assert.ok(harness.findModal('Save attachment'), 'a failed confirmation never closes as if saved');
});

test('an activity removed during original persistence prevents creation of a stale activity link', async (t) => {
  const harness = await openWorkspace(t);
  harness.moment.activities = [{ id: 'activity-1', title: 'Being removed' }];
  harness.pickAttachment();
  nodes(harness.findModal('Save attachment')).find((node) => node.props?.id === 'attachment-activity')
    .props.onChange({ target: { value: 'activity-1' } });
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const save = submitForm(harness.findModal('Save attachment'));
  harness.api.eventStore.events = [{ ...harness.moment, activities: [] }];
  pending.resolve({ assetId: 'a'.repeat(64), storage: 'local' });
  await save;
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.toasts, []);
  assert.match(JSON.stringify(nodes(harness.findModal('Save attachment')).map(children)), /chosen activity is no longer available/i);
});

test('failed parent persistence retains confirmation without reporting the original as fully attached', async (t) => {
  const harness = await openWorkspace(t);
  harness.pickAttachment();
  harness.api.eventStore.updateEventItem = async () => { throw new Error('Moment record could not be saved'); };
  await submitForm(harness.findModal('Save attachment'));
  assert.equal(harness.originalSaves.length, 1);
  assert.ok(harness.findModal('Save attachment'));
  assert.deepEqual(harness.toasts, []);
  assert.match(JSON.stringify(nodes(harness.findModal('Save attachment')).map(children)), /Moment record could not be saved/);
});

test('workspace unmount invalidates an original save still awaiting persistence', async (t) => {
  const harness = await openWorkspace(t);
  harness.pickAttachment();
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const save = submitForm(harness.findModal('Save attachment'));
  const context = harness.originalSaves[0].context;
  harness.unmount();
  pending.resolve({ assetId: 'a'.repeat(64), storage: 'local' });
  await save;
  assert.deepEqual(harness.writes, [], 'leaving the workspace cancels the later attachment record write');
  assert.deepEqual(harness.toasts, []);
  assert.throws(() => context.assertCurrent(), /session|available|workspace/i);
});

test('switching Moments while an original is pending invalidates the previous save closure', async (t) => {
  const harness = await openWorkspace(t);
  harness.pickAttachment();
  const pending = deferred();
  harness.api.persistOriginal = () => pending.promise;
  const save = submitForm(harness.findModal('Save attachment'));
  harness.api.eventStore.events = [harness.moment, { ...harness.moment, id: 'different-moment', name: 'Different Moment' }];
  harness.api.params = { eventId: 'different-moment' };
  harness.api.location = { pathname: '/events/different-moment/attachments', search: '', hash: '' };
  harness.render();
  pending.resolve({ assetId: 'a'.repeat(64), storage: 'local' });
  await save;
  assert.deepEqual(harness.writes, [], 'the pending original cannot attach after its workspace context changes');
  assert.deepEqual(harness.toasts, []);
});
