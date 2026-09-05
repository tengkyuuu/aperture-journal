import { redirect } from 'next/navigation';

import { SecurityPanel } from '@/components/security/security-panel';
import { getSession } from '@/lib/server/auth';
import { listAiCalls, listSealedSessions, listSecurityEvents } from '@/lib/server/queries';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  const uid = session.uid;
  const [calls, events, sealed] = await Promise.all([
    listAiCalls(uid),
    listSecurityEvents(uid),
    listSealedSessions(uid),
  ]);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">What has left your device</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
          Security &amp; privacy
        </h1>
        <p className="prose-journal mt-4 text-ink-2">
          Every call this app makes to Gemini on your behalf is recorded here — what was sent,
          how much of it, and what it cost.
        </p>
      </header>

      <SecurityPanel calls={calls} events={events} sealedCount={sealed.length} />
    </div>
  );
}
