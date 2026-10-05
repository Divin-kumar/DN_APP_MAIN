import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { attachmentRepository } from './attachmentRepository.js';
import { momentRepository } from './momentRepository.js';
import { activityRepository } from './activityRepository.js';
import { createBackupArtifact, restoreBackupArtifact, verifyBackupArtifactIntegrity } from '../services/backupService.js';
import { DATABASE_TABLES as T } from '../database/tables.js';

const seedParents = async (userId) => {
  await momentRepository.create(userId, { id: 'moment-1', name: 'Trip', date: '2026-10-05', type: 'Personal' });
  await activityRepository.create(userId, { id: 'activity-1', momentId: 'moment-1', title: 'Book hotel', date: '2026-10-05', priority: 'medium' });
};

test('attachment can link to a Moment and Activity as one first-class record', async () => {
  await db.delete();
  await initializeDatabase();
  const userId = 'attachment-owner';
  await seedParents(userId);
  const record = await attachmentRepository.create(userId, {
    id: 'receipt-1', name: 'Hotel receipt.pdf', type: 'application/pdf', size: 3,
    fileReference: 'https://example.test/receipt.pdf', availability: 'reference',
  }, { parentLinks: [
    { parentType: 'moment', parentId: 'moment-1' },
    { parentType: 'activity', parentId: 'activity-1' },
  ] });

  assert.equal(record.id, 'receipt-1');
  assert.equal((await attachmentRepository.getByMoment(userId, 'moment-1')).length, 1);
  assert.equal((await attachmentRepository.getByActivity(userId, 'activity-1')).length, 1);
  assert.equal((await attachmentRepository.getAll(userId)).length, 1);
  await db.delete();
});

test('file relink and replacement preserve the existing attachment identity and parent links', async () => {
  await db.delete();
  await initializeDatabase();
  const userId = 'attachment-recovery-owner';
  await seedParents(userId);
  await attachmentRepository.create(userId, {
    id: 'recovery-1', name: 'Hotel receipt.pdf', type: 'application/pdf', size: 4,
    fileReference: 'https://example.test/old-receipt.pdf', availability: 'reference',
  }, { parentLinks: [
    { parentType: 'moment', parentId: 'moment-1' },
    { parentType: 'activity', parentId: 'activity-1' },
  ] });

  await attachmentRepository.updateReference(userId, 'recovery-1', { fileReference: 'https://example.test/new-receipt.pdf' });
  const relinked = await attachmentRepository.getById(userId, 'recovery-1');
  assert.equal(relinked.id, 'recovery-1');
  assert.equal(relinked.fileReference, 'https://example.test/new-receipt.pdf');
  assert.deepEqual(new Set(relinked.parentLinks.map((link) => `${link.parentType}:${link.parentId}`)), new Set(['moment:moment-1', 'activity:activity-1']));

  const replacement = new Blob(['replacement bytes'], { type: 'application/pdf' });
  await attachmentRepository.replaceFile(userId, 'recovery-1', { blob: replacement, name: 'Updated receipt.pdf', mimeType: replacement.type });
  const replaced = await attachmentRepository.getById(userId, 'recovery-1');
  const storedFile = await db.table(T.ATTACHMENT_FILES).get('recovery-1');
  assert.equal(replaced.id, 'recovery-1');
  assert.equal(replaced.name, 'Updated receipt.pdf');
  assert.equal(replaced.hasLocalCopy, true);
  assert.equal(replaced.fileReference, '');
  assert.deepEqual(new Set(replaced.parentLinks.map((link) => `${link.parentType}:${link.parentId}`)), new Set(['moment:moment-1', 'activity:activity-1']));
  assert.equal(await storedFile.blob.text(), 'replacement bytes');
  await db.delete();
});

test('removing one parent link keeps the attachment; deleting it removes all links and local bytes', async () => {
  await db.delete();
  await initializeDatabase();
  const userId = 'attachment-link-removal-owner';
  await seedParents(userId);
  const blob = new Blob(['keep me'], { type: 'text/plain' });
  await attachmentRepository.create(userId, {
    id: 'linked-file', name: 'Note.txt', type: 'text/plain', size: blob.size, availability: 'local-copy',
  }, { parentLinks: [
    { parentType: 'moment', parentId: 'moment-1' },
    { parentType: 'activity', parentId: 'activity-1' },
  ], blob });

  await attachmentRepository.replaceParentLinks(userId, 'linked-file', [{ parentType: 'activity', parentId: 'activity-1' }]);
  assert.ok(await attachmentRepository.getById(userId, 'linked-file'));
  assert.equal((await attachmentRepository.getByMoment(userId, 'moment-1')).length, 0);
  assert.equal((await attachmentRepository.getByActivity(userId, 'activity-1')).length, 1);
  assert.equal(await (await db.table(T.ATTACHMENT_FILES).get('linked-file')).blob.text(), 'keep me');

  await attachmentRepository.delete(userId, 'linked-file');
  assert.equal(await attachmentRepository.getById(userId, 'linked-file'), null);
  assert.equal((await db.table(T.ATTACHMENT_LINKS).where('attachmentId').equals('linked-file').toArray()).length, 0);
  assert.equal(await db.table(T.ATTACHMENT_FILES).get('linked-file'), undefined);
  await db.delete();
});

test('local file copies are opt-in and only included in Include Attachments backup mode', async () => {
  await db.delete();
  await initializeDatabase();
  const userId = 'attachment-backup-owner';
  await seedParents(userId);
  const fileBlob = new Blob(['receipt bytes'], { type: 'application/pdf' });
  await attachmentRepository.create(userId, {
    id: 'receipt-local', name: 'receipt.pdf', type: 'application/pdf', size: fileBlob.size,
    availability: 'local-copy',
  }, { parentLinks: [{ parentType: 'activity', parentId: 'activity-1' }], blob: fileBlob });
  assert.equal((await attachmentRepository.getById(userId, 'receipt-local')).hasLocalCopy, true);

  const metadataArtifact = await createBackupArtifact({ database: db, principalId: userId });
  assert.equal(metadataArtifact.payload[T.ATTACHMENTS].length, 1);
  assert.equal(metadataArtifact.payload[T.ATTACHMENT_LINKS].length, 1);
  assert.equal(metadataArtifact.payload[T.ATTACHMENT_FILES], undefined);

  const inclusiveArtifact = await createBackupArtifact({ database: db, principalId: userId, attachmentMode: 'include-attachments' });
  assert.equal(inclusiveArtifact.payload[T.ATTACHMENT_FILES][0].attachmentId, 'receipt-local');
  assert.equal((await verifyBackupArtifactIntegrity(inclusiveArtifact)).valid, true);

  await db.table(T.ATTACHMENT_FILES).delete('receipt-local');
  assert.equal((await attachmentRepository.getById(userId, 'receipt-local')).hasLocalCopy, false);

  await db.delete();
  await initializeDatabase();
  await restoreBackupArtifact(inclusiveArtifact, { database: db, targetPrincipalId: userId, allowOverwrite: true, force: true });
  const restoredBlob = await attachmentRepository.getAll(userId).then((rows) => rows.length ? db.table(T.ATTACHMENT_FILES).get('receipt-local') : null);
  assert.equal(await restoredBlob.blob.text(), 'receipt bytes');
  assert.equal((await attachmentRepository.getByActivity(userId, 'activity-1')).length, 1);
  await db.delete();
});
