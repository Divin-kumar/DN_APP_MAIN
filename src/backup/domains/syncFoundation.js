import { DATABASE_TABLES as T } from '../../database/tables.js';
import { registerBackupDomain } from '../registry.js';

export const SYNC_FOUNDATION_BACKUP_DOMAINS = [
  [T.DEVICE_REGISTRY, 'device-registry', { type: 'principal-field', field: 'principalId' }],
  [T.SYNC_JOURNAL, 'sync-journal', { type: 'principal-field', field: 'principalId' }],
  [T.SYNC_TOMBSTONES, 'sync-tombstones', { type: 'all-local' }],
  [T.SYNC_CONFLICTS, 'sync-conflicts', { type: 'all-local' }],
  [T.SYNC_AUDIT, 'sync-audit', { type: 'principal-field', field: 'principalId' }],
].map(([table, domain, ownershipPolicy]) => registerBackupDomain({
  domain,
  tables: [table],
  tier: 'tier3-sync-foundation',
  ownershipPolicy,
  restorePolicy: 'skip',
  descriptorVersion: 1,
  defaultIncluded: false,
}));
