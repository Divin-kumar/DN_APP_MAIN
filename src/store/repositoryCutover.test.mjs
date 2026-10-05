import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { activityRepository, attachmentRepository, codeListRepository, devicePrincipalRepository, expenseRepository, incomeRepository, memoryRepository, momentRepository, settingsRepository } from '../repositories/index.js';
import useAppStore from './useAppStore.js';
import useEventStore from './useEventStore.js';
import useExpenseStore from './useExpenseStore.js';
import useIncomeStore from './useIncomeStore.js';

test('runtime stores persist all domains through repositories and reload from Dexie', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network access is disabled in repository cutover validation.'); };
  await db.delete();
  await initializeDatabase();

  await useAppStore.getState().bootstrapDevicePrincipal();
  const principalId = useAppStore.getState().principalId;
  assert.ok(principalId?.startsWith('device_'));

  useEventStore.getState().setEvents([]);
  useExpenseStore.getState().setExpenses([]);
  useIncomeStore.getState().setIncomes([]);

  const today = new Date().toISOString().slice(0, 10);
  const event = await useEventStore.getState().addEvent(null, true, {
    id: 'moment-cutover-1',
    name: 'Cutover test moment',
    date: today,
    type: 'Personal',
    recurrence: 'none',
    activities: [{ id: 'activity-cutover-1', title: 'Initial task', date: today, completed: false, priority: 'medium' }],
    memories: [{ id: 'memory-cutover-1', title: 'A note', body: 'Remember this', createdAt: new Date().toISOString() }],
    attachments: [{ id: 'attachment-cutover-1', name: 'proof.txt', type: 'text/plain', size: 10, createdAt: new Date().toISOString() }],
  });
  assert.equal(event.id, 'moment-cutover-1');

  let projectedEvent = useEventStore.getState().events.find((item) => item.id === event.id);
  assert.equal(projectedEvent.activities[0].title, 'Initial task');
  assert.equal(projectedEvent.memories[0].body, 'Remember this');
  assert.equal(projectedEvent.attachments[0].name, 'proof.txt');

  await useEventStore.getState().updateEventItem(null, true, {
    ...projectedEvent,
    activities: projectedEvent.activities.map((activity) => ({ ...activity, title: 'Updated task', completed: true, completedAt: new Date().toISOString() })),
    memories: projectedEvent.memories.map((memory) => ({ ...memory, body: 'Updated note' })),
    attachments: projectedEvent.attachments.map((attachment) => ({ ...attachment, name: 'proof-updated.txt' })),
  });

  const savedExpense = await useExpenseStore.getState().addExpense(null, true, {
    id: 'expense-cutover-1',
    name: 'Test expense',
    amount: 12.5,
    category: 'Food',
    date: today,
    eventId: event.id,
    activityId: 'activity-cutover-1',
  });
  assert.equal(savedExpense.userId, principalId);
  await useExpenseStore.getState().updateExpenseItem(null, true, { ...savedExpense, amount: 15 });
  await useIncomeStore.getState().addIncome(null, true, {
    id: 'income-cutover-1', name: 'Test income', type: 'Salary', amount: 100, date: today,
  });
  await useIncomeStore.getState().updateIncomeItem(null, true, { ...useIncomeStore.getState().incomes[0], amount: 125 });

  await useAppStore.getState().setPreferences({ theme: 'light', currency: 'USD' });
  await useAppStore.getState().setAdminValues({ eventTypes: [{ value: 'Custom moment', label: 'Custom moment', active: true }] });
  await useAppStore.getState().setAdminValues({ eventTypes: [] });
  assert.equal((await codeListRepository.getList(principalId, 'eventTypes')).length, 0);
  await useAppStore.getState().setAdminValues({ eventTypes: [{ value: 'Custom moment', label: 'Custom moment', active: true }] });

  assert.equal((await momentRepository.getAll(principalId)).length, 1);
  assert.equal((await activityRepository.getByMoment(principalId, event.id))[0].title, 'Updated task');
  assert.equal((await memoryRepository.getByMoment(principalId, event.id))[0].content, 'Updated note');
  assert.equal((await attachmentRepository.getByMoment(principalId, event.id))[0].name, 'proof-updated.txt');
  assert.equal((await expenseRepository.getByEvent(principalId, event.id))[0].amount, 15);
  assert.equal((await incomeRepository.getAll(principalId))[0].amount, 125);
  assert.equal((await settingsRepository.getPreferences(principalId)).theme, 'light');
  assert.equal((await codeListRepository.getList(principalId, 'eventTypes'))[0].entryValue, 'Custom moment');

  await db.close();
  await initializeDatabase();
  useEventStore.getState().setEvents([]);
  useExpenseStore.getState().setExpenses([]);
  useIncomeStore.getState().setIncomes([]);
  await useEventStore.getState().loadEvents(null, true);
  await useExpenseStore.getState().loadExpenses(null, true);
  await useIncomeStore.getState().loadIncomes(null, true);
  await useAppStore.getState().hydratePersistentData(principalId);

  projectedEvent = useEventStore.getState().events.find((item) => item.id === event.id);
  assert.equal(projectedEvent.activities[0].title, 'Updated task');
  assert.equal(projectedEvent.activities[0].expenses[0].id, 'expense-cutover-1');
  assert.equal(projectedEvent.memories[0].body, 'Updated note');
  assert.equal(useExpenseStore.getState().expenses[0].id, 'expense-cutover-1');
  assert.equal(useIncomeStore.getState().incomes[0].amount, 125);
  assert.equal(useAppStore.getState().preferences.theme, 'light');
  assert.ok(useAppStore.getState().adminValues.eventTypes.some((entry) => entry.value === 'Custom moment'));

  await useAppStore.getState().resetPreferences();
  assert.equal((await settingsRepository.getPreferences(principalId)).theme, 'dark');
  await useAppStore.getState().resetAdminValues();
  assert.ok((await codeListRepository.getList(principalId, 'eventTypes')).length > 0);

  useEventStore.getState().setEvents([]);
  await useEventStore.getState().loadEvents(principalId);
  assert.equal(useEventStore.getState().events[0].id, event.id);

  await useExpenseStore.getState().deleteExpenseItem(null, true, 'expense-cutover-1');
  await useIncomeStore.getState().deleteIncomeItem(null, true, 'income-cutover-1');
  assert.equal((await expenseRepository.getAll(principalId)).length, 0);
  assert.equal((await incomeRepository.getAll(principalId)).length, 0);

  await useEventStore.getState().deleteEventItem(null, true, event.id);
  assert.equal((await momentRepository.getAll(principalId)).length, 0);
  assert.equal((await activityRepository.getAll(principalId)).length, 0);
  assert.equal((await memoryRepository.getAll(principalId)).length, 0);
  assert.equal((await attachmentRepository.getAll(principalId)).length, 0);

  await db.delete();
  globalThis.fetch = originalFetch;
});

test('Device Principal bootstrap adopts existing local owner rows and remains stable', async () => {
  await db.delete();
  await initializeDatabase();
  await db.table('moments').put({ id: 'legacy-moment', userId: 'firebase-uid-1', name: 'Legacy', date: '2026-10-05', type: 'Personal' });
  await db.table('settings').put({ id: 'legacy-setting', userId: 'firebase-uid-1', key: 'theme', value: 'light' });

  const first = await useAppStore.getState().bootstrapDevicePrincipal({ deviceName: 'Migration Device' });
  const adoptedMoment = await db.table('moments').get('legacy-moment');
  const adoptedSetting = await db.table('settings').get('legacy-setting');
  const second = await useAppStore.getState().bootstrapDevicePrincipal();

  assert.equal(first.principalType, 'device');
  assert.equal(first.deviceName, 'Migration Device');
  assert.equal(adoptedMoment.userId, first.principalId);
  assert.equal(adoptedSetting.userId, first.principalId);
  assert.deepEqual(second, { ...first, lastSeenAt: second.lastSeenAt });
  assert.ok(first.legacyPrincipalIds.includes('firebase-uid-1'));
  await db.delete();
});

test('multiple legacy owners require explicit approval before consolidation', async () => {
  await db.delete();
  await initializeDatabase();
  await db.table('moments').bulkPut([
    { id: 'legacy-a', userId: 'firebase-uid-a', name: 'A', date: '2026-10-05', type: 'Personal' },
    { id: 'legacy-b', userId: 'firebase-uid-b', name: 'B', date: '2026-10-05', type: 'Personal' },
  ]);

  await assert.rejects(devicePrincipalRepository.getOrCreate(), (error) => {
    assert.equal(error.code, 'DEVICE_PRINCIPAL_MIGRATION_APPROVAL_REQUIRED');
    assert.equal(error.legacyPrincipals.length, 2);
    return true;
  });
  assert.equal((await db.table('moments').get('legacy-a')).userId, 'firebase-uid-a');
  assert.equal((await db.table('moments').get('legacy-b')).userId, 'firebase-uid-b');

  const principal = await devicePrincipalRepository.getOrCreate({ approveLegacyMigration: true });
  assert.equal((await db.table('moments').get('legacy-a')).userId, principal.principalId);
  assert.equal((await db.table('moments').get('legacy-b')).userId, principal.principalId);
  await db.delete();
});
