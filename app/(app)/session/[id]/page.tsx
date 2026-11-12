import { notFound, redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { SessionActions } from '@/components/journal/session-actions';
import { getSession } from '@/lib/server/auth';
import { getProfile, getSessionDetail } from '@/lib/server/queries';
import { CLEAR_SESSION_PATH, MODE_LABELS } from '@/lib/config';
import { longDate, relativeTime } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  const { id } = await params;

  // Scoped to the verified uid. A session id belonging to someone else does not
  // resolve to a document here — it resolves to nothing, and this 404s.
  const [detail, profile] = await Promise.all([
    getSessionDetail(session.uid, id),
    getProfile(session.uid),
  ]);
  if (!detail) notFound();

  const { session: meta, insights, messages } = detail;
  const started = meta.startedAt ? new Date(meta.startedAt) : null;

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      {/* When it was written and whether it is finished, then the title with
          its mode as a small pill. */}
      <header className="mb-10">
        <p className="text-[13px] text-ink-3">
          {started ? longDate(started) : 'Undated'}
          <span aria-hidden> · </span>
          {meta.status === 'closed' ? `Finished ${relativeTime(meta.endedAt)}` : 'Not finished yet'}
        </p>
        <h1 className="mt-2 text-balance text-[32px] leading-tight text-ink sm:text-[36px]">
          <span>
            {meta.sealed ? 'Sealed entry' : (meta.title ?? 'A new entry')}
          </span>
          {!meta.sealed ? (
            <span className="ml-2 inline-block rounded-full bg-sunken px-2 py-0.5 align-middle text-[12px] font-normal text-ink-3">{MODE_LABELS[meta.mode] ?? meta.mode}</span>
          ) : null}
        </h1>
      </header>

      <Canvas
        sessionId={meta.id}
        initialMessages={messages}
        initialInsights={insights}
        initialMode={meta.mode}
        closed={meta.status === 'closed'}
        sealed={meta.sealed}
        placeholder="Pick the thread back up…"
        echoesEnabled={profile.settings.echoes}
        truncated={messages.length < meta.messageCount}
      />

      <SessionActions sessionId={meta.id} title={meta.title} sealed={meta.sealed} />
    </div>
  );
}
