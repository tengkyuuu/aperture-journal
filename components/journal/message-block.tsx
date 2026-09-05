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
  sealed = false,
}: {
  role: 'user' | 'model';
  content: string;
  streaming?: boolean;
  /** Decrypted in this browser. Marked so the reader knows what they are looking at. */
  sealed?: boolean;
}) {
  if (role === 'user') {
    return (
      <article className="relative prose-journal whitespace-pre-wrap text-ink">
        {sealed ? (
          <span
            aria-hidden
            className="absolute -left-5 top-[0.85em] size-2.5 border-2 border-line bg-sealed"
            title="Sealed — decrypted locally"
          />
        ) : null}
        {content}
      </article>
    );
  }

  return (
    <article className="relative pl-5">
      {/* A solid ink rule and a square marker. The old hairline-and-dot was
          the previous system's whisper; this system does not whisper. */}
      <span aria-hidden className="absolute left-0 top-[0.7em] bottom-[0.4em] w-[3px] bg-accent" />
      <span aria-hidden className="absolute -left-[5px] top-[0.75em] size-[11px] border-[3px] border-line bg-accent" />
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

/**
 * A sealed message with the vault locked.
 *
 * There is genuinely nothing to render here: the server holds ciphertext, and
 * this component has no key. That is not a loading state, it is the guarantee
 * working — so it says so rather than showing a spinner.
 */
export function SealedBlock({ onUnlock }: { onUnlock?: () => void }) {
  return (
    <article className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-card border-[3px] border-dashed border-sealed bg-sealed/10 px-4 py-3">
      <span className="size-2.5 shrink-0 border-2 border-line bg-sealed" aria-hidden />
      <p className="text-[13px] text-ink-3">
        <span className="text-sealed">Sealed.</span> Only your passphrase opens this — not us,
        not Gemini.
      </p>
      {onUnlock ? (
        <button
          type="button"
          onClick={onUnlock}
          className="ml-auto rounded-full border border-sealed/40 px-2.5 py-1 text-[11.5px] text-sealed transition-colors hover:bg-sealed/10"
        >
          Unlock
        </button>
      ) : null}
    </article>
  );
}
