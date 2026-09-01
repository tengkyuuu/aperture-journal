import { redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { getSession } from '@/lib/server/auth';
import { longDate } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

/**
 * Today. The composer is the hero and it is the first thing focused.
 * No dashboard, no stats, no cards competing for the eye — you came here to
 * write something.
 */

const PROMPTS = [
  'What has been taking up room in your head?',
  'What did you decide today, and what decided itself?',
  'Something small that went better than expected.',
  'What are you avoiding, and what would the first minute of it look like?',
  'Who were you around today, and how did it leave you?',
  'What did you change your mind about this week?',
  'The thing you keep almost saying.',
  'What would make tomorrow feel manageable?',
];

function promptForToday(): string {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return PROMPTS[dayOfYear % PROMPTS.length]!;
}

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  const firstName = (session.name as string | undefined)?.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">{longDate()}</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink sm:text-[40px]">
          {firstName ? `Hello, ${firstName}.` : 'A private place to think.'}
        </h1>
      </header>

      <Canvas placeholder={promptForToday()} />
    </div>
  );
}
