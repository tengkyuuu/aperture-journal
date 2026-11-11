/**
 * Central configuration. Model IDs live in exactly one place so that a model
 * rename is a one-line change, not a grep-and-pray across the codebase.
 *
 * ══ WHY THESE PROVIDERS ══
 * The app runs at $0. Text generation is Groq's free tier; embeddings are
 * Cloudflare Workers AI's free daily allocation. Neither account has a card
 * attached, so neither can bill — a quota wall is the worst case, and the app
 * already turns that into an honest "the model is busy".
 *
 * Model identifiers move faster than any plan document. Re-check with:
 *   npm run verify:ai
 */

export const MODELS = {
  /** Conversation (Groq). Fast enough that a reply lands as you finish reading. */
  chat: 'openai/gpt-oss-120b',
  /**
   * Used when the primary is rate-limited or overloaded. A DIFFERENT model,
   * because Groq's free tier meters per model: when one is exhausted for the
   * day, another still has budget.
   */
  chatFallback: 'openai/gpt-oss-20b',
  /**
   * Session summaries (Groq). Both gpt-oss models support `strict` structured
   * output — constrained decoding, so the JSON always matches the schema.
   */
  synthesis: 'openai/gpt-oss-120b',
  synthesisFallback: 'openai/gpt-oss-20b',
  /**
   * Retrieval embeddings (Cloudflare Workers AI). bge-m3 rather than
   * bge-base-en: it is multilingual (journals are written in whatever language
   * the writer thinks in, Taglish included), it reads 8K tokens instead of 512,
   * and it costs about a sixth of the neurons, so the free 10K/day goes further.
   */
  embedding: '@cf/baai/bge-m3',
} as const;

/**
 * ══ GROQ FREE-TIER LIMITS (Nov 2026, per model) ══
 *
 *   30 requests/min · 1K requests/day · 8K tokens/min · 200K tokens/day
 *
 * 8K tokens/min is the one that bites: a single request bigger than that is
 * refused outright, not queued. So every prompt is trimmed to fit a budget
 * before it is sent — see PROMPT_BUDGET and fitTurns() in lib/server/ai.ts.
 *
 * gpt-oss models reason before answering, and reasoning tokens count against
 * max_completion_tokens. Effort is pinned to "low" (a journaling reply does
 * not need deliberation) and REASONING_HEADROOM keeps the reasoning from
 * eating the answer.
 */
export const PROMPT_BUDGET = {
  /** Estimated input tokens for one chat turn, history included. */
  chat: 4_500,
  /** Estimated input tokens for a session summary. */
  summary: 4_000,
} as const;

export const REASONING_HEADROOM = 512;

/**
 * Approximate USD per 1M tokens AT PAID-TIER RATES, used only to show what a
 * call would have cost. On the free tier the actual charge is $0 — the ledger
 * says so. Never billed against, never used for enforcement.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  '@cf/baai/bge-m3': { input: 0.012, output: 0 },
};

/**
 * Fallback when a model is not in the table above. Showing $0.00 for an
 * unpriced model would be worse than showing an approximation — a ledger that
 * quietly reports nothing for half its rows is not a ledger.
 */
export const FALLBACK_PRICE_PER_MTOK = { input: 0.15, output: 0.6 };

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
   * MEASURED for @cf/baai/bge-m3 — `npm run calibrate:echo`, 2026-11-12:
   *
   *   same subject   0.540 … 0.670
   *   adjacent       0.466 … 0.520   ← same life, different subject
   *   unrelated      0.365 … 0.480
   *
   * 0.53 is the midpoint of the (0.520, 0.540) gap. That gap is narrow — the
   * gemini-embedding-001 bands this replaced were 0.09 apart, these are 0.02 —
   * and the top "adjacent" draft is the one that shares "sleeping badly" with
   * the entry, so it is not pure noise either. If Echoes starts to feel
   * twitchy in real use, raise this toward 0.60: that still catches the two
   * strong same-subject drafts (0.667, 0.670) and only gives up the weakest
   * paraphrase. Re-run the calibration if the embedding model changes.
   */
  minScore: 0.53,
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
