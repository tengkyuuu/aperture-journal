import type { ConversationMode } from '../config';

/**
 * Shapes that cross the server/client boundary.
 *
 * Everything here is already serialised — Firestore Timestamps become ISO
 * strings before they leave a Server Component, because a Timestamp is not a
 * plain object and React will refuse to pass it.
 */

export interface Mood {
  /** -1 (heavy) … 1 (light). */
  valence: number;
  /** 0 (flat) … 1 (charged). */
  energy: number;
  /** A word for it. Mood is never encoded by colour alone. */
  label: string;
}

export interface Emotion {
  name: string;
  intensity: number;
}

export interface Entity {
  name: string;
  type: 'person' | 'place' | 'project' | 'concept';
}

/**
 * The structured object Gemini returns when a session closes. One call
 * produces the summary, the mood ribbon, the theme graph, and the weekly
 * chapter — which is why the enhancement budget fits in a four-day sprint.
 */
export interface Insights {
  title: string;
  summary: string;
  bullets: string[];
  openLoops: string[];
  mood: Mood;
  emotions: Emotion[];
  themes: string[];
  entities: Entity[];
  suggestedExperiment: string;
}

export interface SessionSummary {
  id: string;
  title: string | null;
  mode: ConversationMode;
  status: 'open' | 'closed';
  sealed: boolean;
  messageCount: number;
  /** ISO string, or null while the server timestamp is still resolving. */
  startedAt: string | null;
  endedAt: string | null;
  mood: Mood | null;
  themes: string[];
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'model';
  /** Present only when `sealed` is false. */
  content: string | null;
  /** Present only when `sealed` is true. base64(iv + ciphertext + tag). */
  cipher: string | null;
  sealed: boolean;
  createdAt: string | null;
}

/**
 * Vault parameters. Neither field is secret: the salt defeats precomputed
 * tables, and `check` is a known constant encrypted under the derived key so a
 * passphrase can be verified without storing anything derived from it.
 */
export interface VaultInfo {
  salt: string;
  check: string;
}

/** Preferences. `theme` stays per-device in localStorage, deliberately. */
export interface UserSettings {
  defaultMode: import('../config').ConversationMode;
  reduceMotion: boolean;
  /**
   * Echoes. OFF unless the user turned it on.
   *
   * This is the only setting that changes what leaves the device, so it is the
   * only one that defaults to off. See app/api/echo/route.ts — the server
   * checks this too; the toggle is not the control.
   */
  echoes: boolean;
}

/**
 * One echo: a past entry the draft resembles.
 *
 * `moodThen` is the mood recorded when that entry was closed. `valenceDelta`
 * compares it with the most recent entry that has a mood, so the card can say
 * the direction things have moved without a model inventing a feeling. It is
 * null when there is nothing to compare against.
 */
export interface Echo {
  sessionId: string;
  title: string;
  startedAt: string | null;
  score: number;
  moodThen: Mood | null;
  valenceDelta: number | null;
}

export interface UserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  vault: VaultInfo | null;
  settings: UserSettings;
}

/** Everything the profile page counts, derived from the user's own data. */
export interface ProfileStats {
  totalSessions: number;
  closedSessions: number;
  sealedSessions: number;
  openSessions: number;
  streak: number;
  firstEntry: string | null;
  themes: { name: string; count: number }[];
  aiCalls: number;
  totalTokens: number;
  estCostUsd: number;
}

/** One row of the Privacy Ledger, as rendered on the Security page. */
export interface AiCall {
  id: string;
  at: string | null;
  route: string;
  model: string;
  purpose: 'chat' | 'summarize' | 'embed' | 'ask' | 'echo';
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  latencyMs: number;
  dataClasses: string[];
  sealedExcluded: number;
  sessionId: string | null;
}

export interface SecurityEvent {
  id: string;
  at: string | null;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
  sessionId: string | null;
}
