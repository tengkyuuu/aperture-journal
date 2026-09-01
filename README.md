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
| `npm run test:rules` | Cross-user isolation suite against the Firestore emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:no-secrets` | Greps the built client bundle for keys — run after `npm run build` |
| `npm run emulators` | Firestore + Auth emulators for local development |

## Status

**Days 1-2 complete.** The trust boundary is in - auth, secrets, path-scoped tenancy, rate
limiting, the AI call ledger, injection heuristics, security headers - and so is the product
surface: the Quiet Ink design system, the three-pane shell, the conversation canvas with
streamed word reveal, the command palette, and the Closing Ritual driven by Gemini structured
output.

Verified locally: 26/26 isolation tests, clean build and lint, route protection, CSRF
rejection, forged-cookie rejection, and no secrets in the client bundle.

Still needed: a Google Cloud project for the live sign-in, chat and distil run. See
[07 - Gate Evidence Log](docs/07-GATE-1-EVIDENCE.md).

Day 3 next: the Zero-Knowledge Vault, Privacy Ledger, Emotional Weather, and Ask Your Past.
