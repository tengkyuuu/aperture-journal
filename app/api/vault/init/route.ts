import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { requireUid } from '@/lib/server/auth';
import { userDoc } from '@/lib/server/db';
import { assertSameOrigin, BadRequest, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { VaultInitSchema } from '@/lib/shared/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/init — record the salt and check blob for a new vault.
 *
 * Note what this endpoint never receives: the passphrase, or anything from
 * which the passphrase could be recovered. The salt is public by design and
 * the check blob is a known constant encrypted under the derived key.
 *
 * Note also what it refuses to do: overwrite an existing vault. Replacing the
 * salt would silently orphan every entry already sealed under the old one —
 * the data would still be there and would never be readable again.
 */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const uid = await requireUid();
    const { salt, check } = await parseBody(req, VaultInitSchema);

    const ref = userDoc(uid);
    const snap = await ref.get();
    if (snap.get('vault')?.salt) {
      // Fail closed rather than destroy data.
      log.warn('vault_reinit_refused', { uidHash: uidTag(uid) });
      throw new BadRequest();
    }

    await ref.set(
      { vault: { salt, check, enabledAt: FieldValue.serverTimestamp() } },
      { merge: true },
    );

    log.info('vault_initialised', { uidHash: uidTag(uid) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, '/api/vault/init');
  }
}
