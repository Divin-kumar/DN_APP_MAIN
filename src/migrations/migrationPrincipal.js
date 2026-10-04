import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';

const GUEST_PRINCIPAL_KEY = 'migration.guestPrincipalId';

export const getOrCreateGuestPrincipalId = async (database = db) => {
  const metadata = database.table(DATABASE_TABLES.METADATA);
  const existing = await metadata.get(GUEST_PRINCIPAL_KEY);
  if (existing?.value) return existing.value;

  const value = `guest_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  await database.transaction('rw', metadata, async () => {
    const current = await metadata.get(GUEST_PRINCIPAL_KEY);
    if (!current?.value) {
      await metadata.put({ key: GUEST_PRINCIPAL_KEY, value, status: 'ready', updatedAt: new Date().toISOString() });
    }
  });
  return (await metadata.get(GUEST_PRINCIPAL_KEY))?.value || value;
};
