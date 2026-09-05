#!/usr/bin/env node
/**
 * Gate check: prove no secret reached the client bundle.
 *
 * Two things are verified:
 *   1. No file under .next/static contains a Google API key pattern, a private
 *      key header, or a service-account JSON marker.
 *   2. No client bundle imports the Secret Manager client. (The `server-only`
 *      package already fails the build if that happens — this is the belt to
 *      that braces, and it produces an artifact you can screenshot.)
 *
 * Run after `npm run build`. Exits non-zero on any hit, so it can gate CI.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '.next/static';

const PATTERNS = [
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'PEM private key', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Service account JSON', re: /"type"\s*:\s*"service_account"/ },
  { name: 'Secret Manager client', re: /SecretManagerServiceClient/ },
  { name: 'googleapis.com\/auth\/cloud-platform scope', re: /auth\/cloud-platform/ },
];

/**
 * The Firebase web API key is expected in the bundle: it identifies the
 * project rather than authorising anything, and Firestore rules plus App Check
 * are what protect the data. It is the ONE value allowed to match.
 *
 * npm scripts do not load .env.local, so read it here. Note the allowance is
 * an exact string comparison against that single value — any other AIza-shaped
 * key still fails the check, which is the property that matters.
 */
function publicFirebaseKey() {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim();
  }
  if (!existsSync('.env.local')) return undefined;
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('NEXT_PUBLIC_FIREBASE_API_KEY='));
  return line?.slice('NEXT_PUBLIC_FIREBASE_API_KEY='.length).trim() || undefined;
}

const PUBLIC_KEY = publicFirebaseKey();

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else yield full;
  }
}

if (!existsSync(ROOT)) {
  console.error(`✗ ${ROOT} not found — run \`npm run build\` first.`);
  process.exit(1);
}

let hits = 0;
let scanned = 0;

for await (const file of walk(ROOT)) {
  if (!/\.(js|mjs|css|map|json|txt)$/.test(file)) continue;
  scanned++;

  const content = await readFile(file, 'utf8');

  for (const { name, re } of PATTERNS) {
    const match = content.match(re);
    if (!match) continue;

    // Allow the one value that is public by design.
    if (PUBLIC_KEY && match[0] === PUBLIC_KEY) continue;

    hits++;
    console.error(`✗ ${name} found in ${file}`);
    console.error(`  matched: ${match[0].slice(0, 12)}… (truncated)`);
  }
}

if (hits > 0) {
  console.error(`\n✗ FAILED — ${hits} finding(s) across ${scanned} bundle files.`);
  process.exit(1);
}

console.log(`✓ Clean. Scanned ${scanned} bundle files under ${ROOT}.`);
console.log('  No API keys, private keys, or Secret Manager references in client output.');

// ── Git history ─────────────────────────────────────────────────────────────
//
// Run with --history to also scan every commit. A key that was committed once
// and removed later is still in the history, and still leaked — deleting the
// line from the working tree fixes nothing.
//
// The Firebase web API key is expected here too: it is public config and lives
// in apphosting.yaml on purpose. Any OTHER key-shaped string fails.

if (process.argv.includes('--history')) {
  console.log('');
  let diff = '';
  try {
    diff = execSync('git log -p --all', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch {
    console.error('✗ Could not read git history.');
    process.exit(1);
  }

  const found = new Map();
  for (const { name, re } of PATTERNS) {
    if (name === 'Secret Manager client') continue; // legitimately in server source
    const global = new RegExp(re.source, 'g');
    for (const m of diff.matchAll(global)) {
      if (PUBLIC_KEY && m[0] === PUBLIC_KEY) continue;
      found.set(m[0], name);
    }
  }

  if (found.size > 0) {
    for (const [value, name] of found) {
      console.error(`✗ ${name} in git history: ${value.slice(0, 12)}… (truncated)`);
    }
    console.error(`
✗ FAILED — ${found.size} secret(s) present in commit history.`);
    process.exitCode = 1;
  } else {
    const commits = execSync('git rev-list --all --count', { encoding: 'utf8' }).trim();
    console.log(`✓ Git history clean across ${commits} commits.`);
    console.log('  The only key-shaped string is the public Firebase web config value.');
  }
}
