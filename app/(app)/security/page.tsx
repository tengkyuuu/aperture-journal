import { redirect } from 'next/navigation';

import { SecurityPanel } from '@/components/security/security-panel';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { listAiCalls, listSealedSessions, listSecurityEvents } from '@/lib/server/queries';
import { PageHead } from '@/components/lexicon/primitives';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  const uid = session.uid;
  const [calls, events, sealed] = await Promise.all([
    listAiCalls(uid),
    listSecurityEvents(uid),
    listSealedSessions(uid),
  ]);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <PageHead first="Sent to the AI" last="Your data" page="Security" title="Security & privacy">
        <p>
          Everything Aperture has sent to the AI for you, what each request contained, and what it
          would cost on a paid plan. You can download or delete all of your data at the bottom.
        </p>
      </PageHead>

      <SecurityPanel calls={calls} events={events} sealedCount={sealed.length} />
    </div>
  );
}
