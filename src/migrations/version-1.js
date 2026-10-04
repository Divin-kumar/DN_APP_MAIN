import { DATABASE_SCHEMA, DATABASE_SCHEMA_VERSION } from '../database/schema.js';

export const versionOneMigration = Object.freeze({
  version: DATABASE_SCHEMA_VERSION,
  name: 'initial-schema',
  description: 'Create the initial database schema for Dexie Foundation Deliverable 1.',
  schema: DATABASE_SCHEMA,
  status: 'registered',
  notes: 'This is a migration scaffold only. Actual data migrations are intentionally deferred.',
});

export const getInitialSchemaRegistration = () => ({ ...versionOneMigration });
