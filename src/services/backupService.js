import { db } from '../database/index.js';
import { DATABASE_SCHEMA_VERSION } from '../database/schema.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { normalizeBackupArtifact, normalizeManifest } from '../utils/backupManifest.js';

const stableStringify = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());

const getRowLookupValue = (row, table) => {
  if (!row || typeof row !== 'object') return null;
  const primaryKeyPath = table?.schema?.primKey?.keyPath;
  if (primaryKeyPath && row[primaryKeyPath] !== undefined) return row[primaryKeyPath];
  if (row.id !== undefined) return row.id;
  if (row.key !== undefined) return row.key;
  return null;
};

const normalizeDomainRows = (rows = []) => rows.map((row) => ({ ...row }));

const hashPayload = async (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex;
};

const canonicalDomainPayload = (domain, rows) => ({
  domain,
  rows: normalizeDomainRows(rows),
  rowCount: rows.length,
});

export const createBackupArtifact = async ({ database = db, principalId, reason = 'manual-local-backup' } = {}) => {
  const tables = [
    DATABASE_TABLES.MOMENTS,
    DATABASE_TABLES.ACTIVITIES,
    DATABASE_TABLES.MEMORIES,
    DATABASE_TABLES.ATTACHMENTS,
    DATABASE_TABLES.EXPENSES,
    DATABASE_TABLES.INCOMES,
    DATABASE_TABLES.SETTINGS,
    DATABASE_TABLES.CODE_LISTS,
    DATABASE_TABLES.METADATA,
    DATABASE_TABLES.MIGRATION_AUDIT,
  ];

  const payload = {};
  for (const tableName of tables) {
    const rows = await database.table(tableName).toArray();
    const filteredRows = principalId
      ? rows.filter((row) => row.userId === principalId || !row.userId)
      : rows;
    payload[tableName] = filteredRows;
  }

  const manifest = normalizeManifest({
    manifestVersion: 1,
    backupId: globalThis.crypto?.randomUUID?.() || `backup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    schemaVersion: DATABASE_SCHEMA_VERSION,
    appVersion: 'LifeHub-local-backup',
    principalScope: principalId || 'all',
    environment: 'local',
    fileFormat: 'lifehub-backup-v1',
    domainSummary: Object.entries(payload).map(([domain, rows]) => ({
      domain,
      recordCount: rows.length,
    })),
    recordCounts: Object.fromEntries(Object.entries(payload).map(([domain, rows]) => [domain, rows.length])),
    reason,
  });

  const artifact = normalizeBackupArtifact({
    artifactVersion: 1,
    artifactId: manifest.backupId,
    appName: 'LifeHub',
    createdAt: manifest.createdAt,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    environment: 'local',
    principalScope: principalId || 'all',
    exportType: 'local-backup',
    manifest,
    payload,
  });

  artifact.checksum = await hashPayload({ manifest, payload });
  return artifact;
};

export const verifyBackupArtifactIntegrity = async (artifact) => {
  if (!artifact || !artifact.manifest || !artifact.payload) {
    return { valid: false, errors: ['Invalid backup artifact.'], recordCount: 0 };
  }

  const payloadChecksum = await hashPayload({ manifest: artifact.manifest, payload: artifact.payload });
  const valid = artifact.checksum === payloadChecksum;

  const recordCount = Object.values(artifact.payload || {}).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0);

  return {
    valid,
    recordCount,
    errors: valid ? [] : ['Backup checksum mismatch detected.'],
    calculatedChecksum: payloadChecksum,
  };
};

export const validateBackupArtifact = async (artifact) => {
  const errors = [];
  if (!artifact || typeof artifact !== 'object') {
    return { valid: false, errors: ['Backup artifact is missing.'] };
  }

  if (!artifact.manifest || typeof artifact.manifest !== 'object') {
    errors.push('Backup manifest missing.');
  }
  if (!artifact.payload || typeof artifact.payload !== 'object') {
    errors.push('Backup payload missing.');
  }
  if (artifact.databaseSchemaVersion !== DATABASE_SCHEMA_VERSION) {
    errors.push(`Backup schema version ${String(artifact.databaseSchemaVersion)} does not match the installed schema version ${DATABASE_SCHEMA_VERSION}.`);
  }

  const verification = await verifyBackupArtifactIntegrity(artifact);
  if (!verification.valid) errors.push(...verification.errors);

  return { valid: errors.length === 0, errors, verification };
};

export const previewRestoreBackup = async (artifact, { database = db } = {}) => {
  const validation = await validateBackupArtifact(artifact);
  if (!validation.valid) {
    return {
      canRestore: false,
      summary: { inserted: 0, conflicted: 0, skipped: 0 },
      conflicts: validation.errors.map((error) => ({ reason: 'validation', message: error })),
      errors: validation.errors,
    };
  }

  const conflicts = [];
  const summary = { inserted: 0, conflicted: 0, skipped: 0 };

  for (const [tableName, rows] of Object.entries(artifact.payload || {})) {
    const table = database.table(tableName);
    if (!table) {
      conflicts.push({ domain: tableName, reason: 'missing-table', message: 'Table is unavailable in the current database.' });
      continue;
    }

    for (const row of rows) {
      const lookupValue = getRowLookupValue(row, table);
      if (lookupValue === null || lookupValue === undefined) {
        summary.conflicted += 1;
        conflicts.push({
          domain: tableName,
          recordId: row?.id || row?.key || null,
          reason: 'missing-primary-key',
          message: `Backup row in ${tableName} does not include a usable primary key for validation.`,
        });
        continue;
      }

      const existing = await table.get(lookupValue);
      if (!existing) {
        summary.inserted += 1;
        continue;
      }

      if (stableStringify(existing) === stableStringify(row)) {
        summary.skipped += 1;
        continue;
      }

      summary.conflicted += 1;
      conflicts.push({
        domain: tableName,
        recordId: row?.id || row?.key || lookupValue,
        reason: 'id-conflict',
        message: `Existing record ${String(row?.id || row?.key || lookupValue)} differs from the backup content.`,
      });
    }
  }

  return {
    canRestore: conflicts.length === 0,
    summary,
    conflicts,
    errors: conflicts.length ? conflicts.map((conflict) => conflict.message) : [],
  };
};

export const restoreBackupArtifact = async (artifact, { database = db, allowOverwrite = false, force = false } = {}) => {
  const validation = await validateBackupArtifact(artifact);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const preview = await previewRestoreBackup(artifact, { database });
  if (!preview.canRestore && !force && !allowOverwrite) {
    const error = new Error(preview.errors.join('; ') || 'Restore preview detected conflicts or invalid records.');
    error.preview = preview;
    throw error;
  }

  const snapshot = {};
  for (const [tableName, rows] of Object.entries(artifact.payload || {})) {
    const table = database.table(tableName);
    if (!table) continue;
    snapshot[tableName] = await table.toArray();
  }

  try {
    await database.transaction('rw', ...Object.keys(artifact.payload || {}).map((name) => database.table(name)), async () => {
      for (const [tableName, rows] of Object.entries(artifact.payload || {})) {
        const table = database.table(tableName);
        if (!table) continue;

        for (const row of rows) {
          const lookupValue = getRowLookupValue(row, table);
          if (lookupValue === null || lookupValue === undefined) {
            throw new Error(`Backup row in ${tableName} does not include a usable primary key for restore.`);
          }

          const existing = await table.get(lookupValue);
          const same = existing && stableStringify(existing) === stableStringify(row);
          if (same) continue;
          if (existing && !allowOverwrite && !force) {
            throw new Error(`Restore conflict for ${tableName}:${String(row?.id || row?.key || lookupValue)}`);
          }
          await table.put(row);
        }
      }
    });

    return { success: true, preview, restored: true, snapshot };
  } catch (error) {
    for (const [tableName, rows] of Object.entries(snapshot)) {
      const table = database.table(tableName);
      if (!table) continue;
      await table.clear();
      if (rows.length) await table.bulkAdd(rows);
    }
    error.snapshot = snapshot;
    throw error;
  }
};

export const localBackupService = {
  createBackupArtifact,
  validateBackupArtifact,
  verifyBackupArtifactIntegrity,
  previewRestoreBackup,
  restoreBackupArtifact,
};
