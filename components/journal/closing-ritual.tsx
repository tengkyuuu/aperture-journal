'use client';

import { moodColor } from '@/lib/shared/format';
import type { Insights } from '@/lib/shared/types';

/**
 * ══ SIGNATURE MOMENT #2: The Distillation ══
 *
 * Ending a session does not show a spinner. The canvas dims, one dot breathes,
 * the word "distilling" fades in — and then the summary reveals line by line.
 *
 * The dwell time is enforced to ~1.9s in the caller even when the model returns
 * sooner. That is deliberate: the wait stops reading as latency and starts
 * reading as the app taking a moment with what you wrote. Under
 * prefers-reduced-motion the copy still shows; it just stops being a
 * performance.
 */

export function Distilling() {
  return (
    <div
      className="flex flex-col items-center gap-5 py-20 animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="animate-breathe size-2.5 rounded-full bg-accent" />
      <span className="label">distilling</span>
    </div>
  );
}

/** Staggered reveal. Each element enters 180ms after the one before it. */
function Line({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <div className="animate-rise-in" style={{ animationDelay: `${i * 180}ms` }}>
      {children}
    </div>
  );
}

export function InsightReveal({ insights }: { insights: Insights }) {
  const { title, summary, bullets, openLoops, mood, themes, suggestedExperiment } = insights;

  return (
    <section
      aria-label="Session summary"
      className="mt-10 border-t border-line pt-10"
    >
      <div className="flex flex-col gap-6">
        <Line i={0}>
          <p className="label mb-2">Distilled</p>
          <h2 className="font-serif text-[28px] leading-tight tracking-tight text-ink">
            {title}
          </h2>
        </Line>

        <Line i={1}>
          <p className="prose-journal text-ink-2">{summary}</p>
        </Line>

        {bullets.length > 0 ? (
          <Line i={2}>
            <ul className="flex flex-col gap-2">
              {bullets.map((b, i) => (
                <li key={i} className="grid grid-cols-[10px_1fr] gap-3 text-[14px] text-ink-2">
                  <span aria-hidden className="pt-[9px] h-px w-2.5 bg-line-strong" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Line>
        ) : null}

        <Line i={3}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Mood carries a text label, always. Colour is never the encoding. */}
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-ink-2">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: moodColor(mood) }}
              />
              {mood.label}
            </span>
            {themes.map((t) => (
              <span
                key={t}
                className="rounded-full bg-sunken px-3 py-1 font-mono text-[11px] text-ink-3"
              >
                {t}
              </span>
            ))}
          </div>
        </Line>

        {openLoops.length > 0 ? (
          <Line i={4}>
            <div className="rounded-card border border-line bg-surface p-4">
              <p className="label mb-2.5">Still open</p>
              <ul className="flex flex-col gap-1.5">
                {openLoops.map((l, i) => (
                  <li key={i} className="text-[13.5px] text-ink-2">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </Line>
        ) : null}

        {suggestedExperiment ? (
          <Line i={5}>
            <div className="rounded-card border-l-2 border-accent bg-accent-wash px-4 py-3.5">
              <p className="label mb-1.5">One thing to try</p>
              <p className="text-[14px] leading-relaxed text-ink-2">{suggestedExperiment}</p>
            </div>
          </Line>
        ) : null}
      </div>
    </section>
  );
}
