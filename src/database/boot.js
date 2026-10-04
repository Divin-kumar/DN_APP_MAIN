import { db } from './index.js';
import { buildMetadataEntries, DATABASE_METADATA_KEYS } from './metadata.js';

export const ensureDatabaseMetadata = async () => {
  const metadataTable = db.table('metadata');
  const rows = buildMetadataEntries();
  const results = [];

  for (const row of rows) {
    const existing = await metadataTable.get(row.key);
    if (!existing) {
      results.push(metadataTable.put(row));
    } else {
      results.push(metadataTable.put({ ...existing, ...row, updatedAt: row.updatedAt }));
    }
  }

  await Promise.all(results);
  const values = await Promise.all([
    metadataTable.get(DATABASE_METADATA_KEYS.SCHEMA_VERSION),
    metadataTable.get(DATABASE_METADATA_KEYS.MIGRATION_STATUS),
    metadataTable.get(DATABASE_METADATA_KEYS.LAST_SUCCESSFUL_MIGRATION),
    metadataTable.get(DATABASE_METADATA_KEYS.ROLLBACK_STATUS),
  ]);

  return values.filter(Boolean);
};

export const initializeDatabase = async () => {
  try {
    await db.open();
    await ensureDatabaseMetadata();
    return db;
  } catch (error) {
    console.error('Dexie database initialization failed:', error);
    throw error;
  }
};
