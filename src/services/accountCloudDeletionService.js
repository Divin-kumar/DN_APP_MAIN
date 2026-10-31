import { collection, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import useAppStore from '../store/useAppStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { assertCloudDeleteOwner, executeCloudRecordDeletion } from '../utils/accountCloudDeletionSafety';

// Deliberately limited to known account-owned Firestore records. Authentication,
// browser-local photo originals, and legacy Firebase Storage files are separate
// and are NEVER implicitly deleted by the Firestore-only action.
export const deleteSignedInCloudRecords = async (uid, onProgress) => {
  const assertCurrent = () => assertCloudDeleteOwner(uid, {
    user: useAppStore.getState().user,
    isGuest: useAppStore.getState().isGuest,
    firebaseUid: auth.currentUser?.uid,
    sample: getActiveSampleScenario(uid),
  });
  assertCurrent();
  return executeCloudRecordDeletion({
    uid, assertCurrent, onProgress,
    listCollection: async (name, owner) =>
      (await getDocsFromServer(collection(db, 'users', owner, name))).docs.map((item) => item.ref),
    deleteBatch: async (references) => {
      assertCurrent();
      const batch = writeBatch(db);
      for (const reference of references) batch.delete(reference);
      await batch.commit();
    },
  });
};
