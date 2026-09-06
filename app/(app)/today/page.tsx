import { redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { OpenLoops } from '@/components/home/open-loops';
import { RecentSessions } from '@/components/home/recent-sessions';
import { WeekStrip } from '@/components/home/week-strip';
import { MoodTint } from '@/components/shell/mood-tint';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { getHomeDigest, getProfile } from '@/lib/server/queries';
import { longDate } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

/**
 * Today.
 *
 * The composer is still the hero and still comes first — you came here to
 * write something, not to read a dashboard. Everything else sits BELOW it, in
 * the order you would actually want it: what you left unresolved, how the
 * fortnight has gone, what you wrote lately.
 *
 * That order is the whole design. Putting the weather chart at the top would
 * make this an analytics page about a journal instead of a journal.
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
  if (!session) redirect(CLEAR_SESSION_PATH);

  const [digest, profile] = await Promise.all([
    getHomeDigest(session.uid),
    getProfile(session.uid),
  ]);
  const firstName = (session.name as string | undefined)?.split(' ')[0];
  const isNew = digest.totalSessions === 0;

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <MoodTint mood={digest.weekMood} />

      <header className="mb-10">
        <p className="label">{longDate()}</p>
        <h1 className="mt-3 font-serif text-[34px] font-light leading-tight tracking-tight text-ink sm:text-[40px]">
          {isNew
            ? 'A private place to think.'
            : firstName
              ? `Hello, ${firstName}.`
              : 'Welcome back.'}
        </h1>

        {isNew ? (
          <p className="prose-journal mt-4 text-ink-2">
            Write whatever is on your mind. When you are done, end the session and it will be
            distilled into something you can come back to. Nothing is shared, and nothing
            leaves your account.
          </p>
        ) : null}
      </header>

      {/* The saved default mode, finally doing something. */}
      <Canvas
        placeholder={promptForToday()}
        initialMode={profile.settings.defaultMode}
        echoesEnabled={profile.settings.echoes}
      />

      {!isNew ? (
        <div className="mt-16 flex flex-col gap-12 border-t-[3px] border-line pt-12">
          <OpenLoops loops={digest.openLoops} />
          <WeekStrip
            sessions={digest.recent}
            mood={digest.weekMood}
            streak={digest.streak}
          />
          <RecentSessions sessions={digest.recent} />
        </div>
      ) : null}
    </div>
  );
}
