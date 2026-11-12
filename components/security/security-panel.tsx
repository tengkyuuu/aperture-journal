'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { relativeTime } from '@/lib/shared/format';
import type { AiCall, SecurityEvent } from '@/lib/shared/types';
import { apiPost } from '@/lib/client/api';
import { failureFrom, failureFromThrown, type Failure } from '@/lib/client/errors';
import { Notice } from '@/components/feedback/notice';

/**
 * The Security page.
 *
 * The point of this page is that it is boring and complete. Every call this
 * server made to a model provider on your behalf is here, with what was sent and what it
 * cost. Most products will not tell you this because most products would
 * rather you did not think about it.
 */

const DATA_CLASS_COPY: Record<string, string> = {
  session_messages: 'the messages in that session',
  single_message: 'one message',
  summary_only: 'session summaries, not raw entries',
  question_only: 'your question only',
  draft_text: 'an unsent draft, while you were still typing it',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card brut bg-surface px-4 py-3.5">
      <p className="label">{label}</p>
      <p className="num mt-1.5 font-serif text-[30px] leading-none text-ink">{value}</p>
      {sub ? <p className="mt-1 text-[13px] text-ink-3">{sub}</p> : null}
    </div>
  );
}

export function SecurityPanel({
  calls,
  events,
  sealedCount,
}: {
  calls: AiCall[];
  events: SecurityEvent[];
  sealedCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  // The same UTC day the server's quota window uses.
  const utcToday = new Date().toISOString().slice(0, 10);
  const todayCalls = calls.filter((c) => (c.at ?? '').slice(0, 10) === utcToday).length;

  const totalIn = calls.reduce((n, c) => n + c.inputTokens, 0);
  const totalOut = calls.reduce((n, c) => n + c.outputTokens, 0);
  const totalCost = calls.reduce((n, c) => n + c.estCostUsd, 0);
  const excluded = calls.reduce((n, c) => n + c.sealedExcluded, 0);

  async function handleDelete() {
    if (confirm !== 'DELETE EVERYTHING' || deleting) return;
    setDeleting(true);
    setFailure(null);
    try {
      const res = await apiPost('/api/account/delete', { confirm });
      if (!res.ok) {
        setFailure(await failureFrom(res));
        setDeleting(false);
        return;
      }
      router.replace('/sign-in');
      router.refresh();
    } catch (err) {
      setFailure(failureFromThrown(err));
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── What left the device ───────────────────────────────────────── */}
      <section>
        <p className="label mb-3">Sent to the AI</p>

        {calls.length === 0 ? (
          <p className="prose-journal text-ink-3">
            Nothing yet. This fills in the moment you have a conversation.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/*
                "Today" rather than a live "108 of 120 remaining" counter.

                A remaining-quota meter above a journal is hostile — it turns
                thinking into a budget — and it is the same false-precision
                mistake the mood ribbon was redesigned to avoid. This is a
                count of what happened, on the page whose job is showing what
                happened, derived from rows already loaded.
              */}
              <Stat label="Calls" value={String(calls.length)} sub={`${todayCalls} today`} />
              <Stat label="Tokens in" value={totalIn.toLocaleString()} />
              <Stat label="Tokens out" value={totalOut.toLocaleString()} />
              <Stat
                label="Est. cost"
                value={totalCost < 0.01 ? '<$0.01' : `$${totalCost.toFixed(2)}`}
                sub="at paid rates · free tier bills $0"
              />
            </div>

            <p className="prose-journal mt-5 text-ink-2">
              {calls.length === 1 ? 'One request' : `${calls.length} requests`} went to the
              model providers — Groq for writing, Cloudflare for search.
              Each one carried {DATA_CLASS_COPY[calls[0]?.dataClasses[0] ?? ''] ?? 'session content'}{' '}
              and nothing else — no account identifiers, no email address, and nothing from any
              other session.
              {sealedCount > 0 ? (
                <>
                  {' '}
                  Your {sealedCount === 1 ? 'sealed entry was' : `${sealedCount} sealed entries were`}{' '}
                  never included: {sealedCount === 1 ? 'it is' : 'they are'} locked, and we cannot read{' '}
                  {sealedCount === 1 ? 'it' : 'them'}.
                </>
              ) : null}
              {excluded > 0 ? ` ${excluded} sealed message${excluded === 1 ? '' : 's'} were explicitly skipped.` : ''}
            </p>
          </>
        )}
      </section>

      {/* ── Ledger ─────────────────────────────────────────────────────── */}
      {calls.length > 0 ? (
        <section>
          <p className="label mb-3">The ledger</p>
          <div className="overflow-x-auto rounded-card brut bg-surface">
            <table className="w-full min-w-[620px] text-left font-mono text-[13px]">
              <thead>
                <tr className="border-b border-line bg-sunken text-ink-3">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 text-right font-medium">In</th>
                  <th className="px-3 py-2 text-right font-medium">Out</th>
                  <th className="px-3 py-2 text-right font-medium">ms</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-3">{relativeTime(c.at)}</td>
                    <td className="px-3 py-2 text-ink-2">{c.purpose}</td>
                    <td className="px-3 py-2 text-ink-3">{c.model}</td>
                    <td className="num px-3 py-2 text-right text-ink-2">
                      {c.inputTokens.toLocaleString()}
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-2">
                      {c.outputTokens.toLocaleString()}
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-3">{c.latencyMs}</td>
                    <td className="num px-3 py-2 text-right text-ink-3">
                      {c.estCostUsd < 0.0001 ? '—' : `$${c.estCostUsd.toFixed(4)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-3">
            Written server-side before each response returns, and not writable by the browser
            — a log you could edit would be worthless as a record of what was actually sent.
          </p>
        </section>
      ) : null}

      {/* ── Security events ────────────────────────────────────────────── */}
      <section>
        <p className="label mb-3">Warnings</p>
        {events.length === 0 ? (
          <p className="text-[13px] text-ink-3">
            Nothing flagged. If something you write or paste looks like an attempt to trick the AI, or you reach the daily limit, it shows up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-card brut bg-surface px-4 py-3"
              >
                <span
                  className={`border px-2 py-0.5 text-[13px] font-semibold rounded-control ${
                    e.severity === 'high'
                      ? 'border-danger text-danger'
                      : e.severity === 'medium'
                        ? 'border-sealed text-sealed'
                        : 'border-line-faint text-ink-3'
                  }`}
                >
                  {e.severity}
                </span>
                <span className="text-[13px] text-ink">{e.kind.replace(/_/g, ' ')}</span>
                <span className="text-[13px] text-ink-3">{e.detail}</span>
                <span className="ml-auto text-[13px] text-ink-3">{relativeTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-3">
          This check looks for suspicious patterns. It catches accidental cases, not a determined
          attacker: nobody can fully prevent that yet, and saying otherwise would be dishonest.
        </p>
      </section>

      {/* ── Data rights ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <p className="label">Your data</p>

        <a
          href="/api/account/export"
          className="flex items-center justify-between rounded-card brut bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
        >
          <span>
            <span className="block text-[13px] text-ink">Export everything</span>
            <span className="block text-[13px] text-ink-3">
              Every entry, summary and log row, as one JSON file. Sealed entries stay locked in
              the download; we cannot unlock them for you either.
            </span>
          </span>
          <span className="ml-4 shrink-0 text-[13px] text-accent">Download</span>
        </a>

        <div className="border border-danger p-4 rounded-control">
          <p className="text-[13px] text-ink">Delete everything</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Permanently removes every entry, message, summary and log row, then deletes your
            account. Nothing is kept or hidden; it is all gone. This cannot be undone.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <label htmlFor="confirm-delete" className="sr-only">
              Type DELETE EVERYTHING to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type DELETE EVERYTHING"
              className="min-w-0 flex-1 rounded-control brut-thin bg-surface px-3 py-2 font-mono text-[13px] outline-none focus:border-danger"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirm !== 'DELETE EVERYTHING' || deleting}
              className="brut-press-sm border border-danger bg-surface px-3.5 py-2 text-[13px] font-semibold text-danger transition-opacity disabled:opacity-30 rounded-control"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>

          {/* No retry button. A failed account deletion may have partially
              completed, and inviting a second attempt on the most destructive
              action in the app is how you compound the damage. */}
          <Notice failure={failure} className="mt-2.5" />
        </div>
      </section>
    </div>
  );
}
