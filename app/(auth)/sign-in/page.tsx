'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { signInWithGoogle } from '@/lib/client/firebase';
import { failureFromThrown, type Failure } from '@/lib/client/errors';
import { Notice } from '@/components/feedback/notice';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { PixelLoader } from '@/components/shell/pixel-loader';
import { GuideWords } from '@/components/lexicon/primitives';

/**
 * The front door.
 *
 * One claim, one button, and the three things this app actually promises —
 * stated as stamped cards rather than marketing copy, because in this system a
 * bordered block with a hard shadow IS the emphasis. No gradient hero, no
 * feature grid, no screenshots.
 *
 * No decorative ground. A tiled grid behind a hero is a generated-UI tell, and
 * this page does not need one — the type, the colour block and the stamped
 * cards carry it.
 */
export default function SignInPage() {
  const router = useRouter();
  // Set by /api/auth/clear when a session cookie was present but no longer
  // verified. Saying so beats silently returning someone to a sign-in screen
  // they thought they were past.
  const expired = useSearchParams().get('expired') === '1';

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setFailure(null);
    try {
      await signInWithGoogle();
      router.replace('/today');
      router.refresh();
    } catch (err) {
      // Generic on purpose. The detail is in the server log, not on screen.
      setFailure(failureFromThrown(err));
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center px-6 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* The title page of the book. Guide words, the frontispiece, the title,
          one sentence of what this is, the one action, and the three promises
          set as entries. */}
      <div className="w-full max-w-md">
        <GuideWords first="Aperture" last="Sign in" page="A private journal" />

        {/* The logo is the one full-colour picture in the system: shown as-is,
            framed like a plate, never recoloured. */}
        <div className="plate mt-8 inline-block p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
              WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
          <img
            src="/logo.webp"
            alt="Aperture"
            width={1269}
            height={1092}
            className="relative block h-20 w-auto"
          />
        </div>

        <h1 className="mt-6 text-balance text-[27px] font-bold leading-tight tracking-[-0.005em] text-ink">
          A private place to think.
        </h1>

        {/* The headline is a promise; this says what the thing actually does,
            for someone who was sent a link and has never heard of it. */}
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
          A journal you think out loud in. Write about your day and an AI asks you questions to
          help you work it through. When you finish, it saves a short summary you can look back on.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="brut-press mt-8 flex min-h-12 w-full items-center justify-center gap-3 border-2 border-line bg-accent px-4 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-on-accent disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? (
            <PixelLoader size="sm" tone="current" />
          ) : (
            <span className="grid size-7 place-items-center bg-canvas">
              <GoogleMark />
            </span>
          )}
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {failure ? (
          <Notice failure={failure} onRetry={handleSignIn} retryLabel="Retry" className="mt-4" />
        ) : expired ? (
          <p className="mt-4 border border-line bg-sunken px-3 py-2 text-[13px] text-ink-2">
            Your session expired. Sign in again to pick up where you left off.
          </p>
        ) : null}

        {/* The three promises, set as entries: the word in bold, then its sense. */}
        <dl className="mt-10 border-t-2 border-line">
          {[
            ['Yours alone', 'Every entry is stored under your account and nobody else’s.'],
            ['Sealed means sealed', 'Encrypted in this browser. We cannot read it. Neither can the AI.'],
            ['Nothing hidden', 'Everything sent to the AI is listed where you can see it.'],
          ].map(([title, body]) => (
            <div key={title} className="border-b border-line-faint py-3">
              <dt className="text-[17px] font-bold leading-snug text-ink">{title}</dt>
              <dd className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-2">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
