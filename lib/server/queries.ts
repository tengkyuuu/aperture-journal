import 'server-only';

import { Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { aiCallsCol, messagesCol, securityEventsCol, sessionDoc, sessionsCol, userDoc } from './db';
import type { ConversationMode } from '../config';
import type {
  AiCall,
  Insights,
  SecurityEvent,
  SessionSummary,
  StoredMessage,
  UserProfile,
} from '../shared/types';

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
  const vault = snap.get('vault') as { salt?: string; check?: string } | undefined;

  return {
    displayName: (snap.get('displayName') as string | null) ?? null,
    email: (snap.get('email') as string | null) ?? null,
    photoURL: (snap.get('photoURL') as string | null) ?? null,
    vault: vault?.salt && vault?.check ? { salt: vault.salt, check: vault.check } : null,
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
      cipher: (m.get('cipher') as string | null) ?? null,
      sealed: m.get('sealed') === true,
      createdAt: iso(m.get('createdAt')),
    })),
  };
}

// ── Privacy Ledger ───────────────────────────────────────────────────────────

/** SECURITY PRECONDITION: `uid` comes from requireUid(). */
export async function listAiCalls(uid: string, limit = 200): Promise<AiCall[]> {
  const snap = await aiCallsCol(uid).orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({
    id: d.id,
    at: iso(d.get('at')),
    route: (d.get('route') as string) ?? '',
    model: (d.get('model') as string) ?? '',
    purpose: (d.get('purpose') as AiCall['purpose']) ?? 'chat',
    inputTokens: (d.get('inputTokens') as number) ?? 0,
    outputTokens: (d.get('outputTokens') as number) ?? 0,
    estCostUsd: (d.get('estCostUsd') as number) ?? 0,
    latencyMs: (d.get('latencyMs') as number) ?? 0,
    dataClasses: (d.get('dataClasses') as string[]) ?? [],
    sealedExcluded: (d.get('sealedExcluded') as number) ?? 0,
    sessionId: (d.get('sessionId') as string | null) ?? null,
  }));
}

/** SECURITY PRECONDITION: `uid` comes from requireUid(). */
export async function listSecurityEvents(uid: string, limit = 100): Promise<SecurityEvent[]> {
  const snap = await securityEventsCol(uid).orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({
    id: d.id,
    at: iso(d.get('at')),
    kind: (d.get('kind') as string) ?? 'unknown',
    severity: (d.get('severity') as SecurityEvent['severity']) ?? 'low',
    detail: (d.get('detail') as string) ?? '',
    sessionId: (d.get('sessionId') as string | null) ?? null,
  }));
}

/**
 * Sessions carrying insights, for the Insights page.
 * Sealed sessions are absent by construction — sealing deletes the insights.
 */
export async function listInsightSessions(uid: string, limit = 400): Promise<SessionSummary[]> {
  const snap = await sessionsCol(uid).orderBy('startedAt', 'desc').limit(limit).get();
  return snap.docs
    .map((d) => toSessionSummary(d.id, d.data()))
    .filter((s) => !s.sealed && s.mood !== null);
}

/**
 * Sealed sessions, newest first. Uses the sealed+startedAt composite index.
 * These carry no title, summary, or insights — sealing deleted them — so the
 * only thing the server can say about one is when it happened.
 */
export async function listSealedSessions(uid: string, limit = 200): Promise<SessionSummary[]> {
  const snap = await sessionsCol(uid)
    .where('sealed', '==', true)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => toSessionSummary(d.id, d.data()));
}
