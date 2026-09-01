import 'server-only';

import type {
  CollectionReference,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore';

import { adminDb } from './firebase-admin';

/**
 * Path-scoped tenancy.
 *
 * ══ SECURITY PRECONDITION FOR EVERY FUNCTION IN THIS FILE ══
 * `uid` MUST be the return value of requireUid(). It must never originate from
 * a request body, query parameter, path segment, or header.
 *
 * The Admin SDK bypasses Firestore security rules, so these paths are the
 * isolation boundary — not the rules. Tenancy is encoded in the PATH rather
 * than in a filterable field on purpose: a wrong path returns nothing, whereas
 * a forgotten `.where('uid', '==', uid)` returns everything.
 *
 * There is deliberately no exported helper that accepts a raw collection path.
 */

function db(): Firestore {
  return adminDb();
}

export function userDoc(uid: string): DocumentReference {
  return db().doc(`users/${uid}`);
}

export function sessionsCol(uid: string): CollectionReference {
  return db().collection(`users/${uid}/sessions`);
}

export function sessionDoc(uid: string, sessionId: string): DocumentReference {
  return db().doc(`users/${uid}/sessions/${sessionId}`);
}

export function messagesCol(uid: string, sessionId: string): CollectionReference {
  return db().collection(`users/${uid}/sessions/${sessionId}/messages`);
}

export function aiCallsCol(uid: string): CollectionReference {
  return db().collection(`users/${uid}/ai_calls`);
}

export function securityEventsCol(uid: string): CollectionReference {
  return db().collection(`users/${uid}/security_events`);
}

export function chaptersCol(uid: string): CollectionReference {
  return db().collection(`users/${uid}/chapters`);
}

/**
 * Firestore document IDs are used in paths, so a caller-supplied ID is a path
 * traversal risk. Reject anything that is not a plain opaque token.
 */
export function assertSafeId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('INVALID_ID');
  return id;
}
