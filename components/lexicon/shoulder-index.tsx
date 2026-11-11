'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import type { SessionSummary } from '@/lib/shared/types';
import { groupAnchor, groupSessions } from '@/components/shell/timeline';

/**
 * The thumb index: cut tabs down the outer edge of the book, one per section
 * of the session list, with how many entries each holds. Pressing one scrolls
 * the list to that section.
 *
 * Wide screens only (xl+), where the list and the margin are both on screen.
 * Narrower, the sections are a scroll away in the same list.
 */
export function ShoulderIndex({ sessions }: { sessions: SessionSummary[] }) {
  const pathname = usePathname();
  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  if (groups.length < 2) return null;

  // Tab labels are cut short the way thumb tabs are: "This week" is "Week",
  // a month is three letters, and a past year keeps its two last digits.
  const short = (label: string) => {
    if (label.startsWith('This ')) return label.slice(5);
    const [word, year] = label.split(' ');
    if (!word || word.length <= 5) return label;
    return year ? `${word.slice(0, 3)} ’${year.slice(-2)}` : word.slice(0, 3);
  };

  const activeId = pathname.startsWith('/session/') ? pathname.split('/')[2] : null;
  const current =
    groups.find((g) => g.items.some((s) => s.id === activeId))?.label ?? groups[0]!.label;

  return (
    <nav
      aria-label="Jump to a section of your entries"
      className="fixed right-0 top-24 z-20 hidden w-[104px] flex-col border-l border-line-faint xl:flex"
    >
      {groups.map((g) => {
        const on = g.label === current;
        return (
          <button
            key={g.label}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() =>
              document.getElementById(groupAnchor(g.label))?.scrollIntoView({ block: 'start' })
            }
            className={`flex items-baseline justify-between gap-2 border-b border-line-faint px-2.5 py-2 text-left text-[13px] font-bold uppercase tracking-[0.06em] transition-colors ${
              on ? 'bg-accent text-on-accent' : 'text-ink-3 hover:bg-sunken hover:text-ink'
            }`}
          >
            <span className="truncate" title={g.label}>{short(g.label)}</span>
            <span className="num font-normal tracking-normal">{g.items.length}</span>
          </button>
        );
      })}
    </nav>
  );
}
