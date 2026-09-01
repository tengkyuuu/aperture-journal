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

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · Framer Motion
Firebase Auth · Cloud Firestore · Firebase App Hosting (Cloud Run)
Google Cloud Secret Manager · Gemini via `@google/genai`

## Status

Planning complete. Implementation not started.
