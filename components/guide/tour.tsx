'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { TOUR_DONE_KEY, TOUR_EVENT } from './events';

/**
 * The first-run tour.
 *
 * A spotlight on the real interface, not a slideshow about it: each step
 * points at the thing itself, and the page stays live underneath — you can
 * start typing in the composer while the first step is still up.
 *
 * Seven steps at most, and every one is about what you DO, not what a widget
 * is called. It runs once, on Today, and Help replays it. A step whose target
 * is not on screen (a new account has nothing "still open") is skipped rather
 * than pointed at empty space.
 */

interface Step {
  /** Matches `data-tour` on the element. The first VISIBLE match wins, so the
   *  rail and the phone's bottom bar can share a step. */
  target: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    target: 'composer',
    title: 'Start by writing',
    body: (
      <>
        <p>
          Type whatever is on your mind and press send. The AI answers with a question to help
          you think it through. It will not lecture you.
        </p>
        <p>
          When you are finished, press <b className="text-ink">End session</b>. The conversation
          becomes a short summary with its mood and themes, which the app calls{' '}
          <b className="text-ink">distilled</b>.
        </p>
      </>
    ),
  },
  {
    target: 'modes',
    title: 'Choose how it talks back',
    body: (
      <ul className="flex flex-col gap-1.5">
        <li>
          <b className="text-ink">Reflect</b> asks one question at a time.
        </li>
        <li>
          <b className="text-ink">Brainstorm</b> throws ideas at you.
        </li>
        <li>
          <b className="text-ink">Untangle</b> points out the shape of a knotted thought.
        </li>
        <li>
          <b className="text-ink">Rubber Duck</b> makes you explain a problem until the gap
          shows.
        </li>
      </ul>
    ),
  },
  {
    target: 'sessions',
    title: 'Every conversation is kept',
    body: (
      <p>
        Your entries live here, newest first. The dot is how it felt: green lighter, pink heavier,
        purple about level. Open one to read its summary.
      </p>
    ),
  },
  {
    target: 'still-open',
    title: 'Threads you left hanging',
    body: (
      <p>
        Questions your summaries said were unresolved. Nothing to tick off; tap one to go back to
        that entry.
      </p>
    ),
  },
  {
    target: 'nav',
    title: 'The rest of Aperture',
    body: (
      <ul className="flex flex-col gap-1.5">
        <li>
          <b className="text-ink">Insights</b>: your mood over time and what you write about.
        </li>
        <li>
          <b className="text-ink">Ask</b>: ask a question about your own past entries.
        </li>
        <li>
          <b className="text-ink">Vault</b>: lock entries with a passphrase only you know.
        </li>
        <li>
          <b className="text-ink">Security</b>: every request sent to the AI, plus export and
          delete.
        </li>
      </ul>
    ),
  },
  {
    target: 'help',
    title: 'Lost? Come back here',
    body: (
      <p>
        Help replays this tour and explains every word the app uses. Look for the small{' '}
        <b className="text-ink">?</b> next to a label for a quick explanation in place.
      </p>
    ),
  },
];

const PAD = 8;
const GAP = 14;
const MARGIN = 16;

function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function markDone() {
  try {
    localStorage.setItem(TOUR_DONE_KEY, '1');
  } catch {
    // Private mode or blocked storage: the tour may show again. Harmless.
  }
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === '1';
  } catch {
    return true; // If we cannot remember, do not ambush.
  }
}

export function Tour() {
  const pathname = usePathname();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const begin = useCallback(() => {
    // Today streams in behind a loading skeleton, and the shell arrives first.
    // Choosing steps before the page has landed drops every step on it — so
    // wait for the composer, the page's anchor — up to ten seconds, because a
    // slow phone on a slow network is exactly who needs the tour most.
    let tries = 0;
    const attempt = () => {
      if (!findTarget('composer') && tries++ < 50) {
        window.setTimeout(attempt, 200);
        return;
      }
      // Only the steps whose element is actually on this screen.
      const available = STEPS.filter((s) => findTarget(s.target));
      if (available.length === 0) return;
      setSteps(available);
      setIndex(0);
    };
    attempt();
  }, []);

  const finish = useCallback(() => {
    markDone();
    setSteps(null);
    setRect(null);
    setCardPos(null);
  }, []);

  // First visit to Today, or arriving from Help's "Take the tour".
  useEffect(() => {
    if (pathname !== '/today') return;
    const requested = new URLSearchParams(window.location.search).get('tour') === '1';
    if (!requested && hasSeen()) return;
    if (requested) window.history.replaceState(null, '', '/today');
    const t = window.setTimeout(begin, 500);
    return () => window.clearTimeout(t);
  }, [pathname, begin]);

  // Replay from anywhere. The steps live on Today, so go there first.
  useEffect(() => {
    function onStart() {
      if (window.location.pathname === '/today') begin();
      else router.push('/today?tour=1');
    }
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [begin, router]);

  // Leaving Today mid-tour ends it; the targets are gone.
  useEffect(() => {
    if (steps && pathname !== '/today') finish();
  }, [pathname, steps, finish]);

  const step = steps?.[index] ?? null;

  // Bring the target into view, then measure it.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    const reduce =
      document.documentElement.dataset.reduceMotion === '1' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Only scroll when the target is actually off screen. The rail is sticky,
    // and asking it to centre itself scrolls the page underneath for nothing.
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(findTarget(step.target)?.getBoundingClientRect() ?? null));
    };
    measure();
    const settle = window.setTimeout(measure, reduce ? 0 : 400);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // Place the card beside the spotlight: below, else above, else beside, else
  // pinned to the bottom of the screen.
  useLayoutEffect(() => {
    if (!rect || !card.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = card.current.offsetWidth;
    const h = card.current.offsetHeight;
    const clampLeft = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN);
    const clampTop = (y: number) => Math.min(Math.max(y, MARGIN), vh - h - MARGIN);

    let pos: { top: number; left: number };
    if (rect.bottom + PAD + GAP + h <= vh - MARGIN) {
      pos = { top: rect.bottom + PAD + GAP, left: clampLeft(rect.left) };
    } else if (rect.top - PAD - GAP - h >= MARGIN) {
      pos = { top: rect.top - PAD - GAP - h, left: clampLeft(rect.left) };
    } else if (rect.right + PAD + GAP + w <= vw - MARGIN) {
      pos = { top: clampTop(rect.top), left: rect.right + PAD + GAP };
    } else {
      // Nothing fits cleanly. Stay lined up with the target on its roomier
      // side and nudge into the viewport, rather than jumping to a corner.
      const below = vh - rect.bottom >= rect.top;
      pos = {
        top: clampTop(below ? rect.bottom + PAD + GAP : rect.top - PAD - GAP - h),
        left: clampLeft(rect.left),
      };
    }
    setCardPos(pos);
  }, [rect, index]);

  // Keyboard: Escape skips, arrows step. Focus follows the step.
  useEffect(() => {
    if (!steps) return;
    nextBtn.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
      if (!card.current?.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps!.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps, index, finish]);

  if (!steps || !step) return null;
  const last = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: 'none' }}>
      {/* The spotlight: a hole in a dimmed page. Clicks pass straight through,
          so the real interface stays usable during the tour. */}
      {rect ? (
        <div
          aria-hidden
          className="absolute rounded-card border border-accent transition-[top,left,width,height] duration-200 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      ) : null}

      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute w-[min(360px,calc(100vw-32px))] sheet p-6 text-ink animate-pop-in"
        style={{
          pointerEvents: 'auto',
          top: cardPos?.top ?? -9999,
          left: cardPos?.left ?? -9999,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="num text-[13px] text-ink-3" aria-live="polite">
            {index + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-control px-2 py-1 text-[13px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            Skip tour
          </button>
        </div>

        <h2 id="tour-title" className="mt-2 text-[16px] font-semibold leading-tight tracking-tight">
          {step.title}
        </h2>
        <div
          id="tour-body"
          className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-ink-2"
        >
          {step.body}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {/* Progress as blocks, in the system's own pixel vocabulary. */}
          <div aria-hidden className="mr-auto flex gap-1">
            {steps.map((s, i) => (
              <span
                key={s.target}
                className={`size-2 border border-line rounded-control ${i <= index ? 'bg-accent' : 'bg-transparent'}`}
              />
            ))}
          </div>
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="rounded-control px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              Back
            </button>
          ) : null}
          <button
            ref={nextBtn}
            type="button"
            onClick={() => {
              if (!last) return setIndex((i) => i + 1);
              finish();
              // End where the tour said to begin: in the writing.
              findTarget('composer')?.querySelector('textarea')?.focus();
            }}
            className="brut-press-sm rounded-control border border-line bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent"
          >
            {last ? 'Start writing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
