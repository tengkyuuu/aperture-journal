import { redirect } from 'next/navigation';

import { VaultPanel } from '@/components/vault/vault-panel';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { listSealedSessions } from '@/lib/server/queries';

export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  // Everything this query can return about a sealed session is metadata.
  // The content is ciphertext and stays that way until the browser decrypts it.
  const sealed = await listSealedSessions(session.uid);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">End-to-end encrypted</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
          Vault
        </h1>
        <p className="prose-journal mt-4 text-ink-2">
          Some things you write down are not for anyone else, including the software you
          wrote them in.
        </p>
      </header>

      <VaultPanel sealed={sealed} />
    </div>
  );
}
