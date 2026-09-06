import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/server/auth';
import { embed, estimateTokens } from '@/lib/server/gemini';
import { assertRequestIntegrity, parseBody, toErrorResponse } from '@/lib/server/http';
import { recordAiCall } from '@/lib/server/ledger';
import { log, uidTag } from '@/lib/server/logger';
import { getProfile } from '@/lib/server/queries';
import { consumeQuota } from '@/lib/server/ratelimit';
import { retrieve } from '@/lib/server/retrieval';
import { EchoRequestSchema } from '@/lib/shared/schemas';
import { ECHO, MODELS } from '@/lib/config';
import type { Echo } from '@/lib/shared/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/echo — has this been written before?
 *
 * ══ WHAT MAKES THIS DIFFERENT FROM EVERY OTHER ROUTE HERE ══
 * It receives text the user has NOT sent. A draft mid-sentence, which they may
 * delete, and which they never chose to submit anywhere. That is a real
 * escalation of what leaves the machine, and it is exactly the kind of change
 * this project exists to refuse to make quietly. Hence:
 *
 *   1. It is off unless the user turned it on, and THIS ROUTE checks that —
 *      not the UI. A client that forgets the toggle gets a 403.
 *   2. It writes a `draft_text` ledger row before it can return anything, so
 *      the disclosure cannot be skipped by an early return.
 *   3. One embedding call. No generation. The mood delta below is arithmetic
 *      over data already stored, because asking a model how someone's feelings
 *      changed invites it to invent a feeling they did not have.
 *
 * Sealed entries cannot appear in the results. Not by a filter here — sealing
 * deletes the embedding, so they are absent from retrieval by construction.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const { draft, sessionId } = await parseBody(req, EchoRequestSchema);

    // ── The consent gate ────────────────────────────────────────────────────
    // Server-side, and before the draft is used for anything. The client also
    // checks, but a UI toggle is not a control — this is.
    const profile = await getProfile(uid);
    if (!profile.settings.echoes) {
      return NextResponse.json(
        {
          error: 'echoes_disabled',
          message: 'Echoes is off. Turn it on in your profile first.',
        },
        { status: 403 },
      );
    }

    if (draft.length < ECHO.minChars) {
      return NextResponse.json({ echoes: [] satisfies Echo[] });
    }

    const text = draft.slice(0, ECHO.maxDraftChars);
    const inputTokens = estimateTokens(text);
    await consumeQuota(uid, inputTokens);

    const { values } = await embed(text, 'RETRIEVAL_QUERY');

    // Ledgered immediately. Every path from here on has already disclosed
    // that an unsent draft was sent, including the paths that find nothing.
    await recordAiCall(uid, {
      route: '/api/echo',
      model: MODELS.embedding,
      purpose: 'echo',
      inputTokens,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      dataClasses: ['draft_text'],
      sealedExcluded: 0,
      ...(sessionId ? { sessionId } : {}),
    });

    const candidates = await retrieve(uid, values, ECHO.topK);

    const cutoff = Date.now() - ECHO.minAgeDays * 86_400_000;
    const matches = candidates.filter(
      (c) =>
        c.score >= ECHO.minScore &&
        c.sessionId !== sessionId &&
        c.startedAt !== null &&
        c.startedAt.getTime() < cutoff,
    );

    // The reference point for the delta: the most recent entry with a mood,
    // whatever it was about. "You were lighter then than you have been lately"
    // needs a "lately", and the newest scored candidate is not it — these are
    // ordered by similarity, not by date.
    const recentValence = mostRecentValence(candidates, matches);

    const echoes: Echo[] = matches.slice(0, 2).map((m) => ({
      sessionId: m.sessionId,
      title: m.title,
      startedAt: m.startedAt?.toISOString() ?? null,
      score: Number(m.score.toFixed(3)),
      moodThen: m.mood,
      valenceDelta:
        m.mood && recentValence !== null
          ? Number((recentValence - m.mood.valence).toFixed(3))
          : null,
    }));

    log.info('echo_checked', {
      route: '/api/echo',
      uidHash: uidTag(uid),
      model: MODELS.embedding,
      scanned: candidates.length,
      count: echoes.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ echoes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return toErrorResponse(err, '/api/echo');
  }
}

/**
 * The newest mood among entries that are NOT one of the matches.
 *
 * Comparing a matched entry against itself would always read "no change", and
 * comparing it against the other match would be comparing two old entries. The
 * question the card answers is "how do I feel about this now, versus then", so
 * the baseline has to be recent and separate.
 */
function mostRecentValence(
  candidates: { sessionId: string; startedAt: Date | null; mood: { valence: number } | null }[],
  matches: { sessionId: string }[],
): number | null {
  const excluded = new Set(matches.map((m) => m.sessionId));

  const newest = candidates
    .filter((c) => !excluded.has(c.sessionId) && c.mood && c.startedAt)
    .sort((a, b) => b.startedAt!.getTime() - a.startedAt!.getTime())[0];

  return newest?.mood?.valence ?? null;
}
