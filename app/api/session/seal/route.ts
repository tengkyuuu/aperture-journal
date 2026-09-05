import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { requireUid } from '@/lib/server/auth';
import { assertSafeId, messagesCol, sessionDoc } from '@/lib/server/db';
import { assertRequestIntegrity, BadRequest, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { SealRequestSchema } from '@/lib/shared/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/seal — replace a session's plaintext with ciphertext.
 *
 * The client encrypted these blobs in the browser. This route never sees a
 * key, a passphrase, or a plaintext; it swaps stored content for the blob and
 * then destroys every derived artefact.
 *
 * That last part matters more than it looks. A summary is a lossy copy of the
 * content. An embedding is a lossy copy of the summary. Themes and a mood
 * label are a lossy copy of both. Sealing a session while leaving its summary
 * behind would be encryption theatre — the interesting part would still be
 * sitting in the database in the clear. So they all go, in the same atomic
 * batch as the ciphertext lands.
 *
 * This is also why the UI says plainly that sealed entries lose their AI
 * features. That is not a limitation we failed to solve; it is what the
 * guarantee costs.
 */
export async function POST(req: Request) {
  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const body = await parseBody(req, SealRequestSchema);
    const sessionId = assertSafeId(body.sessionId);

    const ref = sessionDoc(uid, sessionId);
    const snap = await ref.get();
    // Path-scoped: a session id belonging to anyone else simply does not
    // resolve here, so this is a 400 rather than a 403 — there is nothing to
    // be forbidden from.
    if (!snap.exists) throw new BadRequest();
    if (snap.get('sealed') === true) return NextResponse.json({ ok: true, alreadySealed: true });

    const existing = await messagesCol(uid, sessionId).get();
    const known = new Set(existing.docs.map((d) => d.id));

    // Every id must belong to this session. Reject the whole request rather
    // than partially sealing, which would leave a session half readable.
    for (const m of body.messages) {
      if (!known.has(m.id)) throw new BadRequest();
    }

    const batch = ref.firestore.batch();

    for (const m of body.messages) {
      batch.update(messagesCol(uid, sessionId).doc(m.id), {
        cipher: m.cipher,
        sealed: true,
        content: FieldValue.delete(),
      });
    }

    // Any message the client did not send ciphertext for gets its plaintext
    // removed too. Leaving one behind would defeat the whole exercise.
    for (const doc of existing.docs) {
      if (body.messages.some((m) => m.id === doc.id)) continue;
      batch.update(doc.ref, { sealed: true, content: FieldValue.delete() });
    }

    batch.update(ref, {
      sealed: true,
      status: 'closed',
      sealedAt: FieldValue.serverTimestamp(),
      title: FieldValue.delete(),
      summary: FieldValue.delete(),
      insights: FieldValue.delete(),
      embedding: FieldValue.delete(),
    });

    await batch.commit();

    log.info('session_sealed', {
      uidHash: uidTag(uid),
      sessionId,
      count: body.messages.length,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, '/api/session/seal');
  }
}
