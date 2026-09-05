'use client';

import { moodColor } from '@/lib/shared/format';
import type { Insights } from '@/lib/shared/types';
import { PixelLoader } from '@/components/shell/pixel-loader';

/**
 * ══ SIGNATURE MOMENT #2: The Distillation ══
 *
 * Ending a session does not show a spinner. Three pixel blocks tick through
 * their frames, the word DISTILLING sits under them in a bitmap face, and then
 * the summary lands card by card — each one arriving with a spring overshoot
 * and a hard shadow, like sheets being dealt onto a table.
 *
 * The dwell is held to ~1.9s in the caller even when the model is faster. That
 * is deliberate: the wait stops reading as latency and starts reading as the
 * app taking a moment with what you wrote. Under prefers-reduced-motion the
 * copy still shows and the cards still land; they just stop travelling.
 */

export function Distilling() {
  return (
    <div
      className="flex flex-col items-center gap-5 py-20"
      role="status"
      aria-live="polite"
    >
      <PixelLoader />
      <span className="label tracking-[0.2em]">distilling</span>
    </div>
  );
}

/** Each card is dealt onto the table, 140ms after the one before it. */
function Card({
  i,
  children,
  className = '',
}: {
  i: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-pop-in ${className}`}
      style={{ animationDelay: `${i * 140}ms` }}
    >
      {children}
    </div>
  );
}

export function InsightReveal({ insights }: { insights: Insights }) {
  const { title, summary, bullets, openLoops, mood, themes, suggestedExperiment } = insights;

  return (
    <section aria-label="Session summary" className="mt-10 border-t-[3px] border-line pt-10">
      <div className="flex flex-col gap-5">
        <Card i={0}>
          <div className="tilt-l inline-block">
            <span className="chip-brut bg-pop">Distilled</span>
          </div>
          <h2 className="mt-3 text-[30px] font-bold leading-[1.1] tracking-tight text-ink">
            {title}
          </h2>
        </Card>

        <Card i={1}>
          <p className="prose-journal text-ink-2">{summary}</p>
        </Card>

        {bullets.length > 0 ? (
          <Card i={2}>
            <ul className="flex flex-col gap-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="grid grid-cols-[14px_1fr] gap-3 text-[14px] text-ink-2">
                  {/* A square, not a bullet. Round dots belong to the old system. */}
                  <span aria-hidden className="mt-[7px] size-2 bg-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card i={3}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Mood always carries its word. Colour is never the encoding. */}
            <span className="chip-brut bg-surface text-ink">
              <span
                aria-hidden
                className="size-2 border border-line"
                style={{ background: moodColor(mood) }}
              />
              {mood.label}
            </span>
            {themes.map((t) => (
              <span key={t} className="chip-brut bg-sunken text-ink">
                {t}
              </span>
            ))}
          </div>
        </Card>

        {openLoops.length > 0 ? (
          <Card i={4}>
            <div className="rounded-card brut bg-surface p-4">
              <p className="label mb-2.5">Still open</p>
              <ul className="flex flex-col gap-1.5">
                {openLoops.map((l, i) => (
                  <li key={i} className="text-[13.5px] text-ink-2">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ) : null}

        {suggestedExperiment ? (
          <Card i={5}>
            {/* The one card that is a filled colour block — it is the only
                thing here asking you to DO something. */}
            <div className="tilt-r rounded-card brut bg-pop p-4 text-[#111111]">
              <p className="label text-[#111111]">One thing to try</p>
              <p className="mt-1.5 text-[15px] font-medium leading-relaxed">
                {suggestedExperiment}
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
