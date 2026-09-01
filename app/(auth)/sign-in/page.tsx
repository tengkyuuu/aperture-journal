'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { signInWithGoogle } from '@/lib/client/firebase';
import { ThemeToggle } from '@/components/shell/theme-toggle';

/**
 * Full-bleed, one line of type, one button.
 *
 * No feature list, no marketing copy, no screenshot carousel. The restraint
 * sets every expectation that follows — this is a place to be quiet in.
 */
export default function SignInPage() {
  const router = useRouter();
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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      {/* A slow ambient wash. Decorative, low contrast, motionless under
          prefers-reduced-motion because it is behind an animation utility. */}
      <div
        aria-hidden
        className="animate-fade-in pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, var(--accent-wash), transparent 70%)',
        }}
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <p className="label">Aperture</p>

        <h1 className="mt-4 font-serif text-[42px] font-light leading-[1.05] tracking-tight text-ink sm:text-[52px]">
          A private place
          <br />
          to think.
        </h1>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="mt-10 flex w-full items-center justify-center gap-2.5 rounded-control border border-line-strong bg-surface px-4 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-sunken disabled:opacity-50"
        >
          <GoogleMark />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error ? (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <p className="mt-8 text-[12px] leading-relaxed text-ink-3">
          Your entries are stored under your account and nobody else&rsquo;s. Sealed entries are
          encrypted in this browser before they leave it.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
