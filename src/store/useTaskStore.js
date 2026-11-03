// Independent Tasks store. Cloud account CRUD remains forbidden until
// deployed users/{uid}/tasks rules and account deletion are verified.
import { create } from 'zustand';
import useAppStore from './useAppStore';
import { getActiveSampleScenario, requireActiveSampleData, saveActiveSampleData } from '../dev/sampleData';
import { createGuestTaskRepository } from '../services/guestTaskService';
import { normalizeIndependentTask, taskStatusPatch } from '../utils/independentTasks.js';
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

const useTaskStore = create((set, get) => ({
  tasks: [], loadedFor: null, error: null,
  loadTasks: () => {
    const scope = taskScopeKey(useAppStore.getState());
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
  saveTask: (input) => {
    const scope = taskScopeKey(useAppStore.getState());
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
  setTaskStatus: (id, status) => {
    const scope = taskScopeKey(useAppStore.getState());
    if (get().loadedFor !== scope || !scope.startsWith('guest:')) {
      throw new Error('Task session changed. Reload Tasks.');
    }
    const task = get().tasks.find((item) => item.id === recordId(id));
    if (!task) throw new Error('Task not found in this workspace.');
    const patch = taskStatusPatch(task, status);
    return patch ? get().saveTask({ ...task, ...patch }) : task;
  },
}));
export default useTaskStore;
