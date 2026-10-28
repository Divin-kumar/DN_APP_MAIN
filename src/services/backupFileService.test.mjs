import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBackupFile, readBackupFile, readJsonBackupFile } from './backupFileService.js';
import { buildEventGroupsFromBackup, createBackupDocument, parseBackupDocument } from './backupService.js';
import { createAttachmentRepository, restoreAttachmentFiles } from './attachmentService.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const input = (attachments = []) => ({
  moments: [{ id: 'kept-moment', name: 'A complete memory', date: '2026-10-28', notes: 'Tamil தமிழ், emoji 🏡 and "quoted" writing.\nKeep <p>literal source</p>.',
    activities: [{ id: 'kept-activity', title: 'The actual day', date: '', expenses: [] }],
    attachments, memories: [{ id: 'kept-reflection', body: 'A preserved reflection' }] }],
  incomes: [{ id: 'income', amount: 70, paymentMethod: 'Online' }],
  expenses: [{ id: 'expense', eventId: 'kept-moment', activityId: 'kept-activity', amount: 20, paymentMethod: 'Cash' }],
  codeLists: DEFAULT_CODE_LISTS, preferences: { theme: 'dark', currency: 'INR' },
  dashboardConfiguration: { favorites: ['kept-moment'] }, createdDate: '2026-10-28T12:00:00Z',
});
const filesFixture = (count = 2, size = 13) => {
  const originals = new Map();
  const attachments = Array.from({ length: count }, (_, index) => {
    const bytes = Buffer.alloc(size, index + 1);
    const assetId = hash(bytes);
    originals.set(assetId, new Blob([bytes], { type: 'application/octet-stream' }));
    return { id: 'file-' + index, assetId, type: 'application/octet-stream', storage: 'local',
      name: 'File ' + index, size, activityId: index % 2 ? 'kept-activity' : null };
  });
  return { originals, attachments, repository: { read: async (attachment) => {
    const file = originals.get(attachment.assetId);
    if (!file) throw new Error('Original unavailable');
    return file;
  } } };
};

test('incremental v3 export remains readable by the existing JSON parser with exact writing, files and relationships', async () => {
  const fixture = filesFixture();
  const source = input([...fixture.attachments, { ...fixture.attachments[0], id: 'same-original', activityId: 'kept-activity' }]);
  const before = JSON.stringify(source);
  const exported = await createBackupFile(source, { isGuest: true }, fixture.repository);
  const traditional = parseBackupDocument(JSON.parse(await exported.blob.text()));
  assert.equal(traditional.backupVersion, 3);
  assert.equal(exported.originalFileCount, 2);
  assert.equal(traditional.attachmentFiles.length, 2);
  assert.equal(traditional.moments[0].notes, source.moments[0].notes);
  assert.deepEqual(traditional.attachments.map((item) => item.id), ['file-0', 'file-1', 'same-original']);
  assert.equal(traditional.expenses[0].paymentMethod, 'Cash');
  assert.equal(traditional.incomes[0].paymentMethod, 'Online');
  for (const file of traditional.attachmentFiles) assert.equal(hash(Buffer.from(file.base64, 'base64')), file.assetId);
  assert.equal(JSON.stringify(source), before);
});

test('preview indexes and verifies file ranges without restoring any bytes; confirmed restore preserves original hashes', async () => {
  const fixture = filesFixture();
  const exported = await createBackupFile(input(fixture.attachments), { isGuest: true }, fixture.repository);
  // A whole-file text/arrayBuffer read is deliberately unavailable.
  exported.blob.text = () => assert.fail('must not decode the complete JSON');
  exported.blob.arrayBuffer = () => assert.fail('must not copy the complete JSON');
  const prepared = await readBackupFile(exported.blob);
  assert.equal(prepared.backup.attachmentFiles.length, 2);
  assert.ok(prepared.backup.attachmentFiles.every((file) => !('base64' in file)));
  assert.throws(() => parseBackupDocument(prepared.backup), /base64/,
    'descriptors cannot bypass canonical validation without the separate verified file index');
  const writes = [];
  const saved = new Map();
  const repository = createAttachmentRepository({ local: async (scope, id, blob) => {
    if (blob) { writes.push([scope, id]); saved.set(id, blob); }
    return saved.get(id);
  } });
  const groups = buildEventGroupsFromBackup(prepared.backup, { originalFiles: prepared.originalFiles });
  assert.deepEqual(writes, []);
  const restored = await restoreAttachmentFiles(groups, prepared.backup.attachmentFiles,
    { isGuest: true, readOriginal: prepared.readOriginal }, repository);
  assert.equal(restored[0].attachments[1].activityId, 'kept-activity');
  assert.equal(restored[0].activities[0].date, '');
  assert.deepEqual(writes.map(([scope]) => scope), ['guest', 'guest']);
  for (const [id, blob] of saved) assert.equal(hash(Buffer.from(await blob.arrayBuffer())), id);
});

test('backups above the old 50 MiB cap export and prepare with only one original encoded at a time', async () => {
  const fixture = filesFixture(6, 7 * 1024 * 1024);
  const progress = [];
  const exported = await createBackupFile(input(fixture.attachments), { isGuest: true,
    onProgress: (value) => progress.push(value.completed) }, fixture.repository);
  assert.ok(exported.blob.size > 50 * 1024 * 1024);
  exported.blob.text = () => assert.fail('large import must not read all JSON as text');
  const prepared = await readBackupFile(exported.blob);
  assert.equal(prepared.originalFiles.size, 6);
  assert.ok(prepared.backup.attachmentFiles.every((file) => Object.keys(file).sort().join(',') === 'assetId,size,type'));
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6]);
  const last = prepared.backup.attachmentFiles.at(-1);
  assert.equal(hash(Buffer.from(await (await prepared.readOriginal(last.assetId)).arrayBuffer())), last.assetId);
});

test('chunk boundaries preserve Unicode, escaped punctuation, primitives, nested values and safe object keys', async () => {
  const source = JSON.stringify(Object.fromEntries([
    ['__proto__', { polluted: true }],
    ['moments', [{ id: 'தமிழ் 🏡', notes: 'quotes " and \\ and } ] ,', nested: [true, false, null, -1250, [], {}] }, null, 7, 'x']],
    ['metadata', { string: '[ ]' }],
  ]));
  const expected = JSON.parse(source);
  assert.deepEqual(await readJsonBackupFile(new Blob([source]), { chunkBytes: 7 }), expected);
  assert.equal({}.polluted, undefined);
});

test('invalid JSON, duplicate root fields, unsupported versions and broken relationships reject before confirmation', async () => {
  for (const source of ['[]', '{', '{}garbage', '{"x":1,}', '{"moments":[1,]}', '{"x" 1}', '{"x":true false}',
    '{"x":[}', '{"x":"unterminated}', '{"x":01}', '{"x":1 "y":2}', '{"x":1,"x":2}']) {
    await assert.rejects(readJsonBackupFile(new Blob([source]), { chunkBytes: 9 }), /valid JSON|top-level/);
  }
  await assert.rejects(readBackupFile(new Blob(['{"backupVersion":4}'])), /Unsupported backup version/);
  const backup = createBackupDocument(input());
  backup.activities[0].momentId = 'absent';
  await assert.rejects(readBackupFile(new Blob([JSON.stringify(backup)])), /references a missing Moment/);
});

test('corrupt original hashes, missing files and broken file references cannot produce a restorable preview', async () => {
  const fixture = filesFixture(1);
  const exported = await createBackupFile(input(fixture.attachments), { isGuest: true }, fixture.repository);
  const backup = JSON.parse(await exported.blob.text());
  backup.attachmentFiles[0].base64 = Buffer.alloc(13, 9).toString('base64');
  await assert.rejects(readBackupFile(new Blob([JSON.stringify(backup)])), /integrity/);
  backup.attachmentFiles = [];
  await assert.rejects(readBackupFile(new Blob([JSON.stringify(backup)])), /missing the original/);
  fixture.originals.clear();
  await assert.rejects(createBackupFile(input(fixture.attachments), { isGuest: true }, fixture.repository), /unavailable/);
});

test('preparation cancellation and scope changes abort without yielding a partial downloadable backup', async () => {
  const fixture = filesFixture(2);
  const cancellation = new AbortController();
  await assert.rejects(createBackupFile(input(fixture.attachments), { isGuest: true, signal: cancellation.signal,
    onProgress: () => cancellation.abort() }, fixture.repository), { name: 'AbortError' });
  const document = createBackupDocument(input());
  const file = new Blob([JSON.stringify(document)]);
  const reading = new AbortController();
  await assert.rejects(readBackupFile(file, { chunkBytes: 64, signal: reading.signal,
    onProgress: () => reading.abort() }), { name: 'AbortError' });
  await assert.rejects(readBackupFile(file, { assertCurrent: () => { throw new Error('Session changed'); } }), /Session changed/);
});

test('legacy v2 and settings-only JSON remain accepted without invented attachment data', async () => {
  const v2 = { backupVersion: 2, exportedAt: '2026-10-28T12:00:00Z', data: { collections: {
    eventGroups: input().moments, expenses: [], incomes: [], codeLists: DEFAULT_CODE_LISTS,
  } } };
  const upgraded = await readBackupFile(new Blob([JSON.stringify(v2)]));
  assert.equal(upgraded.backup.backupVersion, 3);
  assert.equal(upgraded.backup.moments[0].id, 'kept-moment');
  assert.equal(upgraded.originalFiles.size, 0);
  const legacy = await readBackupFile(new Blob([JSON.stringify({ dn_preferences: JSON.stringify({ theme: 'light' }) })]));
  assert.equal(legacy.backup.metadata.legacySettingsOnly, true);
  assert.equal(legacy.backup.preferences.theme, 'light');
});

test('UTF-8 BOM backups keep the previous text-reader behavior across single-byte chunks', async () => {
  const bom = new Uint8Array([239, 187, 191]);
  const file = new Blob([bom, '{"value":"தமிழ் 🏡"}']);
  assert.deepEqual(await readJsonBackupFile(file, { chunkBytes: 1 }), JSON.parse(await file.text()));
  const document = createBackupDocument(input());
  const prepared = await readBackupFile(new Blob([bom, JSON.stringify(document)]));
  assert.equal(prepared.backup.moments[0].notes, input().moments[0].notes);
});

test('incremental scanning agrees with JSON.parse for deterministic varied nested values and chunk boundaries', async () => {
  let seed = 7163;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const primitives = [null, true, false, -124.25, 1e24, 'quotes " and \\ and \nதமிழ் 🏡 ] } , :'];
  const value = (depth = 0) => {
    const kind = next() % (depth > 2 ? 6 : 8);
    if (kind < 6) return primitives[kind];
    if (kind === 6) return [value(depth + 1), value(depth + 1), []];
    return { ['key-' + next()]: value(depth + 1), empty: {}, text: '"\\' };
  };
  for (let index = 0; index < 25; index += 1) {
    const expected = { moments: [value(), value()], activities: [], metadata: value(), flag: index % 2 === 0, value: value() };
    const source = JSON.stringify(expected, null, index % 2 ? 2 : 0);
    assert.deepEqual(await readJsonBackupFile(new Blob([source]), { chunkBytes: 11 + index % 13 }), JSON.parse(source));
  }
});
