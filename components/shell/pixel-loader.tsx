/**
 * The pixel loader — three square blocks marching, on a stepped timing
 * function.
 *
 * It replaces the old breathing dot, and the change is not only cosmetic. A
 * dot that pulses on a sine curve reads as "something is smoothly happening".
 * Blocks that jump between three discrete frames read as a machine ticking
 * through work — which is what is actually going on, and which is the whole
 * grammar of this design: hard steps, no easing, nothing dissolving.
 *
 * `steps(3, end)` is doing the work. A linear timing function here would look
 * like three dots wobbling; the step function is what makes it a sprite.
 */
export function PixelLoader({
  label,
  size = 'md',
  tone = 'accent',
}: {
  /** Announced to screen readers. Omit only when a parent already labels it. */
  label?: string;
  size?: 'sm' | 'md';
  tone?: 'accent' | 'sealed' | 'current';
}) {
  const box = size === 'sm' ? 'size-1.5' : 'size-2';
  const fill =
    tone === 'accent' ? 'bg-accent' : tone === 'sealed' ? 'bg-sealed' : 'bg-current';

  return (
    <span
      className="inline-flex items-end gap-[3px]"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`animate-pixel-march ${box} ${fill}`}
          // Offsetting each block by a third of the cycle is what turns three
          // independent blinks into one travelling wave.
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </span>
  );
}
