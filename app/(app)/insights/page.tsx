export const dynamic = 'force-dynamic';

/**
 * Day 3 feature. This is a real empty state, not a placeholder — the copy is
 * the copy this page will keep once the feature lands behind it.
 */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <p className="label">Patterns over time</p>
      <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
        Insights
      </h1>
      <p className="prose-journal mt-6 text-ink-3">
        Patterns need a few entries before they show up. Close a session or two and your Emotional Weather starts drawing itself.
      </p>
    </div>
  );
}
