import { FieldValue } from 'firebase-admin/firestore';

import { requireUid } from '@/lib/server/auth';
import { assertRequestIntegrity, parseBody, toErrorResponse } from '@/lib/server/http';
import { assertSafeId, messagesCol, sessionDoc, sessionsCol } from '@/lib/server/db';
import { estimateTokens, streamChat, toContents } from '@/lib/server/gemini';
import { scanForInjection } from '@/lib/server/injection';
import { recordAiCall, recordSecurityEvent } from '@/lib/server/ledger';
import { consumeQuota, settleQuota } from '@/lib/server/ratelimit';
import { log, uidTag } from '@/lib/server/logger';
import { ChatRequestSchema } from '@/lib/shared/schemas';
import { LIMITS } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat — one conversation turn, streamed.
 *
 * Order of operations is deliberate:
 *   1. Same-origin check          (CSRF layer two)
 *   2. requireUid()               (the only identity in the request)
 *   3. Strict schema parse        (no unknown fields, bounded sizes)
 *   4. Quota                      (denial-of-wallet)
 *   5. Injection scan             (untrusted content, logged not blocked)
 *   6. Load history FROM FIRESTORE under the verified uid, not from the body
 *   7. Stream, persist, ledger, settle
 *
 * Step 6 is the one that matters most. The client sends history for latency,
 * but a client that can choose the conversation history can also choose what
 * the model believes it previously said.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    await assertRequestIntegrity(req);
    const uid = await requireUid();
    const body = await parseBody(req, ChatRequestSchema);

    const estimate = estimateTokens(body.message) + LIMITS.maxOutputTokens;
    await consumeQuota(uid, estimate);

    // The user's own writing is untrusted input. We log suspicion and continue
    // — this is their journal, and false positives must not block their entry.
    const verdict = scanForInjection(body.message);
    if (verdict.suspected) {
      await recordSecurityEvent(
        uid,
        'injection_suspected',
        verdict.severity,
        `Patterns matched: ${verdict.labels.join(', ')}`,
        body.sessionId,
      );
    }

    // ─── Resolve the session, always under the verified uid ─────────────────
    let sessionId: string;
    if (body.sessionId) {
      sessionId = assertSafeId(body.sessionId);
      const existing = await sessionDoc(uid, sessionId).get();
      // A session id that does not exist under THIS uid simply does not exist.
      // There is no path by which it could resolve to another user's document.
      if (!existing.exists) {
        const created = sessionsCol(uid).doc();
        sessionId = created.id;
        await created.set({
          title: null,
          mode: body.mode,
          status: 'open',
          sealed: false,
          messageCount: 0,
          startedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      const created = sessionsCol(uid).doc();
      sessionId = created.id;
      await created.set({
        title: null,
        mode: body.mode,
        status: 'open',
        sealed: false,
        messageCount: 0,
        startedAt: FieldValue.serverTimestamp(),
      });
    }

    // ─── History from the database, never from the request ──────────────────
    const prior = await messagesCol(uid, sessionId)
      .orderBy('createdAt', 'asc')
      .limitToLast(LIMITS.maxTurnsPerRequest)
      .get();

    const turns = prior.docs
      .map((d) => d.data())
      .filter((d) => d.sealed !== true && typeof d.content === 'string')
      .map((d) => ({ role: d.role as 'user' | 'model', content: d.content as string }));

    turns.push({ role: 'user', content: body.message });

    await messagesCol(uid, sessionId).add({
      role: 'user',
      content: body.message,
      sealed: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // ─── Stream ─────────────────────────────────────────────────────────────
    // `model` is what actually answered — the fallback if the primary was
    // rate-limited. The ledger records that, not what we asked for.
    const { stream, usage, model } = await streamChat(body.mode, toContents(turns), req.signal);

    const encoder = new TextEncoder();
    let full = '';

    /**
     * Persist the model turn and close out the accounting.
     *
     * ── WHY THIS IS NOT INLINE IN `done` ANY MORE ──
     * All of it used to live in the done branch, so aborting the request ran
     * none of it: the user's turn was already on disk (it is written before
     * the first token), but the model turn, the messageCount, the quota
     * settlement and — worst — the LEDGER ROW were all skipped. That call
     * reached Gemini and spent tokens. A stopped generation that leaves no
     * ledger row would quietly falsify the claim the Security page makes in
     * writing: "every call this app makes to Gemini on your behalf is
     * recorded here." So `cancel()` calls this too.
     */
    let settled = false;
    async function finish(reason: 'complete' | 'stopped') {
      if (settled) return;
      settled = true;

      const latencyMs = Date.now() - startedAt;

      // The generator resolves `usage`. If it was returned early that may
      // never happen, so do not wait on it indefinitely — an ESTIMATED ledger
      // row is honest, a missing one is not.
      const counted = await Promise.race([
        usage,
        new Promise<null>((r) => setTimeout(() => r(null), 2_000)),
      ]).catch(() => null);

      const inputTokens = counted?.inputTokens ?? estimateTokens(body.message);
      const outputTokens = counted?.outputTokens ?? estimateTokens(full);

      try {
        // An empty partial is not worth a message document — nothing was said.
        const kept = full.trim().length > 0;
        if (kept) {
          await messagesCol(uid, sessionId).add({
            role: 'model',
            content: full,
            sealed: false,
            ...(reason === 'stopped' ? { stopped: true } : {}),
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await sessionDoc(uid, sessionId).set(
          { messageCount: FieldValue.increment(kept ? 2 : 1), mode: body.mode },
          { merge: true },
        );
        await recordAiCall(uid, {
          route: '/api/chat',
          model,
          purpose: 'chat',
          inputTokens,
          outputTokens,
          latencyMs,
          dataClasses: ['session_messages'],
          sealedExcluded: prior.docs.filter((d) => d.get('sealed') === true).length,
          sessionId,
        });
        await settleQuota(uid, inputTokens + outputTokens, estimate);
      } catch {
        log.error('post_stream_persist_failed', { route: '/api/chat', sessionId });
      }

      log.info('chat_turn', {
        route: '/api/chat',
        uidHash: uidTag(uid),
        mode: body.mode,
        model,
        inputTokens,
        outputTokens,
        durationMs: latencyMs,
        reason,
      });
    }

    const out = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await stream.next();
        if (done) {
          controller.close();
          await finish('complete');
          return;
        }

        full += value;
        controller.enqueue(encoder.encode(value));
      },
      cancel() {
        // The reader went away — the user pressed stop, or navigated. Close the
        // generator, then account for what was already spent.
        void stream.return?.(undefined);
        void finish('stopped');
      },
    });

    return new Response(out, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Session-Id': sessionId,
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return toErrorResponse(err, '/api/chat');
  }
}
