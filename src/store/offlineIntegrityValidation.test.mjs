import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_METADATA_KEYS } from '../database/metadata.js';
import { DATABASE_SCHEMA_VERSION } from '../database/schema.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { validateActivityRecord } from '../repositories/activityRepository.validation.js';
import { validateAttachmentRecord } from '../repositories/attachmentRepository.validation.js';
import { validateExpenseRecord } from '../repositories/expenseRepository.validation.js';
import { validateIncomeRecord } from '../repositories/incomeRepository.validation.js';
import { validateMemoryRecord } from '../repositories/memoryRepository.validation.js';
import { validateMomentRecord } from '../repositories/momentRepository.validation.js';
import { activityRepository } from '../repositories/activityRepository.js';
import { attachmentRepository } from '../repositories/attachmentRepository.js';
import { expenseRepository } from '../repositories/expenseRepository.js';
import { incomeRepository } from '../repositories/incomeRepository.js';
import { memoryRepository } from '../repositories/memoryRepository.js';
import { momentRepository } from '../repositories/momentRepository.js';

const validators = {
  moments: validateMomentRecord,
  activities: validateActivityRecord,
  memories: validateMemoryRecord,
  attachments: validateAttachmentRecord,
  expenses: validateExpenseRecord,
  incomes: validateIncomeRecord,
};

test('activity priority validation accepts only fixed Low, Medium, and High keys', () => {
  const base = { id: 'activity-priority-test', userId: 'user-1', momentId: 'moment-1', title: 'Task', date: new Date().toISOString().slice(0, 10) };
  for (const priority of ['low', 'medium', 'high']) {
    assert.equal(validateActivityRecord({ ...base, priority }).valid, true);
  }
  const custom = validateActivityRecord({ ...base, priority: 'urgent' });
  assert.equal(custom.valid, false);
  assert.ok(custom.errors.includes('Activity priority must be Low, Medium, or High.'));
});

const auditPrincipal = async (principalId) => {
  const [moments, activities, memories, attachments, expenses, incomes] = await Promise.all([
    momentRepository.getAll(principalId),
    activityRepository.getAll(principalId),
    memoryRepository.getAll(principalId),
    attachmentRepository.getAll(principalId),
    expenseRepository.getAll(principalId),
    incomeRepository.getAll(principalId),
  ]);
  const domains = { moments, activities, memories, attachments, expenses, incomes };
  const findings = [];
  for (const [domain, rows] of Object.entries(domains)) {
    for (const record of rows) {
      const validation = validators[domain](record);
      for (const message of validation.errors) findings.push({ kind: 'invalid-row', domain, id: record.id, message });
      if (record.userId !== principalId) findings.push({ kind: 'owner-mismatch', domain, id: record.id });
    }
  }
  const ids = (rows) => new Set(rows.map((record) => record.id));
  const momentIds = ids(moments);
  const activityIds = ids(activities);
  for (const [domain, rows] of Object.entries({ activities, memories, attachments, expenses })) {
    for (const record of rows) {
      const parentId = record.momentId || record.eventId;
      if (parentId && !momentIds.has(parentId)) findings.push({ kind: 'orphan-moment', domain, id: record.id, parentId });
    }
  }
  for (const expense of expenses) {
    if (expense.activityId && !activityIds.has(expense.activityId)) {
      findings.push({ kind: 'orphan-activity', domain: 'expenses', id: expense.id, parentId: expense.activityId });
    }
  }
  return findings;
};

test('repositories reject invalid identifiers and invalid financial/domain values before persistence', async () => {
  await db.delete();
  await initializeDatabase();
  const principalId = 'failure-owner';
  const today = new Date().toISOString().slice(0, 10);

  await assert.rejects(momentRepository.create(principalId, { id: '', name: 'No ID', date: today, type: 'Personal' }));
  await assert.rejects(expenseRepository.upsert(principalId, { id: 'negative-expense', name: 'Invalid', amount: -1, category: 'Food', date: today }));
  const normalizedIncome = await incomeRepository.upsert(principalId, { id: 'invalid-income-date', name: 'Invalid', type: 'Salary', amount: 1, date: 'not-a-date' });
  assert.match(normalizedIncome.date, /^\d{4}-\d{2}-\d{2}$/);
  await assert.rejects(activityRepository.create(principalId, { id: 'invalid-activity', momentId: 'm', title: '', date: today }));
  await assert.rejects(memoryRepository.create(principalId, { id: '', momentId: 'm', title: '', content: '' }));
  await assert.rejects(attachmentRepository.create(principalId, { id: '', momentId: 'm', name: '', size: -1 }));

  for (const repository of [momentRepository, activityRepository, memoryRepository, attachmentRepository, expenseRepository]) {
    assert.equal((await repository.getAll(principalId)).length, 0);
  }
  assert.equal((await incomeRepository.getAll(principalId)).length, 1);
  await db.delete();
});

test('missing database metadata is restored by boot without removing domain records', async () => {
  await db.delete();
  await initializeDatabase();
  const principalId = 'metadata-owner';
  const today = new Date().toISOString().slice(0, 10);
  await momentRepository.create(principalId, { id: 'preserved-moment', name: 'Keep me', date: today, type: 'Personal' });

  await db.table(DATABASE_TABLES.METADATA).delete(DATABASE_METADATA_KEYS.SCHEMA_VERSION);
  await db.close();
  await initializeDatabase();

  const schemaVersion = await db.table(DATABASE_TABLES.METADATA).get(DATABASE_METADATA_KEYS.SCHEMA_VERSION);
  assert.ok(schemaVersion);
  assert.equal(schemaVersion.value, DATABASE_SCHEMA_VERSION);
  assert.equal((await momentRepository.getAll(principalId))[0].id, 'preserved-moment');
  await db.delete();
});

test('duplicate primary IDs preserve existing content and emit a conflict audit event', async () => {
  await db.delete();
  await initializeDatabase();
  const principalId = 'duplicate-owner';
  const today = new Date().toISOString().slice(0, 10);

  await momentRepository.create(principalId, { id: 'duplicate-moment', name: 'Original', date: today, type: 'Personal' });
  await assert.rejects(
    momentRepository.create(principalId, { id: 'duplicate-moment', name: 'Replacement', date: today, type: 'Personal' }),
    { code: 'REPOSITORY_CONFLICT' },
  );

  const rows = await momentRepository.getAll(principalId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Original');
  const audit = await db.table(DATABASE_TABLES.MIGRATION_AUDIT).where('principalId').equals(principalId).toArray();
  assert.equal(audit.at(-1).eventType, 'repository-write-conflict');
  assert.deepEqual(audit.at(-1).differingFields, ['name']);
  await db.delete();
});

test('integrity audit detects corrupt rows and missing moment/activity parents', async () => {
  await db.delete();
  await initializeDatabase();
  const principalId = 'integrity-owner';
  const today = new Date().toISOString().slice(0, 10);

  await db.table(DATABASE_TABLES.ACTIVITIES).put({
    id: 'corrupt-orphan-activity', userId: principalId, momentId: 'missing-moment', title: '', date: 'invalid-date',
    completed: false, cancelled: false, priority: 'unknown', source: 'manual',
  });
  await db.table(DATABASE_TABLES.EXPENSES).put({
    id: 'orphan-expense', userId: principalId, momentId: 'missing-moment', activityId: 'missing-activity',
    name: 'Expense', amount: 1, category: 'Other', date: today, source: 'manual',
  });

  const findings = await auditPrincipal(principalId);
  assert.ok(findings.some((finding) => finding.kind === 'invalid-row' && finding.domain === 'activities'));
  assert.ok(findings.some((finding) => finding.kind === 'orphan-moment' && finding.domain === 'activities'));
  assert.ok(findings.some((finding) => finding.kind === 'orphan-moment' && finding.domain === 'expenses'));
  assert.ok(findings.some((finding) => finding.kind === 'orphan-activity' && finding.domain === 'expenses'));
  await db.delete();
});
