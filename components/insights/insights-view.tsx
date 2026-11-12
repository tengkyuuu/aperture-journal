'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { moodColor, relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { MoodWord, Plate } from '@/components/lexicon/primitives';
import { MODE_LABELS } from '@/lib/config';

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
      <Plate
        number="I"
        title="Emotional weather"
        term="weather"
        aside={
          averages ? (
            <span className="text-[13px] text-ink-3">
              {averages.valence > 0.15
                ? 'mostly lighter'
                : averages.valence < -0.15
                  ? 'mostly heavier'
                  : 'mostly even'}
            </span>
          ) : null
        }
      >
        <WeatherRibbon sessions={sessions} />
      </Plate>

      <Plate
        number="II"
        title="Themes"
        term="themes"
        caption="Bigger means it comes up more often; a line joins two themes that appear in the same entry. Choose one to list those entries below."
      >
        <ThemeConstellation sessions={sessions} onSelect={setTheme} selected={theme} />
      </Plate>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label">
            {theme ? `Entries about “${theme}”` : 'All finished entries'}
          </h2>
          {theme ? (
            <button
              type="button"
              onClick={() => setTheme(null)}
              className="text-[13px] text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2"
            >
              Clear filter
            </button>
          ) : null}
        </div>

        <ul className="flex flex-col border-t border-line">
          {filtered.map((s) => (
            <li key={s.id} className="border-b border-line-faint">
              <Link href={`/session/${s.id}`} className="group block py-3">
                <p className="m-0 text-[16px] leading-snug">
                  <span className="font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-[3px]">
                    {s.title ?? 'Untitled'}
                  </span>
                  <span className="ml-2 inline-block rounded-full bg-sunken px-2 py-0.5 align-middle text-[12px] font-normal text-ink-3">{MODE_LABELS[s.mode] ?? s.mode}</span>
                </p>
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-3">
                  {s.mood ? (
                    <MoodWord color={moodColor(s.mood)}>{s.mood.label}</MoodWord>
                  ) : null}
                  {s.themes.length > 0 ? <span>· {s.themes.slice(0, 3).join(', ')}</span> : null}
                  <span aria-hidden>·</span>
                  <span className="num">{relativeTime(s.startedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
