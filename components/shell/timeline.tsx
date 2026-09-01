'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MODE_LABELS } from '@/lib/config';
import { moodColor, moodOpacity, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { IconVault } from './icons';

export function Timeline({
  sessions,
  onNavigate,
}: {
  sessions: SessionSummary[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <span className="label">Sessions</span>
        <Link
          href="/today"
          onClick={onNavigate}
          className="rounded-control px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          New
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="px-5 py-3 text-[13px] leading-relaxed text-ink-3">
          Nothing here yet. That&rsquo;s the right amount for a first day.
        </p>
      ) : (
        <nav aria-label="Your sessions" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <ul className="flex flex-col gap-px">
            {sessions.map((s) => {
              const active = pathname === `/session/${s.id}`;
              return (
                <li key={s.id}>
                  <Link
                    href={`/session/${s.id}`}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex flex-col gap-1 rounded-control px-3 py-2.5 transition-colors ${
                      active ? 'bg-sunken' : 'hover:bg-sunken/60'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      {/* Mood as a dot, always alongside a text label further
                          down — never colour as the only encoding. */}
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full"
                        style={{
                          background: moodColor(s.mood),
                          opacity: moodOpacity(s.mood),
                        }}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate font-serif text-[15px] leading-snug ${
                          s.title ? 'text-ink' : 'text-ink-3 italic'
                        }`}
                      >
                        {s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled')}
                      </span>
                      {s.sealed ? (
                        <IconVault className="size-3.5 shrink-0 text-sealed" />
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 pl-3.5 text-[11px] text-ink-3">
                      <span className="num">{relativeTime(s.startedAt)}</span>
                      <span aria-hidden>·</span>
                      <span>{MODE_LABELS[s.mode] ?? s.mode}</span>
                      {s.mood ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{s.mood.label}</span>
                        </>
                      ) : s.status === 'open' ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-accent">open</span>
                        </>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
