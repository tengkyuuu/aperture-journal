import { redirect } from 'next/navigation';

import { InsightsView } from '@/components/insights/insights-view';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { listInsightSessions } from '@/lib/server/queries';
import { PageHead } from '@/components/lexicon/primitives';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  // Sealed sessions are absent by construction — sealing deletes the insights,
  // so there is nothing here to filter out.
  const sessions = await listInsightSessions(session.uid);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <PageHead first="Emotional weather" last="Finished entries" page="Insights" title="Insights">
        <p>
          How your entries have felt over time, and what you keep writing about. Built from the
          summaries of finished entries.
        </p>
      </PageHead>

      <InsightsView sessions={sessions} />
    </div>
  );
}
