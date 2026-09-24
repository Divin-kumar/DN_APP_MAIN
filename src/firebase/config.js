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
  appId: '1:666300141270:web:23a208ea5797010f384377',
  measurementId: 'G-FFGVMYZDLR',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
