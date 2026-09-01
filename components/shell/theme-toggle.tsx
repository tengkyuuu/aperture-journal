'use client';

import { useEffect, useState } from 'react';

import { IconMoon, IconSun } from './icons';

type Theme = 'light' | 'dark';

/**
 * Three states exist, not two: explicit light, explicit dark, and "follow the
 * system" (no stamp on the root element). The toggle moves between the two
 * explicit states; the bootstrap script in app/layout.tsx applies whichever
 * was stored, before first paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stamped = document.documentElement.dataset.theme as Theme | undefined;
    if (stamped) {
      setTheme(stamped);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('aperture-theme', next);
    } catch {
      // Private browsing. The choice just will not survive a reload.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-9 place-items-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      {/* Render nothing until mounted, so the icon cannot contradict the theme. */}
      {theme === 'dark' ? <IconSun /> : theme === 'light' ? <IconMoon /> : <span className="size-5" />}
    </button>
  );
}
