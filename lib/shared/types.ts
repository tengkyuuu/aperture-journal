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
  content: string | null;
  sealed: boolean;
  createdAt: string | null;
}

export interface UserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
