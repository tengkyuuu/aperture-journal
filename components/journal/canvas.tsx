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
import { EchoCards, useEchoes } from './echoes';
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
  echoesEnabled = false,
  truncated = false,
}: {
  sessionId?: string;
  initialMessages?: StoredMessage[];
  initialInsights?: Insights | null;
  initialMode?: ConversationMode;
  closed?: boolean;
  sealed?: boolean;
  placeholder?: string;
  /** The user's stored Echoes preference. Off unless they turned it on. */
  echoesEnabled?: boolean;
  /** This session has more messages than were loaded. Sealing is unsafe. */
  truncated?: boolean;
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

    /**
     * Which side of the response a failure happened on.
     *
     * It decides whether the writing goes back in the box. Before the headers
     * arrive nothing was persisted, so the optimistic pair comes out and the
     * text returns to the composer. Once the stream has started the user's
     * turn IS in Firestore — /api/chat writes it before the first token — so
     * putting it back would have them send the same thing twice.
     *
     * The catch block used to do neither: it dropped one turn instead of two
     * and never restored the input, so a dropped connection silently ate what
     * the person had just written and then told them to try again.
     */
    let phase: 'request' | 'stream' = 'request';

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
            : res.status === 503
              ? 'Gemini is busy right now. Your entry is still here — try again in a moment.'
              : 'That did not go through. Your entry is still in the box above.',
        );
        setInput(message);
        setTurns((t) => t.slice(0, -2));
        return;
      }

      // Past this point the server has the user's turn on disk.
      phase = 'stream';

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
      if (phase === 'request') {
        // Nothing reached the server. Give the writing back.
        setError('Connection lost before that could be sent. It is back in the box above.');
        setTurns((t) => t.slice(0, -2));
        setInput(message);
      } else {
        // It was saved; only the reply was cut off. Restoring the composer here
        // would duplicate the entry, so drop the empty model turn and re-read.
        setError('The connection dropped mid-reply. Your entry was saved — reload to see where it got to.');
        setTurns((t) => {
          const last = t[t.length - 1];
          return last && last.role === 'model' && last.content === '' ? t.slice(0, -1) : t;
        });
        router.refresh();
      }
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
            : res.status === 503
              ? 'Gemini is busy right now. Your session is safe — try ending it again shortly.'
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
  // A session longer than the read limit arrives here as a prefix of itself.
  // Sealing encrypts only what was loaded, and the server would then have to
  // choose between leaving the rest readable or destroying it. Neither is
  // acceptable, so the offer is withdrawn and the reason is stated below.
  const canSeal =
    Boolean(sessionId.current) &&
    hasContent &&
    !sealed &&
    !truncated &&
    sealState === 'idle' &&
    !streaming;

  const showComposer = ritual === 'idle' && !closed && !sealed && sealState === 'idle';

  /**
   * Echoes only runs while there is actually a composer to write in, and never
   * while the vault is unlocked — someone writing with the vault open may be
   * about to seal this, and a draft destined for encryption must not have been
   * sent off for comparison first.
   */
  const {
    echoes,
    armed: echoArmed,
    dismiss: dismissEcho,
  } = useEchoes({
    draft: input,
    sessionId: sessionId.current,
    enabled: echoesEnabled && showComposer,
    vaultUnlocked: vault.status === 'unlocked',
  });

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
          echoArmed={echoArmed}
        />
      ) : null}

      {showComposer ? <EchoCards echoes={echoes} onDismiss={dismissEcho} /> : null}

      {canSeal ? (
        <div className="flex flex-wrap items-center gap-3 border-t-[3px] border-line pt-5">
          <button
            type="button"
            onClick={requestSeal}
            className="brut-press-sm inline-flex items-center gap-2 rounded-control border-[3px] border-line bg-sealed px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#111111] shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            <IconVault className="size-3.5" />
            Seal this entry
          </button>
          <p className="text-[12px] leading-relaxed text-ink-3">
            Encrypted in this browser. Neither we nor Gemini can read it afterwards — which
            also means no summary, no search, and no mood tracking for it.
          </p>
        </div>
      ) : truncated && !sealed && sealState === 'idle' ? (
        <div className="flex flex-col gap-2 border-t-[3px] border-line pt-5">
          <p className="label">Sealing unavailable here</p>
          <p className="text-[12px] leading-relaxed text-ink-3">
            This entry is longer than can be loaded at once, so only part of it is on
            screen. Sealing encrypts what the browser is holding, and doing that here
            would leave the rest of the entry behind. It stays readable rather than
            half-sealed.
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
      <div className="animate-seal-press grid size-16 place-items-center rounded-full bg-sealed text-white shadow-[var(--shadow-brut)]">
        <IconVault className="size-7" />
      </div>
      <span className="label text-sealed">sealing</span>
    </div>
  );
}
