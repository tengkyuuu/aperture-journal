import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/app-shell';
import { getSession } from '@/lib/server/auth';
import { getProfile, listSessions } from '@/lib/server/queries';

export const dynamic = 'force-dynamic';

/**
 * The authenticated shell.
 *
 * The session is verified HERE, in the Node runtime, with a real signature and
 * revocation check. Middleware only saw that a cookie existed — it cannot
 * verify one, and it is documented as a redirect rather than a boundary.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  const uid = session.uid;
  const [profile, sessions] = await Promise.all([getProfile(uid), listSessions(uid)]);

  return (
    <AppShell
      user={{
        displayName: profile.displayName ?? session.name ?? null,
        email: profile.email ?? session.email ?? null,
        photoURL: profile.photoURL ?? null,
      }}
      sessions={sessions}
    >
      {children}
    </AppShell>
  );
}
