export const MIGRATION_REGISTRY = Object.freeze({
  1: Object.freeze({
    version: 1,
    name: 'initial-schema-registration',
    description: 'Initial Dexie schema registration scaffold for the database foundation.',
    tables: [
      'metadata',
      'moments',
      'activities',
      'memories',
      'attachments',
      'expenses',
      'incomes',
      'settings',
      'codeLists',
    ],
    up: async () => ({ ok: true, version: 1, status: 'registered' }),
    down: async () => ({ ok: true, version: 0, status: 'not-implemented' }),
  }),
});

export const getMigrationRegistry = () => ({ ...MIGRATION_REGISTRY });

export const getMigrationByVersion = (version) => MIGRATION_REGISTRY[version] || null;
