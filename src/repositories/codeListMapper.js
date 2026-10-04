import { DATABASE_TABLES } from '../database/tables.js';

export const mapCodeListEntry = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const listKey = typeof record.listKey === 'string' ? record.listKey : null;
  const entryValue = typeof record.entryValue === 'string' ? record.entryValue : null;

  if (!listKey || !entryValue) return null;

  return {
    id: record.id || crypto.randomUUID(),
    userId,
    listKey,
    entryValue,
    label: typeof record.label === 'string' ? record.label : entryValue,
    active: record.active !== false && record.isActive !== false,
    isActive: record.isActive !== false && record.active !== false,
    canGenerateGreetingCards: record.canGenerateGreetingCards ?? record.generateGreetingCards ?? true,
    greetingTemplate: typeof record.greetingTemplate === 'string' ? record.greetingTemplate : '',
    showInDashboardUpcoming: record.showInDashboardUpcoming ?? record.showInDashboard ?? true,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: record.source || 'legacy',
    table: DATABASE_TABLES.CODE_LISTS,
  };
};

export const mapCodeListCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapCodeListEntry(record, userId))
    .filter(Boolean);
