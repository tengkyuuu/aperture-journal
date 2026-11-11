import Link from 'next/link';

import { MODE_LABELS } from '@/lib/config';
import { moodColor, moodOpacity, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';
import { IconVault } from '@/components/shell/icons';
import { MoodWord, SectionLabel } from '@/components/lexicon/primitives';

/**
 * The latest entries, set as headwords: the title in bold, the mode in italic as
 * its part of speech, then how it felt, what it was about, and when.
 *
 * No thumbnails, no progress bars, no engagement metrics. The most useful
 * thing a list of your own writing can show is what it was about and how it
 * felt, and everything else is furniture.
 */
export function RecentSessions({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel id="recent-heading">Lately</SectionLabel>
        <Link
          href="/insights"
          className="text-[13px] text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          All insights
        </Link>
      </div>

      <ul className="flex flex-col border-t-2 border-line">
        {sessions.map((s) => (
          <li key={s.id} className="border-b border-line-faint">
            <Link href={`/session/${s.id}`} className="group block py-3">
              <p className="m-0 text-[17px] leading-snug">
                <span
                  className={`font-bold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-[3px] ${
                    s.title && !s.sealed ? 'text-ink' : 'text-ink-3'
                  }`}
                >
                  {s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled')}
                </span>
                {!s.sealed ? (
                  <span className="italic text-ink-2"> {(MODE_LABELS[s.mode] ?? s.mode).toLowerCase()}.</span>
                ) : null}
              </p>

              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-3">
                {s.sealed ? (
                  <span className="inline-flex items-center gap-1.5 text-sealed">
                    <IconVault className="size-3.5" />
                    sealed
                  </span>
                ) : s.mood ? (
                  <MoodWord color={moodColor(s.mood)} opacity={moodOpacity(s.mood)}>
                    {s.mood.label}
                  </MoodWord>
                ) : null}
                {s.themes.length > 0 && !s.sealed ? (
                  <span className="truncate">· {s.themes.slice(0, 3).join(', ')}</span>
                ) : null}
                <span aria-hidden>·</span>
                <span className="num">{relativeTime(s.startedAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
