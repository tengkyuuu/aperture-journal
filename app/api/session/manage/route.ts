import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUid } from '@/lib/server/auth';
import { assertSafeId, sessionDoc } from '@/lib/server/db';
import { assertRequestIntegrity, BadRequest, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { DeleteSessionSchema, RenameSessionSchema } from '@/lib/shared/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/manage — rename or delete a single entry.
 *
 * ── WHY THIS EXISTS ──
 * Until now the only deletion in the app was "delete everything". That is a
 * real hole, not a missing nicety: someone writes something they regret and
 * their only remedy is to destroy their entire history. Data rights that are
 * all-or-nothing are barely data rights.
 *
 * Delete uses recursiveDelete for the same reason account deletion does — a
 * plain document delete leaves the `messages` subcollection orphaned in the
 * database, present and unreachable, which is the worst of both outcomes.
 *
 * Both actions are path-scoped to the verified uid, so a session belonging to
 * anyone else does not resolve here. There is nothing to be forbidden from.
 */
// Written out rather than intersected with the shared schemas: Zod 4's
// discriminatedUnion needs plain objects to read the discriminant from, and an
// intersection hides it. The field shapes still come from lib/shared/schemas.
const Body = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('rename'),
    sessionId: RenameSessionSchema.shape.sessionId,
    title: RenameSessionSchema.shape.title,
  }),
  z.strictObject({
    action: z.literal('delete'),
    sessionId: DeleteSessionSchema.shape.sessionId,
    confirm: DeleteSessionSchema.shape.confirm,
  }),
]);

export async function POST(req: Request) {
  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const body = await parseBody(req, Body);

    const sessionId = assertSafeId(body.sessionId);
    const ref = sessionDoc(uid, sessionId);

    const snap = await ref.get();
    if (!snap.exists) throw new BadRequest();

    if (body.action === 'rename') {
      // A sealed session has no title by design — sealing deleted it. Letting
      // one be set would leak a description of encrypted content in plaintext.
      if (snap.get('sealed') === true) throw new BadRequest();

      await ref.update({ title: body.title });
      log.info('session_renamed', { uidHash: uidTag(uid), sessionId });
      return NextResponse.json({ ok: true });
    }

    await ref.firestore.recursiveDelete(ref);
    log.info('session_deleted', { uidHash: uidTag(uid), sessionId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, '/api/session/manage');
  }
}
