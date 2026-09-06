'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  ReCaptchaEnterpriseProvider,
  getToken,
  initializeAppCheck,
  type AppCheck,
} from 'firebase/app-check';

import { failureFrom, failureFromThrown, type Failure } from './errors';

/**
 * One place through which every call to our own API goes.
 *
 * Centralising it means the App Check header, the JSON content type and the
 * same-origin credentials are set once rather than remembered at eleven call
 * sites — and a security header nobody has to remember is a security header
 * that stays set.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY;

let appCheck: AppCheck | null = null;
let initialised = false;

function ensureAppCheck(): AppCheck | null {
  if (initialised) return appCheck;
  initialised = true;

  // No site key means App Check is not configured for this deployment. That is
  // a supported state, not an error — the server is in observation mode too.
  if (!SITE_KEY) return null;

  try {
    const app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });

    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Attestation failing to initialise must never stop someone using their
    // own journal. The server decides whether a missing token is fatal.
    appCheck = null;
  }
  return appCheck;
}

async function appCheckHeader(): Promise<Record<string, string>> {
  const ac = ensureAppCheck();
  if (!ac) return {};
  try {
    const { token } = await getToken(ac, false);
    return { 'X-Firebase-AppCheck': token };
  } catch {
    return {};
  }
}

/** Fetch one of our own API routes. Same-origin only, by construction. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  for (const [k, v] of Object.entries(await appCheckHeader())) headers.set(k, v);

  return fetch(path, { ...init, headers, credentials: 'same-origin' });
}

/** POST JSON to one of our API routes. */
export function apiPost(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ─── Classified results ──────────────────────────────────────────────────────
// Added alongside apiFetch/apiPost rather than replacing them, so call sites
// migrate one at a time instead of in one risky sweep.

export type Result<T> = { ok: true; data: T } | { ok: false; failure: Failure };

/**
 * A JSON route, with the server's error envelope actually read.
 *
 * Times out at 20s by default. Offline is checked BEFORE the request, so a
 * dropped connection is reported as such instead of as a mystery server error.
 */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Result<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, failure: { kind: 'offline' } };
  }

  const { timeoutMs = 20_000, signal, ...rest } = init;
  const timeout = AbortSignal.timeout(timeoutMs);
  // AbortSignal.any: Chrome 116+, Safari 17.4+, Firefox 124+.
  const merged = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const res = await apiFetch(path, { ...rest, signal: merged });
    if (!res.ok) return { ok: false, failure: await failureFrom(res) };
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return { ok: false, failure: failureFromThrown(err) };
  }
}

/**
 * A streaming route. Returns the Response so the caller reads the body itself.
 *
 * Deliberately NO timeout: a long answer is not a failure, and a journal entry
 * worth thinking about is exactly the one the model takes a while over. The
 * caller's signal is the only way this ends early — which is what makes the
 * stop button possible.
 */
export async function apiStream(
  path: string,
  body: unknown,
  opts: { signal?: AbortSignal } = {},
): Promise<Result<Response>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, failure: { kind: 'offline' } };
  }

  try {
    const res = await apiFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) return { ok: false, failure: await failureFrom(res) };
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, failure: failureFromThrown(err) };
  }
}
