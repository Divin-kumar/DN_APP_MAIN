import { DATABASE_TABLES } from './tables.js';

export const DATABASE_SCHEMA_VERSION = 1;

export const DATABASE_SCHEMA = Object.freeze({
  [DATABASE_TABLES.METADATA]: '&key, updatedAt, status',
  [DATABASE_TABLES.MOMENTS]: '&id, userId, ownerType, date, type, status, updatedAt, [userId+ownerType]',
  [DATABASE_TABLES.ACTIVITIES]: '&id, momentId, userId, date, completed, priority, updatedAt, [momentId+date]',
  [DATABASE_TABLES.MEMORIES]: '&id, momentId, userId, createdAt, kind, updatedAt, [momentId+createdAt]',
  [DATABASE_TABLES.ATTACHMENTS]: '&id, momentId, userId, type, createdAt, updatedAt, [momentId+createdAt]',
  [DATABASE_TABLES.EXPENSES]: '&id, userId, momentId, activityId, date, category, amount, updatedAt, [userId+date]',
  [DATABASE_TABLES.INCOMES]: '&id, userId, date, type, amount, updatedAt, [userId+date]',
  [DATABASE_TABLES.SETTINGS]: '&id, userId, key, updatedAt, [userId+key]',
  [DATABASE_TABLES.CODE_LISTS]: '&id, userId, listKey, entryValue, active, updatedAt, [userId+listKey]',
});

export const DATABASE_SCHEMA_INFO = Object.freeze({
  version: DATABASE_SCHEMA_VERSION,
  tables: DATABASE_SCHEMA,
});
