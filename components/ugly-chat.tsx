'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { signOutEverywhere } from '@/lib/client/firebase';
import { MODE_LABELS, type ConversationMode } from '@/lib/config';

/**
 * Day 1 chat surface. Deliberately unstyled — it exists to prove the pipe:
 * cookie → verified uid → Secret Manager → Gemini → Firestore → back.
 *
 * The real conversation canvas is a Day 2 job. See docs/05-UI-UX-SPEC.md.
 */

type Turn = { role: 'user' | 'model'; content: string };

const MODES: ConversationMode[] = ['reflect', 'brainstorm', 'untangle', 'duck'];

export function UglyChat() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ConversationMode>('reflect');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);

  async function send() {
    const message = input.trim();
    if (!message || streaming) return;

    setInput('');
    setError(null);
    setStreaming(true);
    setTurns((t) => [...t, { role: 'user', content: message }, { role: 'model', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode, sessionId: sessionId.current ?? undefined }),
      });

      if (!res.ok || !res.body) {
        setError(res.status === 429 ? 'Daily limit reached.' : 'Something went wrong.');
        setTurns((t) => t.slice(0, -1));
        return;
      }

      sessionId.current = res.headers.get('X-Session-Id') ?? sessionId.current;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((t) => {
          const next = [...t];
          next[next.length - 1] = {
            role: 'model',
            content: next[next.length - 1]!.content + chunk,
          };
          return next;
        });
      }

      router.refresh();
    } catch {
      setError('Connection lost.');
      setTurns((t) => t.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  async function handleSignOut() {
    await signOutEverywhere();
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded border px-3 py-1 text-sm ${
              mode === m ? 'border-current' : 'border-current/20 opacity-50'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
        <button onClick={handleSignOut} className="ml-auto text-sm underline opacity-60">
          Sign out
        </button>
      </div>

      <div className="min-h-40 space-y-4" aria-live="polite">
        {turns.length === 0 ? (
          <p className="text-sm opacity-40">Say something.</p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className="space-y-1">
              <div className="font-mono text-xs uppercase tracking-wide opacity-40">
                {t.role === 'user' ? 'you' : 'gemini'}
              </div>
              <div className="whitespace-pre-wrap">
                {t.content}
                {streaming && i === turns.length - 1 ? <span className="opacity-40">▌</span> : null}
              </div>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          placeholder="Write something… (⌘↵ to send)"
          className="flex-1 rounded border border-current/20 bg-transparent p-3"
        />
        <button
          onClick={() => void send()}
          disabled={streaming || !input.trim()}
          className="rounded border border-current/20 px-4 disabled:opacity-40"
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
