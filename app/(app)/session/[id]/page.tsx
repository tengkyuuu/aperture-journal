import { notFound, redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { SessionActions } from '@/components/journal/session-actions';
import { getSession } from '@/lib/server/auth';
import { getProfile, getSessionDetail } from '@/lib/server/queries';
import { CLEAR_SESSION_PATH, MODE_LABELS } from '@/lib/config';
import { longDate, relativeTime } from '@/lib/shared/format';
import { GuideWords } from '@/components/lexicon/primitives';

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
      {/* The entry page is the dictionary entry itself: guide words for when and
          whether it is finished, then the headword with its mode as the part of
          speech. */}
      <header className="mb-10">
        <GuideWords
          first={started ? longDate(started) : 'Undated'}
          last={meta.status === 'closed' ? `Finished ${relativeTime(meta.endedAt)}` : 'Not ended yet'}
          page="Entry"
        />
        <h1 className="mt-8 text-balance text-[27px] leading-tight tracking-[-0.005em] text-ink">
          <span className="font-bold">
            {meta.sealed ? 'Sealed entry' : (meta.title ?? 'A new entry')}
          </span>
          {!meta.sealed ? (
            <span className="italic text-ink-2"> {(MODE_LABELS[meta.mode] ?? meta.mode).toLowerCase()}.</span>
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
