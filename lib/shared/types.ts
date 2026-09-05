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

export interface UserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  vault: VaultInfo | null;
}

/** One row of the Privacy Ledger, as rendered on the Security page. */
export interface AiCall {
  id: string;
  at: string | null;
  route: string;
  model: string;
  purpose: 'chat' | 'summarize' | 'embed' | 'ask';
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
