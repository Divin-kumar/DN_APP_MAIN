import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_SCHEMA, DATABASE_SCHEMA_VERSION } from './schema.js';
import { db } from './index.js';
import { initializeDatabase } from './boot.js';
import { attachmentRepository } from '../repositories/attachmentRepository.js';

 test('schema upgrade adds attachment relationship and file tables without losing legacy attachment rows', async () => {
  await db.delete();
  const previousSchema = Object.fromEntries(Object.entries(DATABASE_SCHEMA).filter(([table]) => !['attachmentLinks', 'attachmentFiles'].includes(table)));
  const legacy = new Dexie('lifehub-dexie-db');
  legacy.version(DATABASE_SCHEMA_VERSION - 1).stores(previousSchema);
  await legacy.open();
  await legacy.table('moments').put({ id: 'legacy-moment', userId: 'legacy-owner', name: 'Old moment', date: '2026-10-05', type: 'Personal' });
  await legacy.table('attachments').put({ id: 'legacy-attachment', userId: 'legacy-owner', momentId: 'legacy-moment', name: 'old.jpg', type: 'image/jpeg', size: 120, url: 'https://example.test/old.jpg' });
  legacy.close();

  await initializeDatabase();
  assert.ok(db.table('attachmentLinks'));
  assert.ok(db.table('attachmentFiles'));
  const migrated = await attachmentRepository.getByMoment('legacy-owner', 'legacy-moment');
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].id, 'legacy-attachment');
  await db.delete();
});
