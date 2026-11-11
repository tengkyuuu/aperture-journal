'use client';

import { useEffect, useRef, useState } from 'react';

import { HELP_EVENT, openShortcuts, startTour } from './events';
import { GLOSSARY, GLOSSARY_ORDER } from './glossary';

/**
 * Help: how the app works in three steps, what its words mean, and the way
 * back into the tour.
 *
 * The loop comes first because it is the thing nobody could see — that a
 * conversation turns into a summary only when you END it. Everything else on
 * every other page is downstream of that one action.
 */

const LOOP: [string, string][] = [
  ['Write', 'Type what is on your mind on Today and press send.'],
  ['Talk it through', 'The AI answers with a question. Keep going as long as it helps.'],
  [
    'End session',
    'Press End session. The conversation is distilled into a summary, a mood and themes, and saved under Sessions.',
  ],
];

export function Help() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(HELP_EVENT, onOpen);
    return () => window.removeEventListener(HELP_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function then(action: () => void) {
    setOpen(false);
    // Let the dialog close before the next layer opens on top of the page.
    window.setTimeout(action, 50);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="help-title"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-0 max-h-[100dvh] w-full max-w-lg overflow-y-auto sheet p-0 text-ink backdrop:bg-black/40 sm:mx-auto sm:my-[8vh] sm:max-h-[84vh]"
    >
      <div className="flex flex-col gap-7 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="text-[27px] font-bold leading-tight tracking-tight">
            How Aperture works
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-control px-2 py-1 text-[13px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            Close
          </button>
        </div>

        <ol className="flex flex-col gap-3">
          {LOOP.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-control border-2 border-line bg-accent text-[13px] font-bold text-on-accent">
                {i + 1}
              </span>
              <span className="text-[13px] leading-relaxed text-ink-2">
                <b className="text-ink">{title}.</b> {text}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => then(startTour)}
            className="brut-press-sm rounded-control border-2 border-line bg-accent px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-on-accent"
          >
            Take the tour
          </button>
          {/* Shortcuts need a keyboard. On a touch screen this is noise. */}
          <button
            type="button"
            onClick={() => then(openShortcuts)}
            className="brut-press-sm rounded-control border-2 border-line bg-surface px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink [@media(pointer:coarse)]:hidden"
          >
            Keyboard shortcuts
          </button>
        </div>

        <section aria-labelledby="help-words" className="flex flex-col gap-3">
          <h3 id="help-words" className="text-[17px] font-bold">
            Words you will see
          </h3>
          <dl className="flex flex-col divide-y-2 divide-line/30">
            {GLOSSARY_ORDER.map((t) => (
              <div key={t} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-[13px] font-bold text-ink sm:w-36">
                  {GLOSSARY[t].word}
                </dt>
                <dd className="text-[13px] leading-relaxed text-ink-2">{GLOSSARY[t].plain}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </dialog>
  );
}
