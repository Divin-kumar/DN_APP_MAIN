// Centralized table names keep database definitions and migration scaffolding aligned.
export const DATABASE_TABLES = Object.freeze({
  METADATA: 'metadata',
  MOMENTS: 'moments',
  ACTIVITIES: 'activities',
  MEMORIES: 'memories',
  ATTACHMENTS: 'attachments',
  EXPENSES: 'expenses',
  INCOMES: 'incomes',
  SETTINGS: 'settings',
  CODE_LISTS: 'codeLists',
});

export const DATABASE_TABLE_LIST = Object.freeze(Object.values(DATABASE_TABLES));
