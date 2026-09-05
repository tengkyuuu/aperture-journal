'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { decrypt, encrypt } from '@/lib/client/vault';
import { apiPost } from '@/lib/client/api';
import type { ConversationMode } from '@/lib/config';
import type { Insights, StoredMessage } from '@/lib/shared/types';
import { useVault } from '@/components/vault/vault-provider';
import { VaultGate } from '@/components/vault/vault-gate';
import { IconVault } from '@/components/shell/icons';

import { Composer } from './composer';
import { Distilling, InsightReveal } from './closing-ritual';
import { MessageBlock, SealedBlock } from './message-block';

type Turn = {
  id: string;
  role: 'user' | 'model';
  content: string;
  cipher: string | null;
  sealed: boolean;
};

type RitualState = 'idle' | 'distilling' | 'revealed';
type SealState = 'idle' | 'sealing' | 'sealed';

/** The ceremony holds for this long even if the model comes back sooner. */
const MIN_DISTILL_MS = 1_900;
/** Long enough for the seal to land with weight. */
const SEAL_ANIM_MS = 1_100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Canvas({
  sessionId: initialSessionId,
  initialMessages = [],
  initialInsights = null,
  initialMode = 'reflect',
  closed = false,
  sealed = false,
  placeholder,
}: {
  sessionId?: string;
  initialMessages?: StoredMessage[];
  initialInsights?: Insights | null;
  initialMode?: ConversationMode;
  closed?: boolean;
  sealed?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const vault = useVault();

  const [turns, setTurns] = useState<Turn[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content ?? '',
      cipher: m.cipher,
      sealed: m.sealed,
    })),
  );
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ConversationMode>(initialMode);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(initialInsights);
  const [ritual, setRitual] = useState<RitualState>(initialInsights ? 'revealed' : 'idle');
  const [sealState, setSealState] = useState<SealState>(sealed ? 'sealed' : 'idle');
  const [gateOpen, setGateOpen] = useState(false);
  const [decrypted, setDecrypted] = useState(false);

  const sessionId = useRef<string | undefined>(initialSessionId);
  const bottom = useRef<HTMLDivElement>(null);
  const sealAfterUnlock = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, ritual]);

  // ── Reading a sealed session ────────────────────────────────────────────
  // Decryption happens here, in the browser, with a key the server has never
  // seen. Locking the vault throws the plaintext away again.
  useEffect(() => {
    if (!sealed || !vault.key) {
      if (!vault.key && decrypted) {
        setTurns((t) => t.map((x) => (x.sealed ? { ...x, content: '' } : x)));
        setDecrypted(false);
      }
      return;
    }
    if (decrypted) return;

    let cancelled = false;
    (async () => {
      try {
        const out = await Promise.all(
          turns.map(async (t) => {
            if (!t.sealed || !t.cipher) return t;
            return { ...t, content: await decrypt(vault.key!, t.cipher) };
          }),
        );
        if (!cancelled) {
          setTurns(out);
          setDecrypted(true);
        }
      } catch {
        if (!cancelled) setError('These entries could not be decrypted with that passphrase.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sealed, vault.key, decrypted, turns]);

  // ── Sending ─────────────────────────────────────────────────────────────
  async function send() {
    const message = input.trim();
    if (!message || streaming || ritual !== 'idle') return;

    setInput('');
    setError(null);
    setStreaming(true);

    const stamp = Date.now();
    setTurns((t) => [
      ...t,
      { id: `u-${stamp}`, role: 'user', content: message, cipher: null, sealed: false },
      { id: `m-${stamp}`, role: 'model', content: '', cipher: null, sealed: false },
    ]);

    try {
      const res = await apiPost('/api/chat', {
        message,
        mode,
        sessionId: sessionId.current,
      });

      if (!res.ok || !res.body) {
        setError(
          res.status === 429
            ? "You've reached today's limit. It resets at midnight UTC."
            : 'That did not go through. Your entry is still in the box above.',
        );
        setInput(message);
        setTurns((t) => t.slice(0, -2));
        return;
      }

      const returnedId = res.headers.get('X-Session-Id');
      const isNew = !sessionId.current && returnedId;
      if (returnedId) sessionId.current = returnedId;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((t) => {
          const next = [...t];
          const last = next[next.length - 1]!;
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }

      if (isNew && returnedId) {
        router.replace(`/session/${returnedId}`, { scroll: false });
      } else {
        router.refresh();
      }
    } catch {
      setError('Connection lost mid-thought. Try again.');
      setTurns((t) => t.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  // ── The Closing Ritual ──────────────────────────────────────────────────
  async function endSession() {
    if (!sessionId.current || ritual !== 'idle' || streaming) return;

    setRitual('distilling');
    setError(null);
    const startedAt = Date.now();

    try {
      const res = await apiPost('/api/session/summarize', {
        sessionId: sessionId.current,
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_DISTILL_MS) await sleep(MIN_DISTILL_MS - elapsed);

      if (!res.ok) {
        setRitual('idle');
        setError(
          res.status === 422
            ? 'There is not enough here to distil yet. Write a little more.'
            : 'The summary did not come through. Your session is safe — try ending it again.',
        );
        return;
      }

      const data = (await res.json()) as { insights: Insights };
      setInsights(data.insights);
      setRitual('revealed');
      router.refresh();
    } catch {
      setRitual('idle');
      setError('The summary did not come through. Your session is safe.');
    }
  }

  // ── The Seal ────────────────────────────────────────────────────────────
  const doSeal = useCallback(async () => {
    const id = sessionId.current;
    if (!id || !vault.key || sealState !== 'idle') return;

    setError(null);
    setSealState('sealing');

    try {
      // Encrypt in the browser. What leaves this machine is ciphertext.
      const payload = await Promise.all(
        turns
          .filter((t) => !t.sealed && t.content.trim().length > 0)
          .map(async (t) => ({ id: t.id, cipher: await encrypt(vault.key!, t.content) })),
      );

      if (payload.length === 0) {
        setSealState('idle');
        setError('There is nothing here to seal yet.');
        return;
      }

      const [res] = await Promise.all([
        apiPost('/api/session/seal', { sessionId: id, messages: payload }),
        // Let the animation play out rather than snapping.
        sleep(SEAL_ANIM_MS),
      ]);

      if (!res.ok) {
        setSealState('idle');
        setError('The entry could not be sealed. Nothing was changed.');
        return;
      }

      setSealState('sealed');
      setInsights(null);
      setRitual('idle');
      router.refresh();
    } catch {
      setSealState('idle');
      setError('The entry could not be sealed. Nothing was changed.');
    }
  }, [turns, vault.key, sealState, router]);

  function requestSeal() {
    if (vault.status !== 'unlocked') {
      sealAfterUnlock.current = true;
      setGateOpen(true);
      return;
    }
    void doSeal();
  }

  const hasContent = turns.some((t) => !t.sealed && t.content.trim().length > 0);
  const canEnd = Boolean(sessionId.current) && hasContent && ritual === 'idle' && !streaming;
  const canSeal =
    Boolean(sessionId.current) && hasContent && !sealed && sealState === 'idle' && !streaming;

  const showComposer = ritual === 'idle' && !closed && !sealed && sealState === 'idle';

  return (
    <div className="flex flex-col gap-8">
      <div className={sealState === 'sealing' ? 'animate-seal-blur' : undefined}>
        {turns.length > 0 ? (
          <div className="flex flex-col gap-7">
            {turns.map((t, i) =>
              t.sealed && !t.content ? (
                <SealedBlock key={t.id} onUnlock={() => setGateOpen(true)} />
              ) : (
                <MessageBlock
                  key={t.id}
                  role={t.role}
                  content={t.content}
                  sealed={t.sealed}
                  streaming={streaming && i === turns.length - 1 && t.role === 'model'}
                />
              ),
            )}
          </div>
        ) : null}
      </div>

      {sealState === 'sealing' ? <SealCeremony /> : null}

      {ritual === 'distilling' ? <Distilling /> : null}
      {ritual === 'revealed' && insights ? <InsightReveal insights={insights} /> : null}

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {showComposer ? (
        <Composer
          value={input}
          onChange={setInput}
          onSend={send}
          mode={mode}
          onModeChange={setMode}
          busy={streaming}
          disabled={streaming}
          placeholder={placeholder}
          canEnd={canEnd}
          onEnd={endSession}
        />
      ) : null}

      {canSeal ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={requestSeal}
            className="inline-flex items-center gap-2 rounded-full border border-sealed/50 px-3.5 py-1.5 text-[12.5px] text-sealed transition-colors hover:bg-sealed/[0.07]"
          >
            <IconVault className="size-3.5" />
            Seal this entry
          </button>
          <p className="text-[12px] leading-relaxed text-ink-3">
            Encrypted in this browser. Neither we nor Gemini can read it afterwards — which
            also means no summary, no search, and no mood tracking for it.
          </p>
        </div>
      ) : null}

      {sealState === 'sealed' || sealed ? (
        <p className="text-[13px] text-ink-3">
          {vault.status === 'unlocked'
            ? 'Sealed. Decrypted here in your browser; the server still holds only ciphertext.'
            : 'Sealed. Unlock your vault to read this.'}
        </p>
      ) : null}

      {ritual === 'revealed' ? (
        <p className="text-[13px] text-ink-3">
          This session is closed.{' '}
          <button
            type="button"
            onClick={() => router.push('/today')}
            className="text-accent underline underline-offset-2"
          >
            Start a new one
          </button>
          .
        </p>
      ) : null}

      <VaultGate
        open={gateOpen}
        onClose={() => {
          setGateOpen(false);
          sealAfterUnlock.current = false;
        }}
        onUnlocked={() => {
          if (sealAfterUnlock.current) {
            sealAfterUnlock.current = false;
            void doSeal();
          }
        }}
      />

      <div ref={bottom} />
    </div>
  );
}

/** The wax seal pressing down. Slow, weighted, deliberately theatrical. */
function SealCeremony() {
  return (
    <div
      className="pointer-events-none flex flex-col items-center gap-5 py-14"
      role="status"
      aria-live="polite"
    >
      <div className="animate-seal-press grid size-16 place-items-center rounded-full bg-sealed text-white shadow-lg">
        <IconVault className="size-7" />
      </div>
      <span className="label text-sealed">sealing</span>
    </div>
  );
}
