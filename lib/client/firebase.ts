'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';

import { apiFetch, apiPost } from './api';

/**
 * Client-side Firebase — used for exactly one thing: running the Google
 * sign-in popup to obtain an ID token, which is immediately exchanged for an
 * httpOnly session cookie and then discarded.
 *
 * The config values below are PUBLIC. They ship in the bundle by design, they
 * identify the project rather than authorise anything, and they are protected
 * by HTTP referrer restrictions, Firestore rules, and (later) App Check.
 * Pretending they are secrets would be theatre; the real secret is in Secret
 * Manager and never comes near this file.
 *
 * ── The important line in this file is inMemoryPersistence. ──
 * By default the Firebase client SDK persists tokens in IndexedDB, where any
 * XSS can read them. We turn that off. After the exchange, the browser holds
 * no credential that JavaScript can reach — only the httpOnly cookie, which it
 * cannot.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function app() {
  return getApps().length ? getApp() : initializeApp(config);
}

export function clientAuth(): Auth {
  return getAuth(app());
}

/**
 * Sign in, exchange the ID token for a session cookie, then drop the client
 * credential entirely.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = clientAuth();
  await setPersistence(auth, inMemoryPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  const res = await apiPost('/api/auth/session', { idToken });
  if (!res.ok) throw new Error('session_exchange_failed');

  // Create/refresh the profile document server-side now that the cookie exists.
  await apiFetch('/api/auth/session', { method: 'PUT' });

  // The cookie is the credential from here on. Nothing left in the tab.
  await signOut(auth);
}

export async function signOutEverywhere(): Promise<void> {
  await apiFetch('/api/auth/session', { method: 'DELETE' });
  try {
    await signOut(clientAuth());
  } catch {
    // Already signed out in-memory; the cookie is what mattered.
  }
}
