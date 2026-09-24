/* Firebase authentication facade used by React contexts and the shell. */
import { auth, db, googleProvider } from '../firebase/config';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

export const authService = {
  signInWithGoogle: () => signInWithPopup(auth, googleProvider),
  signOutUser: () => signOut(auth),
  onAuthChange: (callback) => onAuthStateChanged(auth, callback),
};

export const firebaseDb = db;
