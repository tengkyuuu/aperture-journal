import type { ReactNode } from 'react';

import { Hint } from '@/components/guide/hint';
import type { Term } from '@/components/guide/glossary';

/**
 * The Lexicon's printed furniture. See DESIGN.md.
 *
 * Every page of a reference book tells you where you are before it tells you
 * anything else: the guide words at the head name the first and last thing on
 * the page. That is the job these do here: a friend who arrived from a link
 * always knows what span of their journal, or which part of a page, is in front
 * of them.
 */

/** The head rule: first and last thing in view, the page's own name between. */
export function GuideWords({
  first,
  last,
  page,
}: {
  first: string;
  last: string;
  page?: string;
}) {
  return (
    // On a phone there is room for the two guide words or the page name, not
    // all three: the guide words win, since they are the ones that orient.
    <div className="grid grid-cols-2 items-baseline gap-3 border-b-2 border-line pb-2 sm:grid-cols-[1fr_auto_1fr]">
      <span className="label min-w-0 text-balance">{first}</span>
      <span className="hidden text-[13px] italic text-ink sm:inline">{page ?? ''}</span>
      <span className="label min-w-0 text-balance text-right">{last}</span>
    </div>
  );
}

/** Guide words, the page title (the only 27px text), and the one-sentence lede. */
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
      <GuideWords first={first} last={last} page={page} />
      <h1 className="mt-8 text-balance text-[27px] font-bold leading-tight tracking-[-0.005em] text-ink">
        {title}
      </h1>
      {children ? <div className="prose-journal mt-3 text-ink-2">{children}</div> : null}
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
      className={`plate m-0 px-5 pb-5 pt-6 sm:px-7 ${tone === 'chrome' ? 'bg-pop text-[#1b1a16]' : ''}`}
    >
      <div className="relative mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-bold leading-snug">{title}</h2>
          {term ? <Hint term={term} /> : null}
        </div>
        <div className="flex items-baseline gap-3">
          {aside}
          {number ? (
            <span className={`label ${tone === 'chrome' ? '!text-[#1b1a16]' : ''}`}>
              Plate {number}
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative">{children}</div>
      {caption ? (
        <figcaption
          className={`relative mt-4 text-[13px] italic leading-relaxed ${
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
