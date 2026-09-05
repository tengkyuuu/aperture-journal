import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { requireUid } from '@/lib/server/auth';
import { assertSafeId, messagesCol, sessionDoc } from '@/lib/server/db';
import { embed, estimateTokens, summarizeSession } from '@/lib/server/gemini';
import { assertSameOrigin, BadRequest, parseBody, toErrorResponse } from '@/lib/server/http';
import { recordAiCall } from '@/lib/server/ledger';
import { log, uidTag } from '@/lib/server/logger';
import { consumeQuota, settleQuota } from '@/lib/server/ratelimit';
import { InsightsSchema, SummarizeRequestSchema } from '@/lib/shared/schemas';
import { MODELS } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/summarize — the Closing Ritual.
 *
 * Distils a session into a typed insight object and persists it. Sealed
 * messages are excluded by construction: their plaintext does not exist on the
 * server, so there is nothing here that could accidentally include them.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    await assertSameOrigin();
    const uid = await requireUid();
    const { sessionId: rawId } = await parseBody(req, SummarizeRequestSchema);
    const sessionId = assertSafeId(rawId);

    const ref = sessionDoc(uid, sessionId);
    const snap = await ref.get();
    if (!snap.exists) throw new BadRequest();

    const msgs = await messagesCol(uid, sessionId).orderBy('createdAt', 'asc').limit(200).get();

    const all = msgs.docs;
    const usable = all
      .filter((d) => d.get('sealed') !== true && typeof d.get('content') === 'string')
      .map((d) => ({
        role: d.get('role') === 'model' ? ('model' as const) : ('user' as const),
        content: d.get('content') as string,
      }));

    // Nothing to distil. Not an error — an empty or fully sealed session is a
    // legitimate thing to have.
    if (usable.length < 2) {
      return NextResponse.json({ error: 'not_enough_content' }, { status: 422 });
    }

    const estimate = usable.reduce((n, t) => n + Math.ceil(t.content.length / 3.5), 0) + 1600;
    await consumeQuota(uid, estimate);

    const { raw, inputTokens, outputTokens } = await summarizeSession(usable);

    // Model output is a trust boundary too. A schema-constrained response is a
    // strong expectation, not a guarantee, and this lands in the UI.
    const parsed = InsightsSchema.safeParse(raw);
    if (!parsed.success) {
      log.error('summary_schema_mismatch', {
        route: '/api/session/summarize',
        model: MODELS.synthesis,
        sessionId,
      });
      return NextResponse.json({ error: 'summary_unavailable' }, { status: 502 });
    }

    const insights = parsed.data;

    /**
     * Embed the SUMMARY, never the raw messages.
     *
     * Two reasons, both load-bearing. A summary is content the user already
     * agreed to have generated, so embedding it escalates nothing. And an
     * embedding is a lossy encoding of whatever went into it — embedding raw
     * entries would quietly put a derivative of every private sentence into a
     * field that later gets shipped around for retrieval.
     *
     * Best-effort: if this fails, the session still closes with its summary
     * intact and simply is not searchable. Losing the distillation because
     * retrieval had a bad day would be the wrong trade.
     */
    let embedding: number[] | undefined;
    try {
      const result = await embed(`${insights.title}. ${insights.summary}`, 'RETRIEVAL_DOCUMENT');
      embedding = result.values;

      await recordAiCall(uid, {
        route: '/api/session/summarize',
        model: MODELS.embedding,
        purpose: 'embed',
        inputTokens: estimateTokens(insights.summary),
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        dataClasses: ['summary_only'],
        sealedExcluded: 0,
        sessionId,
      });
    } catch {
      log.warn('embedding_failed', { route: '/api/session/summarize', sessionId });
    }

    await ref.set(
      {
        title: insights.title,
        summary: insights.summary,
        insights,
        ...(embedding ? { embedding } : {}),
        status: 'closed',
        endedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const latencyMs = Date.now() - startedAt;
    const sealedExcluded = all.filter((d) => d.get('sealed') === true).length;

    await recordAiCall(uid, {
      route: '/api/session/summarize',
      model: MODELS.synthesis,
      purpose: 'summarize',
      inputTokens,
      outputTokens,
      latencyMs,
      dataClasses: ['session_messages'],
      sealedExcluded,
      sessionId,
    });
    await settleQuota(uid, inputTokens + outputTokens, estimate);

    log.info('session_summarized', {
      route: '/api/session/summarize',
      uidHash: uidTag(uid),
      model: MODELS.synthesis,
      inputTokens,
      outputTokens,
      durationMs: latencyMs,
      sessionId,
    });

    return NextResponse.json({ insights });
  } catch (err) {
    return toErrorResponse(err, '/api/session/summarize');
  }
}
