import Link from 'next/link';

import type { Mood, SessionSummary } from '@/lib/shared/types';

/**
 * A compact fortnight of Emotional Weather for the Today screen.
 *
 * The full ribbon lives on Insights and is interactive. This one is a glance:
 * a dozen bands, the mood in words, and the streak. It links through rather
 * than duplicating the interaction, because two hoverable ribbons on two pages
 * is one more than anyone needs.
 */

function bandColor(valence: number): string {
  const t = Math.round(((valence + 1) / 2) * 100);
  return `color-mix(in oklab, var(--positive) ${t}%, var(--negative))`;
}

function moodWords(mood: Mood | null): string {
  if (!mood) return 'no readings yet';
  if (mood.valence > 0.25) return 'lighter than level';
  if (mood.valence < -0.25) return 'heavier than level';
  return 'about level';
}

export function WeekStrip({
  sessions,
  mood,
  streak,
}: {
  sessions: SessionSummary[];
  mood: Mood | null;
  streak: number;
}) {
  const withMood = sessions.filter((s) => s.mood);
  if (withMood.length === 0) return null;

  // Oldest to newest, so reading left to right means forward in time.
  const ordered = [...withMood].reverse();

  return (
    <section aria-labelledby="weather-heading" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="weather-heading" className="label">
          Last two weeks
        </h2>
        {streak > 1 ? (
          <span className="num text-[11.5px] text-ink-3">{streak} days running</span>
        ) : null}
      </div>

      <Link
        href="/insights"
        aria-label={`Emotional weather across ${ordered.length} sessions, ${moodWords(mood)}. Open insights.`}
        className="flex flex-col gap-2 rounded-card transition-opacity hover:opacity-80"
      >
        <div className="flex h-10 items-center gap-[3px]" aria-hidden>
          {ordered.map((s) => {
            const energy = Math.min(Math.max(s.mood?.energy ?? 0.5, 0), 1);
            return (
              <span
                key={s.id}
                className="min-w-0 flex-1 rounded-full"
                style={{
                  height: `${28 + energy * 60}%`,
                  background: bandColor(s.mood!.valence),
                  opacity: 0.45 + energy * 0.55,
                }}
              />
            );
          })}
        </div>

        {/* The words carry it. Colour is never the only encoding. */}
        <p className="text-[12.5px] text-ink-3">
          {ordered.length} session{ordered.length === 1 ? '' : 's'} · {moodWords(mood)}
        </p>
      </Link>
    </section>
  );
}
