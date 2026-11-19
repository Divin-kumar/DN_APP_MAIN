import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './session';

export { auth, firebaseApp, googleProvider, initializeFirebaseAnalytics } from './session';
export const db = getFirestore(firebaseApp);
