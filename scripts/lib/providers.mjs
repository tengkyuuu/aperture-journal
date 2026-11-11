/**
 * Shared setup for the maintenance scripts: env loading, Firebase Admin, and
 * the same Cloudflare embedding call the app makes (lib/server/ai.ts).
 *
 * npm scripts do not load .env.local, so it is loaded here. Variables already
 * set in the shell win.
 */

import { existsSync } from 'node:fs';

import { cert, getApps, initializeApp } from 'firebase-admin/app';

import { MODELS } from '../../lib/config.ts';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export const PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  'aperture-journal';

/** Read a required env var, or stop with a message that says where to put it. */
export function need(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.local.example).`);
    process.exit(1);
  }
  return value;
}

/** Same credential rules as lib/server/firebase-admin.ts. */
export function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const credential = raw
    ? cert(JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')))
    : undefined;
  initializeApp({ projectId: PROJECT, ...(credential ? { credential } : {}) });
}

export const EMBED_DIMS = 1024;

function normalise(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map((x) => x / n);
}

export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Embed up to ~50 texts in one request. Returns unit vectors, in order. */
export async function embedMany(texts) {
  const account = need('CLOUDFLARE_ACCOUNT_ID');
  const token = need('CLOUDFLARE_API_TOKEN');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODELS.embedding}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, truncate_inputs: true }),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const rows = body.result?.data ?? body.result?.response;
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new Error('EMBED_EMPTY');
  for (const r of rows) if (r.length !== EMBED_DIMS) throw new Error(`EMBED_SHAPE ${r.length}`);
  return rows.map(normalise);
}

export async function embedOne(text) {
  return (await embedMany([text]))[0];
}
