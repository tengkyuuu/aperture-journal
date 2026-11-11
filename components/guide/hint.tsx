'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { GLOSSARY, type Term } from './glossary';

/**
 * A small "?" beside a word this app invented.
 *
 * Opens on hover for a mouse, and on tap or focus for everyone else — a hover
 * tooltip alone is unreachable on a phone, and phones are where a journal gets
 * written. Click pins it open; Escape or a click elsewhere closes it.
 */
export function Hint({ term, align = 'left' }: { term: Term; align?: 'left' | 'right' }) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const open = hover || pinned;
  const { word, plain } = GLOSSARY[term];

  useEffect(() => {
    if (!pinned) return;
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setPinned(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <span
      ref={wrap}
      className="relative inline-flex align-middle normal-case tracking-normal"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={`What does “${word}” mean?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="grid size-[18px] place-items-center rounded-full border border-line bg-canvas font-sans text-[13px] font-bold leading-none text-ink transition-colors hover:bg-accent hover:text-on-accent focus-visible:bg-accent focus-visible:text-on-accent"
      >
        ?
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-40 mt-2 w-[min(280px,80vw)] sheet p-3 text-left font-sans text-[13px] font-normal leading-relaxed text-ink-2  animate-pop-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="mb-1 block text-[13px] font-bold text-ink">{word}</span>
          {plain}
        </span>
      ) : null}
    </span>
  );
}
