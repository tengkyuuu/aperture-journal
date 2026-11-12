import type { ReactNode } from 'react';

import { Hint } from '@/components/guide/hint';
import type { Term } from '@/components/guide/glossary';

/** The page title (serif) and its one-sentence lede. first/last/page are accepted for old callers and ignored. */
export function PageHead({
  first,
  last,
  page,
  title,
  children,
}: {
  first: string;
  last: string;
  page: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-balance text-[32px] leading-tight text-ink sm:text-[36px]">
        {title}
      </h1>
      {children ? <div className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">{children}</div> : null}
    </header>
  );
}

/** A section label in guide style, with its explainer when the word is the app's own. */
export function SectionLabel({
  id,
  children,
  term,
}: {
  id?: string;
  children: ReactNode;
  term?: Term;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="label">
        {children}
      </h2>
      {term ? <Hint term={term} /> : null}
    </div>
  );
}

/**
 * A plate: a bordered, numbered figure. The only place the plate inks appear in
 * quantity. The caption says, in plain words, how to read what is inside.
 */
export function Plate({
  number,
  title,
  caption,
  aside,
  term,
  tone,
  children,
}: {
  number?: string;
  title: ReactNode;
  caption?: ReactNode;
  aside?: ReactNode;
  term?: Term;
  tone?: 'chrome';
  children: ReactNode;
}) {
  return (
    <figure
      className={`plate m-0 px-5 pb-5 pt-5 sm:px-6 ${tone === 'chrome' ? 'bg-pop text-[#1b1a16]' : ''}`}
    >
      <div className="relative mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          {term ? <Hint term={term} /> : null}
        </div>
        <div className="flex items-baseline gap-3">
          {aside}
          {null}
        </div>
      </div>
      <div className="relative">{children}</div>
      {caption ? (
        <figcaption
          className={`relative mt-4 text-[13px] leading-relaxed ${
            tone === 'chrome' ? 'text-[#1b1a16]' : 'text-ink-3'
          }`}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Mood dot plus its word: colour is never the only carrier of meaning. */
export function MoodWord({
  color,
  opacity = 1,
  children,
}: {
  color: string;
  opacity?: number;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block size-[9px] shrink-0 rounded-full"
        style={{ background: color, opacity }}
      />
      <span>{children}</span>
    </span>
  );
}

/** Short date for guide words: "Nov 7", or "Nov 7, 2025" outside this year. */
export function guideDate(iso: string | null): string {
  if (!iso) return 'Undated';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
