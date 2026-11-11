import 'server-only';

import { cert, getApps, initializeApp, type App, type AppOptions } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin initialisation.
 *
 * Off Google Cloud (Vercel), there are no Application Default Credentials, so
 * the service account is supplied as FIREBASE_SERVICE_ACCOUNT — the key JSON,
 * either raw or base64-encoded (base64 survives dashboards that mangle
 * newlines in the private key). Without it this falls back to ADC:
 * `gcloud auth application-default login` locally, or the emulator suite when
 * FIRESTORE_EMULATOR_HOST is set.
 *
 * The Admin SDK BYPASSES Firestore security rules. That is why every data
 * helper in lib/server/db.ts takes a uid that came from requireUid() and
 * nowhere else.
 */

function credentialOptions(): Pick<AppOptions, 'credential'> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return {};

  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    return { credential: cert(JSON.parse(json)) };
  } catch {
    // Never echo the value — it is a private key.
    throw new Error('SERVICE_ACCOUNT_INVALID');
  }
}

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

  const app = getApps().length
    ? getApps()[0]!
    : initializeApp({ projectId: projectId(), ...credentialOptions() });
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
