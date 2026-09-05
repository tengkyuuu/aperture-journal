# Aperture — a Personal Gemini Journal

> An authenticated, end-to-end-encrypted journaling companion built on Gemini, Firebase and
> Google Cloud — designed security-first, from a written constitution down to the security rules.

**Google Ideathon submission.** Planning docs live in [docs/](docs/).

---

## The four core requirements

| Requirement | Implementation |
|---|---|
| **Authentication** | Firebase Auth (Google) → server-verified ID token → httpOnly session cookie with revocation checking |
| **Multi-turn AI** | Streaming Gemini conversations across four modes, with structured auto-summarization |
| **Isolated storage** | Path-scoped Firestore `/users/{uid}/…`, deny-by-default rules, write-through-server, automated cross-tenant tests |
| **Secret management** | Runtime retrieval from Google Cloud Secret Manager, memory-cached, `server-only` build guard, secret-scoped IAM |

## The four enhancements

| Feature | What it does |
|---|---|
| **Zero-Knowledge Vault** | Client-side AES-GCM. Sealed entries are ciphertext the server cannot read and Gemini never sees. |
| **Privacy Ledger + Injection Firewall** | Every model call logged to a per-user append-only ledger. Injection attempts detected and surfaced. |
| **Emotional Weather + Theme Graph** | Structured-output mood and theme extraction, rendered as a year-long gradient ribbon and a theme constellation. |
| **Ask Your Past** | Retrieval over your own entries with grounded, cited answers. |

---

## Planning documents

| Doc | Contents |
|---|---|
| [01 · AI Studio Constitution](docs/01-AI-STUDIO-CONSTITUTION.md) | **Phase 1 deliverable.** Paste-ready custom instructions + how to prove they shaped the build. |
| [02 · Architecture](docs/02-ARCHITECTURE.md) | Trust boundary, secret management, Gemini layer, STRIDE threat model, repo layout, stated tradeoffs. |
| [03 · Data Model & Rules](docs/03-DATA-MODEL-AND-RULES.md) | Firestore schema, complete `firestore.rules`, and the cross-tenant isolation test suite. |
| [04 · Features](docs/04-FEATURES.md) | Core requirements, the four enhancements, and the cut list. |
| [05 · UI/UX Spec](docs/05-UI-UX-SPEC.md) | "Quiet Ink" design system, tokens, eight screens, three signature moments, accessibility contract. |
| [06 · Sprint Runbook](docs/06-SPRINT-RUNBOOK.md) | Hour-by-hour 4-day plan with hard gates, demo script, and submission checklist. |
| [07 · Gate Evidence Log](docs/07-GATE-1-EVIDENCE.md) | What has been verified per gate, what is outstanding, and the deliberate deviations. |
| [08 · Submission Map](docs/08-SUBMISSION.md) | **Every requirement mapped to file:line**, the demo script, and the honestly stated limitations. |

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · Framer Motion
Firebase Auth · Cloud Firestore · Firebase App Hosting (Cloud Run)
Google Cloud Secret Manager · Gemini via `@google/genai`

## Getting started

```bash
cp .env.local.example .env.local     # fill in the public Firebase web config
npm install
npm run test:rules                   # 26 isolation tests (needs Java, see below)
npm run dev
```

The Gemini API key does **not** go in `.env.local`. Create it in Secret Manager:

```bash
printf 'YOUR_AI_STUDIO_KEY' | gcloud secrets create GEMINI_API_KEY --data-file=-
```

`npm run test:rules` needs a JRE — the Firestore emulator is a Java process.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Vault crypto + cross-user isolation |
| `npm run test:vault` | 14 WebCrypto tests — round trip, wrong key, tampering, non-extractability |
| `npm run test:rules` | 26 isolation tests against the Firestore emulator (needs Java) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:cloud` | Read-only check of the whole Google Cloud setup |
| `npm run verify:gemini` | Secret Manager to Gemini: chat, structured output, embeddings |
| `npm run test:e2e` | Two real users through the whole app, then a leak attempt |
| `npm run verify:no-secrets` | Scans the built bundle for keys; add `-- --history` to scan every commit |
| `npm run emulators` | Firestore + Auth emulators for local development |

## Status

**Days 1-4 complete.** All four core requirements, all four enhancements, and the hardening
pass. See [08 · Submission Map](docs/08-SUBMISSION.md) for requirement-to-line mapping.

| | |
|---|---|
| Authentication | httpOnly session cookies, revocation-checked, no JS-readable credential |
| Multi-turn AI | Four modes, streamed, with structured auto-summarization |
| Isolated storage | Path-scoped tenancy, deny-by-default rules, 26 passing isolation tests |
| Secret management | Runtime Secret Manager retrieval behind a `server-only` build guard |
| Zero-Knowledge Vault | Client-side AES-256-GCM, 14 passing crypto tests |
| Privacy Ledger | Append-only record of every model call, plus real export and delete |
| Emotional Weather | Mood ribbon and theme constellation from structured output |
| Ask Your Past | Cited retrieval over your own summaries |
| Hardening | Nonce-based CSP, error boundaries, App Check wired, history secret-scan |

Verified locally, with no model call required: **40 tests green**, clean build, lint and
typecheck, route protection, CSRF rejection, forged-cookie rejection, no secrets in the bundle
or in git history.

Verified **against the live API**: sign-in, streamed multi-turn conversation, structured
summaries with correct mood polarity, 768-dim embeddings, grounded answers with citations, the
ledger, export, and bob 404ing on alice's session. Running it for real found five bugs every
offline check had passed — including a `notFound()` returning HTTP 200. All fixed; details in
[07 · Gate Evidence Log](docs/07-GATE-1-EVIDENCE.md).

Remaining before a demo: **paid Gemini access** (the free-tier daily quota is the only
blocker) and the Google sign-in Console toggle.
