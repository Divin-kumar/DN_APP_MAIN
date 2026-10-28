/* Firebase client configuration shared by authentication and Firestore services. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCWks2wkCCsoYY3NRLl5BIBgf23vsgqqlI',
  authDomain: 'expense-tracker-divin.firebaseapp.com',
  projectId: 'expense-tracker-divin',
  storageBucket: 'expense-tracker-divin.firebasestorage.app',
  messagingSenderId: '666300141270',
  appId: '1:666300141270:web:c8423d47bb34408b384377',
  measurementId: 'G-3WW4HSQFF3',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Keep optional Analytics out of the initial app bundle and never block core Firebase services.
export const initializeFirebaseAnalytics = async () => {
  try {
    if (globalThis.navigator?.onLine === false) return null;
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (!(await isSupported()) || globalThis.navigator?.onLine === false) return null;
    return getAnalytics(firebaseApp);
  } catch (error) {
    console.info('Firebase Analytics is unavailable in this environment:', error);
    return null;
  }
};
