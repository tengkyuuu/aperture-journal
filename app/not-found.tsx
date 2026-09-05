import Link from 'next/link';

/**
 * Also what you get when you ask for a session id that is not yours.
 *
 * That is deliberate: a missing session and someone else's session are
 * indistinguishable from the outside. Anything more specific would confirm
 * that an id exists, which is a small but real information leak.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="label">Not here</p>
        <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink">
          There is nothing at this address.
        </h1>
        <p className="prose-journal mt-4 text-ink-2">
          Either it never existed, or it is not yours to read.
        </p>
        <Link
          href="/today"
          className="mt-8 inline-block rounded-control border border-line px-4 py-2 text-[13px] text-ink-2 hover:border-line-strong"
        >
          Back to today
        </Link>
      </div>
    </main>
  );
}
