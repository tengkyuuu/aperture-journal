# Aperture — a Personal AI Journal

> An authenticated, end-to-end-encrypted journaling companion — designed security-first, from a
> written constitution down to the security rules. **Runs at $0**: Vercel Hobby, Firebase Spark,
> Groq and Cloudflare Workers AI free tiers, none of them with a card attached.

Originally a **Google Ideathon submission** on Cloud Run + Gemini; it moved off billed Google
Cloud services in November 2026. Planning docs live in [docs/](docs/) and describe the original
Google Cloud build.

---

## The four core requirements

| Requirement | Implementation |
|---|---|
| **Authentication** | Firebase Auth (Google) → server-verified ID token → httpOnly session cookie with revocation checking |
| **Multi-turn AI** | Streaming Groq (gpt-oss) conversations across four modes, with strict structured auto-summarization |
| **Isolated storage** | Path-scoped Firestore `/users/{uid}/…`, deny-by-default rules, write-through-server, automated cross-tenant tests |
| **Secret management** | Host-encrypted environment variables read only behind a `server-only` build guard; secret scanning of bundle and git history |

## The four enhancements

| Feature | What it does |
|---|---|
| **Zero-Knowledge Vault** | Client-side AES-GCM. Sealed entries are ciphertext the server cannot read and the AI never sees. |
| **Privacy Ledger + Injection Firewall** | Every model call logged to a per-user append-only ledger. Injection attempts detected and surfaced. |
| **Emotional Weather + Theme Graph** | Structured-output mood and theme extraction, rendered as a year-long gradient ribbon and a theme constellation. |
| **Ask Your Past** | Retrieval over your own entries with grounded, cited answers. |

### The headline: Echoes

> Your journal interrupts you — gently — when you have been here before.

Most journals are write-only. You pour something in and the archive never speaks
back, and every "insights dashboard" is a report you have to remember to go and
read. Echoes inverts that: while you are typing, if you pause, it looks for older
entries about the same thing and tells you what you called it then and how your
mood compares.

It needs your own history, embeddings over it, and a mood extracted at write
time. The first two were built for Ask Your Past and the third for the weather
ribbon — Echoes is what they were secretly for.

**It sends writing you have not submitted**, which is a real escalation of what
leaves the device. So it is off until you turn it on, the server enforces that
rather than the UI, it is ledgered as its own `draft_text` class, it never runs
while the vault is unlocked, and the composer says `echoes on` the entire time it
is watching. That handling is the point as much as the feature is.

The similarity bar is **measured, not argued** — `npm run calibrate:echo` scores
drafts in three bands (same subject 0.73–0.77, adjacent 0.60–0.64, unrelated
0.54–0.55) and the threshold sits at the midpoint of the gap.

---

## Planning documents

| Doc | Contents |
|---|---|
| [01 · AI Studio Constitution](docs/01-AI-STUDIO-CONSTITUTION.md) | **Phase 1 deliverable.** Paste-ready custom instructions + how to prove they shaped the build. |
| [02 · Architecture](docs/02-ARCHITECTURE.md) | Trust boundary, secret management, Gemini layer, STRIDE threat model, repo layout, stated tradeoffs. |
| [03 · Data Model & Rules](docs/03-DATA-MODEL-AND-RULES.md) | Firestore schema, complete `firestore.rules`, and the cross-tenant isolation test suite. |
| [04 · Features](docs/04-FEATURES.md) | Core requirements, the four enhancements, and the cut list. |
| [05 · UI/UX Spec](docs/05-UI-UX-SPEC.md) | Superseded "Quiet Ink" system — kept for the layout, screen inventory and accessibility contract, which still hold. |
| [06 · Sprint Runbook](docs/06-SPRINT-RUNBOOK.md) | Hour-by-hour 4-day plan with hard gates, demo script, and submission checklist. |
| [07 · Gate Evidence Log](docs/07-GATE-1-EVIDENCE.md) | What has been verified per gate, what is outstanding, and the deliberate deviations. |
| [08 · Submission Map](docs/08-SUBMISSION.md) | **Every requirement mapped to file:line**, the demo script, and the honestly stated limitations. |
| [11 · Submission Readiness](docs/11-SUBMISSION-READINESS.md) | **Checked against the official checklist.** What is done, what is blocked, and what to lead with. |
| [10 · Roadmap — Echoes](docs/10-ECHOES-AND-PLATFORM.md) | The headline feature that would make this unforgettable, the full web-platform layer, and what I would deliberately not build. |
| [09 · Design — Paper Cut](docs/09-DESIGN-PAPER-CUT.md) | **Current design system.** Neo-brutalism with pixels: rules, palette, primitives, and where the pixels actually earn their place. |

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4
Firebase Auth · Cloud Firestore (Spark plan) · hosted on Vercel Hobby
Groq via `groq-sdk` (chat, summaries, answers) · Cloudflare Workers AI `bge-m3` (embeddings)

| Piece | Free allowance | What happens at the limit |
|---|---|---|
| Groq `gpt-oss-120b`, fallback `gpt-oss-20b` | Per model: 30 req/min, 1K req/day, 8K tokens/min, 200K tokens/day | Fallback model takes over; then "The AI is busy" |
| Cloudflare Workers AI `bge-m3` | 10K neurons/day (≈9M embedded tokens) | Search and Echoes pause until 00:00 UTC |
| Firestore (Spark) | 50K reads, 20K writes/day, 1 GiB | Requests fail until the daily reset |
| Firebase Auth | Google sign-in, no cap that matters here | — |
| Vercel Hobby | Non-commercial use | — |

## Getting started

```bash
cp .env.local.example .env.local     # fill in keys — the file explains each one
npm install
npm run verify:ai                    # one real call to Groq and Cloudflare
npm run test:rules                   # 26 isolation tests (needs Java, see below)
npm run dev
```

`npm run test:rules` needs a JRE — the Firestore emulator is a Java process.

## Deploying for $0

1. Get a Groq key at console.groq.com/keys and a Cloudflare account id + API token with
   "Workers AI: Read" only. Neither needs a card.
2. In the Firebase console, generate a service-account key (Project settings → Service accounts).
3. Import the GitHub repo into Vercel. Add every variable from `.env.local.example` under
   Project → Settings → Environment Variables. Use base64 for `FIREBASE_SERVICE_ACCOUNT`.
4. Add the `*.vercel.app` domain to Firebase Auth → Settings → Authorized domains.
5. Once, after switching embedding models: `npm run reembed`, then `npm run calibrate:echo`
   and set `ECHO.minScore` in `lib/config.ts` to the midpoint it prints.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server on **port 3200** (3000 is taken by another project) |
| `npm test` | Vault crypto + cross-user isolation |
| `npm run test:vault` | 14 WebCrypto tests — round trip, wrong key, tampering, non-extractability |
| `npm run test:rules` | 26 isolation tests against the Firestore emulator (needs Java) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:contrast` | WCAG AA check of both themes, read from the shipped tokens |
| `npm run verify:ai` | One real call per request shape: streamed chat, strict summary, embedding |
| `npm run reembed` | Re-embeds every searchable session with the current model (`-- --dry` to count) |
| `npm run test:e2e` | Two real users through the whole app, then a leak attempt |
| `npm run verify:no-secrets` | Scans the built bundle for keys; add `-- --history` to scan every commit |
| `npm run emulators` | Firestore + Auth emulators for local development |
| `npm run calibrate:echo` | Measures where the Echoes similarity threshold should sit |
| `npm run logo` | Rebuilds every brand asset from `assets/logo-source.png` |

## Status

**Days 1-4 complete.** All four core requirements, all four enhancements, and the hardening
pass. See [08 · Submission Map](docs/08-SUBMISSION.md) for requirement-to-line mapping.

| | |
|---|---|
| Authentication | httpOnly session cookies, revocation-checked, no JS-readable credential |
| Multi-turn AI | Four modes, streamed, with structured auto-summarization |
| Isolated storage | Path-scoped tenancy, deny-by-default rules, 26 passing isolation tests |
| Secret management | Server-only env secrets behind a `server-only` build guard |
| Zero-Knowledge Vault | Client-side AES-256-GCM, 14 passing crypto tests |
| Privacy Ledger | Append-only record of every model call, plus real export and delete |
| Emotional Weather | Mood ribbon and theme constellation from structured output |
| Ask Your Past | Cited retrieval over your own summaries |
| Profile | Real stats from your own data, working preferences, and per-entry delete |
| Hardening | Nonce-based CSP, error boundaries, App Check wired, history secret-scan |

Verified locally, with no model call required: **40 tests green**, clean build, lint and
typecheck, route protection, CSRF rejection, forged-cookie rejection, no secrets in the bundle
or in git history.

Verified **against the live Gemini API** before the move: sign-in, streamed multi-turn
conversation, structured summaries with correct mood polarity, embeddings, grounded answers with
citations, the ledger, export, and bob 404ing on alice's session. Running it for real found
five bugs every offline check had passed — including a `notFound()` returning HTTP 200. All
fixed; details in [07 · Gate Evidence Log](docs/07-GATE-1-EVIDENCE.md).

**Not yet verified on Groq + Cloudflare:** run `npm run verify:ai`, then `npm run test:e2e`.
