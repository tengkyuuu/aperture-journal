'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { signInWithGoogle } from '@/lib/client/firebase';

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
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl">Aperture</h1>
          <p className="opacity-60">A private place to think.</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="w-full rounded border border-current/20 px-4 py-3 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <p className="text-xs opacity-50">
          Day 1 build. Unstyled on purpose — the design system lands on Day 2.
        </p>
      </div>
    </main>
  );
}
