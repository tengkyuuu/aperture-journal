import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/app-shell';
import { VaultProvider } from '@/components/vault/vault-provider';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { getProfile, listSessions } from '@/lib/server/queries';

export const dynamic = 'force-dynamic';

/**
 * The authenticated shell.
 *
 * The session is verified HERE, in the Node runtime, with a real signature and
 * revocation check. Middleware only saw that a cookie existed — it cannot
 * verify one, and it is documented as a redirect rather than a boundary.
 *
 * The vault salt and check blob are handed to the client because the client is
 * the only place that can use them. Neither is secret; the passphrase that
 * turns them into a key never touches this server.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  const uid = session.uid;
  const [profile, sessions] = await Promise.all([getProfile(uid), listSessions(uid)]);

  return (
    <VaultProvider
      hasVault={profile.vault !== null}
      salt={profile.vault?.salt ?? null}
      check={profile.vault?.check ?? null}
    >
      <AppShell
        user={{
          displayName: profile.displayName ?? session.name ?? null,
          email: profile.email ?? session.email ?? null,
          photoURL: profile.photoURL ?? null,
          vault: profile.vault,
        }}
        sessions={sessions}
      >
        {children}
      </AppShell>
    </VaultProvider>
  );
}
