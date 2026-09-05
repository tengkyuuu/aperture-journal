'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  ReCaptchaEnterpriseProvider,
  getToken,
  initializeAppCheck,
  type AppCheck,
} from 'firebase/app-check';

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
