/*
  Firebase authentication facade used by React contexts and the shell.

  This file is a simple wrapper around Firebase so the app can sign in with Google,
  sign out, and listen for auth state changes without writing Firebase code everywhere.
*/
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
