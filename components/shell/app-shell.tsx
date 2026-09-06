'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { signOutEverywhere } from '@/lib/client/firebase';
import { initials } from '@/lib/shared/format';
import type { SessionSummary, UserProfile } from '@/lib/shared/types';

import { Toaster } from '@/components/feedback/toaster';

import { CommandPalette } from './command-palette';
import { Shortcuts } from './shortcuts';
import { IconClose, IconMenu } from './icons';
import { NAV } from './nav';
import { ThemeToggle } from './theme-toggle';
import { Timeline } from './timeline';

/**
 * The app shell.
 *
 *   ≥1024  rail (72) · timeline (320) · canvas
 *   ≥768   rail (72) · canvas          — timeline behind a menu button
 *   <768   canvas + bottom tab bar     — timeline behind a menu button
 *
 * The canvas keeps a 68ch measure at every width. Chrome recedes; the writing
 * is the interface.
 */
export function AppShell({
  user,
  sessions,
  children,
}: {
  user: UserProfile;
  sessions: SessionSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Any navigation closes the sheet — otherwise it lingers over the new page.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  /**
   * The "always reduce motion" preference, applied to the root element.
   *
   * The OS setting is already honoured by a media query in globals.css. This is
   * the override for people whose system does not expose one, or who want it in
   * this app only — a real gap, since the OS toggle is buried on several
   * platforms and absent on some.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (user.settings.reduceMotion) root.dataset.reduceMotion = '1';
    else delete root.dataset.reduceMotion;
  }, [user.settings.reduceMotion]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSheetOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  async function handleSignOut() {
    await signOutEverywhere();
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/*
        Skip link. Tabbing into this app otherwise means traversing a 5-item
        rail and a 50-item session list before reaching the writing — which is
        the one thing everybody came for. Visually hidden until focused.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-on-accent"
      >
        Skip to writing
      </a>

      {/* ── Rail ─────────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col items-center gap-1 border-r-[3px] border-line bg-surface py-4 md:flex">
        <Link
          href="/today"
          aria-label="Aperture — home"
          className="brut-press-sm mb-3 grid size-10 place-items-center rounded-card border-2 border-line bg-surface shadow-[2px_2px_0_0_var(--border-ink)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
              WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
          <img src="/logo-sm.webp" alt="" width={1269} height={1092} className="w-8" />
        </Link>

        <nav aria-label="Main" className="flex flex-col items-center gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                title={label}
                className={`grid size-10 place-items-center rounded-control transition-colors ${
                  active ? 'bg-accent-wash text-accent' : 'text-ink-3 hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleSignOut}
            title={user.email ?? 'Sign out'}
            aria-label="Sign out"
            className="grid size-9 place-items-center rounded-full border-2 border-line text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong"
          >
            {initials(user.displayName, user.email)}
          </button>
        </div>
      </aside>

      {/* ── Timeline (persistent at lg) ──────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-[320px] shrink-0 border-r-[3px] border-line bg-surface lg:block">
        <Timeline sessions={sessions} />
      </aside>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b-[3px] border-line bg-canvas/85 px-4 py-2.5 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open sessions"
            aria-expanded={sheetOpen}
            className="grid size-9 place-items-center rounded-control text-ink-2 transition-colors hover:bg-sunken"
          >
            <IconMenu />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
              WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
          <img src="/logo-sm.webp" alt="Aperture" width={1269} height={1092} className="h-7 w-auto" />
          <div className="ml-auto md:hidden">
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {/*
          Bottom tab bar below md, where there is no rail.

          Capped at FIVE. Six targets on a phone bottom bar puts each one under
          the 44px minimum on a small screen, and the nav-limit rule exists for
          exactly that reason. Profile is the one that drops — it is reachable
          from the sheet, and it is not somewhere you go mid-thought.
        */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 flex border-t-[3px] border-line bg-surface/95 backdrop-blur-sm md:hidden"
        >
          {NAV.slice(0, 5).map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                  active ? 'text-accent' : 'text-ink-3'
                }`}
              >
                <Icon />
                <span className="truncate">{label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Timeline sheet, below lg ─────────────────────────────────────── */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sessions"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40 animate-fade-in"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col border-r-[3px] border-line bg-surface animate-rise-in">
            <div className="flex items-center justify-between border-b-[3px] border-line px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
                  WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
              <img src="/logo-sm.webp" alt="Aperture" width={1269} height={1092} className="h-6 w-auto" />
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-control text-ink-3 hover:bg-sunken"
              >
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Timeline sessions={sessions} onNavigate={() => setSheetOpen(false)} />
            </div>
            <div className="flex flex-col gap-1 border-t-[3px] border-line p-3">
              <Link
                href="/profile"
                className="rounded-control px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-ink-2 hover:bg-sunken hover:text-ink"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-control px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-sunken"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CommandPalette sessions={sessions} />
      <Shortcuts />
      {/* One instance for the whole app. It lives above the routes so an
          acknowledgement survives the navigation that caused it — deleting an
          entry redirects to /today and the toast has to outlive that. */}
      <Toaster />
    </div>
  );
}
