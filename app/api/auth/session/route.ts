import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import {
  getSession,
  mintSessionCookie,
  revokeSession,
  sessionCookieOptions,
  Unauthenticated,
} from '@/lib/server/auth';
import { userDoc } from '@/lib/server/db';
import { assertSameOrigin, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { SessionRequestSchema } from '@/lib/shared/schemas';
import { SESSION_COOKIE_NAME } from '@/lib/config';

// firebase-admin and the Secret Manager client are Node libraries; the Edge
// runtime cannot host them.
export const runtime = 'nodejs';

/**
 * POST — exchange a fresh Firebase ID token for an httpOnly session cookie.
 *
 * After this call the browser holds no JavaScript-readable credential at all.
 * The client SDK is configured with in-memory persistence (see
 * lib/client/firebase.ts) so the ID token never reaches IndexedDB either.
 */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const { idToken } = await parseBody(req, SessionRequestSchema);

    // Verifies signature, expiry, audience, revocation, and sign-in freshness.
    const { value, maxAge } = await mintSessionCookie(idToken);

    // The profile document is written by PUT below, server-side. Clients cannot
    // write it at all — see firestore.rules — which makes uid spoofing
    // structurally impossible rather than merely validated against.
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...sessionCookieOptions(maxAge), value });
    return res;
  } catch (err) {
    return toErrorResponse(err, 'auth/session:POST');
  }
}

/**
 * PUT — idempotent profile upsert for the signed-in user.
 * Called once after sign-in. Separate from POST because it requires the cookie
 * that POST has only just set.
 */
export async function PUT() {
  try {
    await assertSameOrigin();
    const session = await getSession();
    if (!session) throw new Unauthenticated();

    await userDoc(session.uid).set(
      {
        uid: session.uid,
        email: session.email ?? null,
        displayName: session.name ?? null,
        photoURL: session.picture ?? null,
        lastSeenAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    log.info('session_established', { uidHash: uidTag(session.uid) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, 'auth/session:PUT');
  }
}

/**
 * DELETE — sign out.
 *
 * Revokes every refresh token before clearing the cookie, so an attacker
 * holding a copy of the cookie cannot keep using it. Clearing the cookie alone
 * would only sign out the honest browser.
 */
export async function DELETE() {
  try {
    await assertSameOrigin();
    const session = await getSession();
    if (session) {
      await revokeSession(session.uid);
      log.info('session_revoked', { uidHash: uidTag(session.uid) });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...sessionCookieOptions(0), name: SESSION_COOKIE_NAME, value: '' });
    return res;
  } catch (err) {
    return toErrorResponse(err, 'auth/session:DELETE');
  }
}
