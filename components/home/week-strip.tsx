import Link from 'next/link';

import { Plate } from '@/components/lexicon/primitives';

import type { Mood, SessionSummary } from '@/lib/shared/types';

/**
 * A fortnight of Emotional Weather, as fourteen fixed day slots.
 *
 * Fixed slots, not one column per entry: two entries in a fortnight should
 * look like two marks on a calendar, not two progress bars stretched across
 * the plate. An empty day is a tick on the baseline — the day happened, you
 * just did not write.
 *
 * Each entry is one block in its mood's ink, as tall as it was charged.
 * The full interactive ribbon lives on Insights; this is a glance that links
 * through.
 */

const DAYS = 14;
const MAX_H = 44; // px, a fully charged entry
const MIN_H = 8; // px, a flat one still leaves a mark

// Three inks, never a blend: emerald mixed into madder is a muddy brown that
// means nothing. Same thresholds as moodColor().
function blockColor(valence: number): string {
  if (valence > 0.25) return 'var(--positive)';
  if (valence < -0.25) return 'var(--negative)';
  return 'var(--level)';
}

function moodWords(mood: Mood | null): string {
  if (!mood) return 'no readings yet';
  if (mood.valence > 0.25) return 'mostly lighter';
  if (mood.valence < -0.25) return 'mostly heavier';
  return 'mostly even';
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function WeekStrip({
  sessions,
  mood,
}: {
  sessions: SessionSummary[];
  mood: Mood | null;
  streak?: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slots = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i)); // oldest on the left
    return { date: d, entries: [] as SessionSummary[] };
  });
  const byDay = new Map(slots.map((s) => [dayKey(s.date), s]));

  for (const s of sessions) {
    if (!s.mood || !s.startedAt) continue;
    byDay.get(dayKey(new Date(s.startedAt)))?.entries.push(s);
  }

  const count = slots.reduce((n, s) => n + s.entries.length, 0);
  if (count === 0) return null;

  return (
    <section aria-label="Last two weeks">
      <Plate
        number="I"
        title="Last two weeks"
        caption={
          <>
            {count} {count === 1 ? 'entry' : 'entries'} in fourteen days, {moodWords(mood)}. Each
            block is an entry: colour is how it felt, height is how charged it was; a tick is a day
            without one.{' '}
            <Link
              href="/insights"
              className="not-italic text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2"
            >
              Open Insights
            </Link>
          </>
        }
      >
        <div
          role="img"
          aria-label={`Emotional weather: ${count} entries over the last fourteen days, ${moodWords(mood)}.`}
        >
          <div className="flex items-end gap-1 border-b border-line" style={{ height: MAX_H + 4 }}>
            {slots.map((slot) => (
              <div key={dayKey(slot.date)} className="flex min-w-0 flex-1 items-end justify-center gap-px">
                {slot.entries.length === 0 ? (
                  <span aria-hidden className="block h-1.5 w-px bg-line-faint" />
                ) : (
                  slot.entries.map((e) => {
                    const energy = Math.min(Math.max(e.mood?.energy ?? 0.5, 0), 1);
                    return (
                      <span
                        key={e.id}
                        aria-hidden
                        className="block min-w-[6px] flex-1 border border-line rounded-control"
                        style={{
                          height: Math.round(MIN_H + energy * (MAX_H - MIN_H)),
                          background: blockColor(e.mood!.valence),
                        }}
                      />
                    );
                  })
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[13px] text-ink-3">
            <span>{short(slots[0]!.date)}</span>
            <span>Today</span>
          </div>
        </div>
      </Plate>
    </section>
  );
}
