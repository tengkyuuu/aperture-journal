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
  // Bumped on every failure so the shake replays. Setting the same error
  // string twice leaves the <p> mounted, and a CSS animation on an already
  // mounted node does not restart — so the second wrong passphrase used to
  // look exactly like nothing happening.
  const [errNonce, setErrNonce] = useState(0);

  const bump = (msg: string | null) => {
    setError(msg);
    if (msg) setErrNonce((n) => n + 1);
  };

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
    bump(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    bump(null);
    setBusy(true);

    try {
      if (setup) {
        if (passphrase !== confirmation) {
          bump('The two passphrases do not match.');
          return;
        }
        if (!verdict.ok) {
          bump(verdict.hint);
          return;
        }
        if (!acknowledged) {
          bump('Please confirm you understand that this cannot be recovered.');
          return;
        }
        const ok = await vault.initialise(passphrase);
        if (!ok) {
          bump('The vault could not be created. Try again.');
          return;
        }
      } else {
        const ok = await vault.unlock(passphrase);
        if (!ok) {
          // No detail. "Wrong passphrase" and "no such vault" look identical.
          bump('That passphrase does not open this vault.');
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
            aria-invalid={error ? true : undefined}
            aria-describedby={setup && passphrase ? 'vault-pass-hint' : undefined}
            aria-errormessage={error ? 'vault-error' : undefined}
            className="rounded-control brut-thin bg-surface px-3 py-2.5 font-mono text-[14px] outline-none focus:border-line-strong"
          />

          {setup && passphrase ? (
            <div className="flex items-center gap-2.5">
              {/* scaleX, not width. Animating width is a layout property —
                  it forces reflow on every frame, and this runs while someone
                  is typing, which is the worst possible moment for it. */}
              <div className="h-1.5 flex-1 overflow-hidden border-2 border-line bg-sunken">
                <div
                  className={`h-full w-full origin-left ${barColor} transition-transform duration-200 ease-out`}
                  style={{ transform: `scaleX(${verdict.score / 3})` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] text-ink-3">
                {verdict.label}
              </span>
            </div>
          ) : null}

          {setup && passphrase ? (
            <p id="vault-pass-hint" className="text-[12px] leading-relaxed text-ink-3">
              {verdict.hint}
            </p>
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
              // Only once the confirmation is at least as long as the thing it
              // confirms. Flagging a mismatch mid-word would mark every
              // correctly-typed passphrase invalid on the way to being right.
              aria-invalid={
                confirmation.length >= passphrase.length && confirmation !== passphrase
                  ? true
                  : undefined
              }
              aria-describedby="vault-confirm-hint"
              className="rounded-control brut-thin bg-surface px-3 py-2.5 font-mono text-[14px] outline-none focus:border-line-strong"
            />
            <p id="vault-confirm-hint" className="text-[12px] text-ink-3">
              {confirmation.length >= passphrase.length && confirmation !== passphrase
                ? 'These two do not match yet.'
                : 'Typed twice, because there is no way to recover it.'}
            </p>
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
          <p
            key={errNonce}
            id="vault-error"
            role="alert"
            className="animate-shake rounded-control border-[3px] border-line bg-danger px-3 py-2 text-[13px] font-medium text-[#111111]"
          >
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
