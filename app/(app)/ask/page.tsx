import { redirect } from 'next/navigation';

import { AskView } from '@/components/ask/ask-view';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { PageHead } from '@/components/lexicon/primitives';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <PageHead first="Your question" last="Answers" page="Ask your past" title="Ask your past">
        <p>
          Ask a question about your own entries. Answers use only what you wrote, and each point
          links to the entry it came from. Only finished entries can be searched, and sealed ones
          never are.
        </p>
      </PageHead>

      <AskView />
    </div>
  );
}
