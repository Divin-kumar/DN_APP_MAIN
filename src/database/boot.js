import { db } from './index.js';
import { DATABASE_SCHEMA_VERSION } from './schema.js';
import { buildMetadataEntries, DATABASE_METADATA_KEYS } from './metadata.js';
import { validateSchemaMetadataRecord } from '../validators/migration.js';

export const ensureDatabaseMetadata = async (database = db) => {
  const openedVersion = Number(database.verno);
  if (!Number.isInteger(openedVersion) || openedVersion !== DATABASE_SCHEMA_VERSION) {
    throw new Error(`Opened Dexie schema version ${openedVersion} does not match supported version ${DATABASE_SCHEMA_VERSION}.`);
  }

  const metadataTable = database.table('metadata');
  const rows = buildMetadataEntries(openedVersion);
  await database.transaction('rw', metadataTable, async () => {
    for (const row of rows) {
      const existing = await metadataTable.get(row.key);
      if (!existing) {
        await metadataTable.put(row);
        continue;
      }

      if (row.key === DATABASE_METADATA_KEYS.SCHEMA_VERSION) {
        const storedVersion = Number(existing.value);
        if (!Number.isInteger(storedVersion) || storedVersion > openedVersion) {
          throw new Error(`Stored metadata schema version ${String(existing.value)} is invalid or newer than the opened database.`);
        }
        if (storedVersion !== openedVersion || existing.status !== 'ready') {
          await metadataTable.put({ ...existing, value: openedVersion, status: 'ready', updatedAt: new Date().toISOString() });
        }
      }
      // Boot defaults initialize missing control rows only; they must not reset data-migration history.
    }
  });

  const values = await Promise.all([
    metadataTable.get(DATABASE_METADATA_KEYS.SCHEMA_VERSION),
    metadataTable.get(DATABASE_METADATA_KEYS.MIGRATION_STATUS),
    metadataTable.get(DATABASE_METADATA_KEYS.LAST_SUCCESSFUL_MIGRATION),
    metadataTable.get(DATABASE_METADATA_KEYS.ROLLBACK_STATUS),
  ]);

  const schemaValidation = validateSchemaMetadataRecord(values[0], openedVersion);
  if (!schemaValidation.valid) throw new Error(schemaValidation.errors.join(' '));

  return values.filter(Boolean);
};

export const initializeDatabase = async () => {
  try {
    await db.open();
    await ensureDatabaseMetadata(db);
    return db;
  } catch (error) {
    console.error('Dexie database initialization failed:', error);
    throw error;
  }
};
