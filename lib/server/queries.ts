import 'server-only';

import { Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { messagesCol, sessionDoc, sessionsCol, userDoc } from './db';
import type { ConversationMode } from '../config';
import type { Insights, SessionSummary, StoredMessage, UserProfile } from '../shared/types';

/**
 * Read helpers.
 *
 * SECURITY PRECONDITION for every function here: `uid` is the return value of
 * requireUid(). These call the path-scoped helpers in db.ts, so there is no
 * query to forget a filter on.
 *
 * They also serialise: a Firestore Timestamp is not a plain object, and React
 * will refuse to hand one from a Server Component to a Client Component. Doing
 * the conversion in one place beats discovering it per-component.
 */

function iso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function toSessionSummary(id: string, d: DocumentData): SessionSummary {
  const insights = d.insights as Insights | undefined;
  return {
    id,
    title: (d.title as string | null) ?? insights?.title ?? null,
    mode: ((d.mode as ConversationMode) ?? 'reflect') as ConversationMode,
    status: d.status === 'closed' ? 'closed' : 'open',
    sealed: d.sealed === true,
    messageCount: (d.messageCount as number) ?? 0,
    startedAt: iso(d.startedAt),
    endedAt: iso(d.endedAt),
    mood: insights?.mood ?? null,
    themes: insights?.themes ?? [],
  };
}

export async function getProfile(uid: string): Promise<UserProfile> {
  const snap = await userDoc(uid).get();
  return {
    displayName: (snap.get('displayName') as string | null) ?? null,
    email: (snap.get('email') as string | null) ?? null,
    photoURL: (snap.get('photoURL') as string | null) ?? null,
  };
}

export async function listSessions(uid: string, limit = 50): Promise<SessionSummary[]> {
  const snap = await sessionsCol(uid).orderBy('startedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => toSessionSummary(d.id, d.data()));
}

export async function getSessionDetail(
  uid: string,
  sessionId: string,
): Promise<{ session: SessionSummary; insights: Insights | null; messages: StoredMessage[] } | null> {
  const snap = await sessionDoc(uid, sessionId).get();
  // A session id that does not exist under THIS uid does not exist. There is
  // no path by which it could resolve to another user's document.
  if (!snap.exists) return null;

  const data = snap.data()!;
  const msgs = await messagesCol(uid, sessionId).orderBy('createdAt', 'asc').limit(200).get();

  return {
    session: toSessionSummary(snap.id, data),
    insights: (data.insights as Insights | undefined) ?? null,
    messages: msgs.docs.map((m) => ({
      id: m.id,
      role: m.get('role') === 'model' ? 'model' : 'user',
      content: (m.get('content') as string | null) ?? null,
      sealed: m.get('sealed') === true,
      createdAt: iso(m.get('createdAt')),
    })),
  };
}
