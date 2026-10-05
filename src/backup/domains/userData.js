import { DATABASE_TABLES as T } from '../../database/tables.js';
import { registerBackupDomain } from '../registry.js';

const principalOwned = Object.freeze({ type: 'principal-field', field: 'userId' });

export const USER_DATA_BACKUP_DOMAINS = [
  ['moments', T.MOMENTS, 'table'],
  ['activities', T.ACTIVITIES, 'table'],
  ['memories', T.MEMORIES, 'table'],
  ['attachments', T.ATTACHMENTS, 'table'],
  ['attachment-links', T.ATTACHMENT_LINKS, 'table'],
  ['expenses', T.EXPENSES, 'table'],
  ['incomes', T.INCOMES, 'table'],
  ['settings', T.SETTINGS, 'settings'],
  ['code-lists', T.CODE_LISTS, 'code-lists'],
].map(([domain, table, restorePolicy]) => registerBackupDomain({
  domain,
  tables: [table],
  tier: 'tier1-user-data',
  ownershipPolicy: principalOwned,
  restorePolicy,
  descriptorVersion: 1,
  defaultIncluded: true,
}));

