'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MODE_LABELS } from '@/lib/config';
import { relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';

import { NAV } from './nav';

type Command = { id: string; label: string; hint?: string; run: () => void };

/**
 * ⌘K palette, built on the native <dialog> element.
 *
 * `showModal()` gives focus trapping, Esc-to-close, inertness of the page
 * behind, and the top-layer stacking that otherwise needs a portal and a
 * z-index arms race — all from the platform. That is a whole dependency and a
 * class of focus bugs avoided, so it is worth the slightly fussier styling.
 */
export function CommandPalette({ sessions }: { sessions: SessionSummary[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = dialogRef.current;
        if (!el) return;
        if (el.open) el.close();
        else {
          setQuery('');
          setCursor(0);
          el.showModal();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  const commands: Command[] = [
    ...NAV.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      hint: 'Go to',
      run: () => go(n.href),
    })),
    ...sessions.slice(0, 30).map((s) => ({
      id: `session:${s.id}`,
      label: s.sealed ? 'Sealed entry' : (s.title ?? 'Untitled session'),
      hint: `${MODE_LABELS[s.mode] ?? s.mode} · ${relativeTime(s.startedAt)}`,
      run: () => go(`/session/${s.id}`),
    })),
  ];

  const q = query.trim().toLowerCase();
  const results = q
    ? commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q))
    : commands;

  const active = results[Math.min(cursor, results.length - 1)];

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      active?.run();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onClose={() => setQuery('')}
      // Clicking the backdrop closes: the click target is the dialog itself
      // only when the pointer is outside its content box.
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      className="m-0 w-full max-w-lg rounded-sheet brut bg-elevated p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-rise-in sm:mx-auto sm:mt-[12vh]"
    >
      <div className="border-b-[3px] border-line px-4">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onInputKey}
          placeholder="Jump to a session or a page…"
          aria-label="Search sessions and pages"
          className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>

      <ul className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
        {results.length === 0 ? (
          <li className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing matches that.</li>
        ) : (
          results.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === active?.id}
                onMouseEnter={() => setCursor(i)}
                onClick={c.run}
                className={`flex w-full items-baseline gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                  c.id === active?.id ? 'bg-sunken' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">{c.label}</span>
                {c.hint ? (
                  <span className="shrink-0 text-[11px] text-ink-3">{c.hint}</span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="flex items-center gap-3 border-t-[3px] border-line px-4 py-2.5 text-[11px] text-ink-3">
        <span>
          <kbd className="font-mono">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-mono">↵</kbd> open
        </span>
        <span>
          <kbd className="font-mono">esc</kbd> close
        </span>
      </div>
    </dialog>
  );
}
