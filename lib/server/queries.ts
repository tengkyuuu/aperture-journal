import 'server-only';

import { Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { aiCallsCol, messagesCol, securityEventsCol, sessionDoc, sessionsCol, userDoc } from './db';
import type { ConversationMode } from '../config';
import type {
  AiCall,
  Insights,
  Mood,
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

// ── Home digest ──────────────────────────────────────────────────────────────

export interface OpenLoop {
  text: string;
  sessionId: string;
  sessionTitle: string;
  at: string | null;
}

export interface HomeDigest {
  /** Closed sessions from the last 14 days, newest first. */
  recent: SessionSummary[];
  /** Unresolved threads carried forward from recent sessions. */
  openLoops: OpenLoop[];
  /** Average mood across the last two weeks, or null when there is none. */
  weekMood: Mood | null;
  /** Consecutive days ending today on which something was written. */
  streak: number;
  totalSessions: number;
}

/**
 * Everything the Today screen needs, in one pass.
 *
 * SECURITY PRECONDITION: `uid` comes from requireUid().
 *
 * Open loops are the interesting part. The summarizer already extracts the
 * threads a session left unresolved, and until now they were written down and
 * never seen again — which is precisely the thing a journal is supposed to be
 * good at. Carrying them forward is what makes the app feel like it remembers.
 */
export async function getHomeDigest(uid: string): Promise<HomeDigest> {
  const snap = await sessionsCol(uid).orderBy('startedAt', 'desc').limit(60).get();

  const all = snap.docs.map((d) => ({
    summary: toSessionSummary(d.id, d.data()),
    insights: d.get('insights') as Insights | undefined,
  }));

  const twoWeeksAgo = Date.now() - 14 * 86_400_000;
  const withinFortnight = all.filter(
    (s) => s.summary.startedAt && new Date(s.summary.startedAt).getTime() > twoWeeksAgo,
  );

  const openLoops: OpenLoop[] = [];
  for (const { summary, insights } of all) {
    // Sealed sessions have no insights — sealing deletes them — so they cannot
    // contribute a loop, which is correct: a sealed thread stays sealed.
    for (const text of insights?.openLoops ?? []) {
      openLoops.push({
        text,
        sessionId: summary.id,
        sessionTitle: summary.title ?? 'Untitled',
        at: summary.startedAt,
      });
    }
    if (openLoops.length >= 6) break;
  }

  const moods = withinFortnight.map((s) => s.summary.mood).filter((m): m is Mood => m !== null);
  const weekMood =
    moods.length === 0
      ? null
      : {
          valence: moods.reduce((n, m) => n + m.valence, 0) / moods.length,
          energy: moods.reduce((n, m) => n + m.energy, 0) / moods.length,
          label: moods.length === 1 ? moods[0]!.label : `${moods.length} sessions`,
        };

  // Consecutive days ending today (or yesterday — today may not have happened
  // yet, and breaking someone's streak at 00:01 would be a small cruelty).
  const days = new Set(
    all
      .map((s) => s.summary.startedAt)
      .filter((d): d is string => d !== null)
      .map((d) => new Date(d).toDateString()),
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    recent: withinFortnight.map((s) => s.summary).slice(0, 6),
    openLoops: openLoops.slice(0, 4),
    weekMood,
    streak,
    totalSessions: all.length,
  };
}
