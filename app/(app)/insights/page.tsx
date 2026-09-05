import { redirect } from 'next/navigation';

import { InsightsView } from '@/components/insights/insights-view';
import { getSession } from '@/lib/server/auth';
import { listInsightSessions } from '@/lib/server/queries';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  // Sealed sessions are absent by construction — sealing deletes the insights,
  // so there is nothing here to filter out.
  const sessions = await listInsightSessions(session.uid);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">Patterns over time</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
          Insights
        </h1>
      </header>

      <InsightsView sessions={sessions} />
    </div>
  );
}
