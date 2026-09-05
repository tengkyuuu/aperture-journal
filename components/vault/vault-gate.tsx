'use client';

import { useEffect, useRef, useState } from 'react';

import { ratePassphrase } from '@/lib/client/vault';

import { useVault } from './vault-provider';

/**
 * The passphrase sheet. Two modes, decided by whether a vault exists yet.
 *
 * The setup path is the one that matters. There is no recovery, so the warning
 * has to land before someone types a passphrase they will forget — which is
 * why it is a checkbox they must tick rather than a paragraph they will skip.
 * Making it slightly annoying is the point.
 */
export function VaultGate({
  open,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const vault = useVault();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setup = vault.status === 'uninitialised';
  const verdict = ratePassphrase(passphrase);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function reset() {
    setPassphrase('');
    setConfirmation('');
    setAcknowledged(false);
    setError(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      if (setup) {
        if (passphrase !== confirmation) {
          setError('The two passphrases do not match.');
          return;
        }
        if (!verdict.ok) {
          setError(verdict.hint);
          return;
        }
        if (!acknowledged) {
          setError('Please confirm you understand that this cannot be recovered.');
          return;
        }
        const ok = await vault.initialise(passphrase);
        if (!ok) {
          setError('The vault could not be created. Try again.');
          return;
        }
      } else {
        const ok = await vault.unlock(passphrase);
        if (!ok) {
          // No detail. "Wrong passphrase" and "no such vault" look identical.
          setError('That passphrase does not open this vault.');
          return;
        }
      }
      reset();
      onUnlocked();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const barColor = ['bg-danger', 'bg-danger', 'bg-sealed', 'bg-positive'][verdict.score];

  return (
    <dialog
      ref={dialogRef}
      aria-label={setup ? 'Create your vault' : 'Unlock your vault'}
      onClose={() => {
        reset();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-0 w-full max-w-md rounded-sheet brut bg-elevated p-0 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-rise-in sm:mx-auto sm:mt-[10vh]"
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-6">
        <div>
          <p className="label text-sealed">{setup ? 'Create your vault' : 'Unlock'}</p>
          <h2 className="mt-2 font-serif text-[24px] leading-tight">
            {setup ? 'One passphrase. No way back.' : 'Your passphrase'}
          </h2>
        </div>

        {setup ? (
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Sealed entries are encrypted in this browser before they leave it. We never
            receive your passphrase, so <strong className="text-ink">we cannot reset it</strong> and
            we cannot read your sealed entries — not for support, not for recovery, not
            under any circumstances.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="vault-pass" className="label">
            Passphrase
          </label>
          <input
            id="vault-pass"
            type="password"
            autoFocus
            autoComplete={setup ? 'new-password' : 'current-password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="rounded-control brut-thin bg-surface px-3 py-2.5 font-mono text-[14px] outline-none focus:border-line-strong"
          />

          {setup && passphrase ? (
            <div className="flex items-center gap-2.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
                <div
                  className={`h-full ${barColor} transition-all duration-200`}
                  style={{ width: `${(verdict.score / 3) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] text-ink-3">
                {verdict.label}
              </span>
            </div>
          ) : null}

          {setup && passphrase ? (
            <p className="text-[12px] leading-relaxed text-ink-3">{verdict.hint}</p>
          ) : null}
        </div>

        {setup ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="vault-confirm" className="label">
              Type it again
            </label>
            <input
              id="vault-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="rounded-control brut-thin bg-surface px-3 py-2.5 font-mono text-[14px] outline-none focus:border-line-strong"
            />
          </div>
        ) : null}

        {setup ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-card border border-sealed/40 bg-sealed/[0.05] p-3.5">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--sealed)]"
            />
            <span className="text-[13px] leading-relaxed text-ink-2">
              I understand that if I forget this passphrase, my sealed entries are gone
              permanently. There is no reset link.
            </span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-control px-3 py-2 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !passphrase}
            className="rounded-control bg-sealed px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            {busy ? 'Working…' : setup ? 'Create vault' : 'Unlock'}
          </button>
        </div>

        {!setup ? (
          <p className="text-[11px] text-ink-3">
            The key is held in memory only. Press <kbd className="font-mono">Esc</kbd> to lock,
            and it locks itself after 15 minutes of inactivity.
          </p>
        ) : null}
      </form>
    </dialog>
  );
}
