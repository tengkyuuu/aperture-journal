'use client';

import { Fragment, useRef, useState } from 'react';
import Link from 'next/link';

import { IconAsk } from '@/components/shell/icons';
import { PixelLoader } from '@/components/shell/pixel-loader';
import { apiPost } from '@/lib/client/api';
import { failureFrom, failureFromThrown, type Failure } from '@/lib/client/errors';
import { Notice } from '@/components/feedback/notice';

interface Citation {
  id: string;
  title: string;
  date: string | null;
  score: number;
}

const SUGGESTIONS = [
  'What kept coming up last month?',
  'What was I worried about that turned out fine?',
  'Where do I keep changing my mind?',
  'What have I been avoiding?',
];

/**
 * Ask Your Past.
 *
 * The answer streams as plain text carrying [[sessionId]] markers. Those get
 * rendered inline as chips linking to the session they came from — a claim
 * about your own life should be checkable against the day you wrote it, in one
 * click, without scrolling to a footnote.
 */
export function AskView() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;

    setBusy(true);
    setFailure(null);
    setAnswer('');
    setCitations([]);
    setAsked(text);

    try {
      const res = await apiPost('/api/ask', { question: text });

      if (!res.ok || !res.body) {
        // The 422 case carries the server's own sentence — an empty corpus is
        // something the server can explain better than this component can.
        setFailure(await failureFrom(res));
        return;
      }

      const header = res.headers.get('X-Citations');
      if (header) {
        try {
          setCitations(JSON.parse(atob(header)) as Citation[]);
        } catch {
          // A malformed header should not cost the user their answer.
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((a) => a + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setFailure(failureFromThrown(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex items-center gap-2 rounded-card brut bg-surface px-3 py-2 transition-colors focus-within:border-line-strong"
      >
        <IconAsk className="size-4 shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your journal something…"
          aria-label="Ask your journal"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="shrink-0 rounded-control bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent transition-opacity disabled:opacity-30"
        >
          {busy ? 'Looking…' : 'Ask'}
        </button>
      </form>

      {!asked && !busy ? (
        <div className="flex flex-col gap-2.5">
          <p className="label">Try</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="rounded-full border-2 border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Retry re-asks the question that failed. */}
      <Notice failure={failure} onRetry={asked ? () => void ask(asked) : undefined} />

      {busy && !answer ? (
        <div className="flex items-center gap-3 py-6" role="status" aria-live="polite">
          <PixelLoader />
          <span className="label">searching your entries</span>
        </div>
      ) : null}

      {answer ? (
        <article className="flex flex-col gap-5" aria-live="polite">
          <p className="label">In answer to “{asked}”</p>
          <div className="prose-journal whitespace-pre-wrap text-ink-2">
            <CitedText text={answer} citations={citations} />
            {busy ? (
              <span aria-hidden className="animate-caret ml-0.5 inline-block text-accent">
                ▌
              </span>
            ) : null}
          </div>

          {!busy && citations.length > 0 ? (
            <div className="flex flex-col gap-2 border-t-[3px] border-line pt-5">
              <p className="label">Drawn from</p>
              <ul className="flex flex-col gap-1">
                {citations.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/session/${c.id}`}
                      className="flex items-baseline gap-2.5 rounded-control px-2 py-1.5 text-[13px] transition-colors hover:bg-sunken"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink-2">{c.title}</span>
                      <span className="num shrink-0 text-[11px] text-ink-3">
                        {c.date
                          ? new Date(c.date).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                            })
                          : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                Only session summaries were searched — never the raw messages, and never a
                sealed entry.
              </p>
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}

/** Renders [[sessionId]] markers as inline chips linking to the source. */
function CitedText({ text, citations }: { text: string; citations: Citation[] }) {
  const byId = new Map(citations.map((c) => [c.id, c]));
  const parts = text.split(/(\[\[[A-Za-z0-9_-]{1,64}\]\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[\[([A-Za-z0-9_-]{1,64})\]\]$/.exec(part);
        if (!match) return <Fragment key={i}>{part}</Fragment>;

        const id = match[1]!;
        const cite = byId.get(id);
        // A marker for something not in the citation list is a model slip.
        // Drop it silently rather than rendering a dead link.
        if (!cite) return null;

        const index = citations.indexOf(cite) + 1;
        return (
          <Link
            key={i}
            href={`/session/${id}`}
            title={cite.title}
            className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-full bg-accent-wash px-1.5 font-sans text-[11px] font-medium text-accent no-underline align-baseline"
          >
            {index}
          </Link>
        );
      })}
    </>
  );
}
