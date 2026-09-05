'use client';

/**
 * Route error boundary.
 *
 * The message is generic on purpose. `error.message` from a Server Component
 * is already redacted by Next.js in production, but relying on that would put
 * the burden of not-leaking on the framework rather than on us. The digest is
 * safe to show: it is an opaque id that correlates to a server log line, which
 * is exactly what you want a person to be able to quote.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="label">Something broke</p>
        <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink">
          That did not load.
        </h1>
        <p className="prose-journal mt-4 text-ink-2">
          Nothing you wrote was lost. Entries are saved as they are made.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-control bg-accent px-4 py-2 text-[13px] font-medium text-on-accent"
          >
            Try again
          </button>
          <a
            href="/today"
            className="rounded-control brut-thin px-4 py-2 text-[13px] text-ink-2 hover:border-line-strong"
          >
            Back to today
          </a>
        </div>

        {error.digest ? (
          <p className="mt-6 font-mono text-[11px] text-ink-3">reference {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
