/**
 * Central configuration. Model IDs live in exactly one place so that a model
 * rename is a one-line change, not a grep-and-pray across the codebase.
 *
 * VERIFY THESE IN GOOGLE AI STUDIO BEFORE THE FIRST BUILD. Model identifiers
 * move faster than any plan document.
 */

export const MODELS = {
  /**
   * Conversation. Chosen empirically on 2026-09-05 against the live API, not
   * from documentation — see the findings below.
   */
  chat: 'gemini-3.5-flash',
  /** Session summaries. Same model; structured output verified working. */
  synthesis: 'gemini-3.5-flash',
  /** Retrieval embeddings for "Ask Your Past". 768 dims verified. */
  embedding: 'gemini-embedding-001',
} as const;

/**
 * ══ MODEL SELECTION — measured, not guessed ══
 *
 * `gemini-2.5-flash` is GONE. The API returns 404 "no longer available to new
 * users" and points at gemini-3.6-flash. This is exactly the drift the sprint
 * plan flagged as a standing risk, which is why every model id lives here.
 *
 * What the newer flash models actually do, tested with this app's own request
 * shapes:
 *
 *   gemini-3.6-flash   REJECTS thinkingConfig.thinkingBudget: 0 with a bare
 *                      400 "invalid argument". Works with no thinkingConfig or
 *                      a positive budget, spending ~300-400 thinking tokens
 *                      and ~3.5s per reply.
 *   gemini-3.8-flash   Same rejection of budget 0. Also returned 503 "high
 *                      demand" on several calls — a real risk mid-demo.
 *   gemini-3.5-flash   Accepts thinkingBudget: 0. ~1.4s per chat reply, the
 *                      fastest of the three, and no 503s observed.
 *
 * So: 3.5-flash, with thinking disabled. A journaling reply should land
 * immediately; the model does not need to deliberate to ask a good question,
 * and 1.4s versus 3.5s is the difference between a conversation and a wait.
 *
 * IF YOU MIGRATE to 3.6/3.8 you MUST drop `thinkingBudget: 0` from streamChat
 * in lib/server/gemini.ts, or every chat request will 400.
 *
 * Re-check with: npm run verify:gemini
 */

/**
 * Approximate USD per 1M tokens, used only to render an honest cost estimate in
 * the Privacy Ledger. These are estimates shown to the user as estimates —
 * never billed against, never used for enforcement. Verify against current
 * pricing before the demo.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash': { input: 0.3, output: 2.5 },
  'gemini-3.6-flash': { input: 0.3, output: 2.5 },
  'gemini-3.8-flash': { input: 0.3, output: 2.5 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
};

/**
 * Fallback when a model is not in the table above. Showing $0.00 for an
 * unpriced model would be worse than showing an approximation — a ledger that
 * quietly reports nothing for half its rows is not a ledger.
 */
export const FALLBACK_PRICE_PER_MTOK = { input: 0.3, output: 2.5 };

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
