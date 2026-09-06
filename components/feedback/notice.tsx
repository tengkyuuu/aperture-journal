'use client';

import { useEffect, useState } from 'react';

import { describe, isRetryable, type Failure } from '@/lib/client/errors';

/**
 * One failure, said once, in one place.
 *
 * ── WHY THIS EXISTS ──
 * There were seven of these, hand-rolled, each with its own useState, its own
 * copy written at the throw site, and its own opinion about styling — three of
 * the seven shook, four did not, and the one that did NOT was the wrong
 * passphrase, which is the most deserving typo in the product.
 *
 * ── THE SHAKE HAS TO RE-FIRE ──
 * The old pattern put `animate-shake` on a conditionally rendered <p>. Setting
 * the same error twice leaves that node mounted, so the animation never
 * replays and the second failure looks like nothing happened at all. A nonce
 * in the key forces a remount. `animate-shake` is already flattened by both
 * reduced-motion tracks, so this needs no motion guard of its own.
 *
 * ── RETRY IS A PROPERTY OF THE FAILURE ──
 * The button appears only when the caller offers an `onRetry` AND the failure
 * is one that retrying could fix. That is why an out-of-quota user is no
 * longer invited to spend more quota discovering they are out of quota.
 */
export function Notice({
  failure,
  onRetry,
  retryLabel = 'Try again',
  id,
  className = '',
}: {
  failure: Failure | null;
  onRetry?: () => void;
  retryLabel?: string;
  /** So an input can point aria-errormessage / aria-describedby at this. */
  id?: string;
  className?: string;
}) {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (failure) setNonce((n) => n + 1);
  }, [failure]);

  // `aborted` means the user pressed stop. That is not an error and must never
  // be rendered as one — without this branch, the stop button reports
  // "connection lost", which is the classic version of that bug.
  if (!failure || failure.kind === 'aborted') return null;

  const { title, body } = describe(failure);
  const showRetry = Boolean(onRetry) && isRetryable(failure);

  return (
    <div
      key={nonce}
      id={id}
      role="alert"
      className={`animate-shake flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border-[3px] border-line bg-danger px-3 py-2 text-[#111111] ${className}`}
    >
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-bold">{title}</span>
        {body ? <span className="opacity-80"> {body}</span> : null}
      </p>

      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="brut-press-sm shrink-0 rounded-control border-2 border-[#111111] bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_#111111]"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
