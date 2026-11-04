import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

async function harness(t) {
  const key = `__taskCloud${Date.now()}${Math.random().toString(36).slice(2)}`;
  const rows = new Map();
  const listeners = [];
  const auth = { currentUser: { uid: 'alice' } };
  let failure = false;
  const snapshot = (ref) => ({ id: ref.path.split('/').at(-1), exists: () => rows.has(ref.path), data: () => rows.get(ref.path) });
  const api = {
    auth, rows, listeners,
    writeBatch: () => ({ set() {}, commit: async () => {} }),
    collection: (_, ...parts) => ({ path: parts.join('/') }),
    doc: (ref, id) => ({ path: `${ref.path}/${id}` }),
    getDocsFromServer: async (ref) => {
      if (failure) throw new Error('permission-denied');
      return { docs: [...rows.keys()].filter((path) => path.startsWith(ref.path + '/')).map((path) => snapshot({ path })) };
    },
    onSnapshot: (ref, next, error) => {
      const listener = { ref, next, error, stopped: false }; listeners.push(listener);
      return () => { listener.stopped = true; };
    },
    runTransaction: async (_, work) => {
      if (failure) throw new Error('permission-denied');
      const writes = [];
      const result = await work({ get: async (ref) => snapshot(ref),
        set: (ref, value) => writes.push(() => rows.set(ref.path, value)),
        update: (ref, value) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...value })),
        delete: (ref) => writes.push(() => rows.delete(ref.path)) });
      writes.forEach((write) => write()); return result;
    },
  };
  globalThis[key] = api;
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, ssr: { noExternal: ['firebase'] }, server: { middlewareMode: true }, appType: 'custom',
    plugins: [{ name: 'task-cloud-test', enforce: 'pre', resolveId(source) {
      if (/\/(expenseService|incomeService|eventService|attachmentService)$/.test(source)) return '\0task-transfer';
      if (source === 'firebase/firestore') return '\0task-firestore';
      if (source.endsWith('/firebase/config')) return '\0task-config';
      if (source.endsWith('/dev/sampleData')) return '\0task-sample';
      if (source.endsWith('/store/useAppStore') || source === './useAppStore') return '\0task-app';
    }, load(id) {
      const fixture = `globalThis[${JSON.stringify(key)}]`;
      if (id === '\0task-firestore') return `export const {collection,doc,getDocsFromServer,onSnapshot,runTransaction,writeBatch}=${fixture};`;
      if (id === '\0task-transfer') return 'export const getGuestExpenses=()=>[],getGuestIncomes=()=>[],getGuestEvents=()=>[],exportAttachmentFiles=async()=>[],restoreAttachmentFiles=async()=>[];';
      if (id === '\0task-config') return `export const auth=${fixture}.auth; export const db={};`;
      if (id === '\0task-sample') return 'export const getActiveSampleScenario=()=>null,requireActiveSampleData=()=>null,saveActiveSampleData=()=>{};';
      if (id === '\0task-app') return `import {create} from 'zustand'; const store=create(()=>({user:{uid:'alice'},isGuest:false})); ${fixture}.app=store; export default store;`;
    } }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const service = await server.ssrLoadModule('/src/services/accountTaskService.js');
  const { default: store } = await server.ssrLoadModule('/src/store/useTaskStore.js');
  const transfer = await server.ssrLoadModule('/src/services/guestMergeService.js');
  return { ...api, service, transfer, store, app: api.app, fail: () => { failure = true; }, snapshot };
}
const task = { id: 'stable', title: 'Keep my task', priority: 'high', dueDate: '2026-11-07', dueTime: '09:30', momentId: 'moment', activityId: 'activity', updatedAt: '2026-11-04T10:00:00.000Z' };

test('account Tasks preserve IDs, merge destination wins, reject stale edits and deletion resurrection', async (t) => {
  const h = await harness(t);
  await h.service.writeAccountTask('alice', task, { mode: 'create' });
  assert.equal((await h.service.listAccountTasks('alice'))[0].dueTime, '09:30');
  assert.deepEqual(await h.service.mergeAccountTasks('alice', [{ ...task, title: 'Overwrite attempt' }]), { added: 0, conflicts: 1 });
  await assert.rejects(h.service.writeAccountTask('alice', task, { expectedUpdatedAt: null }), /changed on another device/);
  await h.service.detachAccountTaskLinks('alice', { momentId: 'moment', activityIds: ['activity'] });
  assert.equal(h.rows.get('users/alice/tasks/stable').activityId, '');
  assert.equal(h.rows.get('users/alice/tasks/stable').momentId, 'moment');
  await h.service.removeAccountTask('alice', 'stable');
  await assert.rejects(h.service.writeAccountTask('alice', task), /deleted on another device/);
});

test('owner guard rejects cross-account writes and a session change during a transaction', async (t) => {
  const h = await harness(t);
  await assert.rejects(h.service.writeAccountTask('bob', task, { mode: 'create' }), /account changed/);
  let checks = 0;
  await assert.rejects(h.service.writeAccountTask('alice', task, { mode: 'create', assertCurrent: () => {
    if (++checks === 3) throw new Error('session changed');
  } }), /session changed/);
  assert.equal(h.rows.size, 0);
});

test('live Task store clears on logout and rejects old callbacks after A→B→A', async (t) => {
  const h = await harness(t);
  h.store.getState().loadTasks();
  const first = h.listeners[0];
  first.next({ docs: [{ id: task.id, data: () => task }] });
  assert.equal(h.store.getState().tasks.length, 1);
  h.app.setState({ user: null });
  assert.equal(h.store.getState().tasks.length, 0);
  assert.equal(first.stopped, true);
  h.app.setState({ user: { uid: 'bob' } });
  h.app.setState({ user: { uid: 'alice' } });
  h.store.getState().loadTasks();
  first.next({ docs: [{ id: 'old', data: () => ({ ...task, id: 'old' }) }] });
  assert.equal(h.store.getState().loadedFor, null);
  assert.equal(h.store.getState().tasks.length, 0);
  h.listeners.at(-1).next({ docs: [{ id: task.id, data: () => task }] });
  assert.equal(h.store.getState().loadedFor, 'account:alice');
  await h.service.writeAccountTask('alice', task, { mode: 'create' });
  await h.store.getState().setTaskStatus(task.id, 'completed');
  assert.equal(h.rows.get('users/alice/tasks/stable').status, 'completed');
  h.fail();
  await assert.rejects(h.store.getState().setTaskStatus(task.id, 'completed'), /permission-denied/);
  assert.equal(h.store.getState().tasks[0].status, 'in-progress');
});


test('sign-in transfers valid Guest Tasks once and retains local records on write failure', async (t) => {
  const h = await harness(t);
  const local = new Map([['dn_guest_tasks', JSON.stringify([task])]]);
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => local.get(key) ?? null, removeItem: (key) => local.delete(key) };
  t.after(() => { globalThis.localStorage = previous; });
  const result = await h.transfer.mergeGuestDataIntoAccount('alice');
  assert.equal(result.tasks, 1);
  assert.equal(local.has('dn_guest_tasks'), false);
  local.set('dn_guest_tasks', JSON.stringify([{ ...task, title: 'Retry must not overwrite' }]));
  await h.transfer.mergeGuestDataIntoAccount('alice');
  assert.equal(h.rows.get('users/alice/tasks/stable').title, task.title);
  const retained = JSON.stringify([{ ...task, id: 'second' }]);
  local.set('dn_guest_tasks', retained);
  h.fail();
  assert.equal((await h.transfer.mergeGuestDataIntoAccount('alice')).tasksRetainedLocally, 1);
  assert.equal(local.get('dn_guest_tasks'), retained);
});
