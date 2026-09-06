/**
 * Skeletons.
 *
 * A shimmer is a gradient under a mask, and Paper Cut has no gradients. A
 * pulse is a smooth opacity sine, which is the thing `pixel-loader.tsx`
 * explicitly rejects. So a skeleton here is built from the grammar the system
 * already uses: bordered blocks, flat fills, and a hard step between two
 * frames. See `.skel` / `.animate-block-tick` in globals.css.
 *
 * These render the SHAPE OF THE PAGE, not a spinner in a void. The six route
 * loaders used to blank everything to three dots in the middle of nothing,
 * which tells you a wait is happening but not what is coming — and then the
 * real layout arrives and moves under your eyes.
 *
 * Both primitives are aria-hidden. One `role="status"` belongs on the page
 * wrapper; announcing every block would be a stutter of nonsense.
 */

/** Stands in for a bordered card. Give it a height. */
export function SkelBlock({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      aria-hidden
      className={`skel animate-block-tick ${className}`}
      // Staggered so a column of blocks ticks like a row of machines rather
      // than flashing in unison, which reads as a bug.
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

/** Stands in for a line of prose. */
export function SkelLine({ w = 'w-full', delay = 0 }: { w?: string; delay?: number }) {
  return (
    <span
      aria-hidden
      className={`skel-line animate-block-tick ${w}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

/** Several lines at prose rhythm, last one short so it reads as a paragraph. */
export function SkelParagraph({ lines = 3 }: { lines?: number }) {
  return (
    <span aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <SkelLine key={i} w={i === lines - 1 ? 'w-2/3' : 'w-full'} delay={i * 120} />
      ))}
    </span>
  );
}

/**
 * The page wrapper every route skeleton uses.
 *
 * The measure matches the real pages exactly. A skeleton at a different width
 * is a different page, and the swap becomes the layout shift it was supposed
 * to prevent.
 */
export function SkelPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16"
    >
      {children}
    </div>
  );
}
