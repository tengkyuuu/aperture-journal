export const dynamic = 'force-dynamic';

/**
 * Day 3 feature. This is a real empty state, not a placeholder — the copy is
 * the copy this page will keep once the feature lands behind it.
 */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <p className="label">What has left your device</p>
      <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
        Security &amp; privacy
      </h1>
      <p className="prose-journal mt-6 text-ink-3">
        Every call this app makes to Gemini on your behalf gets logged here — what was sent, how many tokens, what it cost. Nothing has been sent yet.
      </p>
    </div>
  );
}
