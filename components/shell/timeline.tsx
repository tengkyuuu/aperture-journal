'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MODE_LABELS } from '@/lib/config';
import { moodColor, moodOpacity, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { Hint } from '@/components/guide/hint';

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-6 pb-1 pt-4">
        <h2 className="label">Your entries</h2>
        <span className="text-[12px] text-ink-3">{sessions.length}</span>
        <span className="ml-auto">
          <Hint term="mood" />
        </span>
      </div>

      {sessions.length === 0 ? (
        <p className="px-6 py-2 text-[13px] leading-relaxed text-ink-3">
          Nothing here yet. When you finish your first conversation, it shows up here.
        </p>
      ) : (
        <nav aria-label="Your entries" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <section key={group.label} id={groupAnchor(group.label)} aria-label={group.label}>
              <h3 className="sticky top-0 z-[1] bg-canvas px-3 pb-1 pt-3 text-[12px] font-medium text-ink-3">
                {group.label}
              </h3>

              <ul className="flex flex-col gap-0.5">
                {group.items.map((s) => {
                  const active = pathname === `/session/${s.id}`;
                  const unended = s.status === 'open' && !s.sealed;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/session/${s.id}`}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`block rounded-control px-3 py-2 transition-colors ${
                          active ? 'bg-accent-wash' : 'hover:bg-sunken'
                        }`}
                      >
                        <p
                          className={`m-0 truncate text-[14px] font-medium leading-snug ${
                            s.title && !s.sealed ? 'text-ink' : 'text-ink-3'
                          }`}
                        >
                          {s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled')}
                        </p>

                        <div className="mt-0.5 flex items-center gap-x-1.5 truncate text-[12px] text-ink-3">
                          {s.sealed ? (
                            <span className="inline-flex items-center gap-1 text-sealed">
                              <IconVault className="size-3.5" />
                              Sealed
                            </span>
                          ) : s.mood ? (
                            <span className="inline-flex items-center gap-1.5">
                              {/* Mood as a dot, always alongside its word —
                                  never colour as the only encoding. */}
                              <span
                                aria-hidden
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ background: moodColor(s.mood), opacity: moodOpacity(s.mood) }}
                              />
                              {s.mood.label}
                            </span>
                          ) : unended ? (
                            <span className="text-accent">Not finished</span>
                          ) : (
                            <span>{MODE_LABELS[s.mode] ?? s.mode}</span>
                          )}
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
