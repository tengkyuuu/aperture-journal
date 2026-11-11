import { redirect } from 'next/navigation';

import { Canvas } from '@/components/journal/canvas';
import { OpenLoops } from '@/components/home/open-loops';
import { RecentSessions } from '@/components/home/recent-sessions';
import { WeekStrip } from '@/components/home/week-strip';
import { MoodTint } from '@/components/shell/mood-tint';
import { getSession } from '@/lib/server/auth';
import { CLEAR_SESSION_PATH } from '@/lib/config';
import { getHomeDigest, getProfile } from '@/lib/server/queries';
import { PageHead } from '@/components/lexicon/primitives';

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

      <PageHead
        first={new Date().toLocaleDateString(undefined, { weekday: 'long' })}
        last={new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        page="Today"
        title={isNew ? 'A private place to think.' : firstName ? `Hello, ${firstName}.` : 'Welcome back.'}
      >
        {isNew ? (
          <p>
            Write whatever is on your mind and press send. The AI answers with a question to help
            you think it through. When you are done, press End session and the conversation is
            filed under Sessions as a short summary you can come back to.
          </p>
        ) : (
          <p>Write, talk it through, then press End session to file it as an entry.</p>
        )}
      </PageHead>

      {/* The saved default mode, finally doing something. */}
      <Canvas
        placeholder={promptForToday()}
        initialMode={profile.settings.defaultMode}
        echoesEnabled={profile.settings.echoes}
      />

      {!isNew ? (
        <div className="mt-12 flex flex-col gap-12 border-t border-line pt-10">
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
