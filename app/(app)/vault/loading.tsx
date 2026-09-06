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
      <SkelLine w="w-36" />

      {/* Vault status, then the sealed entries.

          Deliberately NOT skeletoning the "what sealing actually does"
          explainer below them: that copy is static and never loads, so a
          placeholder standing in for it would be inventing a wait that does
          not exist. The region simply stays empty until it arrives. */}
      <span className="mt-8 flex flex-col gap-3">
        <SkelBlock className="h-16 w-full" />
        {[0, 1, 2].map((i) => (
          <SkelBlock key={i} className="h-14 w-full" delay={160 + i * 100} />
        ))}
      </span>
    </SkelPage>
  );
}
