'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { apiPost } from '@/lib/client/api';
import { MODE_LABELS, type ConversationMode } from '@/lib/config';
import { initials, relativeTime } from '@/lib/shared/format';
import type { ProfileStats, UserProfile } from '@/lib/shared/types';
import { signOutEverywhere } from '@/lib/client/firebase';
import { IconSecurity, IconVault } from '@/components/shell/icons';
import { PixelLoader } from '@/components/shell/pixel-loader';

const MODES: ConversationMode[] = ['reflect', 'brainstorm', 'untangle', 'duck'];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card brut-flat bg-surface px-4 py-3.5">
      <p className="num text-[26px] font-bold leading-none tracking-tight text-ink">{value}</p>
      <p className="label mt-2">{label}</p>
    </div>
  );
}

/**
 * The profile.
 *
 * Two jobs. It shows you what you have actually done — counted from your own
 * documents, never from a running total, because a denormalised counter drifts
 * the moment an entry is deleted, and entries can now be deleted one at a time.
 *
 * And it makes `settings` real. The data model has documented a settings object
 * since Day 1 and nothing ever wrote one; the schema promised something the app
 * did not do. Every control here writes through a server route, because the
 * client cannot write Firestore at all — that round-trip is the cost the rules
 * accepted on purpose.
 */
export function ProfileView({
  user,
  stats,
  memberSince,
}: {
  user: UserProfile;
  stats: ProfileStats;
  memberSince: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [defaultMode, setDefaultMode] = useState(user.settings.defaultMode);
  const [reduceMotion, setReduceMotion] = useState(user.settings.reduceMotion);

  async function save(patch: Record<string, unknown>, key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await apiPost('/api/account/settings', patch);
      if (!res.ok) {
        setError('That did not save. Try again.');
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError('That did not save. Try again.');
      return false;
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── Who ───────────────────────────────────────────────────────── */}
      <section className="rounded-card brut bg-surface p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-card border-[3px] border-line bg-accent text-[20px] font-bold text-on-accent"
          >
            {initials(user.displayName, user.email)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold leading-tight text-ink">
              {user.displayName ?? 'You'}
            </p>
            <p className="truncate text-[13px] text-ink-2">{user.email}</p>
            {memberSince ? (
              <p className="label mt-1.5">Writing here since {memberSince}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOutEverywhere();
              router.replace('/sign-in');
              router.refresh();
            }}
            className="brut-press-sm rounded-control border-[3px] border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* ── What you've done ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="label">By the numbers</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={String(stats.totalSessions)} label="entries" />
          <Stat value={String(stats.streak)} label="day streak" />
          <Stat value={String(stats.themes.length)} label="themes" />
          <Stat value={String(stats.sealedSessions)} label="sealed" />
        </div>

        {stats.firstEntry ? (
          <p className="text-[12.5px] text-ink-3">
            First entry {relativeTime(stats.firstEntry)} ·{' '}
            {stats.closedSessions} distilled · {stats.openSessions} still open
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            Nothing written yet. The numbers fill in as you go.
          </p>
        )}
      </section>

      {/* ── Themes ────────────────────────────────────────────────────── */}
      {stats.themes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="label">What you write about</h2>
          <div className="flex flex-wrap gap-2">
            {stats.themes.map((t) => (
              <span key={t.name} className="chip-brut bg-sunken text-ink">
                {t.name}
                <span className="num opacity-60">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Preferences ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="label">Preferences</h2>

        <div className="rounded-card brut bg-surface p-5">
          <p className="text-[14px] font-bold text-ink">Default mode</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            Which companion a new entry starts in.
          </p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {MODES.map((m) => {
              const on = defaultMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  disabled={saving === 'mode'}
                  onClick={async () => {
                    const prev = defaultMode;
                    setDefaultMode(m); // optimistic
                    const ok = await save({ defaultMode: m }, 'mode');
                    if (!ok) setDefaultMode(prev);
                  }}
                  className={`rounded-control border-[3px] border-line px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-all duration-100 ${
                    on
                      ? 'translate-x-[3px] translate-y-[3px] bg-accent text-on-accent shadow-none'
                      : 'brut-press-sm bg-surface text-ink shadow-[3px_3px_0_0_var(--border-ink)]'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3.5 rounded-card brut bg-surface p-5">
          <input
            type="checkbox"
            checked={reduceMotion}
            disabled={saving === 'motion'}
            onChange={async (e) => {
              const next = e.target.checked;
              setReduceMotion(next);
              const ok = await save({ reduceMotion: next }, 'motion');
              if (!ok) setReduceMotion(!next);
            }}
            className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-[14px] font-bold text-ink">Always reduce motion</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-3">
              Removes the press travel, the tilt, and the ceremony animations. Your operating
              system&rsquo;s setting is already respected — this forces it on regardless.
            </span>
          </span>
        </label>

        <p className="text-[12px] leading-relaxed text-ink-3">
          Light or dark is kept on this device rather than your account. Wanting dark on a
          laptop at night and light on a phone outdoors is normal, and syncing it would be
          worse.
        </p>

        {saving || pending ? (
          <p className="flex items-center gap-2 text-[12px] text-ink-3">
            <PixelLoader size="sm" /> saving
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="animate-shake text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}
      </section>

      {/* ── Elsewhere ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="label">Your data</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/vault"
            className="brut-press-sm flex items-start gap-3 rounded-card border-[3px] border-line bg-surface p-4 shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            <IconVault className="mt-0.5 size-5 shrink-0 text-sealed" />
            <span>
              <span className="block text-[14px] font-bold text-ink">Vault</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-3">
                {user.vault
                  ? `${stats.sealedSessions} sealed ${stats.sealedSessions === 1 ? 'entry' : 'entries'}`
                  : 'Not set up yet'}
              </span>
            </span>
          </Link>

          <Link
            href="/security"
            className="brut-press-sm flex items-start gap-3 rounded-card border-[3px] border-line bg-surface p-4 shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            <IconSecurity className="mt-0.5 size-5 shrink-0 text-accent" />
            <span>
              <span className="block text-[14px] font-bold text-ink">Security &amp; privacy</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-3">
                {stats.aiCalls} model {stats.aiCalls === 1 ? 'call' : 'calls'} ·{' '}
                {stats.estCostUsd < 0.01 ? '<$0.01' : `$${stats.estCostUsd.toFixed(2)}`} · export
                and delete
              </span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
