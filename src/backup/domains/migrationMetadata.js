import { DATABASE_TABLES as T } from '../../database/tables.js';
import { registerBackupDomain } from '../registry.js';

export const MIGRATION_METADATA_BACKUP_DOMAINS = [
  [T.MIGRATION_RUNS, 'migration-runs'],
  [T.MIGRATION_SNAPSHOTS, 'migration-snapshots'],
  [T.MIGRATION_STAGING, 'migration-staging'],
  [T.MIGRATION_LOCKS, 'migration-locks'],
].map(([table, domain]) => registerBackupDomain({
  domain,
  tables: [table],
  tier: 'tier2-system-metadata',
  ownershipPolicy: { type: 'all-local' },
  restorePolicy: 'skip',
  descriptorVersion: 1,
  defaultIncluded: false,
}));
