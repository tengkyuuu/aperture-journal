'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@/components/feedback/toaster';

import { deriveKey, makeCheck, newSalt, verifyCheck } from '@/lib/client/vault';
import { apiPost } from '@/lib/client/api';

/**
 * Holds the vault key in memory and nowhere else.
 *
 * Not localStorage, not sessionStorage, not IndexedDB, not a cookie. Closing
 * the tab loses it. Reloading loses it. That is the intended behaviour — a key
 * that survives in storage is a key an attacker can find in storage.
 *
 * It is also locked automatically after a period of inactivity, because a
 * journal left unlocked on a shared laptop is the realistic threat here, not a
 * cryptanalyst.
 */

const IDLE_LOCK_MS = 15 * 60 * 1000;

type VaultState =
  | { status: 'uninitialised' }
  | { status: 'locked' }
  | { status: 'unlocked'; key: CryptoKey };

interface VaultContextValue {
  status: VaultState['status'];
  key: CryptoKey | null;
  /** Create the vault for the first time. Returns false if the server rejected it. */
  initialise: (passphrase: string) => Promise<boolean>;
  /** Returns false on a wrong passphrase. */
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({
  hasVault,
  salt,
  check,
  children,
}: {
  hasVault: boolean;
  salt: string | null;
  check: string | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<VaultState>(
    hasVault ? { status: 'locked' } : { status: 'uninitialised' },
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    // Dropping the reference is the whole mechanism. The CryptoKey was created
    // non-extractable, so there is no copy of the key material to scrub.
    setState((prev) => {
      // Say so, but only on a real transition. The idle timer fires this every
      // fifteen minutes regardless of state, and until now it did so in total
      // silence — sealed text on screen simply went blank and the passphrase
      // was wanted again, with nothing anywhere explaining why.
      if (prev.status === 'unlocked') toast('Vault locked.', { tone: 'warn' });
      return hasVault ? { status: 'locked' } : { status: 'uninitialised' };
    });
  }, [hasVault]);

  // Idle auto-lock, reset on real interaction.
  useEffect(() => {
    if (state.status !== 'unlocked') return;

    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(lock, IDLE_LOCK_MS);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'focus'];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [state.status, lock]);

  // Esc locks the vault from anywhere — unless something else is using it.
  //
  // This is a window listener, and keydown from inside an open <dialog> bubbles
  // all the way up. So pressing Escape to dismiss the command palette, the
  // shortcuts sheet or the rename field used to ALSO throw away the vault key,
  // blanking decrypted text on screen with no explanation and demanding the
  // passphrase again. "Close this popup" and "discard my decryption key" are
  // not the same intent and must not share a keystroke.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || state.status !== 'unlocked') return;
      if (e.defaultPrevented) return;
      // Native <dialog> dismissal does not reliably call preventDefault(), so
      // ask the top layer directly rather than trusting the event.
      if (document.querySelector('dialog[open]')) return;
      lock();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, lock]);

  const initialise = useCallback(async (passphrase: string) => {
    const s = newSalt();
    const key = await deriveKey(passphrase, s);
    const c = await makeCheck(key);

    // The salt and the check blob are not secret. The salt exists to stop
    // precomputed-table attacks; the check blob only proves a key is correct.
    const res = await apiPost('/api/vault/init', { salt: s, check: c });
    if (!res.ok) return false;

    setState({ status: 'unlocked', key });
    return true;
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!salt || !check) return false;
      const key = await deriveKey(passphrase, salt);
      if (!(await verifyCheck(key, check))) return false;
      setState({ status: 'unlocked', key });
      toast('Vault unlocked.');
      return true;
    },
    [salt, check],
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      status: state.status,
      key: state.status === 'unlocked' ? state.key : null,
      initialise,
      unlock,
      lock,
    }),
    [state, initialise, unlock, lock],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}
