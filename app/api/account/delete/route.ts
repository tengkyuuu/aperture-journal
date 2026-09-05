import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSession, sessionCookieOptions } from '@/lib/server/auth';
import { userDoc } from '@/lib/server/db';
import { adminAuth } from '@/lib/server/firebase-admin';
import { assertSameOrigin, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { SESSION_COOKIE_NAME } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DeleteSchema = z.strictObject({
  /** Typed by hand in the UI. A checkbox is too easy to hit by accident. */
  confirm: z.literal('DELETE EVERYTHING'),
});

/**
 * POST /api/account/delete — remove everything, permanently.
 *
 * Order matters here. Firestore data goes first, then the auth user. If the
 * auth record were deleted first and the Firestore delete then failed, the
 * data would be orphaned under a uid nobody can sign in as — unreachable by
 * its owner, still present on disk. That is the worst of both outcomes.
 *
 * recursiveDelete walks the whole subtree, including the message
 * subcollections that a plain document delete would silently leave behind.
 * Orphaned subcollections are the classic Firestore deletion bug.
 */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const session = await requireSession();
    const uid = session.uid;

    await parseBody(req, DeleteSchema);

    const db = userDoc(uid).firestore;
    await db.recursiveDelete(userDoc(uid));

    await adminAuth().deleteUser(uid);

    log.info('account_deleted', { uidHash: uidTag(uid) });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...sessionCookieOptions(0), name: SESSION_COOKIE_NAME, value: '' });
    return res;
  } catch (err) {
    return toErrorResponse(err, '/api/account/delete');
  }
}
