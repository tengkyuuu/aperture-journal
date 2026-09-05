/**
 * The same breathing dot as the Closing Ritual — one loading vocabulary across
 * the app, rather than a spinner here and a breathing dot there.
 *
 * ── WHY THIS IS NOT AT THE (app) LAYOUT LEVEL ──
 * A loading.tsx creates a Suspense boundary, and a Suspense boundary makes
 * Next flush the response — and therefore commit HTTP 200 — before the page
 * has finished rendering. A later notFound() then renders the 404 page with a
 * 200 status.
 *
 * That is harmless on routes that cannot 404, and wrong on /session/[id],
 * which 404s whenever a session id does not belong to the signed-in user.
 * Caught by scripts/e2e.mjs, which asserts the status rather than the body.
 * So: loading states live in the routes that benefit, and /session/[id] has
 * none.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <span aria-hidden className="animate-breathe size-2 rounded-full bg-accent" />
    </div>
  );
}
