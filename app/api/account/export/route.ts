import { requireUid } from '@/lib/server/auth';
import { aiCallsCol, chaptersCol, messagesCol, securityEventsCol, sessionsCol, userDoc } from '@/lib/server/db';
import { toErrorResponse } from '@/lib/server/http';
import { log, uidTag } from '@/lib/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/account/export — everything we hold about you, as JSON.
 *
 * A GET rather than a POST because it changes nothing, and because a plain
 * link is the least fussy way to offer it.
 *
 * Sealed entries are exported as the ciphertext we actually store. We cannot
 * decrypt them for the export any more than we can for anything else — so the
 * export includes the blobs and says so, rather than silently omitting the
 * entries and leaving you to think they were never there.
 */
export async function GET() {
  try {
    const uid = await requireUid();

    const [profileSnap, sessionsSnap, callsSnap, eventsSnap, chaptersSnap] = await Promise.all([
      userDoc(uid).get(),
      sessionsCol(uid).orderBy('startedAt', 'asc').get(),
      aiCallsCol(uid).orderBy('at', 'asc').get(),
      securityEventsCol(uid).orderBy('at', 'asc').get(),
      chaptersCol(uid).get(),
    ]);

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (s) => {
        const msgs = await messagesCol(uid, s.id).orderBy('createdAt', 'asc').get();
        return {
          id: s.id,
          ...s.data(),
          messages: msgs.docs.map((m) => ({ id: m.id, ...m.data() })),
        };
      }),
    );

    const profile = profileSnap.data() ?? {};

    const payload = {
      exportedAt: new Date().toISOString(),
      note:
        'Sealed entries appear here as ciphertext (the `cipher` field). They are encrypted ' +
        'with a key derived from your passphrase, which this service has never received and ' +
        'therefore cannot use. Decrypt them with the same passphrase you sealed them with.',
      profile: {
        ...profile,
        // The salt and check blob are included because they are needed to
        // decrypt an export elsewhere, and neither is secret.
      },
      sessions,
      aiCalls: callsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      securityEvents: eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      chapters: chaptersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    log.info('account_exported', { uidHash: uidTag(uid), count: sessions.length });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="aperture-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return toErrorResponse(err, '/api/account/export');
  }
}
