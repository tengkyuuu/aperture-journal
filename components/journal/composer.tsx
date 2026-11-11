'use client';

import { useEffect, useRef } from 'react';

import { MODE_LABELS, type ConversationMode } from '@/lib/config';
import { useModKey } from '@/hooks/use-mod-key';

import { PixelLoader } from '../shell/pixel-loader';

const MODES: ConversationMode[] = ['reflect', 'brainstorm', 'untangle', 'duck'];

const MODE_HINTS: Record<ConversationMode, string> = {
  reflect: 'One question at a time. No advice unless you ask twice.',
  brainstorm: 'Volume first. Expect one idea that is slightly too strange.',
  untangle: 'Notices the shape of a thought, not the person thinking it.',
  duck: 'Makes you explain it properly, then points at the gap.',
};

/**
 * The composer.
 *
 * Set as the open page of the book: the mode as an italic part of speech, the
 * chosen one bold over a rule; the writing area an unboxed ruled page under a
 * heavy head rule; Send a printed-reverse word. On an empty entry the page is
 * roomy at desk widths and phone-sized below sm, so Send stays above the tab
 * bar. See DESIGN.md, "Part-of-Speech" and the composer component.
 */
export function Composer({
  value,
  onChange,
  onSend,
  mode,
  onModeChange,
  disabled,
  busy,
  placeholder,
  canEnd,
  onEnd,
  onStop,
  echoArmed,
  roomy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  mode: ConversationMode;
  onModeChange: (m: ConversationMode) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  canEnd?: boolean;
  onEnd?: () => void;
  /** Abort the generation in flight. Only meaningful while `busy`. */
  onStop?: () => void;
  /** Echoes is on and watching this draft. Never run it without saying so. */
  echoArmed?: boolean;
  /** An empty entry: give the page room, as an open notebook would. */
  roomy?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mod = useModKey();

  // Grow with the writing rather than scrolling inside a fixed box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 560)}px`;
  }, [value]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e' && canEnd) {
        e.preventDefault();
        onEnd?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEnd, onEnd]);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Mode: set like the part of speech after a headword ─────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div
          data-tour="modes"
          role="group"
          aria-label="How the AI talks back"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[17px] sm:gap-x-1"
        >
          {MODES.map((m, i) => {
            const on = mode === m;
            return (
              <span key={m} className="inline-flex items-baseline">
                {i > 0 ? (
                  <span aria-hidden className="hidden px-1.5 text-ink-3 sm:inline">
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onModeChange(m)}
                  aria-pressed={on}
                  className={`border-b-2 pb-0.5 italic transition-colors ${
                    on
                      ? 'border-line font-bold text-ink'
                      : 'border-transparent text-ink-2 hover:border-line-faint hover:text-ink'
                  }`}
                >
                  {MODE_LABELS[m].toLowerCase()}.
                </button>
              </span>
            );
          })}
        </div>

        {canEnd ? (
          <button
            type="button"
            onClick={onEnd}
            title="Finish this conversation and turn it into a summary"
            className="brut-press-sm border-2 border-line bg-surface px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-ink"
          >
            End session
            <span className="ml-1.5 text-ink-3 [@media(pointer:coarse)]:hidden">{mod}E</span>
          </button>
        ) : null}
      </div>

      <p className="text-[13px] leading-relaxed text-ink-3">
        <i className="text-ink-2">{MODE_LABELS[mode].toLowerCase()}.</i> {MODE_HINTS[mode]}
      </p>

      {/* ── The open page ───────────────────────────────────────────────
          Not a box: a ruled page, headed by a heavy rule and closed by a
          hairline, with faint writing lines at the text's own leading. An
          empty entry gets a good part of the screen, the way a notebook
          opens to a blank page rather than a field. */}
      <div
        data-tour="composer"
        className="border-y border-line border-t-2 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(1.7em-1px),var(--line-subtle)_calc(1.7em-1px),var(--line-subtle)_1.7em)] bg-[length:100%_1.7em] bg-local text-[17px] focus-within:border-t-[3px]"
        style={{ backgroundPositionY: '0.75rem' }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={3}
          disabled={disabled}
          placeholder={placeholder ?? 'Write something…'}
          aria-label="Your entry"
          className={`prose-journal block w-full max-w-none resize-none bg-transparent px-1 pt-3 text-ink outline-none placeholder:text-ink-3 disabled:opacity-50 ${
            roomy ? 'min-h-[9rem] sm:min-h-[38vh]' : 'min-h-[7rem]'
          }`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-3">
          {/* Keyboard hints mean nothing on a touch screen. */}
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 [@media(pointer:coarse)]:hidden">
            <Key>{mod}↵</Key> to send
            <span aria-hidden>·</span>
            <Key>{mod}K</Key> to jump
            <span aria-hidden>·</span>
            <Key>?</Key> for keys
          </span>
          {/*
            Echoes reads this draft when you pause. It says so here, always,
            while it is armed. A feature that sends unsent writing anywhere and
            does not admit it on screen is the thing this app exists not to be.
          */}
          {echoArmed ? (
            <span
              title="When you pause, this draft is sent to the AI search model to find older entries about the same thing. Turn it off in Profile."
              className="inline-flex items-center gap-1 font-bold text-ink-2"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sealed" />
              echoes on
            </span>
          ) : null}
        </p>

        {/* While streaming, Send becomes Stop: the same printed key, said in
            rubric. A control cannot be both the affordance and the progress
            indicator; the caret in the reply already says one is arriving. */}
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="brut-press-sm min-h-10 border-2 border-danger bg-surface px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-danger"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || busy || !value.trim()}
            className="brut-press-sm inline-flex min-h-10 items-center gap-2 border-2 border-line bg-accent px-5 text-[13px] font-bold uppercase tracking-[0.08em] text-on-accent transition-opacity disabled:pointer-events-none disabled:opacity-35"
          >
            {busy ? <PixelLoader size="sm" tone="current" /> : null}
            Send
          </button>
        )}
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-line-faint px-1 font-sans text-[13px] font-bold not-italic tracking-[0.04em] text-ink-2">
      {children}
    </kbd>
  );
}
