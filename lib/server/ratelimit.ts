import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { userDoc } from './db';
import { RateLimited } from './http';
import { recordSecurityEvent } from './ledger';
import { LIMITS } from '../config';
import { log, uidTag } from './logger';

/**
 * Per-user daily quota, enforced in a Firestore transaction.
 *
 * This is denial-of-wallet defence, not abuse detection. An unbounded model
 * endpoint behind an authenticated route is still an unbounded bill: one
 * compromised account with a loop can spend real money overnight.
 *
 * A transaction rather than a counter increment because the read-then-write
 * has to be atomic across Cloud Run instances — two instances serving the same
 * user must not both see 119 of 120.
 */

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * SECURITY PRECONDITION: `uid` comes from requireUid().
 * Throws RateLimited when the caller is over quota for the current UTC day.
 */
export async function consumeQuota(uid: string, estimatedTokens: number): Promise<void> {
  const ref = userDoc(uid);
  const today = utcDay();

  /**
   * Which limit was hit, captured for the security event.
   *
   * It has to live out here. The throw happens inside a transaction, and a
   * transaction body can be retried or discarded — so a write issued from
   * inside it is not a reliable record of anything. Recorded at the boundary
   * below instead, then rethrown.
   */
  let hit: 'calls' | 'tokens' | null = null;

  try {
    await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const quota = (snap.get('quota') ?? {}) as {
      day?: string;
      chatCalls?: number;
      tokens?: number;
    };

    const fresh = quota.day !== today;
    const calls = fresh ? 0 : (quota.chatCalls ?? 0);
    const tokens = fresh ? 0 : (quota.tokens ?? 0);

    if (calls + 1 > LIMITS.dailyChatCalls) {
      hit = 'calls';
      log.warn('quota_exceeded', {
        uidHash: uidTag(uid),
        reason: 'calls',
        count: calls,
        limit: LIMITS.dailyChatCalls,
      });
      throw new RateLimited();
    }
    if (tokens + estimatedTokens > LIMITS.dailyTokens) {
      hit = 'tokens';
      log.warn('quota_exceeded', {
        uidHash: uidTag(uid),
        reason: 'tokens',
        count: tokens,
        limit: LIMITS.dailyTokens,
      });
      throw new RateLimited();
    }

      tx.set(
        ref,
        { quota: { day: today, chatCalls: calls + 1, tokens: tokens + estimatedTokens } },
        { merge: true },
      );
    });
  } catch (err) {
    // The Security page states that rate-limit hits show up in its events
    // list. Until now nothing ever wrote one — the limit was only ever
    // log.warn'd, so the UI asserted an auditing guarantee the server did not
    // implement. In an app whose entire pitch is verifiable transparency, that
    // is the wrong half of the pair to leave unbuilt.
    //
    // 'low' severity on purpose: this is a limit working as designed, not an
    // attack. It belongs in the user's own record, not flagged as a threat.
    if (err instanceof RateLimited && hit) {
      await recordSecurityEvent(
        uid,
        'rate_limited',
        'low',
        hit === 'calls'
          ? `Daily call limit reached (${LIMITS.dailyChatCalls}).`
          : `Daily token limit reached (${LIMITS.dailyTokens.toLocaleString('en-GB')}).`,
      );
    }
    throw err;
  }
}

/**
 * Reconcile the estimate against actual usage once the model has replied.
 * Best-effort: a failure here must never fail the user's request.
 */
export async function settleQuota(uid: string, actualTokens: number, estimated: number): Promise<void> {
  const delta = actualTokens - estimated;
  if (delta === 0) return;
  try {
    await userDoc(uid).set({ quota: { tokens: FieldValue.increment(delta) } }, { merge: true });
  } catch {
    // Intentionally swallowed. Quota drift of one request is not worth a 500.
  }
}
