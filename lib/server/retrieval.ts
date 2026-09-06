import 'server-only';

import { sessionsCol } from './db';
import { wrapUntrusted } from './injection';
import type { Mood } from '../shared/types';

/**
 * Retrieval over the user's own journal.
 *
 * ══ THE DELIBERATE SIMPLIFICATION ══
 * Firestore has native vector search via `findNearest`, and for a product at
 * scale that is the right answer. It needs a composite vector index created
 * through gcloud, which takes time to build and is one more thing that can be
 * misconfigured on the day of a demo.
 *
 * A personal journal is hundreds of sessions, not millions. Loading one user's
 * own embeddings and scoring them here takes single-digit milliseconds, needs
 * no index, and cannot be pointed at the wrong tenant because the collection
 * path already contains the uid. The upgrade path is this one function.
 *
 * The honest cost: memory grows linearly with the user's history. At 768
 * floats per session that is about 6 KB each, so a thousand sessions is ~6 MB
 * per query. Past a few thousand, switch to findNearest.
 */

/** Vectors are unit-normalised on write, so a dot product is the cosine. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

export interface Retrieved {
  sessionId: string;
  title: string;
  summary: string;
  startedAt: Date | null;
  score: number;
  /**
   * The mood recorded when this entry closed. Carried here rather than
   * re-fetched, because the document is already open — Echoes needs it, and
   * buildContext deliberately ignores it: a mood label is a reading of the
   * user, not evidence, and it has no business in a grounding prompt.
   */
  mood: Mood | null;
}

/**
 * SECURITY PRECONDITION: `uid` comes from requireUid().
 *
 * Note what is not here: any filter that could be forgotten. The collection
 * path is already scoped to one user, so there is no cross-tenant result to
 * exclude — a bug in the scoring code returns bad matches, never someone
 * else's journal.
 */
export async function retrieve(
  uid: string,
  queryVector: number[],
  topK = 5,
  scanLimit = 300,
): Promise<Retrieved[]> {
  const snap = await sessionsCol(uid).orderBy('startedAt', 'desc').limit(scanLimit).get();

  const scored: Retrieved[] = [];

  for (const doc of snap.docs) {
    // Sealed sessions have no embedding — sealing deletes it — so they are
    // absent here by construction rather than by a filter someone must
    // remember to write.
    const embedding = doc.get('embedding') as number[] | undefined;
    if (!embedding?.length) continue;

    const summary = doc.get('summary') as string | undefined;
    if (!summary) continue;

    scored.push({
      sessionId: doc.id,
      title: (doc.get('title') as string) ?? 'Untitled',
      summary,
      startedAt: doc.get('startedAt')?.toDate?.() ?? null,
      // Mood lives inside the `insights` map written at close, not at the
      // top level of the session document.
      mood: (doc.get('insights.mood') as Mood | undefined) ?? null,
      score: cosine(queryVector, embedding),
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Build the grounded context block.
 *
 * The entries go inside delimiters with an explicit "this is data" marker,
 * because a journal can contain anything the user has ever pasted into it —
 * an email, a web page, a screenshot's OCR. Retrieved content is untrusted
 * input that happens to belong to the person asking.
 */
export function buildContext(entries: Retrieved[]): string {
  const body = entries
    .map((e) => {
      const date = e.startedAt
        ? e.startedAt.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : 'undated';
      return `<entry id="${e.sessionId}" date="${date}" title="${e.title.replace(/"/g, "'")}">\n${e.summary}\n</entry>`;
    })
    .join('\n\n');

  return wrapUntrusted(body);
}
