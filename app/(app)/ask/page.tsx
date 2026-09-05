import { redirect } from 'next/navigation';

import { AskView } from '@/components/ask/ask-view';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">Retrieval over your own writing</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink">
          Ask your past
        </h1>
        <p className="prose-journal mt-4 text-ink-2">
          Answers come only from entries you have written, cited back to the day you wrote
          them.
        </p>
      </header>

      <AskView />
    </div>
  );
}
