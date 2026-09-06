'use client';

import Link from 'next/link';

/**
 * A failure inside the app, contained to the part that failed.
 *
 * ── WHY THIS IS AT THE GROUP LEVEL AND NOT PER-ROUTE ──
 * Because it sits INSIDE app/(app)/layout.tsx, the layout renders first and
 * this replaces only {children}: the rail, the timeline, the tab bar and the
 * command palette all survive. Previously any error in any route escalated to
 * the root boundary, which blanked the entire application to a centred
 * paragraph — losing every route out of the failure.
 *
 * Six near-identical per-route copies would be the disease this whole change
 * is treating. One boundary, generic copy.
 *
 * app/error.tsx stays, and still matters: a segment boundary does not catch
 * failures in its own layout, and app/(app)/layout.tsx does three Firestore
 * reads. When that fails there is no shell to render into.
 *
 * ── SAFE ON /session/[id] ──
 * Unlike loading.tsx, an error boundary creates NO Suspense boundary
 * (next/dist/client/components/layout-router.js — "If no loading property is
 * provided it renders the children without a suspense boundary"), so this
 * cannot reintroduce the 200-on-404 bug that removed the group-level loader.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <p className="label">Something broke</p>
      <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink">
        That did not load.
      </h1>
      <p className="prose-journal mt-4 text-ink-2">
        Entries you have already sent are safe. Everything else on this screen is still
        where it was — only this part failed.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="brut-press rounded-control border-[3px] border-line bg-accent px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-on-accent shadow-[var(--shadow-brut)]"
        >
          Try again
        </button>
        <Link
          href="/today"
          className="brut-press-sm rounded-control border-[3px] border-line bg-surface px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--border-ink)]"
        >
          Back to today
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-[11px] text-ink-3">reference {error.digest}</p>
      ) : null}
    </div>
  );
}
