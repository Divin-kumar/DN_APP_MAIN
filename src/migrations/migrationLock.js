import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_MIGRATION_LOCK_TTL_MS } from './migrationConstants.js';

export class MigrationLock {
  constructor({ database = db, now = () => new Date(), ttlMs = DEFAULT_MIGRATION_LOCK_TTL_MS } = {}) {
    this.db = database;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async acquire(principalId, runId) {
    if (!principalId || !runId) throw new Error('principalId and runId are required to acquire a migration lock.');
    const table = this.db.table(DATABASE_TABLES.MIGRATION_LOCKS);
    return this.db.transaction('rw', table, async () => {
      const current = await table.get(principalId);
      const now = this.now();
      if (current && current.runId !== runId && new Date(current.expiresAt) > now) {
        throw new Error('Another migration is currently active for this principal.');
      }
      const lock = { principalId, runId, acquiredAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.ttlMs).toISOString() };
      await table.put(lock);
      return lock;
    });
  }

  async refresh(principalId, runId) {
    const table = this.db.table(DATABASE_TABLES.MIGRATION_LOCKS);
    const current = await table.get(principalId);
    if (!current || current.runId !== runId) throw new Error('Migration lock is not owned by this run.');
    const now = this.now();
    const lock = { ...current, expiresAt: new Date(now.getTime() + this.ttlMs).toISOString() };
    await table.put(lock);
    return lock;
  }

  async release(principalId, runId) {
    const table = this.db.table(DATABASE_TABLES.MIGRATION_LOCKS);
    const current = await table.get(principalId);
    if (!current || current.runId !== runId) return false;
    await table.delete(principalId);
    return true;
  }
}

export default MigrationLock;
