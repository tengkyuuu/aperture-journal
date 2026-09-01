import { redirect } from 'next/navigation';

import { getSession } from '@/lib/server/auth';
import { sessionsCol } from '@/lib/server/db';
import { UglyChat } from '@/components/ugly-chat';

export const dynamic = 'force-dynamic';

/**
 * Server Component.
 *
 * The session is verified HERE, in the Node runtime, with a real signature and
 * revocation check — not in middleware, which can only see that a cookie
 * exists. Every protected page does this for itself.
 */
export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  const uid = session.uid;

  // Read through the path-scoped helper. There is no query here that could
  // return another user's rows, because there is no `where` clause to forget.
  const recent = await sessionsCol(uid).orderBy('startedAt', 'desc').limit(10).get();

  const sessions = recent.docs.map((d) => ({
    id: d.id,
    mode: (d.get('mode') as string) ?? 'reflect',
    messageCount: (d.get('messageCount') as number) ?? 0,
  }));

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-1 border-b border-current/10 pb-4">
        <h1 className="text-2xl">Aperture</h1>
        <p className="text-sm opacity-60">
          Signed in as {session.email ?? uid}
        </p>
        <p className="font-mono text-xs opacity-40">uid: {uid}</p>
      </header>

      <UglyChat />

      <section className="space-y-2 border-t border-current/10 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Your sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm opacity-50">Nothing yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {sessions.map((s) => (
              <li key={s.id} className="opacity-70">
                {s.id} · {s.mode} · {s.messageCount} messages
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
