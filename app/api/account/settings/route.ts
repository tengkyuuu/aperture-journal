import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/server/auth';
import { userDoc } from '@/lib/server/db';
import { assertRequestIntegrity, parseBody, toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';
import { SettingsSchema } from '@/lib/shared/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/account/settings — update preferences.
 *
 * This route exists because the client cannot write to Firestore at all. That
 * is the whole posture: read your own subtree, write nothing. A settings change
 * therefore costs a round-trip, which was called out as an accepted cost when
 * the rules were written — and this is that cost being paid.
 *
 * The merge is deliberately shallow-into-`settings` rather than a whole-user
 * `set`: a client that could replace the user document could also blank its own
 * `vault` field and orphan every sealed entry it owns.
 */
export async function POST(req: Request) {
  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const patch = await parseBody(req, SettingsSchema);

    // Only the keys actually sent are written, so a partial update cannot
    // silently reset the preferences it did not mention.
    const update: Record<string, unknown> = {};
    if (patch.defaultMode !== undefined) update['settings.defaultMode'] = patch.defaultMode;
    if (patch.reduceMotion !== undefined) update['settings.reduceMotion'] = patch.reduceMotion;

    if (Object.keys(update).length > 0) {
      await userDoc(uid).set({ settings: {} }, { merge: true });
      await userDoc(uid).update(update);
    }

    log.info('settings_updated', { uidHash: uidTag(uid), count: Object.keys(update).length });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, '/api/account/settings');
  }
}
