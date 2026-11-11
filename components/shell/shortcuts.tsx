'use client';

import { useEffect, useRef, useState } from 'react';

import { SHORTCUTS_EVENT } from '@/components/guide/events';
import { useModKey } from '@/hooks/use-mod-key';

/**
 * The keyboard reference, on `?`.
 *
 * The app claims to be keyboard-first, and until now the only way to learn any
 * of it was to read the source. A shortcut nobody can discover is a shortcut
 * nobody has.
 *
 * `?` on its own rather than a modifier chord, because it is the convention
 * people already try — and it is suppressed while typing, since a journal is
 * mostly a text field and stealing a question mark mid-sentence would be
 * unforgivable.
 */

// `MOD` is replaced with ⌘ or Ctrl at render, for the keyboard actually in use.
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Anywhere',
    items: [
      ['MOD K', 'Jump to a session or page'],
      ['?', 'This list'],
      ['Esc', 'Close, or lock the vault'],
    ],
  },
  {
    title: 'Writing',
    items: [
      ['MOD ↵', 'Send'],
      ['MOD E', 'End the session and distil it'],
    ],
  },
  {
    title: 'Command palette',
    items: [
      ['↑ ↓', 'Move through results'],
      ['↵', 'Open'],
    ],
  },
];

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

export function Shortcuts() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const mod = useModKey();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    // Help opens this too.
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(SHORTCUTS_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Keyboard shortcuts"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      // Opens on `?`. Keyboard-initiated, so no entrance animation.
      className="m-0 w-full max-w-sm sheet p-0 text-ink backdrop:bg-black/40 sm:mx-auto sm:mt-[14vh]"
    >
      <div className="flex flex-col gap-5 p-6">
        <p className="label">Keyboard</p>

        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-3">{g.title}</p>
            <dl className="flex flex-col gap-1.5">
              {g.items.map(([keys, what]) => (
                <div key={keys} className="flex items-baseline gap-3">
                  <dt className="w-16 shrink-0">
                    <kbd className="rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink-2">
                      {keys.replace('MOD ', mod === '⌘' ? '⌘' : 'Ctrl+')}
                    </kbd>
                  </dt>
                  <dd className="text-[13px] text-ink-2">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="self-end rounded-control px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
