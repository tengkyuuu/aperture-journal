#!/usr/bin/env node
/**
 * Seed a signed-in account with demo history.
 *
 * Insights and Ask Your Past are only interesting once there is a past. A
 * fresh account shows two empty states, which is honest and completely
 * undemonstrable — so this writes ten weeks of plausible sessions with
 * recurring themes, so the weather ribbon has shape and the constellation has
 * edges to draw.
 *
 * The insight objects are hand-authored rather than generated: they cost no
 * quota, they are deterministic, and the ribbon looks the same every time you
 * rehearse. The EMBEDDINGS are real, because retrieval has to actually work —
 * a faked vector would make Ask Your Past return nonsense.
 *
 *   npm run seed                 # finds your account automatically
 *   npm run seed -- --clear      # removes only what this script created
 *   npm run seed -- --email you@example.com
 *
 * Everything it writes carries `seeded: true`, so --clear can remove exactly
 * this and never touch a real entry.
 */

import { readFileSync } from 'node:fs';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

import { MODELS } from '../lib/config.ts';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'aperture-journal';
const args = process.argv.slice(2);
const CLEAR = args.includes('--clear');
const EMAIL = args[args.indexOf('--email') + 1];

if (!getApps().length) initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

// ─── The history ────────────────────────────────────────────────────────────
// Ordered oldest first. `ago` is days back from today. Themes deliberately
// recur so the constellation has co-occurrence edges rather than dots.

const SESSIONS = [
  {
    ago: 68, mode: 'reflect', title: 'The job that fits badly',
    user: "I keep telling people the job is fine. It is fine. It just doesn't fit anywhere I actually am.",
    model: 'What would "fitting" look like on an ordinary Tuesday, rather than in the abstract?',
    summary: "You noticed the gap between calling the job fine and feeling at home in it. Nothing is wrong, which is part of what makes it hard to name.",
    bullets: ['"Fine" has been doing a lot of work', 'No single thing to point at', 'The mismatch shows up on ordinary days, not dramatic ones'],
    openLoops: ['What would fitting actually look like?'],
    mood: { valence: -0.3, energy: 0.35, label: 'unsettled' },
    emotions: [{ name: 'restlessness', intensity: 0.6 }, { name: 'guilt', intensity: 0.3 }],
    themes: ['work', 'identity'],
    entities: [{ name: 'current job', type: 'project' }],
    experiment: 'Write down one moment this week where the job did fit.',
  },
  {
    ago: 61, mode: 'untangle', title: 'Sleep and the 2am audit',
    user: "Woke at 2 and did the thing where I review every decision I've made since March.",
    model: 'Does that review ever produce anything you act on in daylight?',
    summary: "The 2am reviews are not producing decisions, only rehearsals. You noticed they always start with sleep, not with the decisions themselves.",
    bullets: ['The audit never yields an action', 'It starts on nights you sleep badly', 'Daylight version of the same question feels smaller'],
    openLoops: ['Is this a sleep problem wearing a thinking problem’s clothes?'],
    mood: { valence: -0.5, energy: 0.2, label: 'depleted' },
    emotions: [{ name: 'anxiety', intensity: 0.7 }, { name: 'exhaustion', intensity: 0.6 }],
    themes: ['sleep', 'anxiety'],
    entities: [],
    experiment: 'Note tomorrow whether the 2am question still matters at 10am.',
  },
  {
    ago: 54, mode: 'brainstorm', title: 'Ways out that are not quitting',
    user: 'I want options that are not "quit" or "endure". Give me some.',
    model: 'Here are nine, and one of them is deliberately impractical...',
    summary: "You wanted a middle path and found several. The interesting one was not the sensible option but the sideways one you dismissed fastest.",
    bullets: ['Nine options, two worth keeping', 'You dismissed the sideways one quickest', 'Neither kept option requires leaving'],
    openLoops: ['Why did the sideways option get dismissed so fast?'],
    mood: { valence: 0.4, energy: 0.75, label: 'energised' },
    emotions: [{ name: 'hope', intensity: 0.6 }, { name: 'curiosity', intensity: 0.7 }],
    themes: ['work', 'decisions'],
    entities: [],
    experiment: 'Spend twenty minutes on the option you dismissed fastest.',
  },
  {
    ago: 47, mode: 'reflect', title: 'Sunday with the family',
    user: 'Good day with everyone. Tired in a way I do not mind.',
    model: 'What made this tiredness different from the weekday kind?',
    summary: "A day that cost energy without draining you. You noticed the difference between spent and depleted, and that you rarely name the good kind.",
    bullets: ['Spent, not depleted', 'Nobody needed managing', 'You noticed it while it was happening'],
    openLoops: [],
    mood: { valence: 0.7, energy: 0.45, label: 'contented' },
    emotions: [{ name: 'warmth', intensity: 0.8 }, { name: 'calm', intensity: 0.6 }],
    themes: ['family', 'rest'],
    entities: [{ name: 'family', type: 'person' }],
    experiment: 'Notice one more instance of the good tiredness this week.',
  },
  {
    ago: 40, mode: 'duck', title: 'The migration that will not finish',
    user: 'The data migration is 80% done and has been 80% done for three weeks.',
    model: 'What specifically is in the last 20%, item by item?',
    summary: "Naming the remaining twenty percent turned one blocked task into four small ones, three of which nobody had asked you to do.",
    bullets: ['The 20% was four separate things', 'Three were self-assigned', 'Only one is genuinely blocked'],
    openLoops: ['Ask whether the three self-assigned pieces are needed at all'],
    mood: { valence: 0.25, energy: 0.6, label: 'clearer' },
    emotions: [{ name: 'relief', intensity: 0.5 }, { name: 'irritation', intensity: 0.35 }],
    themes: ['work', 'productivity'],
    entities: [{ name: 'data migration', type: 'project' }],
    experiment: 'Ask on Monday whether the three optional pieces are wanted.',
  },
  {
    ago: 33, mode: 'untangle', title: 'Money, and the number that never moves',
    user: 'Checked savings again. Same number. I check it like it will have changed on its own.',
    model: 'What are you hoping the number will tell you that it cannot?',
    summary: "The checking is not about the number. You are asking it whether you are going to be alright, which is a question a balance cannot answer.",
    bullets: ['You check far more often than it changes', 'The real question is about safety, not arithmetic', 'The number has been stable, which is not the same as bad'],
    openLoops: ['What would a real answer to "will I be alright" look like?'],
    mood: { valence: -0.35, energy: 0.4, label: 'uneasy' },
    emotions: [{ name: 'worry', intensity: 0.65 }],
    themes: ['money', 'anxiety'],
    entities: [],
    experiment: 'Check the balance once this week, on a fixed day.',
  },
  {
    ago: 26, mode: 'reflect', title: 'Running again, badly',
    user: 'Went for a run. Slow, ugly, and the first one in months. Felt great afterwards.',
    model: 'What made today the day it happened, after months of it not?',
    summary: "The run happened because you lowered what counted as a run. You noticed the pattern applies to several things you have been not-doing.",
    bullets: ['You lowered the bar and it worked', 'It was worse than your old runs and still counted', 'The same trick might apply elsewhere'],
    openLoops: ['Where else is the bar set too high to start?'],
    mood: { valence: 0.6, energy: 0.7, label: 'lifted' },
    emotions: [{ name: 'satisfaction', intensity: 0.7 }],
    themes: ['health', 'rest'],
    entities: [],
    experiment: 'Pick one stalled thing and halve what counts as doing it.',
  },
  {
    ago: 19, mode: 'reflect', title: 'Sleep is the load-bearing one',
    user: 'Three good nights and suddenly work is manageable and I am not spiralling about money.',
    model: 'Which of those changed first, do you think?',
    summary: "Three nights of sleep changed how work and money felt, without either actually changing. You are starting to suspect sleep is upstream of most of it.",
    bullets: ['Nothing external changed', 'Both the work and money feelings softened', 'Sleep may be upstream of the rest'],
    openLoops: ['Protect sleep and see whether the pattern holds'],
    mood: { valence: 0.55, energy: 0.5, label: 'steady' },
    emotions: [{ name: 'relief', intensity: 0.7 }],
    themes: ['sleep', 'work', 'money'],
    entities: [],
    experiment: 'Hold the bedtime for a week and note what else shifts.',
  },
  {
    ago: 12, mode: 'brainstorm', title: 'What the sideways option actually was',
    user: 'Coming back to the option I dismissed. I think I dismissed it because it was embarrassing, not because it was bad.',
    model: 'Embarrassing to whom, specifically?',
    summary: "The dismissed option was rejected on embarrassment, not merit, and the audience for that embarrassment turned out to be two people whose opinion you had assumed.",
    bullets: ['Rejected on embarrassment, not merit', 'The imagined audience is two specific people', 'You have not asked either of them'],
    openLoops: ['Ask one of the two what they would actually think'],
    mood: { valence: 0.3, energy: 0.65, label: 'candid' },
    emotions: [{ name: 'embarrassment', intensity: 0.5 }, { name: 'clarity', intensity: 0.6 }],
    themes: ['work', 'decisions', 'identity'],
    entities: [],
    experiment: 'Say the option out loud to one person this week.',
  },
  {
    ago: 5, mode: 'untangle', title: 'The launch, and being unseen',
    user: 'Shipped it. Nobody said anything. I know that is normal and it still landed badly.',
    model: 'Is the disappointment about the silence, or about what you thought shipping would settle?',
    summary: "You expected shipping to answer a question about whether the work matters, and it did not, because silence is what shipping usually sounds like.",
    bullets: ['The silence was expected and still stung', 'You wanted it to settle something it cannot settle', 'The work being unremarked is not the work being unremarkable'],
    openLoops: ['What would actually settle the question?'],
    mood: { valence: -0.4, energy: 0.35, label: 'flat' },
    emotions: [{ name: 'disappointment', intensity: 0.7 }, { name: 'tiredness', intensity: 0.5 }],
    themes: ['work', 'validation', 'launch'],
    entities: [{ name: 'the launch', type: 'project' }],
    experiment: 'Write down what you would need to hear, then notice who could say it.',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findUid() {
  if (EMAIL) {
    const u = await auth.getUserByEmail(EMAIL);
    return u.uid;
  }
  const list = await auth.listUsers(50);
  const real = list.users.filter((u) => !u.uid.startsWith('e2e-') && !u.uid.startsWith('leak-'));
  if (real.length === 0) {
    console.error('No account found. Sign in through the app once, then run this again.');
    process.exit(1);
  }
  if (real.length > 1) {
    console.error(`${real.length} accounts found. Pick one with --email:`);
    real.forEach((u) => console.error(`  ${u.email ?? u.uid}`));
    process.exit(1);
  }
  return real[0].uid;
}

async function geminiClient() {
  const sm = new SecretManagerServiceClient();
  const [v] = await sm.accessSecretVersion({
    name: `projects/${PROJECT}/secrets/GEMINI_API_KEY/versions/latest`,
  });
  return new GoogleGenAI({ apiKey: v.payload.data.toString() });
}

/** Matches lib/server/gemini.ts — sub-3072 output must be normalised by hand. */
function normalise(values) {
  const mag = Math.sqrt(values.reduce((n, v) => n + v * v, 0));
  return mag === 0 ? values : values.map((v) => v / mag);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Run ────────────────────────────────────────────────────────────────────

const uid = await findUid();
const sessions = db.collection(`users/${uid}/sessions`);

if (CLEAR) {
  const snap = await sessions.where('seeded', '==', true).get();
  for (const doc of snap.docs) await db.recursiveDelete(doc.ref);
  console.log(`Removed ${snap.size} seeded session(s). Real entries untouched.`);
  process.exit(0);
}

const existing = await sessions.where('seeded', '==', true).get();
if (!existing.empty) {
  console.log(`${existing.size} seeded sessions already present. Run with --clear first to reseed.`);
  process.exit(0);
}

console.log(`Seeding ${SESSIONS.length} sessions for ${uid}\n`);
const ai = await geminiClient();

for (const [i, s] of SESSIONS.entries()) {
  const startedAt = new Date(Date.now() - s.ago * 86_400_000);
  startedAt.setHours(21, 30, 0, 0);

  const insights = {
    title: s.title,
    summary: s.summary,
    bullets: s.bullets,
    openLoops: s.openLoops,
    mood: s.mood,
    emotions: s.emotions,
    themes: s.themes,
    entities: s.entities,
    suggestedExperiment: s.experiment,
  };

  // Real embedding — retrieval has to genuinely work.
  let embedding;
  try {
    const res = await ai.models.embedContent({
      model: MODELS.embedding,
      contents: `${s.title}. ${s.summary}`,
      config: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' },
    });
    embedding = normalise(res.embeddings[0].values);
  } catch (err) {
    console.log(`  ! ${s.title} — embedding failed, entry will not be searchable`);
    console.log(`    ${String(err).slice(0, 100)}`);
  }

  const ref = sessions.doc();
  await ref.set({
    seeded: true,
    title: s.title,
    summary: s.summary,
    insights,
    ...(embedding ? { embedding } : {}),
    mode: s.mode,
    status: 'closed',
    sealed: false,
    messageCount: 2,
    startedAt: Timestamp.fromDate(startedAt),
    endedAt: Timestamp.fromDate(new Date(startedAt.getTime() + 18 * 60_000)),
  });

  const messages = ref.collection('messages');
  await messages.add({
    role: 'user', content: s.user, sealed: false,
    createdAt: Timestamp.fromDate(startedAt),
  });
  await messages.add({
    role: 'model', content: s.model, sealed: false,
    createdAt: Timestamp.fromDate(new Date(startedAt.getTime() + 40_000)),
  });

  console.log(`  ✓ ${String(s.ago).padStart(2)}d ago  ${s.title}${embedding ? '' : '  (no embedding)'}`);

  // Free-tier embeddings rate-limit; pace unless told otherwise.
  if (i < SESSIONS.length - 1 && process.env.SEED_FAST !== '1') await sleep(1500);
}

await db.doc(`users/${uid}`).set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });

console.log(`\nDone. Open /insights and /ask.`);
console.log(`Remove it all with: npm run seed -- --clear`);
