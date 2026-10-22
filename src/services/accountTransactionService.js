import { collection, deleteDoc, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFinancialRecordSources } from '../utils/financialRecords';

// Some existing accounts also contain the unified ledger. Reading it does not
// migrate documents or change where newly created typed records are saved.
export const getAccountTransactions = async (uid, kind, normalize) => {
  let snapshot;
  try { snapshot = await getDocs(collection(db, 'users', uid, 'transactions')); }
  catch (error) {
    if (!['permission-denied', 'firestore/permission-denied'].includes(error?.code)) throw error;
    console.warn('The additional transaction collection is unavailable under the current account permissions; using readable typed records.');
    return [];
  }
  return snapshot.docs.flatMap((document) => {
    const data = document.data();
    if (String(data.kind || '').trim().toLowerCase() !== kind) return [];
    return [{ ...normalize({ ...data, firestoreId: document.id }, document.id),
      firestoreId: document.id, firestoreCollection: 'transactions' }];
  });
};

export const updateAccountFinancialRecord = async (uid, kind, record, normalized) => {
  const sources = getFinancialRecordSources(record, kind, normalized.id);
  if (!sources.length) throw new Error('This transaction has no valid source document. Reload Transactions and try again.');
  const payloadFor = ({ collection: sourceCollection }) => ({ ...normalized,
    ...(sourceCollection === 'transactions' ? { kind, ...(kind === 'income' ? { category: normalized.type } : {}) } : {}),
  });
  if (sources.length > 1) {
    const batch = writeBatch(db);
    for (const source of sources) batch.update(doc(db, 'users', uid, source.collection, source.id), payloadFor(source));
    await batch.commit();
  } else {
    await updateDoc(doc(db, 'users', uid, sources[0].collection, sources[0].id), payloadFor(sources[0]));
  }
  return { ...normalized, firestoreId: sources[0].id, firestoreCollection: sources[0].collection, firestoreSources: sources };
};

export const deleteAccountFinancialRecord = async (uid, kind, record) => {
  const sources = getFinancialRecordSources(record, kind, record.id);
  if (!sources.length) return;
  if (sources.length > 1) {
    const batch = writeBatch(db);
    for (const source of sources) batch.delete(doc(db, 'users', uid, source.collection, source.id));
    await batch.commit();
  } else await deleteDoc(doc(db, 'users', uid, sources[0].collection, sources[0].id));
};
