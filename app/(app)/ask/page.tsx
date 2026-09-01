export const dynamic = 'force-dynamic';

/**
 * Day 3 feature. This is a real empty state, not a placeholder — the copy is
 * the copy this page will keep once the feature lands behind it.
 */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <p className="label">Retrieval over your own writing</p>
      <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
        Ask your past
      </h1>
      <p className="prose-journal mt-6 text-ink-3">
        Once you have a handful of closed sessions, you can ask them questions — and get answers cited back to the day you wrote them.
      </p>
    </div>
  );
}
