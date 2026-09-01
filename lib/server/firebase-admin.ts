import 'server-only';

import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin initialisation.
 *
 * On Cloud Run (Firebase App Hosting) this picks up Application Default
 * Credentials from the attached service account — no key file exists anywhere,
 * which is the entire point. Locally it uses `gcloud auth application-default
 * login`, or the emulator suite when FIRESTORE_EMULATOR_HOST is set.
 *
 * The Admin SDK BYPASSES Firestore security rules. That is why every data
 * helper in lib/server/db.ts takes a uid that came from requireUid() and
 * nowhere else.
 */

function projectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

function init() {
  if (cached) return cached;

  const app = getApps().length ? getApps()[0]! : initializeApp({ projectId: projectId() });
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if the instance has already been used. Harmless in dev
    // where module state survives a hot reload.
  }

  cached = { app, auth, db };
  return cached;
}

export function adminAuth(): Auth {
  return init().auth;
}

export function adminDb(): Firestore {
  return init().db;
}
