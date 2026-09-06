import { SkelBlock, SkelLine, SkelPage } from '@/components/feedback/skeleton';

/**
 * A skeleton of THIS page, not a spinner in a void.
 *
 * The loader that used to live here blanked the whole route to three marching
 * blocks in the middle of an empty screen. That says a wait is happening but
 * not what is arriving, and then the real layout appears and moves under the
 * reader's eyes. These blocks carry the same 3px border and radius as the
 * cards they stand in for, so the swap costs no reflow.
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
    <SkelPage>
      <SkelLine w="w-40" />
      <SkelLine w="w-64" delay={120} />

      {/* The composer is the hero and comes first on the real page. Showing
          where to write before it is writable is the whole point. */}
      <span className="mt-8 flex flex-col gap-3">
        <span className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <SkelBlock key={i} className="h-8 w-24" delay={i * 90} />
          ))}
        </span>
        <SkelBlock className="h-32 w-full" delay={200} />
      </span>

      {/* Open loops, the fortnight strip, recent entries. */}
      <span className="mt-10 flex flex-col gap-6">
        <SkelBlock className="h-24 w-full" delay={300} />
        <SkelBlock className="h-16 w-full" delay={380} />
        <SkelBlock className="h-28 w-full" delay={460} />
      </span>
    </SkelPage>
  );
}
