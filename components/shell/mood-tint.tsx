'use client';

import { useEffect } from 'react';

import type { Mood } from '@/lib/shared/types';

/**
 * The ambient tint: the canvas drifts a few degrees toward the fortnight's
 * dominant mood. Subtle enough that you feel it before you notice it.
 *
 * Three rules make this safe rather than merely pretty:
 *
 *   1. BACKGROUND ONLY. It writes `--mood-tint`, which `body` uses as a
 *      background-image. No text token moves, so no contrast ratio can
 *      degrade no matter what the mood turns out to be.
 *   2. Mixed from the same semantic tokens as everything else, so it follows
 *      the light/dark theme instead of being a hardcoded wash that looks
 *      wrong in one of them.
 *   3. Capped opacity, and skipped entirely for a neutral fortnight. A tint
 *      that is always on is just a gradient; one that only appears when there
 *      is something to say is information.
 *
 * It is decoration carrying a signal, never the signal itself — the mood is
 * always stated in words elsewhere on the page.
 */
export function MoodTint({ mood }: { mood: Mood | null }) {
  useEffect(() => {
    const root = document.documentElement;

    if (!mood || Math.abs(mood.valence) < 0.15) {
      root.style.setProperty('--mood-tint', 'none');
      return;
    }

    const token = mood.valence > 0 ? 'var(--positive)' : 'var(--negative)';
    // 0.15 → 1 of valence maps to a 3–7% wash. The ceiling matters: above
    // roughly 8% this stops reading as atmosphere and starts reading as a bug.
    const strength = Math.min(Math.abs(mood.valence), 1);
    const pct = (3 + strength * 4).toFixed(1);

    root.style.setProperty(
      '--mood-tint',
      `radial-gradient(120rem 50rem at 50% -20%, color-mix(in oklab, ${token} ${pct}%, transparent), transparent 70%)`,
    );

    return () => root.style.setProperty('--mood-tint', 'none');
  }, [mood]);

  return null;
}
