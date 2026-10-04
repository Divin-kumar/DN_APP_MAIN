import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { activityRepository, attachmentRepository, codeListRepository, expenseRepository, incomeRepository, memoryRepository, momentRepository, settingsRepository } from '../repositories/index.js';
import useAppStore from './useAppStore.js';
import useEventStore from './useEventStore.js';
import useExpenseStore from './useExpenseStore.js';
import useIncomeStore from './useIncomeStore.js';

test('runtime stores persist all domains through repositories and reload from Dexie', async () => {
  await db.delete();
  await initializeDatabase();

  await useAppStore.getState().setGuestMode(true);
  const principalId = useAppStore.getState().principalId;
  assert.ok(principalId?.startsWith('guest_'));

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

  useEventStore.getState().setEvents([]);
  useExpenseStore.getState().setExpenses([]);
  useIncomeStore.getState().setIncomes([]);
  await useEventStore.getState().loadEvents(null, true);
  await useExpenseStore.getState().loadExpenses(null, true);
  await useIncomeStore.getState().loadIncomes(null, true);
  await useAppStore.getState().hydratePersistentData(principalId);

  projectedEvent = useEventStore.getState().events.find((item) => item.id === event.id);
  assert.equal(projectedEvent.activities[0].title, 'Updated task');
  assert.equal(projectedEvent.memories[0].body, 'Updated note');
  assert.equal(useExpenseStore.getState().expenses[0].id, 'expense-cutover-1');
  assert.equal(useIncomeStore.getState().incomes[0].amount, 125);
  assert.equal(useAppStore.getState().preferences.theme, 'light');
  assert.equal(useAppStore.getState().adminValues.eventTypes[0].value, 'Custom moment');

  await useAppStore.getState().resetPreferences();
  assert.equal((await settingsRepository.getPreferences(principalId)).theme, 'dark');
  await useAppStore.getState().resetAdminValues();
  assert.ok((await codeListRepository.getList(principalId, 'eventTypes')).length > 0);

  await useAppStore.getState().setUser({ uid: 'account-cutover-1', email: 'account@example.test' });
  useEventStore.getState().setEvents([]);
  const accountMoment = await useEventStore.getState().addEvent('account-cutover-1', false, {
    id: 'account-moment-1', name: 'Account moment', date: today, type: 'Personal', activities: [],
  });
  assert.equal((await momentRepository.getAll('account-cutover-1')).length, 1);
  assert.equal((await momentRepository.getAll(principalId)).length, 1);
  await useEventStore.getState().deleteEventItem('account-cutover-1', false, accountMoment.id);
  assert.equal((await momentRepository.getAll('account-cutover-1')).length, 0);
  assert.equal((await momentRepository.getAll(principalId)).length, 1);

  await useAppStore.getState().setGuestMode(true);
  useEventStore.getState().setEvents([]);
  await useEventStore.getState().loadEvents(null, true);
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
});
