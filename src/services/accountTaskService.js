import { collection, doc, getDocsFromServer, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizeIndependentTask, detachIndependentTaskLinks } from '../utils/independentTasks.js';

const assertOwner = (uid, assertCurrent) => {
  assertCurrent?.();
  if (!uid || uid.includes('/') || auth.currentUser?.uid !== uid) throw new Error('Task account changed. Reopen Tasks and try again.');
};
const tasksRef = (uid) => collection(db, 'users', uid, 'tasks');
const readTask = (snapshot) => normalizeIndependentTask({ ...snapshot.data(), id: snapshot.id });
export const listAccountTasks = async (uid, assertCurrent) => {
  assertOwner(uid, assertCurrent);
  const result = await getDocsFromServer(tasksRef(uid));
  assertOwner(uid, assertCurrent);
  return result.docs.map(readTask);
};
export const watchAccountTasks = (uid, assertCurrent, receive, fail) => {
  assertOwner(uid, assertCurrent);
  return onSnapshot(tasksRef(uid), (snapshot) => {
    try { assertOwner(uid, assertCurrent); receive(snapshot.docs.map(readTask)); }
    catch (error) { fail(error); }
  }, fail);
};
// Transactions prevent deleted Tasks from being recreated by stale editors and
// preserve destination records when a backup/Guest transfer is retried.
export const writeAccountTask = async (uid, input, { assertCurrent, mode = 'edit', expectedUpdatedAt } = {}) => {
  const task = normalizeIndependentTask(input);
  assertOwner(uid, assertCurrent);
  const result = await runTransaction(db, async (transaction) => {
    assertOwner(uid, assertCurrent);
    const ref = doc(tasksRef(uid), task.id);
    const existing = await transaction.get(ref);
    assertOwner(uid, assertCurrent);
    if (mode === 'merge' && existing.exists()) return false;
    if (mode === 'edit' && !existing.exists()) throw new Error('This Task was deleted on another device. Close the editor and reload Tasks.');
    if (mode === 'edit' && expectedUpdatedAt !== undefined && (existing.data().updatedAt || null) !== expectedUpdatedAt) throw new Error('This Task changed on another device. Close and reopen it before editing.');
    if (mode === 'create' && existing.exists()) throw new Error('This Task already exists. Reload Tasks before saving again.');
    transaction.set(ref, task);
    return task;
  });
  assertOwner(uid, assertCurrent);
  return result;
};
export const removeAccountTask = async (uid, id, assertCurrent) => {
  if (!id || id.includes('/')) throw new Error('Invalid Task ID.');
  assertOwner(uid, assertCurrent);
  await runTransaction(db, async (transaction) => {
    assertOwner(uid, assertCurrent);
    transaction.delete(doc(tasksRef(uid), id));
  });
  assertOwner(uid, assertCurrent);
  return true;
};
export const mergeAccountTasks = async (uid, inputs, assertCurrent) => {
  const tasks = inputs.map((item) => normalizeIndependentTask(item));
  let added = 0, conflicts = 0;
  for (const task of tasks) {
    if (await writeAccountTask(uid, task, { assertCurrent, mode: 'merge' })) added++;
    else conflicts++;
  }
  return { added, conflicts };
};
export const detachAccountTaskLinks = async (uid, parent, assertCurrent) => {
  if (!parent.momentId || (Array.isArray(parent.activityIds) && !parent.activityIds.length)) return;
  const tasks = await listAccountTasks(uid, assertCurrent);
  for (const task of tasks) {
    if (detachIndependentTaskLinks([task], parent)[0] === task) continue;
    await runTransaction(db, async (transaction) => {
      assertOwner(uid, assertCurrent);
      const ref = doc(tasksRef(uid), task.id);
      const snapshot = await transaction.get(ref);
      assertOwner(uid, assertCurrent);
      if (!snapshot.exists()) return;
      const current = readTask(snapshot);
      const next = detachIndependentTaskLinks([current], parent)[0];
      if (next !== current) transaction.update(ref, { momentId: next.momentId, activityId: next.activityId });
    });
  }
  assertOwner(uid, assertCurrent);
};
