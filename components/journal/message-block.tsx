'use client';

import { useMemo } from 'react';

/**
 * Messages as typographic blocks, not chat bubbles.
 *
 * The user's writing sits at full weight. The model's answer is marked by a
 * single hairline rule and a dot — enough to tell the voices apart, not enough
 * to make it look like a messaging app. No avatars, no name labels, no
 * timestamps in the flow.
 */

function RevealText({ text }: { text: string }) {
  // Split on whitespace but keep it, so line breaks and spacing survive.
  // Each token animates once on mount; because we only ever append, existing
  // tokens keep their identity and stay put while new ones fade up.
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className="animate-reveal-word">
          {part}
        </span>
      ))}
    </>
  );
}

export function MessageBlock({
  role,
  content,
  streaming = false,
}: {
  role: 'user' | 'model';
  content: string;
  streaming?: boolean;
}) {
  if (role === 'user') {
    return (
      <article className="prose-journal whitespace-pre-wrap text-ink">{content}</article>
    );
  }

  return (
    <article className="relative pl-5">
      <span
        aria-hidden
        className="absolute left-0 top-[0.85em] bottom-[0.5em] w-px bg-accent/25"
      />
      <span
        aria-hidden
        className="absolute -left-[2px] top-[0.78em] size-[5px] rounded-full bg-accent"
      />
      <div className="prose-journal whitespace-pre-wrap text-ink-2">
        {streaming ? <RevealText text={content} /> : content}
        {streaming ? (
          <span aria-hidden className="animate-caret ml-0.5 inline-block text-accent">
            ▌
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** A sealed message. The plaintext does not exist on the server to render. */
export function SealedBlock() {
  return (
    <article className="flex items-center gap-2.5 rounded-card border border-dashed border-sealed/40 bg-sealed/[0.04] px-4 py-3">
      <span className="size-1.5 rounded-full bg-sealed" aria-hidden />
      <p className="text-[13px] text-ink-3">
        <span className="text-sealed">Sealed.</span> Only your passphrase opens this — not us,
        not Gemini.
      </p>
    </article>
  );
}
