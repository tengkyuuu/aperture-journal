'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { apiFetch } from '@/lib/client/api';
import { ECHO } from '@/lib/config';
import { relativeTime } from '@/lib/shared/format';
import type { Echo } from '@/lib/shared/types';

/**
 * Echoes.
 *
 * Most journals are write-only: you pour something in and the archive never
 * speaks back. Every "insights dashboard" is a report you have to remember to
 * go and read. This inverts that — it brings the past to you, at the moment it
 * is relevant, while you are typing the thing you have typed before.
 *
 * The restraint is the feature. One wrong echo costs more than ten right ones,
 * so every threshold in ECHO errs toward saying nothing.
 */

/** How many characters differ, ignoring a shared prefix and suffix. */
function changedChars(a: string, b: string): number {
  if (a === b) return 0;

  let start = 0;
  const max = Math.min(a.length, b.length);
  while (start < max && a[start] === b[start]) start++;

  let end = 0;
  while (end < max - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;

  return Math.max(a.length - start - end, b.length - start - end);
}

interface State {
  echoes: Echo[];
  /** Set once the server says the feature is off, or quota is spent. */
  halted: boolean;
}

/**
 * Watches a draft and asks the server whether it has been written before.
 *
 * `enabled` must be the user's stored preference. `vaultUnlocked` hard-blocks
 * the whole thing: if someone is writing with their vault open they may be
 * about to seal this, and a draft that is going to be encrypted must not have
 * already been sent somewhere for comparison.
 */
export function useEchoes({
  draft,
  sessionId,
  enabled,
  vaultUnlocked,
}: {
  draft: string;
  sessionId?: string;
  enabled: boolean;
  vaultUnlocked: boolean;
}) {
  const [{ echoes, halted }, setState] = useState<State>({ echoes: [], halted: false });
  const [dismissed, setDismissed] = useState<string[]>([]);

  const lastChecked = useRef('');
  const lastCheckAt = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  const armed = enabled && !vaultUnlocked && !halted;

  useEffect(() => {
    if (!armed) return;
    if (draft.length < ECHO.minChars) return;
    if (changedChars(draft, lastChecked.current) < ECHO.minCharsChanged) return;

    const wait = Math.max(ECHO.pauseMs, ECHO.cooldownMs - (Date.now() - lastCheckAt.current));

    const timer = setTimeout(async () => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;

      lastChecked.current = draft;
      lastCheckAt.current = Date.now();

      try {
        const res = await apiFetch('/api/echo', {
          method: 'POST',
          body: JSON.stringify({ draft: draft.slice(0, ECHO.maxDraftChars), sessionId }),
          signal: ctrl.signal,
        });

        // 403 means the setting is off; 429 means the daily budget is spent.
        // Neither is worth retrying against every keystroke for the rest of
        // the session, and neither is worth an error message — this feature
        // was never asked for by the person typing right now.
        if (res.status === 403 || res.status === 429) {
          setState({ echoes: [], halted: true });
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as { echoes?: Echo[] };
        setState({ echoes: data.echoes ?? [], halted: false });
      } catch {
        // Aborted, offline, or a transient failure. Silence is correct.
      }
    }, wait);

    return () => clearTimeout(timer);
  }, [draft, sessionId, armed]);

  // A new session, or the draft being cleared by a send, resets everything.
  useEffect(() => {
    if (draft.length === 0) {
      lastChecked.current = '';
      setState((s) => (s.echoes.length ? { ...s, echoes: [] } : s));
    }
  }, [draft.length]);

  useEffect(() => () => inflight.current?.abort(), []);

  const dismiss = useCallback((id: string) => setDismissed((d) => [...d, id]), []);

  return {
    echoes: echoes.filter((e) => !dismissed.includes(e.sessionId)),
    armed,
    dismiss,
  };
}

/** How the mood then compares with how things have been lately. */
function moodLine(echo: Echo): string | null {
  if (!echo.moodThen) return null;
  const label = echo.moodThen.label;

  if (echo.valenceDelta === null) return `You called it ${label}.`;
  if (echo.valenceDelta > 0.25) return `You called it ${label}. You were in a heavier place then.`;
  if (echo.valenceDelta < -0.25) return `You called it ${label}. You were lighter then than lately.`;
  return `You called it ${label} — much the same as lately.`;
}

/**
 * The card.
 *
 * `role="status"` with a polite live region: it appears unprompted, so someone
 * using a screen reader has to be told, but never interrupted. It is announced
 * after the current utterance, not over it.
 */
export function EchoCards({
  echoes,
  onDismiss,
}: {
  echoes: Echo[];
  onDismiss: (id: string) => void;
}) {
  if (echoes.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5">
      {echoes.map((echo) => (
        <article
          key={echo.sessionId}
          className="animate-rise-in rounded-card brut bg-elevated p-4"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <span className="chip-brut bg-pop">You&rsquo;ve been here</span>

              <p className="mt-2.5 truncate text-[15px] font-bold text-ink">
                {echo.title}
              </p>
              <p className="label mt-1">{relativeTime(echo.startedAt)}</p>

              {moodLine(echo) ? (
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{moodLine(echo)}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(echo.sessionId)}
              aria-label="Dismiss this echo"
              className="grid size-7 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="square"
                />
              </svg>
            </button>
          </div>

          <Link
            href={`/session/${echo.sessionId}`}
            className="brut-press-sm mt-3.5 inline-block rounded-control border-[3px] border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            Read it
          </Link>
        </article>
      ))}
    </div>
  );
}
