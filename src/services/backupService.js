import { db } from '../database/index.js';
import { DATABASE_SCHEMA_VERSION } from '../database/schema.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { codeListRepository, settingsRepository } from '../repositories/index.js';
import { normalizeBackupArtifact, normalizeManifest } from '../utils/backupManifest.js';
import { normalizeCodeListIdentityValue } from '../utils/codeLists.js';

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

const PRINCIPAL_SCOPED_TABLES = new Set([
  DATABASE_TABLES.MOMENTS,
  DATABASE_TABLES.ACTIVITIES,
  DATABASE_TABLES.MEMORIES,
  DATABASE_TABLES.ATTACHMENTS,
  DATABASE_TABLES.EXPENSES,
  DATABASE_TABLES.INCOMES,
  DATABASE_TABLES.SETTINGS,
  DATABASE_TABLES.CODE_LISTS,
]);

const remapArtifactPrincipal = async (artifact, targetPrincipalId) => {
  if (!targetPrincipalId || artifact.principalScope === targetPrincipalId) return artifact;
  const payload = Object.fromEntries(Object.entries(artifact.payload || {}).map(([tableName, rows]) => [
    tableName,
    PRINCIPAL_SCOPED_TABLES.has(tableName)
      ? rows.map((row) => (row.userId ? { ...row, userId: targetPrincipalId } : row))
      : rows,
  ]));
  const manifest = { ...artifact.manifest, principalScope: targetPrincipalId };
  const mapped = { ...artifact, principalScope: targetPrincipalId, manifest, payload };
  mapped.checksum = await hashPayload({ manifest, payload });
  return mapped;
};

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

export const previewRestoreBackup = async (artifact, { database = db, targetPrincipalId } = {}) => {
  const validation = await validateBackupArtifact(artifact);
  if (!validation.valid) {
    return {
      canRestore: false,
      summary: { inserted: 0, conflicted: 0, skipped: 0 },
      conflicts: validation.errors.map((error) => ({ reason: 'validation', message: error })),
      errors: validation.errors,
    };
  }

  const restoreArtifact = await remapArtifactPrincipal(artifact, targetPrincipalId);
  const conflicts = [];
  const summary = { inserted: 0, conflicted: 0, skipped: 0 };

  for (const [tableName, rows] of Object.entries(restoreArtifact.payload || {})) {
    if (tableName === DATABASE_TABLES.METADATA) continue;
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
          reason: 'missing-primary-key',
          message: `A record in ${tableName} could not be identified.`,
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
        reason: 'id-conflict',
        message: `A ${tableName} record differs from the version in this backup.`,
      });
    }
  }

  return {
    canRestore: conflicts.length === 0,
    summary,
    conflicts,
    errors: conflicts.length ? conflicts.map((conflict) => conflict.message) : [],
    principalMapping: targetPrincipalId && artifact.principalScope !== targetPrincipalId
      ? { from: artifact.principalScope, to: targetPrincipalId }
      : null,
  };
};

const resolveRestoreConflicts = async (artifact, { database, targetPrincipalId, conflictResolution }) => {
  const mapped = await remapArtifactPrincipal(artifact, targetPrincipalId);
  if (conflictResolution === 'use-backup-version') return mapped;
  if (!['keep-existing', 'merge-safe'].includes(conflictResolution)) return mapped;

  const payload = { ...mapped.payload };
  for (const [tableName, rows] of Object.entries(payload)) {
    if (tableName === DATABASE_TABLES.METADATA) continue;
    const table = database.table(tableName);
    if (!table) continue;

    if (tableName === DATABASE_TABLES.SETTINGS) {
      const retained = [];
      for (const row of rows) {
        if (!row?.userId || !row?.key) continue;
        const existing = await settingsRepository.getByKey(row.userId, row.key);
        if (!existing || stableStringify(existing.value) === stableStringify(row.value)) retained.push(row);
      }
      payload[tableName] = retained;
      continue;
    }

    if (tableName === DATABASE_TABLES.CODE_LISTS) {
      const incomingGroups = new Map();
      for (const row of rows) {
        const key = `${row.userId}::${row.listKey}`;
        const group = incomingGroups.get(key) || [];
        group.push(row);
        incomingGroups.set(key, group);
      }
      const mergedRows = [];
      for (const [groupKey, incomingRows] of incomingGroups) {
        const [userId, listKey] = groupKey.split('::');
        const currentRows = await table.where('[userId+listKey]').equals([userId, listKey]).toArray();
        const byValue = new Map(currentRows.map((row) => [normalizeCodeListIdentityValue(row.entryValue ?? row.value), row]));
        for (const row of incomingRows) {
          const logicalKey = normalizeCodeListIdentityValue(row.entryValue ?? row.value);
          if (!byValue.has(logicalKey)) byValue.set(logicalKey, row);
        }
        mergedRows.push(...byValue.values());
      }
      payload[tableName] = mergedRows;
      continue;
    }

    const retained = [];
    for (const row of rows) {
      const lookupValue = getRowLookupValue(row, table);
      if (lookupValue === null || lookupValue === undefined) continue;
      const existing = await table.get(lookupValue);
      if (!existing || stableStringify(existing) === stableStringify(row)) retained.push(row);
    }
    payload[tableName] = retained;
  }
  return { ...mapped, payload };
};

export const restoreBackupArtifact = async (artifact, { database = db, allowOverwrite = false, force = false, targetPrincipalId, conflictResolution } = {}) => {
  const overwriteAllowed = allowOverwrite || conflictResolution === 'use-backup-version';
  const validation = await validateBackupArtifact(artifact);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const restoreArtifact = await resolveRestoreConflicts(artifact, { database, targetPrincipalId, conflictResolution });
  const preview = await previewRestoreBackup(artifact, { database, targetPrincipalId });
  if (!preview.canRestore && !force && !allowOverwrite && !conflictResolution) {
    const error = new Error(preview.errors.join('; ') || 'Restore preview detected conflicts or invalid records.');
    error.preview = preview;
    throw error;
  }

  const snapshot = {};
  for (const [tableName, rows] of Object.entries(restoreArtifact.payload || {})) {
    const table = database.table(tableName);
    if (!table) continue;
    snapshot[tableName] = await table.toArray();
  }

  try {
    for (const [tableName, rows] of Object.entries(restoreArtifact.payload || {})) {
      if (tableName === DATABASE_TABLES.METADATA) continue;
      if (tableName === DATABASE_TABLES.SETTINGS) {
        for (const row of rows) {
          if (!row?.userId || !row?.key) continue;
          const existing = await settingsRepository.getByKey(row.userId, row.key);
          const same = existing && stableStringify(existing.value) === stableStringify(row.value);
          if (same) continue;
          if (existing && !overwriteAllowed && !force) {
            throw new Error(`Restore conflict for ${tableName}:${String(row?.key || row?.id)}`);
          }
          if (existing) {
            await settingsRepository.updateOne(row.userId, row.key, row.value);
          } else {
            await settingsRepository.setOne(row.userId, row.key, row.value);
          }
        }
        continue;
      }

      if (tableName === DATABASE_TABLES.CODE_LISTS) {
        const groups = new Map();
        for (const row of rows) {
          if (!row?.userId || !row?.listKey) continue;
          const logicalKey = `${row.userId}::${row.listKey}`;
          const group = groups.get(logicalKey) || [];
          group.push(row);
          groups.set(logicalKey, group);
        }

        for (const [logicalKey, groupRows] of groups.entries()) {
          const [userId, listKey] = logicalKey.split('::');
          const deduped = new Map();
          for (const row of groupRows) {
            const candidate = String(row.entryValue ?? row.value ?? '').trim();
            if (!candidate) continue;
            const normalized = normalizeCodeListIdentityValue(candidate);
            if (!deduped.has(normalized)) {
              deduped.set(normalized, {
                ...row,
                entryValue: candidate,
                label: row.label || candidate,
                active: row.active ?? row.isActive ?? true,
                isActive: row.isActive ?? row.active ?? true,
                canGenerateGreetingCards: row.canGenerateGreetingCards ?? row.generateGreetingCards ?? true,
                greetingTemplate: typeof row.greetingTemplate === 'string' ? row.greetingTemplate : '',
                showInDashboardUpcoming: row.showInDashboardUpcoming ?? row.showInDashboard ?? true,
              });
            }
          }

          const entries = [...deduped.values()].map((row) => ({
            value: String(row.entryValue ?? '').trim(),
            label: String(row.label ?? row.entryValue ?? '').trim() || String(row.entryValue ?? '').trim(),
            active: row.active !== false && row.isActive !== false,
            isActive: row.isActive !== false && row.active !== false,
            canGenerateGreetingCards: row.canGenerateGreetingCards ?? row.generateGreetingCards ?? true,
            greetingTemplate: typeof row.greetingTemplate === 'string' ? row.greetingTemplate : '',
            showInDashboardUpcoming: row.showInDashboardUpcoming ?? row.showInDashboard ?? true,
          }));

          if (entries.length) {
            await codeListRepository.setList(userId, listKey, entries);
          }
        }
        continue;
      }
    }

    const transactionTables = Object.keys(restoreArtifact.payload || {}).filter((name) => name !== DATABASE_TABLES.METADATA && name !== DATABASE_TABLES.SETTINGS && name !== DATABASE_TABLES.CODE_LISTS).map((name) => database.table(name));
    if (transactionTables.length) {
      await database.transaction('rw', ...transactionTables, async () => {
        for (const [tableName, rows] of Object.entries(restoreArtifact.payload || {})) {
          if (tableName === DATABASE_TABLES.METADATA) continue;
          if (tableName === DATABASE_TABLES.SETTINGS || tableName === DATABASE_TABLES.CODE_LISTS) continue;
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
            if (existing && !overwriteAllowed && !force) {
              throw new Error(`Restore conflict for ${tableName}:${String(row?.id || row?.key || lookupValue)}`);
            }
            await table.put(row);
          }
        }
      });
    }

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
