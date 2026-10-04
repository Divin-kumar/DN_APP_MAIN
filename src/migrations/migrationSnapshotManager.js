import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_SNAPSHOT_RETENTION_DAYS, MIGRATION_DOMAIN } from './migrationConstants.js';
import { canonicalFingerprint } from './migrationIdentity.js';
import { getMigrationDefinition } from './migrationRegistry.js';

const domainTableNames = (version) => Object.values(getMigrationDefinition(version)?.domains || {}).map((item) => item.table);
const jsonBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const newId = () => globalThis.crypto?.randomUUID?.() || `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class MigrationSnapshotManager {
  constructor({ database = db, retentionDays = DEFAULT_SNAPSHOT_RETENTION_DAYS, maxBytes = 30 * 1024 * 1024, now = () => new Date() } = {}) {
    this.db = database;
    this.retentionDays = retentionDays;
    this.maxBytes = maxBytes;
    this.now = now;
  }

  async create({ runId, principalId, migrationVersion = 1, tables = null }) {
    if (!runId || !principalId) throw new Error('runId and principalId are required to create a snapshot.');
    const tableNames = tables || domainTableNames(migrationVersion);
    if (!tableNames.length || tableNames.some((name) => !this.db.tables.some((table) => table.name === name))) {
      throw new Error('Snapshot table selection is invalid.');
    }

    const capturedAt = this.now();
    const snapshotId = newId();
    const contents = {};
    for (const tableName of tableNames) {
      contents[tableName] = await this.db.table(tableName).where('userId').equals(principalId).toArray();
    }

    const payloadBytes = jsonBytes(contents);
    if (payloadBytes > this.maxBytes) throw new Error(`Snapshot size ${payloadBytes} exceeds configured limit ${this.maxBytes}.`);
    const storage = globalThis.navigator?.storage;
    if (storage?.estimate) {
      const estimate = await storage.estimate();
      if (Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage) && estimate.usage + payloadBytes > estimate.quota * 0.9) {
        throw new Error('Insufficient IndexedDB quota to safely create a migration snapshot.');
      }
    }

    const checksums = {};
    for (const [tableName, records] of Object.entries(contents)) checksums[tableName] = await canonicalFingerprint(records);
    const createdAt = capturedAt.toISOString();
    const expiresAt = new Date(capturedAt.getTime() + this.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = {
      id: snapshotId,
      runId,
      principalId,
      migrationVersion,
      createdAt,
      expiresAt,
      status: 'verified',
      tableNames,
      rowCounts: Object.fromEntries(Object.entries(contents).map(([name, rows]) => [name, rows.length])),
      checksums,
      payloadBytes,
      overallChecksum: await canonicalFingerprint({ contents, checksums, principalId, migrationVersion }),
    };

    const snapshotTable = this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS);
    await this.db.transaction('rw', snapshotTable, async () => {
      await snapshotTable.put({ ...snapshot, kind: 'manifest' });
      for (const [tableName, records] of Object.entries(contents)) {
        await snapshotTable.put({
          id: `${snapshotId}:${tableName}`,
          snapshotId,
          runId,
          principalId,
          tableName,
          kind: 'table-data',
          records,
          checksum: checksums[tableName],
          createdAt,
          expiresAt,
          status: 'verified',
        });
      }
    });

    const verified = await this.validate(snapshotId);
    if (!verified.valid) throw new Error(`Created migration snapshot failed verification: ${verified.errors.join('; ')}`);
    return snapshot;
  }

  async load(snapshotId) {
    const snapshotTable = this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS);
    const manifest = await snapshotTable.get(snapshotId);
    if (!manifest || manifest.kind !== 'manifest') return null;
    const contents = {};
    for (const tableName of manifest.tableNames || []) {
      const part = await snapshotTable.get(`${snapshotId}:${tableName}`);
      if (!part || part.kind !== 'table-data') return null;
      contents[tableName] = part.records;
    }
    return { manifest, contents };
  }

  async validate(snapshotId) {
    const loaded = await this.load(snapshotId);
    if (!loaded) return { valid: false, errors: ['Snapshot manifest or data is missing.'] };
    const { manifest, contents } = loaded;
    const errors = [];
    const checksums = {};
    for (const tableName of manifest.tableNames || []) {
      checksums[tableName] = await canonicalFingerprint(contents[tableName]);
      if (checksums[tableName] !== manifest.checksums?.[tableName]) errors.push(`Snapshot checksum mismatch for ${tableName}.`);
      if ((manifest.rowCounts?.[tableName] ?? -1) !== contents[tableName].length) errors.push(`Snapshot row count mismatch for ${tableName}.`);
      if (contents[tableName].some((row) => row.userId !== manifest.principalId)) errors.push(`Snapshot contains rows owned by another principal in ${tableName}.`);
    }
    const overallChecksum = await canonicalFingerprint({ contents, checksums: manifest.checksums, principalId: manifest.principalId, migrationVersion: manifest.migrationVersion });
    if (overallChecksum !== manifest.overallChecksum) errors.push('Snapshot manifest checksum mismatch.');
    return { valid: errors.length === 0, errors, manifest };
  }

  async validateTargetUnchanged(snapshotId) {
    const validation = await this.validate(snapshotId);
    if (!validation.valid) return validation;
    const { manifest } = validation;
    const errors = [];
    for (const tableName of manifest.tableNames || []) {
      const current = await this.db.table(tableName).where('userId').equals(manifest.principalId).toArray();
      if (await canonicalFingerprint(current) !== manifest.checksums[tableName]) {
        errors.push(`Target table ${tableName} changed after snapshot creation.`);
      }
    }
    return { valid: errors.length === 0, errors, manifest };
  }

  async restore(snapshotId, { verifyCurrent = false, expectedCurrentChecksums = null, extraTables = [], onRestored = null } = {}) {
    const validation = await this.validate(snapshotId);
    if (!validation.valid) throw new Error(`Cannot restore invalid snapshot: ${validation.errors.join('; ')}`);
    const { manifest, contents } = await this.load(snapshotId);
    const tableNames = manifest.tableNames || Object.values(MIGRATION_DOMAIN);
    const tables = tableNames.map((name) => this.db.table(name));
    const snapshots = this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS);

    await this.db.transaction('rw', ...tables, snapshots, ...extraTables, async () => {
      for (const tableName of tableNames) {
        const table = this.db.table(tableName);
        if (expectedCurrentChecksums?.[tableName]) {
          const before = await table.where('userId').equals(manifest.principalId).toArray();
          const currentChecksum = await canonicalFingerprint(before);
          if (currentChecksum !== expectedCurrentChecksums[tableName]) {
            throw new Error(`Rollback blocked because ${tableName} changed after the migration snapshot.`);
          }
        }
        const current = await table.where('userId').equals(manifest.principalId).primaryKeys();
        if (current.length) await table.bulkDelete(current);
        if (contents[tableName].length) await table.bulkPut(contents[tableName]);
      }
      const latestManifest = await snapshots.get(snapshotId);
      await snapshots.put({ ...latestManifest, status: 'restored', restoredAt: this.now().toISOString() });
      if (onRestored) await onRestored({ manifest, contents });
    });

    if (verifyCurrent) {
      const after = await this.load(snapshotId);
      for (const tableName of tableNames) {
        const currentRows = await this.db.table(tableName).where('userId').equals(manifest.principalId).toArray();
        const restoredChecksum = await canonicalFingerprint(currentRows);
        if (restoredChecksum !== manifest.checksums[tableName]) throw new Error(`Restoration verification failed for ${tableName}.`);
      }
      if (!after) throw new Error('Snapshot disappeared after restore.');
    }
    return { restored: true, snapshotId, principalId: manifest.principalId, tableNames };
  }

  async retain(snapshotId, status = 'verified') {
    const table = this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS);
    const snapshot = await table.get(snapshotId);
    if (!snapshot || snapshot.kind !== 'manifest') throw new Error('Snapshot does not exist.');
    await table.put({ ...snapshot, status, retainedAt: this.now().toISOString() });
    return { ...snapshot, status };
  }

  async expireEligible(now = this.now()) {
    const table = this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS);
    const runs = this.db.table(DATABASE_TABLES.MIGRATION_RUNS);
    const manifests = await table.where('status').equals('verified').toArray().catch(() => []);
    const eligible = [];
    for (const entry of manifests) {
      if (entry.kind !== 'manifest' || !entry.expiresAt || new Date(entry.expiresAt) > now) continue;
      const run = await runs.get(entry.runId);
      if (['Completed', 'RolledBack'].includes(run?.state)) eligible.push(entry);
    }
    const expiredIds = eligible.map((entry) => entry.id);
    if (!expiredIds.length) return [];
    const audit = this.db.table(DATABASE_TABLES.MIGRATION_AUDIT);
    await this.db.transaction('rw', table, runs, audit, async () => {
      for (const candidate of eligible) {
        const snapshotId = candidate.id;
        const manifest = await table.get(snapshotId);
        if (!manifest || manifest.status !== 'verified') continue;
        const run = await runs.get(manifest.runId);
        if (!['Completed', 'RolledBack'].includes(run?.state)) continue;
        const parts = await table.where('snapshotId').equals(snapshotId).primaryKeys();
        await table.bulkDelete(parts);
        await table.put({ ...manifest, status: 'expired', expiredAt: now.toISOString(), checksums: manifest.checksums, overallChecksum: manifest.overallChecksum });
        await audit.add({
          id: newId(), runId: manifest.runId, principalId: manifest.principalId,
          eventType: 'snapshot-expired', occurredAt: now.toISOString(),
          migrationVersion: manifest.migrationVersion, source: null,
          outcome: 'snapshot-expired', conflictStatus: 'none', snapshotId,
        });
      }
    });
    return expiredIds;
  }
}

export default MigrationSnapshotManager;
