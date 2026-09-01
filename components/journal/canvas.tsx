'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ConversationMode } from '@/lib/config';
import type { Insights, StoredMessage } from '@/lib/shared/types';

import { Composer } from './composer';
import { Distilling, InsightReveal } from './closing-ritual';
import { MessageBlock, SealedBlock } from './message-block';

type Turn = { id: string; role: 'user' | 'model'; content: string; sealed: boolean };

type RitualState = 'idle' | 'distilling' | 'revealed';

/** The ceremony holds for this long even if the model comes back sooner. */
const MIN_DISTILL_MS = 1_900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Canvas({
  sessionId: initialSessionId,
  initialMessages = [],
  initialInsights = null,
  initialMode = 'reflect',
  closed = false,
  placeholder,
}: {
  sessionId?: string;
  initialMessages?: StoredMessage[];
  initialInsights?: Insights | null;
  initialMode?: ConversationMode;
  closed?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();

  const [turns, setTurns] = useState<Turn[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content ?? '',
      sealed: m.sealed,
    })),
  );
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ConversationMode>(initialMode);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(initialInsights);
  const [ritual, setRitual] = useState<RitualState>(initialInsights ? 'revealed' : 'idle');

  const sessionId = useRef<string | undefined>(initialSessionId);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, ritual]);

  async function send() {
    const message = input.trim();
    if (!message || streaming || ritual !== 'idle') return;

    setInput('');
    setError(null);
    setStreaming(true);

    const stamp = Date.now();
    setTurns((t) => [
      ...t,
      { id: `u-${stamp}`, role: 'user', content: message, sealed: false },
      { id: `m-${stamp}`, role: 'model', content: '', sealed: false },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode, sessionId: sessionId.current }),
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

      // A brand-new session gets its own URL once its first exchange is
      // persisted. Nothing is lost in the swap — the session page reloads the
      // same messages from Firestore.
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

  async function endSession() {
    if (!sessionId.current || ritual !== 'idle' || streaming) return;

    setRitual('distilling');
    setError(null);
    const startedAt = Date.now();

    try {
      const res = await fetch('/api/session/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });

      // Hold the ceremony even when the model is fast.
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

  const hasContent = turns.some((t) => !t.sealed && t.content.trim().length > 0);
  const canEnd = Boolean(sessionId.current) && hasContent && ritual === 'idle' && !streaming;

  return (
    <div className="flex flex-col gap-8">
      {turns.length > 0 ? (
        <div className="flex flex-col gap-7">
          {turns.map((t, i) =>
            t.sealed ? (
              <SealedBlock key={t.id} />
            ) : (
              <MessageBlock
                key={t.id}
                role={t.role}
                content={t.content}
                streaming={streaming && i === turns.length - 1 && t.role === 'model'}
              />
            ),
          )}
        </div>
      ) : null}

      {ritual === 'distilling' ? <Distilling /> : null}
      {ritual === 'revealed' && insights ? <InsightReveal insights={insights} /> : null}

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {ritual === 'idle' && !closed ? (
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

      <div ref={bottom} />
    </div>
  );
}
