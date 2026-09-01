#!/usr/bin/env node
/**
 * Day 0 verification: is the cloud setup actually correct?
 *
 * Read-only. Changes nothing. Run it any time you suspect the environment
 * rather than the code — which, on a four-day sprint, is more often than you
 * would like.
 *
 *   npm run verify:cloud
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PROJECT = 'aperture-journal';
const SA = `journal-runtime@${PROJECT}.iam.gserviceaccount.com`;
const REGION = 'asia-southeast1';

const PASS = '  ✓';
const FAIL = '  ✗';
const WARN = '  !';

let failures = 0;
let warnings = 0;

/**
 * On Windows gcloud is a .cmd shim, and Node refuses to spawn .cmd without a
 * shell. So a shell it is — but we quote the arguments ourselves and pass one
 * string, rather than handing an array to shell:true and letting Node
 * concatenate them unescaped.
 *
 * Every argument in this file is a hardcoded literal, so this is hygiene
 * rather than a live injection risk. Worth doing anyway: scripts get copied.
 */
function sh(cmd, args) {
  const quoted = args.map((a) => `"${String(a).replace(/(["\\$`])/g, '\\$1')}"`).join(' ');
  try {
    return execSync(`${cmd} ${quoted}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const gcloud = (args) => sh('gcloud', args);

function check(label, ok, detail = '', hint = '') {
  if (ok) {
    console.log(`${PASS} ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.log(`${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
    if (hint) console.log(`      ${hint}`);
  }
}

function warn(label, detail, hint) {
  warnings++;
  console.log(`${WARN} ${label}${detail ? ` — ${detail}` : ''}`);
  if (hint) console.log(`      ${hint}`);
}

function section(name) {
  console.log(`\n${name}`);
}

console.log(`Aperture — cloud setup check (${PROJECT})`);

// ── Identity ────────────────────────────────────────────────────────────────
section('Account');

const account = gcloud(['config', 'get-value', 'account']);
check('gcloud authenticated', Boolean(account) && account !== '(unset)', account ?? '', 'Run: gcloud auth login');

const adc =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  `${process.env.APPDATA ?? process.env.HOME}/gcloud/application_default_credentials.json`;
check(
  'application default credentials',
  existsSync(adc),
  'needed for Firestore Admin + Secret Manager locally',
  'Run: gcloud auth application-default login',
);

// ── Project ─────────────────────────────────────────────────────────────────
section('Project');

const pnum = gcloud(['projects', 'describe', PROJECT, '--format=value(projectNumber)']);
check('project exists', Boolean(pnum), pnum ? `number ${pnum}` : '');

const billing = gcloud([
  'billing', 'projects', 'describe', PROJECT, '--format=value(billingEnabled)',
]);
check('billing linked', billing === 'True', '', 'Secret Manager and App Hosting both require it');

// ── APIs ────────────────────────────────────────────────────────────────────
section('APIs');

const enabled = new Set(
  (gcloud(['services', 'list', '--enabled', `--project=${PROJECT}`, '--format=value(config.name)']) ?? '')
    .split('\n')
    .map((s) => s.trim()),
);

for (const api of [
  'firestore.googleapis.com',
  'secretmanager.googleapis.com',
  'identitytoolkit.googleapis.com',
  'generativelanguage.googleapis.com',
  'firebaseapphosting.googleapis.com',
]) {
  check(api, enabled.has(api), '', `Run: gcloud services enable ${api} --project=${PROJECT}`);
}

// ── Firestore ───────────────────────────────────────────────────────────────
section('Firestore');

const dbLoc = gcloud([
  'firestore', 'databases', 'describe', '--database=(default)',
  `--project=${PROJECT}`, '--format=value(locationId)',
]);
check('database exists', Boolean(dbLoc), dbLoc ?? '');
if (dbLoc && dbLoc !== REGION) {
  warn('region', `${dbLoc}, expected ${REGION}`, 'A database location is permanent — recreate only if you must.');
}

// ── Service account and IAM ─────────────────────────────────────────────────
section('Runtime identity');

check('service account exists', Boolean(gcloud(['iam', 'service-accounts', 'describe', SA, `--project=${PROJECT}`])), SA);

const roles = (
  gcloud([
    'projects', 'get-iam-policy', PROJECT,
    '--flatten=bindings[].members',
    `--filter=bindings.members:${SA}`,
    '--format=value(bindings.role)',
  ]) ?? ''
)
  .split('\n')
  .map((r) => r.trim())
  .filter(Boolean);

check('roles/datastore.user', roles.includes('roles/datastore.user'));
check('roles/firebaseauth.admin', roles.includes('roles/firebaseauth.admin'));

// The point of least privilege is that these are ABSENT — but "absent" must
// mean "we looked and they were not there", not "we could not read the policy".
// An empty roles list passing this check would be a lie of omission.
const overreach = roles.filter((r) => ['roles/owner', 'roles/editor'].includes(r));
check(
  'no Owner or Editor on the runtime identity',
  roles.length > 0 && overreach.length === 0,
  roles.length === 0
    ? 'could not read the IAM policy — check not performed'
    : overreach.length
      ? `found ${overreach.join(', ')}`
      : `least privilege holds across ${roles.length} role(s)`,
);

// ── Secret ──────────────────────────────────────────────────────────────────
section('Secret Manager');

check('GEMINI_API_KEY secret exists', Boolean(gcloud(['secrets', 'describe', 'GEMINI_API_KEY', `--project=${PROJECT}`])));

const versions = (
  gcloud([
    'secrets', 'versions', 'list', 'GEMINI_API_KEY',
    `--project=${PROJECT}`, '--filter=state:ENABLED', '--format=value(name)',
  ]) ?? ''
).split('\n').filter(Boolean);

check(
  'secret has an enabled version',
  versions.length > 0,
  versions.length ? `${versions.length} version(s)` : 'empty',
  'Add one WITHOUT putting the key in your shell history:\n' +
    '      gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=aperture-journal\n' +
    '      (paste the key, then press Ctrl+Z and Enter on Windows / Ctrl+D elsewhere)',
);

const secretPolicy =
  gcloud([
    'secrets', 'get-iam-policy', 'GEMINI_API_KEY',
    `--project=${PROJECT}`, '--format=value(bindings.members)',
  ]) ?? '';
check(
  'runtime SA can read the secret',
  secretPolicy.includes(SA),
  'bound on the secret itself, not project-wide',
);

// ── Auth provider ───────────────────────────────────────────────────────────
section('Authentication');

const token = gcloud(['auth', 'print-access-token']);
if (!token) {
  warn('could not fetch an access token', '', 'Skipping the sign-in provider check.');
} else {
  const idp = sh('curl', [
    '-s', '-H', `Authorization: Bearer ${token}`, '-H', `X-Goog-User-Project: ${PROJECT}`,
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/defaultSupportedIdpConfigs`,
  ]);

  let googleEnabled = false;
  try {
    const parsed = JSON.parse(idp ?? '{}');
    googleEnabled = (parsed.defaultSupportedIdpConfigs ?? []).some(
      (c) => c.name?.endsWith('google.com') && c.enabled,
    );
  } catch {
    /* leave false */
  }

  check(
    'Google sign-in enabled',
    googleEnabled,
    '',
    'The API cannot provision the OAuth client — this one is a Console toggle:\n' +
      `      https://console.firebase.google.com/project/${PROJECT}/authentication/providers`,
  );
}

// ── Local config ────────────────────────────────────────────────────────────
section('Local config');

const hasEnv = existsSync('.env.local');
check('.env.local present', hasEnv, '', 'Re-run the setup, or copy .env.local.example and fill it in');

if (hasEnv) {
  const env = readFileSync('.env.local', 'utf8');
  for (const key of [
    'GOOGLE_CLOUD_PROJECT',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ]) {
    check(key, new RegExp(`^${key}=.+$`, 'm').test(env));
  }

  // The whole architecture exists to keep this out of here.
  check(
    'no Gemini key leaked into .env.local',
    !/AIza[0-9A-Za-z_-]{35}/.test(env.replace(/^NEXT_PUBLIC_FIREBASE_API_KEY=.*$/m, '')),
    'the Gemini key belongs in Secret Manager',
  );
}

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`All checks passed${warnings ? ` (${warnings} warning${warnings > 1 ? 's' : ''})` : ''}. Run: npm run dev`);
} else {
  console.log(`${failures} check${failures > 1 ? 's' : ''} failed. Fix the hints above, then re-run.`);
  process.exitCode = 1;
}
