'use client';

import { moodColor } from '@/lib/shared/format';
import type { Insights } from '@/lib/shared/types';
import { Hint } from '@/components/guide/hint';
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
      <span className="label tracking-[0.2em]">writing your summary</span>
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
    <section aria-label="Session summary" className="mt-10 border-t border-line pt-10">
      <div className="flex flex-col gap-5">
        {/* The page head already prints the headword; this section is headed by
            what it is, and the title is kept only for screen readers. */}
        <Card i={0}>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <h2 className="label">
              Distilled<span className="sr-only">: {title}</span>
            </h2>
            <Hint term="distilled" />
          </div>
        </Card>

        <Card i={1}>
          <p className="prose-journal text-ink-2">{summary}</p>
        </Card>

        {bullets.length > 0 ? (
          <Card i={2}>
            <ul className="flex flex-col gap-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="grid grid-cols-[14px_1fr] gap-3 text-[13px] text-ink-2">
                  {/* A square, not a bullet. Round dots belong to the old system. */}
                  <span aria-hidden className="mt-[7px] size-2 shrink-0 rounded-full bg-accent" />
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
                className="size-2 border border-line rounded-control"
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
                  <li key={i} className="text-[13px] text-ink-2">
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
            <div className="plate bg-pop p-5 text-[#1b1a16]">
              <p className="label !text-[#1b1a16]">One thing to try</p>
              <p className="mt-1.5 text-[16px] font-medium leading-relaxed">
                {suggestedExperiment}
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
