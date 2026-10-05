import { DATABASE_TABLES as T } from '../../database/tables.js';
import { registerBackupDomain } from '../registry.js';

export const SYSTEM_METADATA_BACKUP_DOMAINS = [
  registerBackupDomain({
    domain: 'application-metadata',
    tables: [T.METADATA],
    tier: 'tier2-system-metadata',
    ownershipPolicy: { type: 'all-local' },
    restorePolicy: 'skip',
    descriptorVersion: 1,
  }),
  registerBackupDomain({
    domain: 'migration-audit',
    tables: [T.MIGRATION_AUDIT],
    tier: 'tier2-system-metadata',
    ownershipPolicy: { type: 'principal-field', field: 'principalId' },
    restorePolicy: 'table',
    descriptorVersion: 1,
  }),
  registerBackupDomain({
    domain: 'guest-lineage',
    tables: [T.GUEST_LINEAGE],
    tier: 'tier2-system-metadata',
    ownershipPolicy: { type: 'principal-field', field: 'principalId' },
    restorePolicy: 'table',
    descriptorVersion: 1,
    defaultIncluded: false,
  }),
];
