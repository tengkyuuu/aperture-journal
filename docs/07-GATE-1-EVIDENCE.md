# Gate 1 — Evidence Log

Day 1 delivers the trust boundary. This file records what was actually verified, what was
verified by proof rather than assertion, and what is still outstanding.

Keep it updated. At submission time it becomes the "map each requirement to the code that
satisfies it" page that makes a judge's job trivial.

---

## Verified ✅

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
