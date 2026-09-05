import { notFound, redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { SessionActions } from '@/components/journal/session-actions';
import { getSession } from '@/lib/server/auth';
import { getSessionDetail } from '@/lib/server/queries';
import { CLEAR_SESSION_PATH, MODE_LABELS } from '@/lib/config';
import { longDate, relativeTime } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  const { id } = await params;

  // Scoped to the verified uid. A session id belonging to someone else does not
  // resolve to a document here — it resolves to nothing, and this 404s.
  const detail = await getSessionDetail(session.uid, id);
  if (!detail) notFound();

  const { session: meta, insights, messages } = detail;
  const started = meta.startedAt ? new Date(meta.startedAt) : null;

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="label">{started ? longDate(started) : 'Session'}</p>
          <span aria-hidden className="text-ink-3">
            ·
          </span>
          <p className="label">{MODE_LABELS[meta.mode] ?? meta.mode}</p>
          {meta.status === 'closed' ? (
            <>
              <span aria-hidden className="text-ink-3">
                ·
              </span>
              <p className="label">closed {relativeTime(meta.endedAt)}</p>
            </>
          ) : null}
        </div>

        {meta.sealed ? (
          <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink sm:text-[34px]">
            Sealed entry
          </h1>
        ) : meta.title ? (
          <h1 className="mt-3 font-serif text-[30px] font-light leading-tight tracking-tight text-ink sm:text-[34px]">
            {meta.title}
          </h1>
        ) : null}
      </header>

      <Canvas
        sessionId={meta.id}
        initialMessages={messages}
        initialInsights={insights}
        initialMode={meta.mode}
        closed={meta.status === 'closed'}
        sealed={meta.sealed}
        placeholder="Pick the thread back up…"
      />

      <SessionActions sessionId={meta.id} title={meta.title} sealed={meta.sealed} />
    </div>
  );
}
