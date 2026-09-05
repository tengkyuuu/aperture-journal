#!/usr/bin/env node
/**
 * End-to-end check of the secret path: Secret Manager -> Gemini.
 *
 * This is the one thing `verify:cloud` cannot tell you. A secret can exist,
 * have a version, and be readable by the right service account, and the key
 * inside it can still be wrong, revoked, or restricted to the wrong API. The
 * only way to know is to spend a token on it.
 *
 * The Secret Manager and Gemini calls are re-implemented here rather than
 * imported, because lib/server/* is guarded by `import 'server-only'` and will
 * not load outside Next. That guard is doing its job; this is the cost of it.
 *
 * The MODEL IDS, however, are imported from lib/config.ts — which carries no
 * such guard precisely so that a checker like this can share them. A verifier
 * with its own copy of the thing it verifies is worse than no verifier: this
 * script passed against `gemini-2.5-flash` long after the app had moved off it.
 *
 *   npm run verify:gemini
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenAI } from '@google/genai';

import { LIMITS, MODELS } from '../lib/config.ts';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'aperture-journal';
const SECRET = process.env.GEMINI_SECRET_NAME ?? 'GEMINI_API_KEY';

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label, detail = '') {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

console.log(`Gemini path check (${PROJECT})\n`);

let apiKey;
try {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT}/secrets/${SECRET}/versions/latest`,
  });
  apiKey = version.payload?.data?.toString();
  if (!apiKey) throw new Error('empty payload');
  ok('Secret Manager', `read ${SECRET}, ${apiKey.length} chars`);
} catch (err) {
  bad('Secret Manager', String(err).slice(0, 140));
  console.log('\n    Add a version:');
  console.log('    gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=' + PROJECT);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ── Chat ────────────────────────────────────────────────────────────────────
try {
  const started = Date.now();
  const res = await ai.models.generateContent({
    model: MODELS.chat,
    contents: 'Reply with exactly the word: ready',
    // The SAME config lib/server/gemini.ts sends. thinkingBudget: 0 is rejected
    // outright by gemini-3.6/3.8, so a checker that omits it would pass while
    // the app 400s on every message.
    config: {
      maxOutputTokens: LIMITS.maxOutputTokens,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = res.text?.trim();
  if (!text) {
    bad(MODELS.chat, 'replied with empty text — the model likely spent the budget on thinking');
  } else {
    ok(
      `${MODELS.chat}`,
      `"${text}" in ${Date.now() - started}ms, ${res.usageMetadata?.totalTokenCount ?? '?'} tokens`,
    );
  }
} catch (err) {
  const msg = String(err);
  bad(MODELS.chat, msg.slice(0, 160));
  if (msg.includes('400') && msg.includes('invalid argument')) {
    console.log('\n    A bare 400 on a chat call usually means thinkingBudget: 0.');
    console.log('    gemini-3.6-flash and 3.8-flash reject it. Drop it, or pin 3.5-flash.');
  }
  if (msg.includes('prepayment credits')) {
    console.log('\n    The key reaches the API but the project has no Gemini credits.');
    console.log('    This is separate from Cloud Billing — manage it at https://ai.studio/projects');
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    console.log('\n    The stored key is not accepted. If it was created with');
    console.log('    `gcloud services api-keys create`, check its API restriction includes');
    console.log('    generativelanguage.googleapis.com.');
  }
  if (msg.includes('SERVICE_DISABLED') || msg.includes('has not been used')) {
    console.log('\n    Run: gcloud services enable generativelanguage.googleapis.com --project=' + PROJECT);
  }
}

// ── Structured output — the Closing Ritual depends on this working ─────────
try {
  const res = await ai.models.generateContent({
    model: MODELS.chat,
    contents: 'The user wrote: "Slept badly, shipped the thing anyway."',
    config: {
      maxOutputTokens: 1600,
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, mood: { type: 'STRING' } },
        required: ['title', 'mood'],
      },
    },
  });
  const parsed = JSON.parse(res.text ?? '{}');
  ok('structured output', `title="${parsed.title}" mood="${parsed.mood}"`);
} catch (err) {
  bad('structured output', String(err).slice(0, 160));
}

// ── Embeddings — Ask Your Past depends on this working ─────────────────────
try {
  const res = await ai.models.embedContent({
    model: MODELS.embedding,
    contents: 'a test sentence about sleep and work',
    config: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' },
  });
  const values = res.embeddings?.[0]?.values;
  ok(MODELS.embedding, `${values?.length} dimensions`);
} catch (err) {
  bad(MODELS.embedding, String(err).slice(0, 160));
}

console.log(
  process.exitCode ? '\nSomething in the path is broken. See above.' : '\nThe whole path works.',
);
