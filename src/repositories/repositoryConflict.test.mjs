import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { activityRepository } from './activityRepository.js';
import { attachmentRepository } from './attachmentRepository.js';
import { codeListRepository } from './codeListRepository.js';
import { expenseRepository } from './expenseRepository.js';
import { incomeRepository } from './incomeRepository.js';
import { memoryRepository } from './memoryRepository.js';
import { momentRepository } from './momentRepository.js';
import { settingsRepository } from './settingsRepository.js';

const principalId = 'conflict-owner';
const date = '2026-10-04';
const makeMoment = (id, name = 'Moment') => ({ id, userId: principalId, name, date, type: 'Personal', recurrence: 'none', status: 'active' });
const expectConflict = async (promise) => assert.rejects(promise, (error) => error.code === 'REPOSITORY_CONFLICT');

 test('all repository creates are deterministic for identical retries and reject conflicting ID reuse', async () => {
  await db.delete();
  await initializeDatabase();
  await momentRepository.create(principalId, makeMoment('moment-1'));

  const cases = [
    ['moments', () => momentRepository.create(principalId, makeMoment('moment-1')), () => momentRepository.create(principalId, makeMoment('moment-1', 'Changed Moment')), () => momentRepository.getById(principalId, 'moment-1')],
  ];
  const activity = { id: 'activity-1', userId: principalId, momentId: 'moment-1', title: 'Task', date, priority: 'medium', completed: false };
  await activityRepository.create(principalId, activity);
  cases.push(['activities', () => activityRepository.create(principalId, activity), () => activityRepository.create(principalId, { ...activity, title: 'Changed Task' }), () => activityRepository.getById(principalId, 'activity-1')]);

  const memory = { id: 'memory-1', userId: principalId, momentId: 'moment-1', title: 'Note', content: 'Original' };
  await memoryRepository.create(principalId, memory);
  cases.push(['memories', () => memoryRepository.create(principalId, memory), () => memoryRepository.create(principalId, { ...memory, content: 'Changed' }), () => memoryRepository.getById(principalId, 'memory-1')]);

  const attachment = { id: 'attachment-1', userId: principalId, momentId: 'moment-1', name: 'photo.png', type: 'image/png', size: 10 };
  await attachmentRepository.create(principalId, attachment);
  cases.push(['attachments', () => attachmentRepository.create(principalId, attachment), () => attachmentRepository.create(principalId, { ...attachment, name: 'other.png' }), () => attachmentRepository.getById(principalId, 'attachment-1')]);

  const expense = { id: 'expense-1', userId: principalId, name: 'Lunch', amount: 10, category: 'Food', date };
  await expenseRepository.create(principalId, expense);
  cases.push(['expenses', () => expenseRepository.create(principalId, expense), () => expenseRepository.create(principalId, { ...expense, amount: 11 }), () => expenseRepository.getById(principalId, 'expense-1')]);

  const income = { id: 'income-1', userId: principalId, name: 'Salary', type: 'Salary', amount: 100, date };
  await incomeRepository.create(principalId, income);
  cases.push(['incomes', () => incomeRepository.create(principalId, income), () => incomeRepository.create(principalId, { ...income, amount: 101 }), () => incomeRepository.getById(principalId, 'income-1')]);

  const setting = await settingsRepository.setOne(principalId, 'theme', 'dark');
  cases.push(['settings', () => settingsRepository.setOne(principalId, 'theme', 'dark'), () => settingsRepository.setOne(principalId, 'theme', 'light'), () => settingsRepository.getByKey(principalId, 'theme')]);
  assert.ok(setting.id);

  const codeList = await codeListRepository.upsertEntry(principalId, 'eventTypes', { value: 'Birthday', label: 'Birthday' });
  // Code List upsert-by-logical-key is an explicit edit and must deterministically retain the row ID.
  const codeListUpdated = await codeListRepository.upsertEntry(principalId, 'eventTypes', { id: codeList.id, value: 'Birthday', label: 'Celebration' });
  assert.equal(codeListUpdated.id, codeList.id);
  assert.equal(codeListUpdated.label, 'Celebration');

  for (const [domain, idempotentCreate, conflictCreate, read] of cases) {
    const retry = await idempotentCreate();
    assert.ok(retry, `${domain} exact retry should be idempotent`);
    await expectConflict(conflictCreate());
    const persisted = await read();
    assert.notEqual(persisted, null, `${domain} existing row should remain present`);
    if (Array.isArray(persisted)) assert.equal(persisted.length, 1, `${domain} should have one logical row`);
  }

  const audit = await db.table(DATABASE_TABLES.MIGRATION_AUDIT).where('principalId').equals(principalId).toArray();
  assert.ok(audit.length >= 7);
  assert.ok(audit.every((entry) => entry.eventType === 'repository-write-conflict'));
  assert.ok(audit.every((entry) => !Object.hasOwn(entry, 'recordBody')));
  await db.delete();
});

test('parent relationship writes reject missing or mismatched records', async () => {
  await db.delete();
  await initializeDatabase();

  await expectConflict(activityRepository.create(principalId, {
    id: 'orphan-activity', userId: principalId, momentId: 'missing-moment', title: 'Task', date,
  }));
  await expectConflict(memoryRepository.create(principalId, {
    id: 'orphan-memory', userId: principalId, momentId: 'missing-moment', title: 'Memory', content: 'Body',
  }));
  await expectConflict(attachmentRepository.create(principalId, {
    id: 'orphan-attachment', userId: principalId, momentId: 'missing-moment', name: 'File',
  }));
  await expectConflict(expenseRepository.create(principalId, {
    id: 'orphan-expense', userId: principalId, momentId: 'missing-moment', name: 'Expense', amount: 1, category: 'Other', date,
  }));
  assert.equal((await activityRepository.getAll(principalId)).length, 0);
  assert.equal((await memoryRepository.getAll(principalId)).length, 0);
  assert.equal((await attachmentRepository.getAll(principalId)).length, 0);
  assert.equal((await expenseRepository.getAll(principalId)).length, 0);
  await db.delete();
});

test('code-list updates preserve stable IDs when only labels change and reject normalized duplicate values', async () => {
  await db.delete();
  await initializeDatabase();
  const first = await codeListRepository.setList(principalId, 'eventTypes', [
    { id: 'event-stable-id', value: 'Family Event', label: 'Family Event' },
  ]);
  const updated = await codeListRepository.setList(principalId, 'eventTypes', [
    { id: first[0].id, value: 'Family Event', label: 'Family Celebration' },
  ]);

  assert.equal(updated[0].id, 'event-stable-id');
  assert.equal(updated[0].value, 'Family Event');
  assert.equal(updated[0].label, 'Family Celebration');
  await assert.rejects(
    codeListRepository.setList(principalId, 'eventTypes', [
      { value: 'Family Event', label: 'Family Event' },
      { value: ' family   event ', label: 'Duplicate' },
    ]),
    /already contains an entry with that name/i,
  );
  await db.delete();
});

test('duplicate bulk records abort atomically and preserve existing rows', async () => {
  await db.delete();
  await initializeDatabase();
  await momentRepository.create(principalId, makeMoment('batch-parent'));
  const batch = [
    { id: 'batch-activity-1', userId: principalId, momentId: 'batch-parent', title: 'First', date, priority: 'medium', completed: false },
    { id: 'batch-activity-1', userId: principalId, momentId: 'batch-parent', title: 'Conflicting', date, priority: 'medium', completed: false },
  ];
  await expectConflict(activityRepository.bulkUpsert(principalId, batch));
  assert.equal((await activityRepository.getAll(principalId)).length, 0);
  await db.delete();
});
