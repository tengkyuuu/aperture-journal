#!/usr/bin/env node
/**
 * Re-embed every searchable session with the current embedding model.
 *
 * Needed once after switching from gemini-embedding-001 (768 dims) to bge-m3
 * (1024 dims). Vectors from different models live in different spaces, so an
 * old vector is useless to a new query — retrieval.ts scores mismatched lengths
 * at -1, which keeps old entries out of results rather than mismatching them,
 * but they stay unsearchable until this runs.
 *
 * Embeds exactly what the app embeds on close: "<title>. <summary>". Sealed
 * sessions are skipped — sealing deletes the embedding on purpose and this
 * must never undo that.
 *
 *   npm run reembed              # every user in the project
 *   npm run reembed -- --dry     # count only, write nothing
 *
 * Safe to re-run: sessions already at the right size are left alone.
 */

import { getFirestore } from 'firebase-admin/firestore';

import { EMBED_DIMS, embedMany, initAdmin, PROJECT } from './lib/providers.mjs';

const DRY = process.argv.includes('--dry');
const BATCH = 25;

initAdmin();
const db = getFirestore();

const users = await db.collection('users').listDocuments();
console.log(`${PROJECT}: ${users.length} user(s)${DRY ? ' — dry run' : ''}\n`);

let done = 0;
let skipped = 0;

for (const user of users) {
  const snap = await user.collection('sessions').get();

  const todo = snap.docs.filter((d) => {
    if (d.get('sealed') === true) return false;
    const summary = d.get('summary');
    if (typeof summary !== 'string' || !summary) return false;
    const current = d.get('embedding');
    if (Array.isArray(current) && current.length === EMBED_DIMS) {
      skipped++;
      return false;
    }
    return true;
  });

  console.log(`  ${user.id}: ${todo.length} to re-embed`);
  if (DRY) continue;

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const vectors = await embedMany(
      chunk.map((d) => `${d.get('title') ?? 'Untitled'}. ${d.get('summary')}`),
    );
    const batch = db.batch();
    chunk.forEach((d, j) => batch.update(d.ref, { embedding: vectors[j] }));
    await batch.commit();
    done += chunk.length;
  }
}

console.log(`\n${DRY ? 'Would re-embed' : 'Re-embedded'} ${DRY ? '(see counts above)' : done}; ${skipped} already current.`);
