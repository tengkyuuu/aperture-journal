/**
 * The same breathing dot as the Closing Ritual. One loading vocabulary across
 * the app — a spinner here and a breathing dot there would read as two
 * different products.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <span aria-hidden className="animate-breathe size-2 rounded-full bg-accent" />
    </div>
  );
}
