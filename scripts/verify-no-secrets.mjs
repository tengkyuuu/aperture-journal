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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '.next/static';

const PATTERNS = [
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'PEM private key', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Service account JSON', re: /"type"\s*:\s*"service_account"/ },
  { name: 'Secret Manager client', re: /SecretManagerServiceClient/ },
  { name: 'googleapis.com\/auth\/cloud-platform scope', re: /auth\/cloud-platform/ },
];

/** The public Firebase web API key is expected in the bundle and is not a secret. */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();

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
