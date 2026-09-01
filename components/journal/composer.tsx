'use client';

import { useEffect, useRef } from 'react';

import { MODE_LABELS, type ConversationMode } from '@/lib/config';

import { IconSend } from '../shell/icons';

const MODES: ConversationMode[] = ['reflect', 'brainstorm', 'untangle', 'duck'];

const MODE_HINTS: Record<ConversationMode, string> = {
  reflect: 'One question at a time. No advice unless you ask twice.',
  brainstorm: 'Volume first. Expect one idea that is slightly too strange.',
  untangle: 'Notices the shape of a thought, not the person thinking it.',
  duck: 'Makes you explain it properly, then points at the gap.',
};

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
      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            title={MODE_HINTS[m]}
            className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
              mode === m
                ? 'bg-accent-wash text-accent'
                : 'text-ink-3 hover:bg-sunken hover:text-ink-2'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}

        {canEnd ? (
          <button
            type="button"
            onClick={onEnd}
            className="ml-auto rounded-full border border-line px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            End session
            <span className="ml-1.5 font-mono text-[10px] text-ink-3">⌘E</span>
          </button>
        ) : null}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">{MODE_HINTS[mode]}</p>

      <div className="flex items-end gap-2 rounded-card border border-line bg-surface p-2 transition-colors focus-within:border-line-strong">
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
          className="prose-journal max-h-80 min-h-[3.5rem] w-full flex-1 resize-none bg-transparent px-3 py-2 text-[17px] outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-ink-3 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || busy || !value.trim()}
          aria-label="Send"
          className="mb-1 grid size-9 shrink-0 place-items-center rounded-control bg-accent text-on-accent transition-opacity disabled:opacity-25"
        >
          {busy ? <span className="animate-breathe size-1.5 rounded-full bg-current" /> : <IconSend />}
        </button>
      </div>

      <p className="text-[11px] text-ink-3">
        <kbd className="font-mono">⌘↵</kbd> to send · <kbd className="font-mono">⌘K</kbd> to jump
      </p>
    </div>
  );
}
