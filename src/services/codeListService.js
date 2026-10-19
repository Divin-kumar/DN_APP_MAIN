import { doc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  CODE_LIST_SCHEMA_VERSION,
  readGuestCodeListSettings,
  readLegacyCodeListSettings,
  resolveCodeListSettings,
} from '../utils/codeLists';

const settingsDocument = (uid) => doc(db, 'users', uid, 'settings', 'codelists');

const sameValue = (first, second) => JSON.stringify(first) === JSON.stringify(second);

export const loadCodeListsForUser = async (uid) => {
  if (!uid) throw new Error('A signed-in account is required to load code lists.');

  const ref = settingsDocument(uid);
  let legacySettings = readLegacyCodeListSettings();
  try {
    if (globalThis.localStorage?.getItem('lifehub_guest_mode') === 'true') {
      legacySettings = readGuestCodeListSettings();
    }
  } catch {
    // Firestore defaults remain available if browser storage is unavailable.
  }

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const remoteSettings = snapshot.exists() ? snapshot.data() : null;
    const resolved = resolveCodeListSettings(remoteSettings, legacySettings);
    const needsWrite = !snapshot.exists()
      || resolved.source !== 'remote'
      || !sameValue(remoteSettings.adminValues, resolved.adminValues)
      || Number(remoteSettings.schemaVersion || 0) !== resolved.schemaVersion;

    if (needsWrite) {
      transaction.set(ref, {
        adminValues: resolved.adminValues,
        schemaVersion: resolved.schemaVersion,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return resolved.adminValues;
  });
};

export const saveCodeListsForUser = async (uid, adminValues) => {
  if (!uid) throw new Error('A signed-in account is required to save code lists.');

  await setDoc(settingsDocument(uid), {
    adminValues,
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return adminValues;
};
