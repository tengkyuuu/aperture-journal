import { redirect } from 'next/navigation';

import { VaultPanel } from '@/components/vault/vault-panel';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { listSealedSessions } from '@/lib/server/queries';
import { PageHead } from '@/components/lexicon/primitives';

export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  // Everything this query can return about a sealed session is metadata.
  // The content is ciphertext and stays that way until the browser decrypts it.
  const sealed = await listSealedSessions(session.uid);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <PageHead first="What sealing does" last="Sealed entries" page="Vault" title="Vault">
        <p>
          Lock an entry with a passphrase only you know. Once it is sealed, nobody can read it:
          not us, and not the AI.
        </p>
      </PageHead>

      <VaultPanel sealed={sealed} />
    </div>
  );
}
