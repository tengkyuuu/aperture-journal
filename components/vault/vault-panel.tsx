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
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
        <span
          aria-hidden
          className={`grid size-9 place-items-center rounded-full ${
            unlocked ? 'bg-sealed text-white' : 'bg-sunken text-ink-3'
          }`}
        >
          <IconVault className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-ink">
            {vault.status === 'uninitialised'
              ? 'No vault yet'
              : unlocked
                ? 'Unlocked'
                : 'Locked'}
          </p>
          <p className="text-[12.5px] text-ink-3">
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
            className="rounded-control border border-line px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            Lock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            className="rounded-control bg-sealed px-3.5 py-1.5 text-[13px] font-medium text-white"
          >
            {vault.status === 'uninitialised' ? 'Create vault' : 'Unlock'}
          </button>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="rounded-card border border-line bg-surface p-5">
        <p className="label mb-3">What sealing actually does</p>
        <ul className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="pt-[9px] h-px w-3.5 bg-line-strong" />
            <span>
              Your passphrase is stretched with <span className="font-mono text-[12.5px]">PBKDF2</span>{' '}
              (600,000 rounds, SHA-256) into an AES-256-GCM key, in this browser.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="pt-[9px] h-px w-3.5 bg-line-strong" />
            <span>
              Each message is encrypted here before it is sent. The server stores a blob it
              has no way to open.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="pt-[9px] h-px w-3.5 bg-line-strong" />
            <span>
              The summary, mood, themes and embedding are <strong className="text-ink">deleted</strong>{' '}
              when an entry is sealed. Leaving them would keep the interesting part in the
              clear, which would make the whole exercise theatre.
            </span>
          </li>
          <li className="grid grid-cols-[14px_1fr] gap-3">
            <span aria-hidden className="pt-[9px] h-px w-3.5 bg-line-strong" />
            <span className="text-ink-3">
              What stays visible to us: that an entry exists, when it was written, and how
              many messages it holds. Encryption hides content, not metadata.
            </span>
          </li>
        </ul>
      </section>

      {/* ── Entries ────────────────────────────────────────────────────── */}
      <section>
        <p className="label mb-3">
          Sealed entries {sealed.length > 0 ? `(${sealed.length})` : ''}
        </p>

        {sealed.length === 0 ? (
          <p className="prose-journal text-ink-3">
            Nothing is sealed yet. Open any entry and choose “Seal this entry” to encrypt it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sealed.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/session/${s.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
                >
                  <IconVault className="size-4 shrink-0 text-sealed" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[15px] text-ink">Sealed entry</span>
                    <span className="block text-[12px] text-ink-3">
                      <span className="num">{relativeTime(s.startedAt)}</span> ·{' '}
                      {s.messageCount} messages
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">
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
