'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { initials } from '@/lib/shared/format';
import type { SessionSummary, UserProfile } from '@/lib/shared/types';

import { Toaster } from '@/components/feedback/toaster';
import { openHelp } from '@/components/guide/events';
import { Help } from '@/components/guide/help';
import { Tour } from '@/components/guide/tour';
import { useOnline } from '@/hooks/use-online';

import { CommandPalette } from './command-palette';
import { Shortcuts } from './shortcuts';
import { IconClose, IconHelp, IconMenu } from './icons';
import { NAV } from './nav';
import { ThemeToggle } from './theme-toggle';
import { Timeline } from './timeline';

/**
 * Says the browser has no network.
 *
 * Deliberately never says anything about what happens next. navigator.onLine
 * being true is not a promise of connectivity — a captive portal reports
 * online — and there is no background sync here, so promising to send it later
 * would be a lie. It reports a fact and stops.
 */
function OfflineChip() {
  return (
    <span
      role="status"
      title="No network. You can still write — sending is what stops."
      className="chip-brut border-danger/40 text-danger"
    >
      Offline
    </span>
  );
}

const MAIN = NAV.filter((n) => ['/today', '/insights', '/ask'].includes(n.href));
const PRIVACY = NAV.filter((n) => ['/vault', '/security'].includes(n.href));

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Everything you can go to, in words.
 *
 * The previous shell was an icon rail, a separate column of entries and a set
 * of index tabs down the far edge: three navigation systems, two of them
 * unlabelled. This is one list: a "New entry" button, the places, then your
 * entries, then you. Used as the desktop sidebar and, unchanged, as the phone
 * menu.
 */
function SidebarContent({
  user,
  sessions,
  online,
  onNavigate,
  onClose,
}: {
  user: UserProfile;
  sessions: SessionSummary[];
  online: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const navLink = ({ href, label, Icon }: (typeof NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-control px-3 py-2 text-[14px] transition-colors ${
          active
            ? 'bg-accent-wash font-semibold text-accent'
            : 'text-ink-2 hover:bg-sunken hover:text-ink'
        }`}
      >
        <Icon className="size-[18px] shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    // Short screens scroll the whole sidebar; tall ones give the entries the rest.
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <Link href="/today" onClick={onNavigate} className="flex items-center gap-2.5" aria-label="Aperture — home">
          {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
              WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
          <img src="/logo-sm.webp" alt="" width={1269} height={1092} className="w-8" />
          <span className="font-heading text-[20px] font-medium text-ink">Aperture</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {!online ? <OfflineChip /> : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="grid size-8 place-items-center rounded-control text-ink-3 hover:bg-sunken"
            >
              <IconClose />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-3">
        <Link
          href="/today"
          onClick={onNavigate}
          className="brut-press flex items-center justify-center gap-2 bg-accent px-4 py-2.5 text-[14px] font-semibold text-on-accent"
        >
          <span aria-hidden className="text-[18px] leading-none">+</span>
          New entry
        </Link>
      </div>

      <nav aria-label="Main" data-tour="nav" className="mt-4 flex flex-col gap-0.5 px-3">
        {MAIN.map(navLink)}
        <p className="label mb-1 mt-4 px-3">Privacy</p>
        {PRIVACY.map(navLink)}
      </nav>

      <div data-tour="sessions" className="mt-5 flex min-h-[220px] flex-1 flex-col border-t border-line-faint">
        <Timeline sessions={sessions} onNavigate={onNavigate} />
      </div>

      {/* You, then Help and the theme as two small buttons. Sign out lives on
          Profile, one click away, so this row stays a single line. */}
      <div className="border-t border-line-faint p-3">
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            onClick={onNavigate}
            aria-current={isActive(pathname, '/profile') ? 'page' : undefined}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-1.5 transition-colors ${
              isActive(pathname, '/profile') ? 'bg-accent-wash' : 'hover:bg-sunken'
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-wash text-[12px] font-semibold text-accent">
              {initials(user.displayName, user.email)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-ink">
                {user.displayName ?? 'Profile'}
              </span>
              <span className="block truncate text-[12px] text-ink-3">Profile &amp; settings</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose?.();
              openHelp();
            }}
            data-tour="help"
            aria-label="Help and tour"
            title="Help and tour"
            className="grid size-9 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <IconHelp />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/**
 * The app shell.
 *
 *   ≥768   sidebar (272) · canvas
 *   <768   top bar + bottom tab bar; the sidebar opens as a menu
 *
 * The canvas keeps a comfortable measure at every width. Chrome recedes; the
 * writing is the interface.
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
  const online = useOnline();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Any navigation closes the menu — otherwise it lingers over the new page.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  /**
   * The "always reduce motion" preference, applied to the root element.
   *
   * The OS setting is already honoured by a media query in globals.css. This is
   * the override for people whose system does not expose one, or who want it in
   * this app only.
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

  return (
    <div className="flex min-h-dvh">
      {/* Skip link: straight to the writing, past the sidebar. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-on-accent"
      >
        Skip to writing
      </a>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 border-r border-line bg-canvas md:block">
        <SidebarContent user={user} sessions={sessions} online={online} />
      </aside>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open menu"
            aria-expanded={sheetOpen}
            className="grid size-9 place-items-center rounded-control text-ink-2 transition-colors hover:bg-sunken"
          >
            <IconMenu />
          </button>
          <Link href="/today" className="flex items-center gap-2" aria-label="Aperture — home">
            {/* eslint-disable-next-line @next/next/no-img-element -- already a pre-sized
                WebP; next/image optimisation needs sharp at runtime and sharp is a devDependency. */}
            <img src="/logo-sm.webp" alt="" width={1269} height={1092} className="block h-6 w-auto" />
            <span className="font-heading text-[18px] font-medium text-ink">Aperture</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {!online ? <OfflineChip /> : null}
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {/*
          Bottom tab bar below md. Capped at FIVE: six targets on a phone bar
          puts each one under the 44px minimum. Profile is in the menu.
        */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
        >
          {NAV.slice(0, 5).map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[12px] transition-colors ${
                  active ? 'font-semibold text-accent' : 'text-ink-3'
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    active ? 'bg-accent-wash' : ''
                  }`}
                >
                  <Icon />
                </span>
                <span className="truncate">{label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Menu, below md ───────────────────────────────────────────────── */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/30 animate-fade-in"
          />
          <div className="absolute inset-y-0 left-0 w-[min(300px,85vw)] rounded-r-[var(--radius-sheet)] bg-canvas shadow-[var(--shadow-sheet)] animate-rise-in">
            <SidebarContent
              user={user}
              sessions={sessions}
              online={online}
              onNavigate={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <CommandPalette sessions={sessions} />
      <Shortcuts />
      <Help />
      <Tour />
      {/* One instance for the whole app. It lives above the routes so an
          acknowledgement survives the navigation that caused it. */}
      <Toaster />
    </div>
  );
}
