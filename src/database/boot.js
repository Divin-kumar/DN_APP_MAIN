import { db } from './index.js';
import { DATABASE_SCHEMA_VERSION } from './schema.js';
import { buildMetadataEntries, DATABASE_METADATA_KEYS } from './metadata.js';
import { validateSchemaMetadataRecord } from '../validators/migration.js';

let initializationPromise = null;

export const ensureDatabaseMetadata = async (database = db) => {
  const openedVersion = Number(database.verno);
  if (!Number.isInteger(openedVersion) || openedVersion !== DATABASE_SCHEMA_VERSION) {
    throw new Error(`Opened Dexie schema version ${openedVersion} does not match supported version ${DATABASE_SCHEMA_VERSION}.`);
  }

  const metadataTable = database.table('metadata');
  const rows = buildMetadataEntries(openedVersion);
  const keys = rows.map((row) => row.key);

  await database.transaction('rw', metadataTable, async () => {
    const existingList = await metadataTable.bulkGet(keys);
    const toPut = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const existing = existingList[i];
      if (!existing) {
        toPut.push(row);
        continue;
      }

      if (row.key === DATABASE_METADATA_KEYS.SCHEMA_VERSION) {
        const storedVersion = Number(existing.value);
        if (!Number.isInteger(storedVersion) || storedVersion > openedVersion) {
          throw new Error(`Stored metadata schema version ${String(existing.value)} is invalid or newer than the opened database.`);
        }
        if (storedVersion !== openedVersion || existing.status !== 'ready') {
          toPut.push({ ...existing, value: openedVersion, status: 'ready', updatedAt: new Date().toISOString() });
        }
      }
      // Boot defaults initialize missing control rows only; they must not reset data-migration history.
    }

    if (toPut.length > 0) {
      await metadataTable.bulkPut(toPut);
    }
  });

  const values = await metadataTable.bulkGet([
    DATABASE_METADATA_KEYS.SCHEMA_VERSION,
    DATABASE_METADATA_KEYS.MIGRATION_STATUS,
    DATABASE_METADATA_KEYS.LAST_SUCCESSFUL_MIGRATION,
    DATABASE_METADATA_KEYS.ROLLBACK_STATUS,
  ]);

  const schemaValidation = validateSchemaMetadataRecord(values[0], openedVersion);
  if (!schemaValidation.valid) throw new Error(schemaValidation.errors.join(' '));

  return values.filter(Boolean);
};

export const initializeDatabase = async () => {
  if (db.isOpen() && initializationPromise) {
    return initializationPromise;
  }
  initializationPromise = null;

  const runInit = async () => {
    if (!db.isOpen()) {
      await db.open();
    }
    try {
      await ensureDatabaseMetadata(db);
    } catch (error) {
      if (error?.name === 'UnknownError' || String(error?.message || '').includes('without an in-progress transaction')) {
        console.warn('Recovering from Dexie transaction state error, reopening database...', error);
        db.close();
        await db.open();
        await ensureDatabaseMetadata(db);
      } else {
        throw error;
      }
    }
    return db;
  };

  initializationPromise = runInit().catch((error) => {
    initializationPromise = null;
    console.error('Dexie database initialization failed:', error);
    throw error;
  });

  return initializationPromise;
};
