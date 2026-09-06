'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Transient acknowledgement.
 *
 * ── WHY THIS EXISTS ──
 * Nothing in this app has ever confirmed that anything worked. Rename, settings
 * save, seal and delete all succeeded in silence; the only success the user
 * ever saw acknowledged was the Closing Ritual. Silence after a destructive or
 * irreversible action is not restraint, it is ambiguity.
 *
 * ── WHY IT IS HAND-ROLLED ──
 * `command-palette.tsx` already argues this case for modals: native <dialog>
 * over a library, "a whole dependency and a class of focus bugs avoided".
 * Taking a dependency for a strictly smaller problem right after making that
 * argument would be incoherent. The expensive parts of a toast library —
 * stacking with FLIP, swipe-dismiss, promise toasts, expand-on-hover, theming
 * — are all things this app does not want, and its rounded, blurred, shadowed
 * defaults would have to be stripped back to flat ink anyway.
 *
 * ── ONE AT A TIME, REPLACED NOT STACKED ──
 * A journal produces at most one acknowledgement per action. A new toast
 * overwrites the old and resets the timer. That removes the single largest
 * source of complexity in every toast library, and it means three settings
 * toggles in a row produce one "Saved." instead of three.
 *
 * ── NO UNDO, DELIBERATELY ──
 * The `action` slot exists for navigation and retry, and ships with no undo
 * anywhere. Sealing deletes the summary, mood, themes and embedding; deleting
 * is "a real deletion, not a flag". Undo would need a tombstone, which would
 * falsify a promise this app makes in writing. The confirmation budget is
 * already spent on typing DELETE.
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'warn';
  action?: ToastAction;
  duration: number;
}

// Module-level, not context. Callers are scattered across canvas, profile,
// session-actions and the vault provider, and threading a hook through all of
// them would be ceremony for a function that never needs to re-render anyone.
let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(
  message: string,
  opts: { tone?: 'ok' | 'warn'; action?: ToastAction; duration?: number } = {},
): void {
  current = {
    id: ++seq,
    message,
    tone: opts.tone ?? 'ok',
    action: opts.action,
    // Longer when there is something to click, because reading and deciding
    // takes longer than reading.
    duration: opts.duration ?? (opts.action ? 6000 : 4000),
  };
  emit();
}

export function dismissToast(): void {
  if (!current) return;
  current = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Mounted once, in AppShell.
 *
 * The live region is PERMANENTLY MOUNTED and the toast renders inside it.
 * Mounting the region and its content together is the most common toast
 * accessibility bug — many screen readers only announce changes within a
 * region that already existed, so a region that appears with its message is
 * frequently silent.
 */
export function Toaster() {
  const t = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!t) return;
    timer.current = setTimeout(dismissToast, t.duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [t]);

  const onAction = useCallback((a: ToastAction) => {
    a.onClick();
    dismissToast();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      // bottom-24 clears the fixed mobile tab bar. Not top: the sticky header
      // is there below lg, and the send button — where the eyes already are —
      // is at the bottom.
      className="pointer-events-none fixed bottom-24 left-4 right-4 z-[55] flex justify-start md:bottom-6 md:right-auto"
    >
      {t ? (
        <div
          key={t.id}
          className="animate-rise-in pointer-events-auto flex max-w-[min(28rem,100%)] items-center gap-3 rounded-card brut bg-surface px-4 py-3 shadow-[var(--shadow-brut)]"
        >
          <span
            aria-hidden
            className={`size-2.5 shrink-0 border-2 border-line ${t.tone === 'warn' ? 'bg-sealed' : 'bg-pop'}`}
          />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{t.message}</p>

          {t.action ? (
            <button
              type="button"
              onClick={() => onAction(t.action!)}
              className="brut-press-sm shrink-0 rounded-control border-2 border-line bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_var(--border-ink)]"
            >
              {t.action.label}
            </button>
          ) : null}

          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss"
            className="shrink-0 rounded-control px-1 text-[13px] leading-none text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
