import Link from 'next/link';

/**
 * Not found, without losing the rest of the app.
 *
 * Identical copy to app/not-found.tsx, deliberately and permanently. "Either
 * it never existed, or it is not yours to read" is a stated security property,
 * not filler: a session id belonging to someone else and a session id that was
 * never issued must be indistinguishable from here, or the 404 becomes an
 * oracle for which ids exist.
 *
 * The only thing this changes is where it lands. notFound() from
 * /session/[id] used to escalate to the root boundary and blank the whole
 * application; now it renders inside the shell, one click from another entry.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <p className="label">Not here</p>
      <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink">
        There is nothing at this address.
      </h1>
      <p className="prose-journal mt-4 text-ink-2">
        Either it never existed, or it is not yours to read.
      </p>
      <Link
        href="/today"
        className="brut-press-sm mt-8 inline-block rounded-control border-[3px] border-line bg-surface px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--border-ink)]"
      >
        Back to today
      </Link>
    </div>
  );
}
