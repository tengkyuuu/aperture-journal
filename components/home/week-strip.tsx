import Link from 'next/link';

import type { Mood, SessionSummary } from '@/lib/shared/types';

/**
 * A fortnight of Emotional Weather, drawn as pixel columns.
 *
 * This is where the pixels earn their keep rather than decorate. Mood is a
 * fuzzy, self-reported reading — a smooth gradient ribbon implies a precision
 * the underlying number does not have. Quantising each column into whole
 * blocks says the true thing: roughly this heavy, roughly this charged.
 * The medium matches the confidence of the data.
 *
 * Each column is `energy` blocks tall, coloured by `valence`, on a ruled
 * baseline. The full interactive ribbon lives on Insights; this one is a
 * glance that links through.
 */

const ROWS = 6;

function blockColor(valence: number): string {
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

  // Oldest to newest, so left-to-right reads as forward in time.
  const ordered = [...withMood].reverse();

  return (
    <section aria-labelledby="weather-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="weather-heading" className="label">
          Last two weeks
        </h2>
        {streak > 1 ? (
          <span className="chip-brut bg-pop">{streak} day streak</span>
        ) : null}
      </div>

      <Link
        href="/insights"
        aria-label={`Emotional weather across ${ordered.length} sessions, ${moodWords(mood)}. Open insights.`}
        className="brut-press-sm block rounded-card brut bg-surface p-4 shadow-[3px_3px_0_0_var(--border-ink)]"
      >
        <div className="flex items-end gap-[5px]" aria-hidden>
          {ordered.map((s) => {
            const energy = Math.min(Math.max(s.mood?.energy ?? 0.5, 0), 1);
            // At least one block: a session that happened must leave a mark,
            // even a flat one.
            const filled = Math.max(1, Math.round(energy * ROWS));

            return (
              <span key={s.id} className="flex min-w-0 flex-1 flex-col-reverse gap-[3px]">
                {Array.from({ length: ROWS }, (_, row) => (
                  <span
                    key={row}
                    className="h-2.5 w-full border-2 border-line"
                    style={
                      row < filled
                        ? { background: blockColor(s.mood!.valence) }
                        : { background: 'transparent', opacity: 0.18 }
                    }
                  />
                ))}
              </span>
            );
          })}
        </div>

        {/* The words carry it. Colour is never the only encoding. */}
        <p className="mt-3 border-t-[3px] border-line pt-2.5 text-[12.5px] text-ink-2">
          {ordered.length} session{ordered.length === 1 ? '' : 's'} · {moodWords(mood)}
        </p>
      </Link>
    </section>
  );
}
