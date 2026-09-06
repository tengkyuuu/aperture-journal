'use client';

/**
 * What went wrong, and whether trying again could possibly help.
 *
 * ── WHY THIS EXISTS ──
 * `lib/server/http.ts` carefully returns `{ error: 'rate_limited' }`,
 * `'provider_busy'`, `'bad_request'` and the rest — and not one client ever
 * read it. Every call site branched on `res.status` alone and wrote its own
 * sentence at the throw site, which is how the app ended up with seven
 * independent error slots, inconsistent copy, and one screen telling an
 * out-of-quota user to "try ending it again" — an action that cannot succeed
 * until midnight UTC and spends more quota on every attempt.
 *
 * Classification belongs in one place. So does the decision about whether a
 * retry button appears, because that decision is a property of what failed,
 * not of who is asking.
 *
 * ── RETRY IS ALWAYS A BUTTON, NEVER A TIMER ──
 * Deliberately no automatic backoff here. `lib/server/gemini.ts` already
 * retries and falls back to a second model; a client loop on top multiplies
 * it. And the daily quota is denial-of-wallet defence — spending another of
 * someone's 120 calls is their decision, not a setTimeout's.
 */

export type Failure =
  /** Detected before the request left, or a fetch that threw while offline. */
  | { kind: 'offline' }
  /** 429 — the user's own daily budget, not the provider's. */
  | { kind: 'rate_limited' }
  /** 503 — Gemini is busy. Not a bug, and worth trying shortly. */
  | { kind: 'provider_busy' }
  | { kind: 'unauthenticated' }
  | { kind: 'attestation' }
  | { kind: 'bad_request' }
  /**
   * 422 — the request was fine but there is nothing to act on. The server
   * supplies the sentence, because it knows something the client does not
   * (see /api/ask, which explains an empty corpus better than we could here).
   */
  | { kind: 'unavailable'; detail: string }
  | { kind: 'timeout' }
  /**
   * The USER stopped it. In the union so that every call site is forced to
   * think about it, and never rendered — without this, pressing "stop"
   * produces "connection lost", which is the classic version of that bug.
   */
  | { kind: 'aborted' }
  | { kind: 'server' };

/** Server envelope → Failure. Falls back to the status when the body is not ours. */
export async function failureFrom(res: Response): Promise<Failure> {
  // A proxy 502 returns HTML, and a stream may have no body to read at all.
  let code: string | undefined;
  let detail: string | undefined;
  try {
    const body = (await res.clone().json()) as { error?: string; message?: string };
    code = body?.error;
    detail = body?.message;
  } catch {
    /* not JSON. The status still tells us enough. */
  }

  if (code === 'rate_limited' || res.status === 429) return { kind: 'rate_limited' };
  if (code === 'provider_busy' || res.status === 503) return { kind: 'provider_busy' };
  if (code === 'unauthenticated' || res.status === 401) return { kind: 'unauthenticated' };
  if (code === 'failed_attestation' || res.status === 403) return { kind: 'attestation' };
  if (res.status === 422) {
    return { kind: 'unavailable', detail: detail ?? 'There is nothing to work with yet.' };
  }
  if (code === 'bad_request' || res.status === 400) return { kind: 'bad_request' };
  return { kind: 'server' };
}

/** A thrown fetch → Failure. */
export function failureFromThrown(err: unknown): Failure {
  if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'aborted' };
  if (err instanceof DOMException && err.name === 'TimeoutError') return { kind: 'timeout' };

  // navigator.onLine === true is not a promise of connectivity — a captive
  // portal reports online — so only claim offline when the browser is certain.
  // Otherwise this is indistinguishable from the server being unreachable.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
  return { kind: 'server' };
}

/**
 * Could trying the exact same thing again succeed?
 *
 * `rate_limited` is false, and that is the point: it makes the summarize-429
 * bug unreachable rather than merely fixed. Nobody can reintroduce it by
 * forgetting an `if` at a call site.
 */
export function isRetryable(f: Failure): boolean {
  switch (f.kind) {
    case 'offline':
    case 'provider_busy':
    case 'timeout':
    case 'server':
      return true;
    default:
      return false;
  }
}

/**
 * The words. Calm, concrete, and always explicit about where the writing is —
 * the one thing someone actually wants to know when a journal fails.
 */
export function describe(f: Failure): { title: string; body?: string } {
  switch (f.kind) {
    case 'offline':
      return {
        title: 'You are offline.',
        body: 'Nothing was sent. What you wrote is still here.',
      };
    case 'rate_limited':
      return {
        title: "That is today's limit.",
        body: 'It resets at midnight UTC. Nothing was lost.',
      };
    case 'provider_busy':
      return { title: 'Gemini is busy right now.', body: 'Worth trying again in a moment.' };
    case 'timeout':
      return { title: 'That took too long.', body: 'Nothing was sent.' };
    case 'unauthenticated':
      return { title: 'Your session expired.', body: 'Sign in again to pick up where you left off.' };
    case 'attestation':
      return { title: 'This browser could not be verified.', body: 'Reload and try once more.' };
    case 'unavailable':
      return { title: f.detail };
    case 'bad_request':
      return { title: 'That did not go through.' };
    case 'aborted':
      // Never rendered. Present so the switch is exhaustive.
      return { title: '' };
    case 'server':
      return { title: 'That did not go through.', body: 'Nothing was changed.' };
  }
}
