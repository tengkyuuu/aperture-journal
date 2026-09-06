'use client';

import { useEffect, useRef } from 'react';

import { MODE_LABELS, type ConversationMode } from '@/lib/config';

import { IconSend } from '../shell/icons';
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
 * Every control here is a physical key: bordered, shadowed, and driven down by
 * exactly the shadow offset when pressed. The mode tabs are the clearest case
 * — the selected one sits FLUSH with the page, shadow gone, as though it were
 * being held down. Selection is communicated by depth as well as by fill,
 * which survives colour-blindness and a bad projector equally well.
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
  echoArmed,
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
  /** Echoes is on and watching this draft. Never run it without saying so. */
  echoArmed?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the writing rather than scrolling inside a fixed box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
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
      {/* ── Mode keys ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={on}
              title={MODE_HINTS[m]}
              className={`rounded-control border-[3px] border-line px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-100 ${
                on
                  ? // Held down: flush with the page, shadow gone, filled.
                    'translate-x-[3px] translate-y-[3px] bg-accent text-on-accent shadow-none'
                  : 'brut-press-sm bg-surface text-ink shadow-[3px_3px_0_0_var(--border-ink)]'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          );
        })}

        {canEnd ? (
          <button
            type="button"
            onClick={onEnd}
            className="brut-press-sm ml-auto rounded-control border-[3px] border-line bg-pop px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#111111] shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            End session
            <span className="ml-1.5 font-mono text-[10px] opacity-70">⌘E</span>
          </button>
        ) : null}
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-3">{MODE_HINTS[mode]}</p>

      {/* ── The page you write on ──────────────────────────────────────── */}
      <div className="flex items-end gap-2 rounded-card brut bg-surface p-2 transition-shadow focus-within:shadow-[var(--shadow-brut-lg)]">
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
          rows={2}
          disabled={disabled}
          placeholder={placeholder ?? 'Write something…'}
          aria-label="Your entry"
          className="prose-journal max-h-80 min-h-[3.5rem] w-full flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-[15px] placeholder:text-ink-3 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || busy || !value.trim()}
          aria-label="Send"
          className="brut-press-sm mb-1 grid size-11 shrink-0 place-items-center rounded-control border-[3px] border-line bg-accent text-on-accent shadow-[3px_3px_0_0_var(--border-ink)] transition-[transform,box-shadow,opacity] duration-100 disabled:pointer-events-none disabled:opacity-30"
        >
          {busy ? <PixelLoader size="sm" tone="current" /> : <IconSend />}
        </button>
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-3">
        <Key>⌘↵</Key> to send
        <span aria-hidden>·</span>
        <Key>⌘K</Key> to jump
        <span aria-hidden>·</span>
        <Key>?</Key> for keys
        {/*
          Echoes reads this draft when you pause. It says so here, always,
          while it is armed. A feature that sends unsent writing anywhere and
          does not admit it on screen is the thing this app exists not to be.
        */}
        {echoArmed ? (
          <>
            <span aria-hidden>·</span>
            <span
              title="When you pause, this draft is sent to the embedding model to look for past entries like it. Turn it off in your profile."
              className="inline-flex items-center gap-1 font-medium text-ink-2"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sealed" />
              echoes on
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border-2 border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}
