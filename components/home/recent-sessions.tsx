import Link from 'next/link';

import { MODE_LABELS } from '@/lib/config';
import { moodColor, moodOpacity, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';
import { IconVault } from '@/components/shell/icons';

/**
 * Recent sessions as typographic cards — title, mood, themes, when.
 *
 * No thumbnails, no progress bars, no engagement metrics. The most useful
 * thing a list of your own writing can show is what it was about and how it
 * felt, and everything else is furniture.
 */
export function RecentSessions({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent-heading" className="label">
          Lately
        </h2>
        <Link
          href="/insights"
          className="text-[12px] text-ink-3 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          All insights
        </Link>
      </div>

      <ul className="flex flex-col gap-px">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/session/${s.id}`}
              className="group flex items-baseline gap-3 rounded-card px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full"
                style={{ background: moodColor(s.mood), opacity: moodOpacity(s.mood) }}
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`min-w-0 truncate font-serif text-[16px] leading-snug ${
                      s.title ? 'text-ink' : 'italic text-ink-3'
                    }`}
                  >
                    {s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled')}
                  </span>
                  {s.sealed ? <IconVault className="size-3.5 shrink-0 text-sealed" /> : null}
                </span>

                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-3">
                  {/* Mood in words, always — the dot is a second encoding, never the only one. */}
                  {s.mood ? <span>{s.mood.label}</span> : null}
                  {s.mood && s.themes.length > 0 ? <span aria-hidden>·</span> : null}
                  {s.themes.length > 0 ? (
                    <span className="truncate">{s.themes.slice(0, 3).join(', ')}</span>
                  ) : null}
                  {!s.mood && s.themes.length === 0 ? (
                    <span>{MODE_LABELS[s.mode] ?? s.mode}</span>
                  ) : null}
                </span>
              </span>

              <span className="num shrink-0 text-[11.5px] text-ink-3">
                {relativeTime(s.startedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
