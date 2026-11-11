#!/usr/bin/env node
/**
 * Where should the Echoes similarity threshold actually sit?
 *
 * ECHO.minScore was picked by argument, not measurement: "err high, because a
 * false positive kills trust". That reasoning is right and the number was still
 * a guess — and the first e2e run matched at 0.725 against a 0.72 bar, which is
 * the kind of margin that means the feature either misfires or never fires at
 * all, depending on the day.
 *
 * This measures the real distribution. It embeds a realistic session summary,
 * then scores drafts against it, in three bands:
 *
 *   same      — the thing the entry was about
 *   adjacent  — same life, different subject. MUST NOT echo.
 *   unrelated — control
 *
 * A usable threshold sits above the highest `adjacent` and below the lowest
 * `same`. If those overlap, no threshold works and the feature needs a
 * different signal.
 *
 *   node scripts/calibrate-echo.mjs
 */

import { ECHO, MODELS } from '../lib/config.ts';
import { dot, embedOne } from './lib/providers.mjs';

console.log(`model: ${MODELS.embedding}\n`);

// A plausible closed-session summary — the kind of text Echoes searches over.
const ENTRY = `
You shipped the feature despite sleeping badly, and the unease that followed was
not about the code. What surfaced was a fear that the work would land silently —
that nobody would notice it at all — and that the silence would say something
about whether the effort had been worth it.
`.trim();

const DRAFTS = {
  same: [
    'Still turning over the launch. I shipped it but I keep waiting for someone to say it landed, and the silence is doing something to me that I do not like.',
    'Nobody has said anything about the release. I know that is not the same as it being bad but it feels like it.',
    'I keep refreshing to see if anyone noticed the thing I shipped. The quiet is getting to me more than criticism would.',
  ],
  adjacent: [
    'My sister is coming to stay for a fortnight and I have not worked out where she is going to sleep or how to tell her about the cat.',
    'Trying to decide whether to renew the lease. The flat is too small but moving in winter sounds miserable.',
    'I have been sleeping badly again. Up at four most nights, no obvious reason for it.',
  ],
  unrelated: [
    'The sourdough finally worked. Turns out the starter just needed somewhere warmer to live than the windowsill.',
    'Bike has a slow puncture and I cannot find the hole even with the bucket of water.',
  ],
};

const docVec = await embedOne(ENTRY);

const scores = {};
for (const [band, drafts] of Object.entries(DRAFTS)) {
  scores[band] = [];
  for (const d of drafts) {
    const s = dot(docVec, await embedOne(d));
    scores[band].push(s);
    console.log(`${band.padEnd(10)} ${s.toFixed(3)}  ${d.slice(0, 62)}…`);
  }
}

const min = (a) => Math.min(...a);
const max = (a) => Math.max(...a);

console.log('\n─── bands ───');
console.log(`same      ${min(scores.same).toFixed(3)} … ${max(scores.same).toFixed(3)}`);
console.log(`adjacent  ${min(scores.adjacent).toFixed(3)} … ${max(scores.adjacent).toFixed(3)}`);
console.log(`unrelated ${min(scores.unrelated).toFixed(3)} … ${max(scores.unrelated).toFixed(3)}`);

const floor = max(scores.adjacent);
const ceiling = min(scores.same);

console.log(`\ncurrent ECHO.minScore = ${ECHO.minScore}`);
if (ceiling > floor) {
  const suggested = Math.round(((floor + ceiling) / 2) * 100) / 100;
  console.log(`separable: any threshold in (${floor.toFixed(3)}, ${ceiling.toFixed(3)})`);
  console.log(`midpoint  ${suggested}  ← defensible setting`);
  if (ECHO.minScore > ceiling) {
    console.log(`\n⚠ CURRENT BAR IS TOO HIGH — it rejects real matches down to ${ceiling.toFixed(3)}.`);
  } else if (ECHO.minScore < floor) {
    console.log(`\n⚠ CURRENT BAR IS TOO LOW — adjacent entries reach ${floor.toFixed(3)}.`);
  } else {
    console.log('\n✓ current bar sits inside the separable band.');
  }
} else {
  console.log(`\n⚠ BANDS OVERLAP (same floor ${ceiling.toFixed(3)} ≤ adjacent ceiling ${floor.toFixed(3)}).`);
  console.log('  No cosine threshold separates these. The feature needs a different signal.');
}
