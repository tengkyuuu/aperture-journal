# Gate Evidence Log

Day 1 delivers the trust boundary. This file records what was actually verified, what was
verified by proof rather than assertion, and what is still outstanding.

Keep it updated. At submission time it becomes the "map each requirement to the code that
satisfies it" page that makes a judge's job trivial.

---

## Gate 1 — verified ✅

### 1. Cross-user isolation — 26/26 tests green

```
$ npm run test:rules

 RUN  v4.1.11
 Test Files  1 passed (1)
      Tests  26 passed (26)
   Duration  7.88s
```

Run against the real [`firestore.rules`](../firestore.rules) on the Firestore emulator, not a
mock. Includes 4 positive controls, so a rules file that denied everything could not pass.

**Screenshot this for the submission.**

### 2. No secret reaches the client bundle

```
$ npm run build && npm run verify:no-secrets

✓ Clean. Scanned 23 bundle files under .next/static.
  No API keys, private keys, or Secret Manager references in client output.
```

### 3. The `server-only` guard is a real build failure, not a convention

Temporarily importing [`lib/server/secrets.ts`](../lib/server/secrets.ts) from a client
component (`components/ugly-chat.tsx`) produces:

```
Error: Turbopack build failed with 39 errors:
./lib/server/secrets.ts:1:1

> 1 | import 'server-only';

'server-only' cannot be imported from a Client Component module.
It should only be used from a Server Component.
```

The boundary violation is caught at **compile time**. It cannot ship. Probe reverted.

**This is worth reproducing live during the demo** — it takes fifteen seconds and it turns
"we're careful about secrets" into something the room watches fail.

### 4. Typecheck and production build clean

```
$ npx tsc --noEmit     # exit 0
$ npm run build        # 7 routes, middleware 37.5 kB
```

---

## Outstanding — needs your Google Cloud project ⏳

These cannot be verified from this machine because they need a real project, a real secret,
and a real Google sign-in. They are the remainder of Gate 1.

| # | Step | How to verify |
|---|---|---|
| 1 | Day 0 cloud setup — project, APIs, Firestore, dedicated SA, IAM | [`docs/06-SPRINT-RUNBOOK.md`](06-SPRINT-RUNBOOK.md#day-0--foundation-2h-the-evening-before) |
| 2 | Create the secret | `printf 'KEY' \| gcloud secrets create GEMINI_API_KEY --data-file=-` |
| 3 | Fill `.env.local` from `.env.local.example` | Web config from Firebase Console → Project settings |
| 4 | Enable Google sign-in | Firebase Console → Authentication → Sign-in method |
| 5 | **Sign in → chat → persisted under your uid** | `npm run dev`, then check Firestore console for `/users/{uid}/sessions/…` |
| 6 | **Two browser profiles, no leakage** | Sign in as two accounts; confirm each sees only their own sessions |
| 7 | Budget alerts at $10 / $25 | GCP Console → Billing → Budgets |
| 8 | Hello-world deploy to App Hosting | **Do this on Day 1, not Day 4** — see the risk table |

Steps 5 and 6 are the live half of Gate 1. Do not start Day 2 until both pass.

---

## Local prerequisites installed

| Tool | Version | Note |
|---|---|---|
| Node | 24.14.1 | |
| npm | 11.11.0 | |
| Firebase CLI | 15.18.0 | |
| gcloud | 582.0.0 | |
| **OpenJDK** | **21.0.12.1** | Installed to `C:\Users\User\.jdks\jdk-21.0.12.1+1` — the Firestore emulator is a Java process. `JAVA_HOME` and `PATH` were set at **user scope**, so a **new terminal** is needed for `npm run test:rules` to work without setting them manually. |

---

## Known gaps, deliberately deferred

| Gap | Why it is acceptable now | When it closes |
|---|---|---|
| CSP still allows `'unsafe-inline'` for scripts | Next.js emits inline bootstrap; nonce + `strict-dynamic` is fiddly and not a Day 1 risk | Day 4 hardening |
| No Firebase App Check | Rules already prevent cross-user access; App Check raises the cost of automated abuse | Day 4 if time |
| Client reads go through the server, not realtime listeners | Simpler and strictly safer; rules permit owner reads so the upgrade needs no rules change | Day 2, via a short-lived custom token |
| Prompt-injection detection is heuristic | Prompt injection is unsolved; the structural control is the delimiter + system rule | Never fully — say so honestly |
| Node's OneDrive sync | `node_modules` inside a synced folder causes churn and occasional file locks | Consider excluding the folder in OneDrive settings |

---

# Gate 2 — The Product

Day 2 delivers the design system, the app shell, the conversation canvas, and the Closing
Ritual. All four core requirements are now demoable.

## Gate 2 — verified ✅

### 1. Build, typecheck, lint all clean

```
$ npx tsc --noEmit    # exit 0
$ npm run build       # 12 routes
$ npx next lint       # No ESLint warnings or errors
```

123 kB shared First Load JS, middleware 37.5 kB.

### 2. Route protection holds end to end

Booted the production server and exercised it:

| Check | Result |
|---|---|
| `GET /` with no cookie | `307` to `/sign-in` |
| `GET /today` with no cookie | `307` to `/sign-in` |
| `GET /sign-in` | `200`, renders headline, Google CTA, theme bootstrap |
| `POST /api/chat` unauthenticated | `401 unauthenticated` |
| `POST /api/session/summarize` unauthenticated | `401 unauthenticated` |
| `POST /api/chat` from `Origin: https://evil.example` | `400 bad_request` |
| `GET /today` with a **forged** session cookie | `307` to `/sign-in` |

The last two are the interesting ones.

**Cross-origin is rejected with 400 before the 401.** The origin check runs ahead of the auth
check, so an attacker's page cannot even learn whether a session exists.

**The forged cookie passes middleware and is then rejected.** That is the documented design
working as intended: middleware only sees that a cookie *exists* — the Edge runtime cannot run
firebase-admin — and `verifySessionCookie` in the Node runtime catches the forgery. Worth
demonstrating live; it shows the boundary is exactly where the comment says it is.

### 3. Security headers on every response

CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options`, and `Cache-Control: private, no-store`.

### 4. Isolation suite still green after the restructure

26/26, re-run after moving routes into `(auth)` and `(app)` groups.

### 5. Fonts self-hosted

19 woff2 files emitted by `next/font`. No runtime request to `fonts.googleapis.com` — one
fewer third party learning that someone opened their journal.

---

## Incident: the emulator port

The isolation suite went red mid-session with `{"detail":"Not Found"}` from
`loadFirestoreRules`. Cause: a Python/uvicorn app (`main.py`, PID 7372) bound `0.0.0.0:8080`
between test runs. On Windows both servers can hold the port, and the test was hardcoded to
8080 — so it was uploading rules to the wrong server entirely.

Two fixes, both kept:

1. The emulator moved to **port 8787** in `firebase.json`. Port 8080 is contested by half the
   dev tools ever written and was a poor default to have picked.
2. `tests/rules.test.ts` now reads `FIRESTORE_EMULATOR_HOST` rather than hardcoding, so it
   follows whatever `firebase.json` says — and it wraps the failure in a message naming the
   likely cause, instead of leaving the next person to decode a bare 404.

Stopping the Python app changes nothing here; the suite follows the config either way.

---

## Deliberate deviations from the UI plan

Three, each a considered trade rather than a shortcut, and all cheap to reverse.

| Planned | Shipped | Why |
|---|---|---|
| shadcn/ui + Radix | Hand-built components; native `<dialog>` for the palette | shadcn ships its own oklch token system that would fight Quiet Ink at every turn. The only primitive genuinely needed was a modal, and `showModal()` gives focus trapping, Esc, page inertness, and top-layer stacking from the platform — no portal, no z-index arms race. Five icons don't justify an icon library either; hand-drawn ones match the 1.5px hairlines used everywhere else. |
| Framer Motion | CSS keyframes | Every motion in the spec — word reveal, breathing dot, staggered rise — is a keyframe plus a delay. Framer would add roughly 50 kB to a 123 kB budget to express the same thing. |
| Four panes (rail, timeline, canvas, drawer) | Three panes; insights render inline | The Closing Ritual reads better *in the flow of the page* — the summary arrives where the conversation ended, not off to one side. The fourth pane lands on Day 3, when citations give it something that genuinely belongs there. |

## Gate 2 — still to verify with the live project

These ride along with the Gate 1 outstanding list; all need a real Google Cloud project.

- [ ] A streamed conversation renders with the word reveal
- [ ] **The Distillation** — end a session, watch the summary reveal
- [ ] A real model response validates against `InsightsSchema`
- [ ] Mood dot and themes appear on the timeline entry

---

# Gate 3 — The Differentiators

All four Phase 3 enhancements are implemented.

## Gate 3 — verified ✅

### 1. Vault crypto — 14/14 tests green

```
$ npm run test:vault

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Run against the same WebCrypto implementation the browser uses — Node exposes an
identical `crypto.subtle`, so this exercises the real code path rather than a mock.

The negative tests are the ones that matter:

| Test | Proves |
|---|---|
| A wrong passphrase cannot decrypt | The key actually gates the content |
| The same passphrase under a different salt cannot decrypt | The salt is doing its job |
| Tampered ciphertext throws | AES-GCM authenticates — a flipped byte is rejected, not silently rendered as nonsense |
| A truncated blob throws | No partial-decrypt path |
| The check blob contains no part of the passphrase | Verifying a passphrase leaks nothing |
| `key.extractable === false` and `exportKey` rejects | Not even our own JavaScript can read the key material back out, which caps what an XSS can steal |
| 50 salts, 50 distinct values | No accidental reuse |
| Identical plaintext encrypts differently twice | Fresh IV per call, so equal entries don't look equal |

**Screenshot this alongside the rules suite.**

### 2. Isolation suite still green after all four features

26/26, unchanged.

### 3. Every new endpoint rejects correctly

| Route | Unauthenticated | Cross-origin |
|---|---|---|
| `POST /api/ask` | `401` | `400` |
| `POST /api/vault/init` | `401` | `400` |
| `POST /api/session/seal` | `401` | `400` |
| `POST /api/account/delete` | `401` | `400` |
| `GET /api/account/export` | `401` | — |
| `/vault` `/insights` `/ask` `/security` | `307` to `/sign-in` | — |

### 4. Bundle scanner fixed and proven both ways

It was failing on the Firebase web API key — which is public by design and belongs in the
bundle. The allowance existed but read from `process.env`, and npm scripts do not load
`.env.local`. The scanner now reads that file itself.

Verified in both directions: the real public key passes, and a planted `AIza…` key in
`.next/static` still fails the run. An allowance that swallowed every key would be worse
than no scanner.

---

## What each enhancement actually does

### E1 · Zero-Knowledge Vault

PBKDF2-HMAC-SHA256 at 600,000 rounds derives a non-extractable AES-256-GCM key in the
browser. Sealing encrypts every message client-side and `POST`s ciphertext.

**The part that makes it real:** sealing also deletes the title, summary, insights, and
embedding in the same atomic batch. A summary is a lossy copy of the content and an embedding
is a lossy copy of the summary — sealing a session while leaving those behind would be
encryption theatre with the interesting part still sitting in the clear.

`/api/vault/init` refuses to overwrite an existing vault. Replacing the salt would silently
orphan every entry sealed under the old one: still present, never readable again.

No recovery, deliberately. An escrow would defeat the property. The UI makes you tick a box.

### E2 · Privacy Ledger + Injection Firewall

Every model call writes an append-only, client-unwritable row: route, model, purpose, token
counts, latency, estimated cost, and which classes of data were included. The Security page
renders it as plain English first and a table second.

Export produces real JSON including sealed entries **as ciphertext**, stated plainly — we
cannot decrypt them for the export either. Delete uses `recursiveDelete` so message
subcollections go too (the classic Firestore deletion bug), then removes the auth user —
Firestore first, so a partial failure can never orphan data under an unreachable uid.

### E3 · Emotional Weather + Theme Constellation

Colour is mixed in `oklab` between the two semantic tokens, so the ribbon follows the theme
instead of being a hardcoded rainbow. Mood always carries a text label; colour is never the
only encoding.

The constellation is a deterministic force simulation run to completion at render — no
animation loop, and the same journal produces the same picture every visit. A layout that
rearranges itself is decoration, not information.

### E4 · Ask Your Past

Embeddings are taken of the **summary, never the raw messages** — a summary is content the
user already agreed to have generated, and embedding raw entries would put a derivative of
every private sentence into a field built to be shipped around.

Retrieval is in-memory cosine over the user's own uid-scoped embeddings. No vector index, no
build-time dependency. The honest cost is documented: ~6 KB per session, so switch to
`findNearest` past a few thousand.

Retrieved entries are wrapped in delimiters with a data-not-instructions rule, because a
journal can contain anything its owner has ever pasted into it.

---

## Gate 3 — still needs the live project

Everything above is verified without a single Gemini call. What is not:

- [ ] A real seal, then the Firestore console showing `cipher: "…"` — **the demo moment**
- [ ] Unlock and read a sealed entry back
- [ ] The ledger populating with real token counts and costs
- [ ] The weather ribbon and constellation with real distilled sessions
- [ ] A cited answer from Ask Your Past
