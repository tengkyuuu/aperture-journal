#!/usr/bin/env node
/**
 * Live end-to-end verification against a running server.
 *
 * Drives two real users through the whole app — sign in, converse with Gemini,
 * distil, seal, retrieve — and then tries to make one read the other's data.
 *
 * ── WHY CUSTOM TOKENS ──
 * The Google sign-in provider needs a Console toggle we cannot script. Custom
 * tokens are always available, produce a genuine ID token through the real
 * Identity Toolkit endpoint, and exercise exactly the same server path: the
 * same verifyIdToken, the same auth_time freshness check, the same session
 * cookie. Only the popup is skipped, and the popup is not the security control.
 *
 * Creates test users and deletes them, and everything they wrote, at the end.
 *
 *   npm run dev          # in another terminal
 *   npm run test:e2e
 */

import { readFileSync } from 'node:fs';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Port 3200, not 3000 — another project on this machine owns 3000, and a
// reachability check that silently hits someone else's app is a bad time.
const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3200';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'aperture-journal';

function env(key) {
  if (process.env[key]) return process.env[key];
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

const WEB_KEY = env('NEXT_PUBLIC_FIREBASE_API_KEY');

const UIDS = { alice: 'e2e-alice-test', bob: 'e2e-bob-test' };

let pass = 0;
let fail = 0;
function ok(l, d = '') { console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`); pass++; }
function bad(l, d = '') { console.log(`  ✗ ${l}${d ? ` — ${d}` : ''}`); fail++; }
function section(n) { console.log(`\n${n}`); }

/**
 * `serviceAccountId` is required because createCustomToken signs LOCALLY, and
 * Application Default Credentials belonging to a human cannot sign as a
 * service account without being told which one to impersonate.
 *
 * On Cloud Run this is unnecessary — the runtime SA signs for itself, which is
 * the tokenCreator-on-itself binding granted in Day 0. This line exists purely
 * so the check can run from a laptop.
 */
if (!getApps().length) {
  initializeApp({
    projectId: PROJECT,
    serviceAccountId: process.env.E2E_SIGNER ?? `journal-runtime@${PROJECT}.iam.gserviceaccount.com`,
  });
}
const auth = getAuth();
const db = getFirestore();

/** Custom token -> real ID token -> httpOnly session cookie. */
async function signIn(uid, email) {
  await auth
    .updateUser(uid, { email, displayName: uid })
    .catch(() => auth.createUser({ uid, email, displayName: uid }));

  const customToken = await auth.createCustomToken(uid);

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const j = await r.json();
  if (!j.idToken) throw new Error(`custom token exchange failed: ${JSON.stringify(j).slice(0, 200)}`);

  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ idToken: j.idToken }),
  });
  if (!res.ok) throw new Error(`session mint failed: ${res.status}`);

  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(';')[0]).find((c) => c.startsWith('__session='));
  if (!cookie) throw new Error('no session cookie returned');

  await fetch(`${BASE}/api/auth/session`, {
    method: 'PUT',
    headers: { Cookie: cookie, Origin: BASE },
  });

  return cookie;
}

/**
 * Free-tier Gemini projects rate-limit hard, and this script fires six model
 * calls in a row. A short pause between them is the difference between testing
 * the app and testing the quota. Skipped with E2E_FAST=1 on a paid project.
 */
const pace = () =>
  process.env.E2E_FAST === '1' ? Promise.resolve() : new Promise((r) => setTimeout(r, 6000));

const call = (cookie, path, body, method = 'POST') =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: BASE },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function drain(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

console.log(`Aperture end-to-end (${BASE})`);

// ── Reachability ────────────────────────────────────────────────────────────
try {
  const r = await fetch(`${BASE}/sign-in`);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error(`\n✗ No server at ${BASE}. Start one with: npm run dev`);
  process.exit(1);
}

let aliceCookie, bobCookie, sessionId;

try {
  // ── Auth ─────────────────────────────────────────────────────────────────
  section('Authentication');
  aliceCookie = await signIn(UIDS.alice, 'alice@e2e.test');
  ok('alice signed in', 'session cookie minted');
  bobCookie = await signIn(UIDS.bob, 'bob@e2e.test');
  ok('bob signed in');

  const anon = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ message: 'hi', mode: 'reflect' }),
  });
  anon.status === 401 ? ok('unauthenticated chat rejected', '401') : bad('unauthenticated chat', `got ${anon.status}`);

  // ── Redirect integrity ───────────────────────────────────────────────────
  // A cookie that EXISTS but does not VERIFY used to loop forever: middleware
  // judges by presence and lets it through, the server judges by validity and
  // bounces it back to sign-in, where middleware sees the cookie again.
  //
  // The old test asserted ONE hop and passed. Following the redirects is the
  // whole point — a loop looks identical to a correct redirect until you do.
  section('Redirect integrity');
  {
    async function hops(path, cookie, limit = 10) {
      let url = `${BASE}${path}`;
      const chain = [];
      for (let i = 0; i < limit; i++) {
        const r = await fetch(url, {
          headers: cookie ? { Cookie: cookie } : {},
          redirect: 'manual',
        });
        if (r.status < 300 || r.status >= 400) return { chain, status: r.status };
        const next = r.headers.get('location');
        if (!next) return { chain, status: r.status };
        url = new URL(next, url).toString();
        chain.push(url);
      }
      return { chain, status: null, looped: true };
    }

    for (const [label, cookie] of [
      ['malformed cookie', '__session=stale.invalid.cookie'],
      ['expired cookie', `__session=${Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 })).toString('base64url')}.sig`],
    ]) {
      const r = await hops('/today', cookie);
      r.looped
        ? bad(label, `redirect loop — ${r.chain.length}+ hops`)
        : ok(label, `settles in ${r.chain.length} hop(s) at ${r.status}`);
    }

    const clean = await hops('/today', null);
    clean.looped
      ? bad('no cookie', 'redirect loop')
      : ok('no cookie', `settles in ${clean.chain.length} hop(s) at ${clean.status}`);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  section('Multi-turn conversation');
  const t0 = Date.now();
  const chat1 = await call(aliceCookie, '/api/chat', {
    message: 'I slept badly last night but I shipped the feature anyway. Still uneasy about the launch.',
    mode: 'reflect',
  });
  if (!chat1.ok) throw new Error(`chat failed ${chat1.status} ${await chat1.text()}`);
  sessionId = chat1.headers.get('X-Session-Id');
  const reply1 = await drain(chat1);
  reply1.trim()
    ? ok('turn 1 streamed', `${Date.now() - t0}ms, ${reply1.length} chars`)
    : bad('turn 1', 'empty reply');
  sessionId ? ok('session created', sessionId) : bad('session id', 'missing');

  await pace();
  const chat2 = await call(aliceCookie, '/api/chat', {
    message: 'Mostly that nobody will notice it at all.',
    mode: 'reflect',
    sessionId,
  });
  // Check the STATUS before the body. Draining a 503 yields its JSON error
  // payload, which is non-empty — so a body-only assertion reports success on
  // a failed call. A test that passes on an error response is worse than none.
  if (!chat2.ok) {
    bad('turn 2', `${chat2.status} ${(await chat2.text()).slice(0, 90)}`);
  } else {
    const reply2 = await drain(chat2);
    reply2.trim() ? ok('turn 2 streamed', 'multi-turn works') : bad('turn 2', 'empty reply');
  }

  const msgs = await db.collection(`users/${UIDS.alice}/sessions/${sessionId}/messages`).get();
  // 4 = two user turns plus two model replies.
  msgs.size === 4
    ? ok('persisted under alice', `${msgs.size} messages at users/${UIDS.alice}/…`)
    : bad('persistence', `expected 4 messages, got ${msgs.size}`);

  // ── Closing Ritual ───────────────────────────────────────────────────────
  section('The Closing Ritual');
  await pace();
  const sum = await call(aliceCookie, '/api/session/summarize', { sessionId });
  if (sum.ok) {
    const { insights } = await sum.json();
    ok('structured summary', `"${insights.title}"`);
    ok('mood extracted', `${insights.mood.label} (valence ${insights.mood.valence}, energy ${insights.mood.energy})`);
    ok('themes extracted', insights.themes.join(', '));
    insights.mood.valence < 0
      ? ok('valence sign correct', 'an uneasy session reads negative')
      : bad('valence sign', `got ${insights.mood.valence} for an uneasy session`);

    const doc = await db.doc(`users/${UIDS.alice}/sessions/${sessionId}`).get();
    const emb = doc.get('embedding');
    emb?.length === 768 ? ok('embedding stored', '768 dims') : bad('embedding', `got ${emb?.length}`);
  } else {
    bad('summarize', `${sum.status} ${(await sum.text()).slice(0, 120)}`);
  }

  // ── Today digest ─────────────────────────────────────────────────────────
  // The Today screen carries open loops forward from past sessions. Asserting
  // the rendered HTML because the value of this feature is that it SHOWS UP —
  // a query that returns loops nobody sees is the bug it was built to fix.
  section('Today digest');
  {
    const home = await fetch(`${BASE}/today`, { headers: { Cookie: aliceCookie } });
    const html = await home.text();

    home.ok ? ok('today renders', String(home.status)) : bad('today', String(home.status));
    html.includes('Still open')
      ? ok('open loops carried forward')
      : bad('open loops', 'section absent after a session with unresolved threads');
    html.includes('Lately') ? ok('recent sessions listed') : bad('recent sessions', 'absent');
    html.includes('Skip to writing')
      ? ok('skip link present')
      : bad('skip link', 'absent');
  }

  // ── Ask Your Past ────────────────────────────────────────────────────────
  section('Ask Your Past');
  await pace();
  const ask = await call(aliceCookie, '/api/ask', { question: 'What have I been uneasy about?' });
  if (ask.ok) {
    const answer = await drain(ask);
    const cites = JSON.parse(Buffer.from(ask.headers.get('X-Citations') ?? '', 'base64').toString() || '[]');
    answer.trim() ? ok('grounded answer', `${answer.length} chars`) : bad('answer', 'empty');
    cites.length ? ok('citations returned', `${cites.length}: ${cites.map((c) => c.title).join(', ')}`) : bad('citations', 'none');
    /\[\[[A-Za-z0-9_-]+\]\]/.test(answer)
      ? ok('inline citation markers present')
      : bad('citation markers', 'model did not cite inline');
  } else {
    bad('ask', `${ask.status} ${(await ask.text()).slice(0, 120)}`);
  }

  // ── Privacy Ledger ───────────────────────────────────────────────────────
  section('Privacy Ledger');
  const calls = await db.collection(`users/${UIDS.alice}/ai_calls`).get();
  calls.size > 0 ? ok('calls recorded', `${calls.size} rows`) : bad('ledger', 'empty');
  const purposes = [...new Set(calls.docs.map((d) => d.get('purpose')))].sort();
  ok('purposes logged', purposes.join(', '));
  const totalCost = calls.docs.reduce((n, d) => n + (d.get('estCostUsd') ?? 0), 0);
  totalCost > 0 ? ok('cost estimated', `$${totalCost.toFixed(6)}`) : bad('cost', 'all zero');

  // ── THE LEAK TEST ────────────────────────────────────────────────────────
  section('Cross-user isolation — the one that matters');

  const bobReads = await fetch(`${BASE}/session/${sessionId}`, { headers: { Cookie: bobCookie } });
  bobReads.status === 404
    ? ok("bob cannot open alice's session", '404 — indistinguishable from never existing')
    : bad('leak', `bob got ${bobReads.status} on alice's session`);

  const bobSummarize = await call(bobCookie, '/api/session/summarize', { sessionId });
  bobSummarize.status === 400
    ? ok("bob cannot summarize alice's session", '400')
    : bad('leak', `bob got ${bobSummarize.status} summarizing alice's session`);

  const bobSeal = await call(bobCookie, '/api/session/seal', {
    sessionId,
    messages: [{ id: 'x'.repeat(20), cipher: 'AAAAAAAAAAAAAAAAAAAAAA==' }],
  });
  bobSeal.status === 400
    ? ok("bob cannot seal alice's session", '400')
    : bad('leak', `bob got ${bobSeal.status} sealing alice's session`);

  const bobAsk = await call(bobCookie, '/api/ask', { question: 'What have I been uneasy about?' });
  if (bobAsk.status === 422) {
    ok("bob's retrieval finds nothing of alice's", '422 — his corpus is empty');
  } else if (bobAsk.ok) {
    const a = await drain(bobAsk);
    /uneasy|launch|slept|ship/i.test(a)
      ? bad('LEAK', "bob's answer references alice's content")
      : ok("bob's answer contains nothing of alice's");
  } else {
    ok("bob's ask rejected", String(bobAsk.status));
  }

  const bobSessions = await db.collection(`users/${UIDS.bob}/sessions`).get();
  bobSessions.size === 0 ? ok('bob has no sessions of his own', 'nothing bled across') : bad('bob', `${bobSessions.size} sessions`);

  // ── Data rights ──────────────────────────────────────────────────────────
  section('Data rights');
  const exp = await fetch(`${BASE}/api/account/export`, { headers: { Cookie: aliceCookie } });
  if (exp.ok) {
    const data = await exp.json();
    ok('export works', `${data.sessions?.length ?? 0} sessions, ${data.aiCalls?.length ?? 0} ledger rows`);
  } else {
    bad('export', String(exp.status));
  }
} catch (err) {
  bad('run aborted', String(err).slice(0, 200));
} finally {
  // ── Cleanup ──────────────────────────────────────────────────────────────
  section('Cleanup');
  for (const uid of Object.values(UIDS)) {
    try {
      await db.recursiveDelete(db.doc(`users/${uid}`));
      await auth.deleteUser(uid).catch(() => {});
      ok(`removed ${uid}`);
    } catch (e) {
      bad(`cleanup ${uid}`, String(e).slice(0, 80));
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
