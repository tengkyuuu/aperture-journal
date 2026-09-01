import 'server-only';

import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { adminAuth } from './firebase-admin';
import { LIMITS, SESSION_COOKIE_NAME } from '../config';

/**
 * THE ONLY SOURCE OF IDENTITY IN THIS CODEBASE.
 *
 * There is no other function that returns a uid, and no route, page, or data
 * helper accepts one from a request body, query string, path segment, or
 * header. If you find yourself writing `uid` into a Zod schema, stop — that is
 * the bug this module exists to prevent.
 */

export class Unauthenticated extends Error {
  constructor() {
    super('UNAUTHENTICATED');
    this.name = 'Unauthenticated';
  }
}

/**
 * Verify the session cookie and return its claims.
 *
 * `checkRevoked: true` costs one lookup and means a signed-out or disabled
 * account stops working immediately rather than at cookie expiry. On a journal
 * holding people's private thoughts, that trade is not close.
 */
export async function getSession(): Promise<DecodedIdToken | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    return await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    // Expired, revoked, malformed, or forged. All the same to us: no session.
    return null;
  }
}

/** Throws Unauthenticated if there is no valid session. */
export async function requireSession(): Promise<DecodedIdToken> {
  const session = await getSession();
  if (!session) throw new Unauthenticated();
  return session;
}

/**
 * The uid, verified. Pass the result of this — and nothing else — into
 * lib/server/db.ts helpers.
 */
export async function requireUid(): Promise<string> {
  return (await requireSession()).uid;
}

/**
 * Exchange a freshly minted Firebase ID token for an httpOnly session cookie.
 *
 * Two checks matter here:
 *   1. verifyIdToken(..., true) — signature, expiry, audience, and revocation.
 *   2. auth_time freshness — the token must come from a sign-in that happened
 *      in the last few minutes. Without this, a long-lived stolen ID token
 *      could be upgraded into a five-day session cookie.
 */
export async function mintSessionCookie(idToken: string): Promise<{ value: string; maxAge: number }> {
  const auth = adminAuth();
  const decoded = await auth.verifyIdToken(idToken, true);

  const authAge = Date.now() / 1000 - decoded.auth_time;
  if (authAge > LIMITS.maxAuthAgeSeconds) throw new Unauthenticated();

  const expiresIn = LIMITS.sessionCookieDays * 24 * 60 * 60 * 1000;
  const value = await auth.createSessionCookie(idToken, { expiresIn });

  return { value, maxAge: expiresIn / 1000 };
}

/** Cookie attributes, in one place so they cannot drift between set and clear. */
export function sessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true, // unreadable by JavaScript — the whole point
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // blocks cross-site POST, our first CSRF layer
    path: '/',
    maxAge,
  };
}

/** Revoke every refresh token for the user, so the cookie cannot be re-minted. */
export async function revokeSession(uid: string): Promise<void> {
  await adminAuth().revokeRefreshTokens(uid);
}
