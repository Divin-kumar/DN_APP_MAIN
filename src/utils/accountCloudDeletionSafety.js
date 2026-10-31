// Only known DN account-owned Firestore collections can be cleared.
// Legacy events and unified transactions are included to avoid silent leftovers.
export const CLOUD_RECORD_COLLECTIONS = Object.freeze([
  'eventGroups', 'events', 'expenses', 'incomes', 'transactions', 'settings',
]);

export const CLOUD_DELETE_CONFIRMATION = 'DELETE MY CLOUD DATA';

export const assertCloudDeleteOwner = (uid, { user, isGuest, firebaseUid, sample } = {}) => {
  if (typeof uid !== 'string' || !uid || uid.includes('/') || uid.includes('\\')) {
    throw new Error('A valid signed-in account is required to delete online data.');
  }
  if (isGuest || sample || user?.uid !== uid || firebaseUid !== uid) {
    throw new Error('Your signed-in account changed. No further online records were deleted.');
  }
};

export const assertOwnedCloudDocument = (uid, collectionName, reference) => {
  if (!CLOUD_RECORD_COLLECTIONS.includes(collectionName)
    || typeof reference?.path !== 'string'
    || !reference.path.startsWith(`users/${uid}/${collectionName}/`)
    || reference.path.split('/').length !== 4) {
    throw new Error('Unexpected cloud record path. Deletion was stopped.');
  }
};

// Transport is injected so the irreversible batch logic is testable without
// Firebase credentials. This operates ONLY on references enumerated on server.
export const executeCloudRecordDeletion = async ({
  uid, assertCurrent, listCollection, deleteBatch, onProgress = () => {},
}) => {
  if (typeof uid !== 'string' || !uid || uid.includes('/') || uid.includes('\\')) {
    throw new Error('A valid signed-in account is required.');
  }
  assertCurrent();
  const records = [];
  // Read ALL collection scopes first. If any is inaccessible/offline, abort
  // without deleting a subset and misrepresenting it as a complete clear.
  for (const collectionName of CLOUD_RECORD_COLLECTIONS) {
    assertCurrent();
    const refs = await listCollection(collectionName, uid);
    assertCurrent();
    if (!Array.isArray(refs)) throw new Error('The cloud inventory was incomplete. No records were deleted.');
    for (const reference of refs) {
      assertOwnedCloudDocument(uid, collectionName, reference);
      records.push(reference);
    }
  }
  onProgress({ stage: 'deleting', deleted: 0, total: records.length });
  let deleted = 0;
  // Firestore write batches max at 500 mutations. Smaller chunks avoid limits
  // from security rules and keep each commit within a well-defined scope.
  for (let offset = 0; offset < records.length; offset += 200) {
    assertCurrent();
    const chunk = records.slice(offset, offset + 200);
    await deleteBatch(chunk);
    deleted += chunk.length;
    onProgress({ stage: 'deleting', deleted, total: records.length });
    assertCurrent();
  }
  // Never claim a complete clear if another session repopulated the account,
  // the rules hid a collection, or a verification request failed.
  for (const collectionName of CLOUD_RECORD_COLLECTIONS) {
    assertCurrent();
    const remaining = await listCollection(collectionName, uid);
    assertCurrent();
    if (!Array.isArray(remaining) || remaining.length) {
      throw new Error('Some online records remain or were recreated. Close other DN sessions and retry. Earlier deletions are permanent.');
    }
  }
  return { deleted };
};
