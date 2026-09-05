'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { moodColor, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { ThemeConstellation } from './theme-constellation';
import { WeatherRibbon } from './weather-ribbon';

export function InsightsView({ sessions }: { sessions: SessionSummary[] }) {
  const [theme, setTheme] = useState<string | null>(null);

  const filtered = useMemo(
    () => (theme ? sessions.filter((s) => s.themes.includes(theme)) : sessions),
    [sessions, theme],
  );

  const averages = useMemo(() => {
    if (sessions.length === 0) return null;
    const v = sessions.reduce((n, s) => n + (s.mood?.valence ?? 0), 0) / sessions.length;
    const e = sessions.reduce((n, s) => n + (s.mood?.energy ?? 0), 0) / sessions.length;
    return { valence: v, energy: e };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="prose-journal text-ink-3">
        Patterns need a few entries before they show up. Close a session or two and your
        Emotional Weather starts drawing itself.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label">Emotional weather</p>
          {averages ? (
            <p className="text-[12px] text-ink-3">
              average{' '}
              <span style={{ color: moodColor({ ...averages, label: '' }) }}>
                {averages.valence > 0.15
                  ? 'lighter than level'
                  : averages.valence < -0.15
                    ? 'heavier than level'
                    : 'about level'}
              </span>
            </p>
          ) : null}
        </div>
        <WeatherRibbon sessions={sessions} />
      </section>

      <section className="flex flex-col gap-4">
        <p className="label">Themes</p>
        <ThemeConstellation sessions={sessions} onSelect={setTheme} selected={theme} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label">
            {theme ? `Sessions about “${theme}”` : 'All distilled sessions'}
          </p>
          {theme ? (
            <button
              type="button"
              onClick={() => setTheme(null)}
              className="text-[12px] text-accent underline underline-offset-2"
            >
              Clear filter
            </button>
          ) : null}
        </div>

        <ul className="flex flex-col gap-1.5">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                href={`/session/${s.id}`}
                className="flex items-baseline gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: moodColor(s.mood) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[15px] text-ink">
                    {s.title ?? 'Untitled'}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {s.mood?.label}
                    {s.themes.length > 0 ? ` · ${s.themes.slice(0, 3).join(', ')}` : ''}
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
    </div>
  );
}
