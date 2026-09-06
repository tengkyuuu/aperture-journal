/**
 * Central configuration. Model IDs live in exactly one place so that a model
 * rename is a one-line change, not a grep-and-pray across the codebase.
 *
 * VERIFY THESE IN GOOGLE AI STUDIO BEFORE THE FIRST BUILD. Model identifiers
 * move faster than any plan document.
 */

export const MODELS = {
  /** Conversation. Measured against the live API — see the findings below. */
  chat: 'gemini-3.1-flash-lite',
  /**
   * Used when the primary is rate-limited or overloaded. A DIFFERENT model,
   * because the free tier meters per model: when one is exhausted for the day,
   * another still has budget.
   */
  chatFallback: 'gemini-3.8-flash',
  /** Session summaries. Structured output verified working. */
  synthesis: 'gemini-3.1-flash-lite',
  synthesisFallback: 'gemini-3.8-flash',
  /** Retrieval embeddings for "Ask Your Past". 768 dims verified. */
  embedding: 'gemini-embedding-001',
} as const;

/**
 * ══ MODEL SELECTION — measured, and re-measured ══
 *
 * `gemini-2.5-flash` is GONE: 404, "no longer available to new users".
 *
 * Two rounds of probing with this app's own request shapes, a day apart,
 * because the first round drew a wrong conclusion worth recording:
 *
 *   gemini-3.6-flash        REJECTS thinkingConfig.thinkingBudget: 0 with a
 *                           bare 400. Real and reproducible.
 *   gemini-3.5-flash-lite   Same 400.
 *   gemini-flash-lite-latest Same 400.
 *   gemini-3.8-flash        ACCEPTS budget 0. The first round recorded it as
 *                           rejecting — that was a 503 under load misread as
 *                           the 400 its neighbour returned. Fast when it
 *                           answers, but 503s often enough to be a demo risk.
 *   gemini-3.1-flash-lite   Accepts budget 0. ~0.7s chat, ~1.0s structured
 *                           output, correct mood polarity. No 503s observed.
 *
 * So: 3.1-flash-lite primary, 3.8-flash as the fallback. A journaling reply
 * should land immediately, and sub-second is the difference between a
 * conversation and a wait.
 *
 * IF YOU MIGRATE to 3.6 or either flash-lite-latest, you MUST drop
 * `thinkingBudget: 0` from streamChat or every chat request will 400.
 *
 * On a PAID project, prefer gemini-3.8-flash or gemini-flash-latest for the
 * primary — better quality, and the 503s are a free-tier capacity artefact.
 *
 * Re-check any time with: npm run verify:gemini
 */

/**
 * Approximate USD per 1M tokens, used only to render an honest cost estimate in
 * the Privacy Ledger. These are estimates shown to the user as estimates —
 * never billed against, never used for enforcement. Verify against current
 * pricing before the demo.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-3.1-flash-lite': { input: 0.1, output: 0.4 },
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
  /**
   * How many messages of one session are loaded at once.
   *
   * ONE number, used by the read AND by the seal schema, deliberately. They
   * used to disagree — the query returned 200 while SealRequestSchema accepted
   * 400 — and a session between those bounds could be sealed from a client
   * that had only ever seen part of it. The seal route then deleted the
   * plaintext of everything it had no ciphertext for. That gap is only
   * possible while two constants describe one invariant.
   */
  maxMessagesPerSession: 200,
  /** Per-user, per-UTC-day. Denial-of-wallet defence. */
  dailyChatCalls: 120,
  dailyTokens: 400_000,
  /** Session cookie lifetime. Firebase caps this at 14 days. */
  sessionCookieDays: 5,
  /** An ID token must have been minted this recently to be exchanged for a cookie. */
  maxAuthAgeSeconds: 5 * 60,
} as const;

/**
 * Echoes — thresholds.
 *
 * Every number here exists to stop the feature being twitchy. One wrong echo
 * costs more than ten right ones: a false positive makes it feel stupid and
 * people stop reading them, permanently. So each threshold errs toward
 * silence.
 */
export const ECHO = {
  /** Interrupting mid-sentence is unforgivable. Wait for a real pause. */
  pauseMs: 2_500,
  /** Below this, everything looks like everything. */
  minChars: 120,
  /** Stops it re-firing on the same thought. */
  minCharsChanged: 60,
  /** Restraint, and free-tier rate limits. */
  cooldownMs: 20_000,
  /**
   * Below this similarity it surfaces noise and loses trust instantly.
   *
   * MEASURED, not guessed — `npm run calibrate:echo` scores drafts against a
   * realistic entry in three bands:
   *
   *   same subject   0.729 … 0.773
   *   adjacent       0.597 … 0.636   ← same life, different subject
   *   unrelated      0.539 … 0.554
   *
   * So anything in (0.636, 0.729) separates them. This was 0.72 on the
   * argument that the bar should err high, which was the right instinct and
   * the wrong number: it left 0.009 of headroom above the weakest true match,
   * and the e2e echo assertion passed or failed depending on the run. 0.68 is
   * the midpoint — still far above an adjacent entry, no longer on a knife
   * edge. Re-run the calibration if the embedding model changes.
   */
  minScore: 0.68,
  /** "You wrote this yesterday" is not an insight. */
  minAgeDays: 7,
  /** How many candidates to score before filtering. */
  topK: 8,
  /** Never send more of an unsent draft than this. */
  maxDraftChars: 2_000,
} as const;

export const SESSION_COOKIE_NAME = '__session';

/**
 * Where to send someone whose session cookie exists but does not verify.
 *
 * NOT '/sign-in' — middleware would see the still-present cookie and bounce
 * them straight back, which is an infinite redirect. This route clears the
 * cookie first. See app/api/auth/clear/route.ts.
 */
export const CLEAR_SESSION_PATH = '/api/auth/clear';

export type ConversationMode = 'reflect' | 'brainstorm' | 'untangle' | 'duck';

export const MODE_LABELS: Record<ConversationMode, string> = {
  reflect: 'Reflect',
  brainstorm: 'Brainstorm',
  untangle: 'Untangle',
  duck: 'Rubber Duck',
};
