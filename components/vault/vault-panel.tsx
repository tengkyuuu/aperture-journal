'use client';

import { useState } from 'react';
import Link from 'next/link';

import { relativeTime } from '@/lib/shared/format';
import type { SessionSummary } from '@/lib/shared/types';
import { IconVault } from '@/components/shell/icons';

import { VaultGate } from './vault-gate';
import { useVault } from './vault-provider';

/**
 * The Vault page body.
 *
 * When locked, the sealed entries are listed but their content is genuinely
 * unavailable — not hidden behind a CSS blur, absent. The server sent
 * ciphertext and this page has no key. Everything it can honestly show about a
 * locked entry is its date.
 */
export function VaultPanel({ sealed }: { sealed: SessionSummary[] }) {
  const vault = useVault();
  const [gateOpen, setGateOpen] = useState(false);

  const unlocked = vault.status === 'unlocked';

  return (
    <div className="flex flex-col gap-8">
      {/* ── Status ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-card brut bg-surface p-4">
        <span
          aria-hidden
          className={`grid size-9 place-items-center border rounded-control ${
            unlocked ? 'border-sealed text-sealed' : 'border-line text-ink-3'
          }`}
        >
          <IconVault className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink">
            {vault.status === 'uninitialised'
              ? 'No vault yet'
              : unlocked
                ? 'Unlocked'
                : 'Locked'}
          </p>
          <p className="text-[13px] text-ink-3">
            {vault.status === 'uninitialised'
              ? 'Create one to start sealing entries.'
              : unlocked
                ? 'The key is in memory only. Esc locks it, as does 15 minutes of inactivity.'
                : 'Your passphrase decrypts these in this browser. We never receive it.'}
          </p>
        </div>

        {unlocked ? (
          <button
            type="button"
            onClick={vault.lock}
            className="rounded-control brut-thin px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            Lock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            className="brut-press-sm border border-line bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-on-accent rounded-control"
          >
            {vault.status === 'uninitialised' ? 'Create vault' : 'Unlock'}
          </button>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="rounded-card brut bg-surface p-5">
        <p className="label mb-3">What sealing does</p>
        <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-2">
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="mt-[11px] size-[6px] shrink-0 rounded-full bg-ink-3" />
            <span>
              Your passphrase never leaves this browser. It is turned into the key that locks your
              entries right here.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="mt-[11px] size-[6px] shrink-0 rounded-full bg-ink-3" />
            <span>
              Each message is locked before it is sent, so our server only ever stores scrambled
              text it cannot open.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="mt-[11px] size-[6px] shrink-0 rounded-full bg-ink-3" />
            <span>
              Its summary, mood and themes are <strong className="text-ink">deleted</strong>, so a
              sealed entry no longer appears in Insights, Ask your past or Echoes. Keeping them
              would leave the most revealing part readable.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="mt-[11px] size-[6px] shrink-0 rounded-full bg-ink-3" />
            <span className="text-ink-3">
              We can still see that the entry exists, when you wrote it and how many messages it
              has, but not what it says. Forget the passphrase and nobody can open it again.
            </span>
          </li>
        </ul>
        <details className="mt-4 text-[13px] text-ink-3">
          <summary className="cursor-pointer list-none text-ink-2 underline decoration-1 underline-offset-[3px] hover:text-ink [&::-webkit-details-marker]:hidden">
            Show the technical details
          </summary>
          <p className="mt-2 leading-relaxed">
            The key is derived in your browser with PBKDF2 (SHA-256, 600,000 rounds) and used for
            AES-256-GCM encryption. The server stores only the encrypted text.
          </p>
        </details>
      </section>

      {/* ── Entries ────────────────────────────────────────────────────── */}
      <section>
        <p className="label mb-3">
          Sealed entries {sealed.length > 0 ? `(${sealed.length})` : ''}
        </p>

        {sealed.length === 0 ? (
          <p className="prose-journal text-ink-3">
            Nothing is sealed yet. To seal one, open an entry and choose “Seal this entry” at the bottom.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sealed.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/session/${s.id}`}
                  className="flex items-center gap-3 rounded-card brut bg-surface px-4 py-3 transition-colors hover:border-line-strong"
                >
                  <IconVault className="size-4 shrink-0 text-sealed" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[16px] text-ink">Sealed entry</span>
                    <span className="block text-[13px] text-ink-3">
                      <span className="num">{relativeTime(s.startedAt)}</span> ·{' '}
                      {s.messageCount} messages
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] text-ink-3">
                    {unlocked ? 'Open' : 'Locked'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VaultGate open={gateOpen} onClose={() => setGateOpen(false)} onUnlocked={() => {}} />
    </div>
  );
}
