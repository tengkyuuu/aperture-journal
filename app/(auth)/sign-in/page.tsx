'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { signInWithGoogle } from '@/lib/client/firebase';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { PixelLoader } from '@/components/shell/pixel-loader';

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
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace('/today');
      router.refresh();
    } catch {
      // Generic on purpose. The detail is in the server log, not on screen.
      setError('Sign-in did not complete. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/*
          The logo is a glossy 3D render, which is the opposite of everything
          else here — flat fills, hard borders, zero-blur shadows. Rather than
          pretend otherwise, it is pasted into a bordered tile and tilted, so it
          reads as a sticker stuck onto the paper. Collage is already part of
          this idiom; an unframed gradient floating on cream would not be.
        */}
        <div className="tilt-l mb-7 inline-block rounded-card border-[3px] border-line bg-surface px-4 py-3 shadow-[var(--shadow-brut)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
              WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
          <img
            src="/logo.webp"
            alt="Aperture"
            width={1269}
            height={1092}
            className="block h-24 w-auto"
          />
        </div>

        <h1 className="text-[46px] font-bold leading-[0.95] tracking-[-0.03em] text-ink sm:text-[58px]">
          A PRIVATE
          <br />
          PLACE TO
          <br />
          <span className="inline-block border-[4px] border-line bg-accent px-2 text-on-accent">
            THINK.
          </span>
        </h1>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="brut-press mt-9 flex w-full items-center justify-center gap-3 rounded-card border-[3px] border-line bg-surface px-4 py-4 text-[15px] font-bold uppercase tracking-wide text-ink shadow-[var(--shadow-brut)] disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? <PixelLoader size="sm" tone="current" /> : <GoogleMark />}
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error ? (
          <p
            role="alert"
            className="animate-shake mt-4 rounded-control border-[3px] border-line bg-danger px-3 py-2 text-[13px] font-medium text-[#111111]"
          >
            {error}
          </p>
        ) : expired ? (
          <p className="mt-4 rounded-control border-[3px] border-line bg-sunken px-3 py-2 text-[13px] text-ink-2">
            Your session expired. Sign in again to pick up where you left off.
          </p>
        ) : null}

        {/* The three promises, as stamped cards. */}
        <ul className="mt-10 flex flex-col gap-2.5">
          {[
            ['Yours alone', 'Every entry is stored under your account and nobody else’s.'],
            [
              'Sealed means sealed',
              'Encrypted in this browser. We cannot read it. Neither can Gemini.',
            ],
            ['Nothing hidden', 'Every call to the model is logged where you can see it.'],
          ].map(([title, body], i) => (
            <li
              key={title}
              className={`rounded-card brut-flat bg-surface px-4 py-3 ${i === 1 ? 'tilt-r' : ''}`}
            >
              <p className="label">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ul>
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
