import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { MIGRATION_STATE } from './migrationConstants.js';
import { canonicalFingerprint } from './migrationIdentity.js';
import { transitionMigrationRun } from './migrationStateMachine.js';
import { MigrationAuditLog } from './migrationAuditLog.js';
import { MigrationSnapshotManager } from './migrationSnapshotManager.js';

export class MigrationRollbackManager {
  constructor({ database = db, snapshotManager = new MigrationSnapshotManager({ database }), auditLog = new MigrationAuditLog({ database }), now = () => new Date() } = {}) {
    this.db = database;
    this.snapshotManager = snapshotManager;
    this.auditLog = auditLog;
    this.now = now;
  }

  async rollback(runId, reason = 'explicit-request') {
    const runs = this.db.table(DATABASE_TABLES.MIGRATION_RUNS);
    const run = await runs.get(runId);
    if (!run || !run.snapshotId) throw new Error('Migration run or its snapshot was not found.');
    if (![MIGRATION_STATE.FAILED, MIGRATION_STATE.COMPLETED].includes(run.state)) {
      throw new Error(`Rollback is not permitted from state ${run.state}.`);
    }

    const validation = await this.snapshotManager.validate(run.snapshotId);
    if (!validation.valid) throw new Error(`Rollback snapshot is invalid: ${validation.errors.join('; ')}`);
    const manifest = validation.manifest;
    const expectedCurrentChecksums = run.state === MIGRATION_STATE.COMPLETED
      ? run.committedChecksums
      : manifest.checksums;
    if (!expectedCurrentChecksums) throw new Error('The expected current-state checksum is unavailable; rollback is blocked to protect newer data.');

    let nextRun;
    await this.snapshotManager.restore(run.snapshotId, {
      verifyCurrent: true,
      expectedCurrentChecksums,
      extraTables: [runs, this.db.table(DATABASE_TABLES.MIGRATION_AUDIT)],
      onRestored: async ({ manifest: restoredManifest }) => {
        nextRun = transitionMigrationRun(run, MIGRATION_STATE.ROLLED_BACK, { cause: reason }, this.now().toISOString());
        nextRun.rollback = { reason, snapshotId: restoredManifest.id, completedAt: this.now().toISOString() };
        await runs.put(nextRun);
        await this.auditLog.recordRollback(nextRun, { snapshotId: restoredManifest.id, tableNames: restoredManifest.tableNames });
      },
    });

    return { run: nextRun, restored: true, snapshotId: run.snapshotId };
  }

  async verifyRestoration(runId) {
    const run = await this.db.table(DATABASE_TABLES.MIGRATION_RUNS).get(runId);
    if (!run?.snapshotId) return { valid: false, errors: ['Migration snapshot is not available.'] };
    const validation = await this.snapshotManager.validate(run.snapshotId);
    if (!validation.valid) return validation;
    const contents = await this.snapshotManager.load(run.snapshotId);
    const errors = [];
    for (const tableName of validation.manifest.tableNames) {
      const current = await this.db.table(tableName).where('userId').equals(run.principalId).toArray();
      if (await canonicalFingerprint(current) !== validation.manifest.checksums[tableName]) errors.push(`Restored ${tableName} rows do not match the snapshot.`);
    }
    if (!contents) errors.push('Snapshot payload is unavailable.');
    return { valid: errors.length === 0, errors };
  }
}

export default MigrationRollbackManager;
