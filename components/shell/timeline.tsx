'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MODE_LABELS } from '@/lib/config';
import { moodColor, moodOpacity, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { Hint } from '@/components/guide/hint';
import { GuideWords, guideDate } from '@/components/lexicon/primitives';

import { IconVault } from './icons';

/**
 * Group by when, not by page.
 *
 * A flat list of fifty sessions is a scroll, not a timeline. Buckets give the
 * eye somewhere to land, and "Yesterday" is a far better landmark than a
 * timestamp you have to read and convert.
 */
function bucketFor(iso: string | null): string {
  if (!iso) return 'Undated';
  const then = new Date(iso);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysBack = Math.floor((startOfToday.getTime() - then.getTime()) / 86_400_000);

  if (daysBack < 0) return 'Today';
  if (daysBack === 0) return 'Today';
  if (daysBack === 1) return 'Yesterday';
  if (daysBack < 7) return 'This week';
  if (daysBack < 30) return 'This month';

  return then.toLocaleDateString(undefined, {
    month: 'long',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export interface SessionGroup {
  label: string;
  items: SessionSummary[];
}

/** Shared with the shoulder index, so its tabs are exactly these sections. */
export function groupSessions(sessions: SessionSummary[]): SessionGroup[] {
  const out: SessionGroup[] = [];
  for (const s of sessions) {
    const label = bucketFor(s.startedAt);
    const last = out[out.length - 1];
    if (last?.label === label) last.items.push(s);
    else out.push({ label, items: [s] });
  }
  return out;
}

export const groupAnchor = (label: string) =>
  `sessions-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export function Timeline({
  sessions,
  onNavigate,
}: {
  sessions: SessionSummary[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  const listRef = useRef<HTMLElement>(null);

  /**
   * Guide words: the first and last entry actually in view, recomputed as the
   * list scrolls — exactly what the two words at the head of a dictionary page
   * do. Starts as the whole range until the observer reports.
   */
  const [range, setRange] = useState<[number, number]>([0, Math.max(sessions.length - 1, 0)]);
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) visible.add(i);
          else visible.delete(i);
        }
        if (visible.size) setRange([Math.min(...visible), Math.max(...visible)]);
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sessions]);

  let index = -1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 px-5 pb-3 pt-5">
        {sessions.length > 0 ? (
          <GuideWords
            first={guideDate(sessions[range[0]]?.startedAt ?? null)}
            last={guideDate(sessions[range[1]]?.startedAt ?? null)}
            page="Sessions"
          />
        ) : null}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] text-ink-3">
            {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
            <Hint term="mood" />
          </span>
          <Link
            href="/today"
            onClick={onNavigate}
            className="text-[13px] text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2"
          >
            New entry
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="px-5 py-3 text-[13px] leading-relaxed text-ink-3">
          Nothing here yet. Your first finished conversation will be filed here as an entry.
        </p>
      ) : (
        <nav
          ref={listRef}
          aria-label="Your sessions"
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6"
        >
          {groups.map((group) => (
            <section key={group.label} id={groupAnchor(group.label)} aria-label={group.label} className="scroll-mt-2">
              <h3 className="label sticky top-0 z-[1] border-b border-line-faint bg-surface py-2">
                {group.label}
              </h3>

              <ul className="flex flex-col">
                {group.items.map((s) => {
                  index++;
                  const active = pathname === `/session/${s.id}`;
                  const unended = s.status === 'open' && !s.sealed;
                  return (
                    <li key={s.id} data-index={index} className="border-b border-line-faint last:border-b-0">
                      <Link
                        href={`/session/${s.id}`}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`group block py-2.5 transition-colors ${
                          active ? 'bg-sunken -mx-2 px-2' : 'hover:bg-sunken/60 -mx-2 px-2'
                        }`}
                      >
                        {/* Set like a headword: the title bold, the mode in
                            italic as its part of speech. */}
                        <p className="m-0 text-[17px] leading-snug">
                          <span
                            className={`font-bold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-[3px] ${
                              s.title && !s.sealed ? 'text-ink' : 'text-ink-3'
                            }`}
                          >
                            {s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled')}
                          </span>
                          {!s.sealed ? (
                            <span className="italic text-ink-2">
                              {' '}
                              {(MODE_LABELS[s.mode] ?? s.mode).toLowerCase()}.
                            </span>
                          ) : null}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-3">
                          {s.sealed ? (
                            <span className="inline-flex items-center gap-1.5 text-sealed">
                              <IconVault className="size-3.5" />
                              sealed
                            </span>
                          ) : s.mood ? (
                            <span className="inline-flex items-center gap-1.5">
                              {/* Mood as a dot, always alongside its word —
                                  never colour as the only encoding. */}
                              <span
                                aria-hidden
                                className="inline-block size-[9px] shrink-0 rounded-full"
                                style={{ background: moodColor(s.mood), opacity: moodOpacity(s.mood) }}
                              />
                              {s.mood.label}
                            </span>
                          ) : unended ? (
                            <span className="text-rubric">not ended yet</span>
                          ) : null}
                          <span aria-hidden>·</span>
                          <span className="num">{relativeTime(s.startedAt)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      )}
    </div>
  );
}
