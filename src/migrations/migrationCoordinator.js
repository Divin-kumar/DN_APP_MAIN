import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { MigrationAuditLog } from './migrationAuditLog.js';
import { MIGRATION_DOMAIN, MIGRATION_SOURCE, MIGRATION_STATE, MIGRATION_VERSION } from './migrationConstants.js';
import { buildMigrationDatasets } from './migrationDatasetBuilder.js';
import { deterministicMigrationId, canonicalFingerprint } from './migrationIdentity.js';
import { MigrationLock } from './migrationLock.js';
import { getOrCreateGuestPrincipalId } from './migrationPrincipal.js';
import { buildImportPreview } from './migrationPreview.js';
import { createPreviewToken } from './migrationPreviewToken.js';
import { getMigrationDefinition } from './migrationRegistry.js';
import { MigrationRollbackManager } from './migrationRollbackManager.js';
import { MigrationSnapshotManager } from './migrationSnapshotManager.js';
import { transitionMigrationRun } from './migrationStateMachine.js';
import { readFirebaseMigrationSources, readGuestMigrationSources, readSettingsMigrationSource } from './migrationSources.js';
import { normalizeCodeListIdentityValue } from '../utils/codeLists.js';

const createId = () => globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ACTIVE_STATES = new Set([
  MIGRATION_STATE.NOT_STARTED,
  MIGRATION_STATE.CHECKING_SOURCE,
  MIGRATION_STATE.SNAPSHOT_CREATED,
  MIGRATION_STATE.IMPORT_PREVIEW,
  MIGRATION_STATE.IMPORTING,
  MIGRATION_STATE.VALIDATING,
  MIGRATION_STATE.COMMIT_READY,
]);

export class MigrationCoordinator {
  constructor({
    database = db,
    registry = { getMigrationDefinition },
    auditLog = new MigrationAuditLog({ database }),
    snapshotManager = new MigrationSnapshotManager({ database }),
    rollbackManager = new MigrationRollbackManager({ database, snapshotManager, auditLog }),
    lock = new MigrationLock({ database }),
    sourceReaders = {
      firebase: readFirebaseMigrationSources,
      guest: readGuestMigrationSources,
      settings: readSettingsMigrationSource,
    },
    now = () => new Date(),
  } = {}) {
    this.db = database;
    this.registry = registry;
    this.auditLog = auditLog;
    this.snapshotManager = snapshotManager;
    this.rollbackManager = rollbackManager;
    this.lock = lock;
    this.sourceReaders = sourceReaders;
    this.now = now;
  }

  async getRun(runId) {
    if (!runId) return null;
    return this.db.table(DATABASE_TABLES.MIGRATION_RUNS).get(runId);
  }

  async getHistory(principalId, options) {
    return this.auditLog.getHistory(principalId, options);
  }

  async _readSources(principalId, selection) {
    const sources = {};
    if (selection?.firebase) {
      const result = await this.sourceReaders.firebase(principalId);
      if (!result?.complete) throw new Error('Firebase source scan did not complete.');
      sources.firebase = result;
    }
    if (selection?.guest) {
      const result = await this.sourceReaders.guest();
      if (!result?.complete) throw new Error('Guest source scan did not complete.');
      sources.guest = result;
    }
    if (selection?.settings) {
      const result = await this.sourceReaders.settings();
      if (!result?.complete) throw new Error('Settings source scan did not complete.');
      sources.settings = result;
    }
    if (!Object.keys(sources).length) throw new Error('Select at least one migration source.');
    return sources;
  }

  async _sourceFingerprint(sources) {
    const stable = {};
    for (const [name, source] of Object.entries(sources)) {
      stable[name] = source.raw || source.datasets;
    }
    return canonicalFingerprint(stable);
  }

  async _transition(run, nextState, cause) {
    const at = this.now().toISOString();
    const nextRun = transitionMigrationRun(run, nextState, { cause }, at);
    await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).put(nextRun);
    await this.auditLog.recordTransition(nextRun, { from: run.state, to: nextState, cause });
    return nextRun;
  }

  async _markFailed(runId, error, stage) {
    const runs = this.db.table(DATABASE_TABLES.MIGRATION_RUNS);
    const run = await runs.get(runId);
    if (!run || !ACTIVE_STATES.has(run.state)) return run;
    let failed = transitionMigrationRun(run, MIGRATION_STATE.FAILED, { cause: error?.message || String(error) }, this.now().toISOString());
    failed = { ...failed, failure: { stage: stage || run.state, code: error?.code || 'MIGRATION_FAILED', message: String(error?.message || error).slice(0, 500), failedAt: this.now().toISOString() } };
    await runs.put(failed);
    await this.auditLog.recordTransition(failed, { from: run.state, to: MIGRATION_STATE.FAILED, cause: error?.message || String(error) });
    await this.auditLog.recordFailure(failed, error, { stage, mutationPossible: false });
    return failed;
  }

  async createPreview({ principalId = null, principalType = 'user', sourceSelection, migrationVersion = MIGRATION_VERSION, guestImportApproved = false } = {}) {
    if (!principalId && principalType === 'guest') principalId = await getOrCreateGuestPrincipalId(this.db);
    if (!principalId) throw new Error('A principalId is required to create a migration preview.');
    if (sourceSelection?.firebase && principalType !== 'user') throw new Error('Firebase migration requires an authenticated user principal.');
    if (sourceSelection?.guest && principalType === 'user' && !guestImportApproved) {
      throw new Error('Guest data can be imported into an account only after explicit approval.');
    }
    const definition = this.registry.getMigrationDefinition(migrationVersion);
    if (!definition) throw new Error(`Migration version ${migrationVersion} is not registered.`);

    const runId = createId();
    const now = this.now().toISOString();
        const exists = domain === MIGRATION_DOMAIN.CODE_LISTS
          ? targetRows.some((row) => row.listKey === record.listKey && normalizeCodeListIdentityValue(row.entryValue ?? row.value) === normalizeCodeListIdentityValue(record.entryValue ?? record.value))
      principalId,
      principalType,
      migrationVersion,
      sourceSelection: { ...sourceSelection },
      state: MIGRATION_STATE.NOT_STARTED,
      startedAt: now,
      updatedAt: now,
      snapshotId: null,
      stateHistory: [{ from: null, to: MIGRATION_STATE.NOT_STARTED, at: now }],
    };
    await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).add(run);
    await this.auditLog.beginRun(run);

    try {
      await this.lock.acquire(principalId, runId);
      run = await this._transition(run, MIGRATION_STATE.CHECKING_SOURCE, 'source-check-started');
      const sources = await this._readSources(principalId, sourceSelection || {});
      const sourceFingerprint = await this._sourceFingerprint(sources);
      run = { ...run, sourceFingerprint, sourceSummary: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, {
        datasets: Object.fromEntries(Object.entries(value.datasets || {}).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : Object.keys(rows || {}).length])),
        keyPresence: value.keyPresence || null,
      }])) };
      await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).put(run);

      const snapshot = await this.snapshotManager.create({ runId, principalId, migrationVersion });
      run = { ...run, snapshotId: snapshot.id };
      await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).put(run);
      run = await this._transition(run, MIGRATION_STATE.SNAPSHOT_CREATED, 'verified-pre-import-snapshot-created');

      const datasets = buildMigrationDatasets(sources, principalId);
      const preview = await buildImportPreview({ datasets, principalId, migrationVersion, database: this.db });
      const previewToken = await createPreviewToken({ runId, principalId, sourceFingerprint, counts: preview.counts, validation: preview.validation });
      await this.auditLog.appendEvent({
        runId, principalId, eventType: 'import-preview-generated',
        source: sourceSelection, migrationVersion,
        outcome: 'preview-ready', conflictStatus: preview.conflicts.length ? 'unresolved' : 'none',
        counts: preview.counts, findingCount: preview.validation.findings.length,
      });
      for (const duplicate of preview.duplicates) {
        await this.auditLog.recordDecision({
          runId, principalId,
          source: duplicate.row.source || MIGRATION_SOURCE.DEXIE,
          originalId: duplicate.row.id,
          migrationVersion,
          outcome: 'duplicate', conflictStatus: 'resolved',
          domain: duplicate.domain, rule: duplicate.rule,
          retainedTargetId: duplicate.matched?.id || null,
        });
      }
      for (const conflict of preview.conflicts) {
        await this.auditLog.recordDecision({
          runId, principalId,
          source: conflict.row.source || 'legacy',
          originalId: conflict.row.id,
          migrationVersion,
          outcome: 'conflict', conflictStatus: 'unresolved',
          domain: conflict.domain, rule: conflict.rule,
          candidateTargetId: conflict.matched?.id || null,
        });
      }
      for (const rejected of datasets.rawFindings || []) {
        await this.auditLog.recordDecision({
          runId, principalId,
          source: rejected.source || 'legacy',
          originalId: rejected.recordId,
          migrationVersion,
          outcome: 'rejected', conflictStatus: 'unresolved',
          domain: rejected.domain, rule: rejected.ruleId,
          sourcePath: rejected.sourcePath,
        });
      }
      for (const item of preview.validation.findings.filter((finding) => finding.severity === 'error' && finding.recordId)) {
        const sourceEntry = datasets[item.domain]?.find((entry) => entry.record?.id === item.recordId);
        if (sourceEntry) {
          await this.auditLog.recordDecision({
            runId, principalId,
            source: sourceEntry.lineage.source,
            originalId: sourceEntry.lineage.originalId,
            migrationVersion,
            outcome: 'rejected', conflictStatus: 'unresolved',
            domain: item.domain, rule: item.ruleId,
            sourcePath: sourceEntry.lineage.sourcePath,
          });
        }
      }
      run = {
        ...run,
        previewToken,
        previewCreatedAt: this.now().toISOString(),
        previewCounts: preview.counts,
        previewValid: preview.valid,
        previewFindings: preview.validation.findings,
        previewDuplicateCount: preview.duplicates.length,
        previewConflictCount: preview.conflicts.length,
      };
      await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).put(run);
      run = await this._transition(run, MIGRATION_STATE.IMPORT_PREVIEW, 'preview-ready-no-domain-writes-performed');
      return {
        runId,
        principalId,
        state: run.state,
        previewToken,
        counts: preview.counts,
        duplicates: preview.duplicates,
        conflicts: preview.conflicts,
        findings: preview.validation.findings,
        valid: preview.valid,
        sourceFingerprint,
        snapshotId: snapshot.id,
      };
    } catch (error) {
      await this._markFailed(runId, error, 'create-preview');
      throw error;
    } finally {
      await this.lock.release(principalId, runId);
    }
  }

  async _stage(run, datasets) {
    const staging = this.db.table(DATABASE_TABLES.MIGRATION_STAGING);
    const rows = [];
    for (const [domain, entries] of Object.entries(datasets)) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, index) => rows.push({
        id: `${run.id}:${domain}:${index}`,
        runId: run.id,
        principalId: run.principalId,
        domain,
        record: entry.record,
        lineage: entry.lineage,
        createdAt: this.now().toISOString(),
      }));
    }
    await this.db.transaction('rw', staging, async () => {
      const keys = await staging.where('runId').equals(run.id).primaryKeys();
      if (keys.length) await staging.bulkDelete(keys);
      if (rows.length) await staging.bulkPut(rows);
    });
    return rows.length;
  }

  async _verifyCommitted(run, recordsByDomain) {
    const definition = this.registry.getMigrationDefinition(run.migrationVersion);
    const errors = [];
    for (const [domain, records] of Object.entries(recordsByDomain)) {
      const descriptor = definition.domains[domain];
      const targetRows = await this.db.table(descriptor.table).where('userId').equals(run.principalId).toArray();
      for (const record of records) {
        const exists = domain === MIGRATION_DOMAIN.CODE_LISTS
          ? targetRows.some((row) => row.listKey === record.listKey && row.entryValue === record.entryValue)
          : targetRows.some((row) => row.id === record.id);
        if (!exists) errors.push(`${domain} record ${record.id} is missing after commit.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async commit(runId, approvalToken) {
    const runs = this.db.table(DATABASE_TABLES.MIGRATION_RUNS);
    let run = await runs.get(runId);
    if (!run || run.state !== MIGRATION_STATE.IMPORT_PREVIEW) throw new Error('Migration run is not awaiting preview approval.');
    if (!approvalToken || approvalToken !== run.previewToken) throw new Error('Preview approval token is invalid.');
    if (!run.previewValid) throw new Error('This preview has blocking validation findings or unresolved conflicts and cannot be committed.');
    await this.lock.acquire(run.principalId, run.id);
    let transactionCommitted = false;

    try {
      await this.lock.refresh(run.principalId, run.id);
      const sources = await this._readSources(run.principalId, run.sourceSelection);
      const sourceFingerprint = await this._sourceFingerprint(sources);
      if (sourceFingerprint !== run.sourceFingerprint) throw new Error('Migration source changed after preview. Create a new preview before committing.');
      const targetCheck = await this.snapshotManager.validateTargetUnchanged(run.snapshotId);
      if (!targetCheck.valid) throw new Error(`Migration target changed after preview: ${targetCheck.errors.join('; ')}`);

      run = await this._transition(run, MIGRATION_STATE.IMPORTING, 'approved-preview-import-started');
      const allDatasets = buildMigrationDatasets(sources, run.principalId);
      const prepared = await buildImportPreview({ datasets: allDatasets, principalId: run.principalId, migrationVersion: run.migrationVersion, database: this.db });
      if (!prepared.valid) throw new Error('Import validation or duplicate-conflict gates failed. No canonical data was written.');
      await this._stage(run, prepared.datasets);

      run = await this._transition(run, MIGRATION_STATE.VALIDATING, 'staged-data-validation-started');
      if (!prepared.validation.valid) throw new Error('Migration validation failed. No canonical data was written.');
      run = await this._transition(run, MIGRATION_STATE.COMMIT_READY, 'all-validation-gates-passed');

      const definition = this.registry.getMigrationDefinition(run.migrationVersion);
      const domainTables = definition.domainOrder.map((domain) => this.db.table(definition.domains[domain].table));
      const migrationTables = [
        runs,
        this.db.table(DATABASE_TABLES.MIGRATION_AUDIT),
        this.db.table(DATABASE_TABLES.MIGRATION_STAGING),
        this.db.table(DATABASE_TABLES.MIGRATION_SNAPSHOTS),
        this.db.table(DATABASE_TABLES.MIGRATION_LOCKS),
      ];
      const importedRecords = Object.fromEntries(definition.domainOrder.map((domain) => [domain, prepared.datasets[domain].map((entry) => entry.record)]));

      await this.db.transaction('rw', ...domainTables, ...migrationTables, async () => {
        const heldLock = await this.db.table(DATABASE_TABLES.MIGRATION_LOCKS).get(run.principalId);
        if (!heldLock || heldLock.runId !== run.id || new Date(heldLock.expiresAt) <= this.now()) throw new Error('Migration lock expired before commit.');
        const stillUnchanged = await this.snapshotManager.validateTargetUnchanged(run.snapshotId);
        if (!stillUnchanged.valid) throw new Error(`Migration target changed before atomic commit: ${stillUnchanged.errors.join('; ')}`);

        for (const domain of definition.domainOrder) {
          const records = importedRecords[domain];
          if (records.length) await definition.domains[domain].write(run.principalId, records);
        }

        const committedChecksums = {};
        for (const domain of definition.domainOrder) {
          const descriptor = definition.domains[domain];
          const tableRows = await this.db.table(descriptor.table).where('userId').equals(run.principalId).toArray();
          committedChecksums[descriptor.table] = await canonicalFingerprint(tableRows);
        }

        for (const domain of definition.domainOrder) {
          for (const entry of prepared.datasets[domain]) {
            await this.auditLog.recordDecision({
              runId: run.id,
              principalId: run.principalId,
              source: entry.lineage.source,
              originalId: entry.lineage.originalId,
              migrationVersion: run.migrationVersion,
              outcome: 'imported',
              conflictStatus: 'none',
              domain,
              targetId: entry.record.id,
              sourcePath: entry.lineage.sourcePath,
            });
          }
        }
        const completed = transitionMigrationRun(run, MIGRATION_STATE.COMPLETED, { cause: 'atomic-import-committed' }, this.now().toISOString());
        const finalRun = {
          ...completed,
          completedAt: this.now().toISOString(),
          committedChecksums,
          resultCounts: run.previewCounts,
          sourceFingerprint,
        };
        await runs.put(finalRun);
        await this.auditLog.recordTransition(finalRun, { from: MIGRATION_STATE.COMMIT_READY, to: MIGRATION_STATE.COMPLETED, cause: 'atomic-import-committed' });
        await this.auditLog.appendEvent({
          runId: run.id, principalId: run.principalId, eventType: 'run-completed',
          source: run.sourceSelection, migrationVersion: run.migrationVersion,
          outcome: 'completed', conflictStatus: 'none', resultCounts: run.previewCounts,
        });
        const staging = this.db.table(DATABASE_TABLES.MIGRATION_STAGING);
        const stagingKeys = await staging.where('runId').equals(run.id).primaryKeys();
        if (stagingKeys.length) await staging.bulkDelete(stagingKeys);
        run = finalRun;
      });
      transactionCommitted = true;

      const postCommit = await this._verifyCommitted(run, importedRecords);
      if (!postCommit.valid) throw new Error(`Post-commit validation failed: ${postCommit.errors.join('; ')}`);
      return { runId, state: MIGRATION_STATE.COMPLETED, counts: run.resultCounts, snapshotId: run.snapshotId };
    } catch (error) {
      if (transactionCommitted) {
        try {
          await this.rollbackManager.rollback(runId, 'post-commit-verification-failed');
        } catch (rollbackError) {
          await this.auditLog.appendEvent({ runId, principalId: run.principalId, eventType: 'rollback-recovery-needed', outcome: 'recovery-needed', errorCode: rollbackError.code || 'ROLLBACK_FAILED' });
          throw new Error(`${error.message}; automatic rollback requires recovery: ${rollbackError.message}`);
        }
      } else {
        await this._markFailed(runId, error, 'commit');
      }
      throw error;
    } finally {
      await this.lock.release(run.principalId, run.id);
    }
  }

  async rollback(runId, reason) {
    const run = await this.getRun(runId);
    if (!run) throw new Error('Migration run was not found.');
    return this.rollbackManager.rollback(runId, reason);
  }
}

export default MigrationCoordinator;
