import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/server/auth';
import { embed, estimateTokens, streamGroundedAnswer } from '@/lib/server/gemini';
import { assertRequestIntegrity, parseBody, toErrorResponse } from '@/lib/server/http';
import { scanForInjection } from '@/lib/server/injection';
import { recordAiCall, recordSecurityEvent } from '@/lib/server/ledger';
import { log, uidTag } from '@/lib/server/logger';
import { consumeQuota, settleQuota } from '@/lib/server/ratelimit';
import { buildContext, retrieve } from '@/lib/server/retrieval';
import { AskRequestSchema } from '@/lib/shared/schemas';
import { LIMITS, MODELS } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ask — a grounded, cited answer drawn only from the user's own entries.
 *
 * Two model calls: one embedding for the question, one generation for the
 * answer. Both are ledgered separately, because "we sent your question to an
 * embedding model" and "we sent five of your summaries to a chat model" are
 * genuinely different disclosures.
 *
 * Only summaries are retrieved, never raw messages. A summary is what the user
 * already agreed to have generated; sending the full transcript of five past
 * sessions to answer one question would be a quiet escalation of what leaves
 * the device.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const { question } = await parseBody(req, AskRequestSchema);

    const estimate = estimateTokens(question) + LIMITS.maxOutputTokens;
    await consumeQuota(uid, estimate);

    // The question is user input heading for a prompt. Log suspicion, do not
    // block — a question containing the words "ignore previous instructions"
    // is more likely to be someone journalling about this very app.
    const verdict = scanForInjection(question);
    if (verdict.suspected) {
      await recordSecurityEvent(
        uid,
        'injection_suspected',
        verdict.severity,
        `Question matched: ${verdict.labels.join(', ')}`,
      );
    }

    const { values: queryVector } = await embed(question, 'RETRIEVAL_QUERY');
    await recordAiCall(uid, {
      route: '/api/ask',
      model: MODELS.embedding,
      purpose: 'embed',
      inputTokens: estimateTokens(question),
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      dataClasses: ['question_only'],
      sealedExcluded: 0,
    });

    const entries = await retrieve(uid, queryVector);

    if (entries.length === 0) {
      return NextResponse.json(
        {
          error: 'nothing_to_search',
          message:
            'There are no distilled sessions to search yet. Close a few sessions first — ' +
            'sealed entries are never searchable, by design.',
        },
        { status: 422 },
      );
    }

    const context = buildContext(entries);
    const { stream, usage, model } = await streamGroundedAnswer(question, context, req.signal);

    const encoder = new TextEncoder();

    const out = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await stream.next();
        if (done) {
          controller.close();

          const { inputTokens, outputTokens } = await usage;
          const latencyMs = Date.now() - startedAt;

          try {
            await recordAiCall(uid, {
              route: '/api/ask',
              model,
              purpose: 'ask',
              inputTokens,
              outputTokens,
              latencyMs,
              dataClasses: ['summary_only'],
              sealedExcluded: 0,
            });
            await settleQuota(uid, inputTokens + outputTokens, estimate);
          } catch {
            log.error('ask_ledger_failed', { route: '/api/ask' });
          }

          log.info('ask_answered', {
            route: '/api/ask',
            uidHash: uidTag(uid),
            model,
            inputTokens,
            outputTokens,
            durationMs: latencyMs,
            count: entries.length,
          });
          return;
        }
        controller.enqueue(encoder.encode(value));
      },
      cancel() {
        void stream.return?.(undefined);
      },
    });

    // Citations travel in a header so the body stays plain streamable text.
    // The client maps [[sessionId]] markers back onto these.
    const citations = entries.map((e) => ({
      id: e.sessionId,
      title: e.title,
      date: e.startedAt?.toISOString() ?? null,
      score: Number(e.score.toFixed(3)),
    }));

    return new Response(out, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Citations': Buffer.from(JSON.stringify(citations)).toString('base64'),
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return toErrorResponse(err, '/api/ask');
  }
}
