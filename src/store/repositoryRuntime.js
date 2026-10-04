import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { getOrCreateGuestPrincipalId } from '../migrations/migrationPrincipal.js';

let guestPrincipalPromise = null;

export const resolveRepositoryPrincipal = async (uid, isGuest) => {
  await initializeDatabase();
  if (uid) return uid;
  if (!isGuest) return null;
  if (!guestPrincipalPromise) {
    guestPrincipalPromise = getOrCreateGuestPrincipalId(db).catch((error) => {
      guestPrincipalPromise = null;
      throw error;
    });
  }
  return guestPrincipalPromise;
};

export const clearResolvedGuestPrincipal = () => {
  guestPrincipalPromise = null;
};
