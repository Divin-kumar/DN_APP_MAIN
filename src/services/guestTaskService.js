// Independent Guest Tasks have their own storage key and never share a
// Moment's embedded activities or the legacy guest record collections.
import { detachIndependentTaskLinks, normalizeIndependentTask } from '../utils/independentTasks.js';
import { recordId } from '../utils/recordIdentity.js';

export const GUEST_TASKS_KEY = 'dn_guest_tasks';

// Explicit session assertion is required even when callers use a synthetic
// Guest tour. Never let a stale account-triggered callback write Guest Tasks.
export const createGuestTaskRepository = ({ storage, assertGuest, createId } = {}) => {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function'
    || typeof assertGuest !== 'function') {
    throw new Error('Guest Task storage requires an explicit storage and session guard.');
  }
  const guard = () => {
    if (assertGuest() !== true) throw new Error('Guest session changed. No Tasks were saved.');
  };
  const read = () => {
    guard();
    const raw = storage.getItem(GUEST_TASKS_KEY);
    if (raw == null) return [];
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Guest Task storage is unreadable. Nothing was overwritten.'); }
    if (!Array.isArray(parsed)) throw new Error('Guest Task storage is invalid. Nothing was overwritten.');
    const ids = new Set();
    const tasks = parsed.map((item) => {
      const task = normalizeIndependentTask(item);
      if (ids.has(task.id)) throw new Error('Guest Task storage contains a duplicate ID. Nothing was overwritten.');
      ids.add(task.id);
      return task;
    });
    guard();
    return tasks;
  };
  const write = (tasks) => {
    guard();
    // Validate before any storage write, preserving the existing snapshot on failure.
    const ids = new Set();
    const normalized = tasks.map((item) => {
      const task = normalizeIndependentTask(item);
      if (ids.has(task.id)) throw new Error('A duplicate Task cannot be saved.');
      ids.add(task.id);
      return task;
    });
    guard();
    storage.setItem(GUEST_TASKS_KEY, JSON.stringify(normalized));
    return normalized;
  };
  return {
    list: read,
    upsert(input) {
      const current = read();
      const requestedId = recordId(input?.id) || recordId(input?.firestoreId);
      const index = current.findIndex((item) => item.id === requestedId);
      const task = normalizeIndependentTask(index < 0 ? input : { ...current[index], ...input },
        { createId: requestedId ? undefined : createId });
      if (index < 0 && current.some((item) => item.id === task.id)) throw new Error('Task ID already exists.');
      const next = [...current];
      if (index < 0) next.push(task);
      else next[index] = task;
      write(next);
      return task;
    },
    remove(id) {
      const key = recordId(id);
      if (!key) throw new Error('Choose a valid Task to remove.');
      const current = read();
      const next = current.filter((item) => item.id !== key);
      if (next.length !== current.length) write(next);
      return current.length - next.length;
    },
    // Merge an imported backup by stable ID, never replacing destination values.
    // One validated write avoids partial Task imports on quota failures.
    merge(imported = []) {
      const current = read();
      if (!Array.isArray(imported)) throw new Error('Imported Tasks must be an array.');
      const normalized = imported.map((item) => normalizeIndependentTask(item));
      const incomingIds = new Set();
      normalized.forEach((task) => {
        if (incomingIds.has(task.id)) throw new Error('Imported Tasks contain a duplicate ID.');
        incomingIds.add(task.id);
      });
      const existing = new Set(current.map((task) => task.id));
      const additions = normalized.filter((task) => !existing.has(task.id));
      const conflicts = normalized.length - additions.length;
      const items = additions.length ? write([...current, ...additions]) : current;
      return { items, added: additions.length, conflicts };
    },
    detachParent(parent) {
      const current = read();
      const next = detachIndependentTaskLinks(current, parent);
      if (next.some((item, index) => item !== current[index])) write(next);
      return next;
    },
  };
};
