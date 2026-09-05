'use client';

import { useState } from 'react';
import Link from 'next/link';

import type { SessionSummary } from '@/lib/shared/types';

/**
 * ══ SIGNATURE MOMENT #3: Emotional Weather ══
 *
 * A year of your inner life as one continuous strip. Each session is a band:
 * its colour comes from mood valence, its thickness and opacity from energy,
 * and its vertical position drifts up on the lighter days.
 *
 * Colour is mixed in oklab between the two semantic tokens, so it stays inside
 * the palette and follows the theme rather than being a hardcoded rainbow.
 *
 * Colour is never the only encoding — hovering names the mood in words, and
 * the legend below spells out the scale. Roughly one man in twelve cannot
 * reliably separate these hues, and "a slightly reddish band" was never
 * information anyway.
 */

const VIEW_H = 100;

function bandColor(valence: number): string {
  const t = Math.round(((valence + 1) / 2) * 100);
  return `color-mix(in oklab, var(--positive) ${t}%, var(--negative))`;
}

export function WeatherRibbon({ sessions }: { sessions: SessionSummary[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // Oldest on the left. Reading left-to-right should mean forward in time.
  const ordered = [...sessions].reverse();
  if (ordered.length === 0) return null;

  const n = ordered.length;
  const active = hover !== null ? ordered[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <svg
          viewBox={`0 0 ${n} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="block h-32 w-full sm:h-40"
          role="img"
          aria-label={`Mood over ${n} sessions, oldest first`}
          onMouseLeave={() => setHover(null)}
        >
          {ordered.map((s, i) => {
            const valence = s.mood?.valence ?? 0;
            const energy = Math.min(Math.max(s.mood?.energy ?? 0.5, 0), 1);

            const h = 18 + energy * 64;
            const y = (VIEW_H - h) / 2 - valence * 12;
            const opacity = 0.45 + energy * 0.55;

            return (
              <rect
                key={s.id}
                x={i}
                y={y}
                width={1.02}
                height={h}
                rx={0.35}
                style={{ fill: bandColor(valence), opacity: hover === i ? 1 : opacity }}
                onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
      </div>

      {/* The words. Always present, not a hover-only affordance. */}
      <div className="flex min-h-[2.5rem] flex-wrap items-baseline gap-x-3 gap-y-1">
        {active ? (
          <>
            <Link
              href={`/session/${active.id}`}
              className="font-serif text-[15px] text-ink underline-offset-2 hover:underline"
            >
              {active.title ?? 'Untitled'}
            </Link>
            <span className="text-[13px] text-ink-2">{active.mood?.label}</span>
            <span className="text-[12px] text-ink-3">
              {active.startedAt
                ? new Date(active.startedAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })
                : ''}
            </span>
          </>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            {n} session{n === 1 ? '' : 's'}. Hover a band to read it — colour is valence,
            thickness is energy.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-4 rounded-sm"
            style={{ background: bandColor(-1) }}
          />
          heavier
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-4 rounded-sm"
            style={{ background: bandColor(0) }}
          />
          level
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-4 rounded-sm"
            style={{ background: bandColor(1) }}
          />
          lighter
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-4 rounded-sm bg-ink-3" />
          thin = low energy
        </span>
      </div>
    </div>
  );
}
