import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';

const createId = () => globalThis.crypto?.randomUUID?.() || `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class MigrationAuditLog {
  constructor({ database = db, now = () => new Date() } = {}) {
    this.db = database;
    this.now = now;
  }

  async appendEvent({ runId, principalId, eventType, ...details }) {
    if (!runId || !principalId || !eventType) throw new Error('runId, principalId and eventType are required for audit events.');
    const row = {
      id: createId(), runId, principalId, eventType,
      occurredAt: this.now().toISOString(),
      ...details,
    };
    await this.db.table(DATABASE_TABLES.MIGRATION_AUDIT).add(row);
    return row;
  }

  async beginRun(run) {
    return this.appendEvent({
      runId: run.id, principalId: run.principalId, eventType: 'run-started',
      migrationVersion: run.migrationVersion, source: run.sourceSelection,
      outcome: 'started', conflictStatus: 'none',
    });
  }

  async recordDecision({ runId, principalId, source, originalId, migrationVersion, outcome, conflictStatus = 'none', ...details }) {
    const migratedAt = ['imported', 'already-present'].includes(outcome) ? this.now().toISOString() : null;
    return this.appendEvent({
      runId, principalId, eventType: 'record-decision', source, originalId: originalId ?? null,
      migratedAt, migrationVersion, outcome, conflictStatus, ...details,
    });
  }

  async recordTransition(run, transition) {
    return this.appendEvent({
      runId: run.id, principalId: run.principalId, eventType: 'state-transition',
      fromState: transition.from, toState: transition.to, cause: transition.cause || null,
      migrationVersion: run.migrationVersion, source: run.sourceSelection,
      outcome: transition.to,
    });
  }

  async recordFailure(run, error, { stage, mutationPossible = false } = {}) {
    return this.appendEvent({
      runId: run.id, principalId: run.principalId, eventType: 'run-failed',
      source: run.sourceSelection, migrationVersion: run.migrationVersion,
      outcome: 'failed', conflictStatus: 'unknown', stage: stage || run.state,
      errorCode: error?.code || 'MIGRATION_FAILED', errorMessage: String(error?.message || error).slice(0, 500),
      mutationPossible,
    });
  }

  async recordRollback(run, result) {
    return this.appendEvent({
      runId: run.id, principalId: run.principalId, eventType: 'run-rolled-back',
      source: run.sourceSelection, migrationVersion: run.migrationVersion,
      outcome: 'rolled-back', conflictStatus: 'resolved', snapshotId: result.snapshotId,
      restoredTables: result.tableNames,
    });
  }

  async getHistory(principalId, { limit = 200 } = {}) {
    if (!principalId) return [];
    const rows = await this.db.table(DATABASE_TABLES.MIGRATION_AUDIT)
      .where('principalId').equals(principalId).toArray();
    return rows.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, limit);
  }

  async getRunHistory(runId) {
    if (!runId) return [];
    return this.db.table(DATABASE_TABLES.MIGRATION_AUDIT)
      .where('runId').equals(runId)
      .sortBy('occurredAt');
  }
}

export default MigrationAuditLog;
