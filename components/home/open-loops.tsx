import Link from 'next/link';

import { relativeTime } from '@/lib/shared/format';
import type { OpenLoop } from '@/lib/server/queries';

/**
 * Threads a past session left unresolved, carried forward.
 *
 * The summarizer has always extracted these; until now they were written down
 * once and never seen again, which is exactly the failure a journal is meant
 * to prevent. Surfacing them is the difference between an app that records you
 * and an app that remembers you.
 *
 * Deliberately not a to-do list. There is no checkbox, no "done", no count of
 * how many you have left. An open loop is a question worth sitting with, and
 * turning it into an unchecked box would make an unanswered question feel like
 * a failure — which is the opposite of what this is for.
 */
export function OpenLoops({ loops }: { loops: OpenLoop[] }) {
  if (loops.length === 0) return null;

  return (
    <section aria-labelledby="open-loops-heading" className="flex flex-col gap-3">
      <h2 id="open-loops-heading" className="label">
        Still open
      </h2>

      <ul className="flex flex-col gap-px">
        {loops.map((loop, i) => (
          <li key={`${loop.sessionId}-${i}`}>
            <Link
              href={`/session/${loop.sessionId}`}
              className="group flex flex-col gap-1 rounded-card px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span className="prose-journal text-[16px] leading-snug text-ink-2 group-hover:text-ink">
                {loop.text}
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                <span className="truncate">{loop.sessionTitle}</span>
                <span aria-hidden>·</span>
                <span className="num shrink-0">{relativeTime(loop.at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
