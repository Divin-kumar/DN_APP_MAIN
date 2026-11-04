import { watchAccountTasks, writeAccountTask, removeAccountTask } from '../services/accountTaskService';
import { create } from 'zustand';
import useAppStore from './useAppStore';
import { getActiveSampleScenario, requireActiveSampleData, saveActiveSampleData } from '../dev/sampleData';
import { createGuestTaskRepository } from '../services/guestTaskService';
import { detachIndependentTaskLinks, normalizeIndependentTask, taskStatusPatch } from '../utils/independentTasks.js';
import { recordId } from '../utils/recordIdentity.js';

export const taskScopeKey = ({ user, isGuest } = {}) => user?.uid ? `account:${user.uid}`
  : isGuest ? `guest:${getActiveSampleScenario() || 'private'}` : 'signed-out';

const assertGuestScope = (expected) => {
  if (!expected.startsWith('guest:') || taskScopeKey(useAppStore.getState()) !== expected) {
    throw new Error('Task session changed. Reopen Tasks in the current workspace.');
  }
};
const sampleTasks = (sample) => {
  if (sample.tasks === undefined) return [];
  if (!Array.isArray(sample.tasks)) throw new Error('The sample Tasks are invalid. Refresh the demo.');
  const ids = new Set();
  return sample.tasks.map((item) => {
    const task = normalizeIndependentTask(item);
    if (ids.has(task.id)) throw new Error('The sample contains duplicate Task IDs.');
    ids.add(task.id);
    return task;
  });
};
const repository = (expected) => createGuestTaskRepository({
  storage: localStorage,
  assertGuest: () => { assertGuestScope(expected); return true; },
  createId: () => crypto.randomUUID(),
});

let unsubscribe = null;
let accountEpoch = 0;
let watchedScope = null;
const accountGuard = (scope, epoch) => () => {
  if (accountEpoch !== epoch || taskScopeKey(useAppStore.getState()) !== scope) throw new Error('Task session changed. Reopen Tasks.');
};
const useTaskStore = create((set, get) => ({
  tasks: [], loadedFor: null, error: null,
  loadTasks: () => {
    const scope = taskScopeKey(useAppStore.getState());
    if (scope.startsWith('account:')) {
      if (watchedScope === scope && unsubscribe && !get().error) return;
      unsubscribe?.(); unsubscribe = null;
      const epoch = ++accountEpoch;
      watchedScope = scope;
      set({ tasks: [], loadedFor: null, error: null });
      const guard = accountGuard(scope, epoch);
      const fail = (error) => {
        if (epoch === accountEpoch && taskScopeKey(useAppStore.getState()) === scope) set({ tasks: [], loadedFor: null, error: error.message || 'Tasks could not sync.' });
      };
      try {
        unsubscribe = watchAccountTasks(scope.slice(8), guard,
          (tasks) => set({ tasks, loadedFor: scope, error: null }), fail);
      } catch (error) { fail(error); }
      return;
    }
    unsubscribe?.(); unsubscribe = null; watchedScope = null; accountEpoch++;
    if (!scope.startsWith('guest:')) {
      set({ tasks: [], loadedFor: scope, error: null });
      return [];
    }
    try {
      const tasks = scope === 'guest:private' ? repository(scope).list() : sampleTasks(requireActiveSampleData(null));
      assertGuestScope(scope);
      set({ tasks, loadedFor: scope, error: null });
      return tasks;
    } catch (error) {
      if (taskScopeKey(useAppStore.getState()) === scope) {
        set({ tasks: [], loadedFor: scope, error: error.message || 'Tasks could not be read.' });
      }
      return [];
    }
  },
  saveTask: (input, options = {}) => {
    const scope = taskScopeKey(useAppStore.getState());
    if (scope.startsWith('account:')) {
      if (get().loadedFor !== scope || get().error) throw new Error('Tasks are not ready. Reload and try again.');
      const previous = get().tasks.find((task) => task.id === recordId(input?.id));
      const now = new Date().toISOString();
      return writeAccountTask(scope.slice(8), { ...previous, ...input,
        id: recordId(input?.id) || crypto.randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now,
      }, { mode: input?.id ? 'edit' : 'create', expectedUpdatedAt: options.expectedUpdatedAt !== undefined ? options.expectedUpdatedAt : input?.updatedAt || previous?.updatedAt || null, assertCurrent: accountGuard(scope, accountEpoch) });
    }
    if (!scope.startsWith('guest:') || get().loadedFor !== scope || get().error) {
      throw new Error('Tasks are not ready in this workspace. Reload Tasks and try again.');
    }
    const previous = get().tasks.find((task) => task.id === recordId(input?.id));
    const current = new Date().toISOString();
    const task = normalizeIndependentTask({
      ...previous, ...input, id: recordId(input?.id) || crypto.randomUUID(),
      createdAt: previous?.createdAt || current, updatedAt: current,
    });
    let tasks;
    if (scope === 'guest:private') {
      const reader = repository(scope);
      reader.upsert(task);
      tasks = reader.list();
    } else {
      const data = requireActiveSampleData(null);
      const source = sampleTasks(data);
      const index = source.findIndex((entry) => entry.id === task.id);
      tasks = [...source];
      if (index < 0) tasks.push(task);
      else tasks[index] = task;
      assertGuestScope(scope);
      saveActiveSampleData({ ...data, tasks });
    }
    assertGuestScope(scope);
    set({ tasks, error: null });
    return task;
  },
  removeTask: (id) => {
    const scope = taskScopeKey(useAppStore.getState());
    if (scope.startsWith('account:')) return removeAccountTask(scope.slice(8), recordId(id), accountGuard(scope, accountEpoch));
    if (!scope.startsWith('guest:') || get().loadedFor !== scope || get().error) {
      throw new Error('Tasks are not ready in this workspace.');
    }
    let tasks;
    if (scope === 'guest:private') {
      const reader = repository(scope);
      reader.remove(id);
      tasks = reader.list();
    } else {
      const data = requireActiveSampleData(null);
      const source = sampleTasks(data);
      tasks = source.filter((entry) => entry.id !== recordId(id));
      assertGuestScope(scope);
      if (tasks.length !== source.length) saveActiveSampleData({ ...data, tasks });
    }
    assertGuestScope(scope);
    set({ tasks });
    return tasks;
  },
  // Called only after a Moment/Activity deletion is persisted. Detached Tasks
  // retain their IDs, status, notes and dates; account Tasks are never touched.
  detachParent: (parent) => {
    const scope = taskScopeKey(useAppStore.getState());
    if (!scope.startsWith('guest:')) return 0;
    const demo = scope !== 'guest:private';
    const data = demo ? requireActiveSampleData(null) : null;
    const reader = demo ? null : repository(scope);
    const before = demo ? sampleTasks(data) : reader.list();
    const projected = detachIndependentTaskLinks(before, parent);
    const detached = projected.filter((item, index) => item !== before[index]).length;
    assertGuestScope(scope);
    const tasks = !detached ? before : demo
      ? (saveActiveSampleData({ ...data, tasks: projected }), projected)
      : reader.detachParent(parent);
    assertGuestScope(scope);
    if (get().loadedFor === scope) set({ tasks, error: null });
    return detached;
  },
  setTaskStatus: (id, status) => {
    const scope = taskScopeKey(useAppStore.getState());
    if (get().loadedFor !== scope || scope === 'signed-out') {
      throw new Error('Task session changed. Reload Tasks.');
    }
    const task = get().tasks.find((item) => item.id === recordId(id));
    if (!task) throw new Error('Task not found in this workspace.');
    const patch = taskStatusPatch(task, status);
    return patch ? get().saveTask({ ...task, ...patch }, { expectedUpdatedAt: task.updatedAt }) : task;
  },
}));
// Invalidate immediately on every session transition, including A → B → A.
useAppStore.subscribe((state, previous) => {
  if (state.user?.uid === previous.user?.uid && state.isGuest === previous.isGuest) return;
  accountEpoch++; unsubscribe?.(); unsubscribe = null; watchedScope = null;
  useTaskStore.setState({ tasks: [], loadedFor: null, error: null });
});
export default useTaskStore;
