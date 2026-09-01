/**
 * Central configuration. Model IDs live in exactly one place so that a model
 * rename is a one-line change, not a grep-and-pray across the codebase.
 *
 * VERIFY THESE IN GOOGLE AI STUDIO BEFORE THE FIRST BUILD. Model identifiers
 * move faster than any plan document.
 */

export const MODELS = {
  /** Conversation. Fast, cheap, thinking disabled for latency. */
  chat: 'gemini-2.5-flash',
  /** Session summaries and weekly synthesis. Structured output. */
  synthesis: 'gemini-2.5-flash',
  /** Retrieval embeddings for "Ask Your Past". */
  embedding: 'gemini-embedding-001',
} as const;

/**
 * Approximate USD per 1M tokens, used only to render an honest cost estimate in
 * the Privacy Ledger. These are estimates shown to the user as estimates —
 * never billed against, never used for enforcement. Verify against current
 * pricing before the demo.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
};

/** Hard ceilings. Every model call is bounded; unbounded inference is a bill. */
export const LIMITS = {
  maxOutputTokens: 1200,
  maxMessageChars: 8_000,
  maxTurnsPerRequest: 40,
  /** Per-user, per-UTC-day. Denial-of-wallet defence. */
  dailyChatCalls: 120,
  dailyTokens: 400_000,
  /** Session cookie lifetime. Firebase caps this at 14 days. */
  sessionCookieDays: 5,
  /** An ID token must have been minted this recently to be exchanged for a cookie. */
  maxAuthAgeSeconds: 5 * 60,
} as const;

export const SESSION_COOKIE_NAME = '__session';

export type ConversationMode = 'reflect' | 'brainstorm' | 'untangle' | 'duck';

export const MODE_LABELS: Record<ConversationMode, string> = {
  reflect: 'Reflect',
  brainstorm: 'Brainstorm',
  untangle: 'Untangle',
  duck: 'Rubber Duck',
};
