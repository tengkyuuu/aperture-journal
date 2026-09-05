# Submission Map

Every graded requirement, mapped to the exact file and line that satisfies it.

This page exists so a judge never has to hunt. Line numbers are accurate as of the Day 4
commit; if they drift, the anchors are the function names.

---

## Phase 1 — AI Studio configured with security directives

| Deliverable | Where |
|---|---|
| The constitution, paste-ready | [`docs/01-AI-STUDIO-CONSTITUTION.md`](01-AI-STUDIO-CONSTITUTION.md) |
| Compact variant for short fields | same file, second block |
| How to prove it shaped the build | same file, final section — three prompts that should be refused |

**Screenshots to include:** the AI Studio settings panel, and two or three transcripts where it
*refused* an insecure request. The refusals are worth more than the instructions text: they
show Phase 1 actually constrained Phase 2.

---

## Phase 2 — the four core requirements

### 1 · User authentication (Firebase)

| Control | File | Line |
|---|---|---|
| `requireUid()` — **the only source of identity in the codebase** | [`lib/server/auth.ts`](../lib/server/auth.ts) | 56 |
| Session cookie verification with revocation checking | `lib/server/auth.ts` | 38 |
| `auth_time` freshness — a stale stolen ID token cannot be upgraded to a 5-day cookie | `lib/server/auth.ts` | 73 |
| `httpOnly` + `Secure` + `SameSite=Lax` cookie attributes | `lib/server/auth.ts` | 86 |
| `inMemoryPersistence` — the client SDK never writes a token to IndexedDB | [`lib/client/firebase.ts`](../lib/client/firebase.ts) | 54 |
| Token exchange endpoint | [`app/api/auth/session/route.ts`](../app/api/auth/session/route.ts) | 28 |
| Middleware documented as a redirect, **not** a boundary | [`middleware.ts`](../middleware.ts) | 8 |

**The claim:** after sign-in the browser holds no JavaScript-readable credential at all.
**How to check it:** sign in, open devtools, run `document.cookie` — the session cookie is not there.

### 2 · Multi-turn AI interaction (Gemini)

| Control | File | Line |
|---|---|---|
| `streamChat()` — streamed multi-turn generation | [`lib/server/gemini.ts`](../lib/server/gemini.ts) | 136 |
| Four persona system instructions + a safety clause applied to all of them | `lib/server/gemini.ts` | 42–104 |
| **History reloaded from Firestore, never trusted from the request body** | [`app/api/chat/route.ts`](../app/api/chat/route.ts) | 89 |
| Structured-output schema for the session summary | `lib/server/gemini.ts` | 198 |
| Model output re-validated before it touches the database | [`app/api/session/summarize/route.ts`](../app/api/session/summarize/route.ts) | 60 |

**The subtle one:** the client sends history for latency, but the server ignores it and reloads
under the verified uid. A client that can choose the history can choose what the model believes
it previously said.

### 3 · Isolated data storage (Firestore, zero cross-user leakage)

| Control | File | Line |
|---|---|---|
| Rules posture — read your own subtree, write nothing | [`firestore.rules`](../firestore.rules) | 28 |
| Deny by default on everything unmatched | `firestore.rules` | 47 |
| Path-scoped helpers with a stated security precondition | [`lib/server/db.ts`](../lib/server/db.ts) | 14 |
| 11 cross-user negative tests | [`tests/rules.test.ts`](../tests/rules.test.ts) | 145 |
| 7 write-through-server tests | `tests/rules.test.ts` | 220 |

**Evidence:** `npm run test:rules` → 26/26. Includes 4 positive controls, so a rules file that
denied everything could not pass.

### 4 · Secure key management (Secret Manager)

| Control | File | Line |
|---|---|---|
| `import 'server-only'` — a client import fails the **build** | [`lib/server/secrets.ts`](../lib/server/secrets.ts) | 1 |
| `getSecret()` with a 10-minute in-memory cache | `lib/server/secrets.ts` | 42 |
| `accessSecretVersion` against `versions/latest` | `lib/server/secrets.ts` | 46 |
| IAM scoped to the individual secret, not the project | [`docs/06-SPRINT-RUNBOOK.md`](06-SPRINT-RUNBOOK.md) Day 0 |
| `GEMINI_API_KEY` deliberately absent from deploy config | [`apphosting.yaml`](../apphosting.yaml) |

**Evidence:** `npm run build && npm run verify:no-secrets -- --history` — clean bundle *and*
clean git history.

---

## Phase 3 — the four enhancements

| # | Enhancement | Key line |
|---|---|---|
| E1 | **Zero-Knowledge Vault** — PBKDF2 600k rounds | [`lib/client/vault.ts:28`](../lib/client/vault.ts) |
| E1 | Non-extractable key — not even our own JS can read it back | `lib/client/vault.ts:62` |
| E1 | Sealing deletes summary, insights and embedding in the same batch | [`app/api/session/seal/route.ts:61`](../app/api/session/seal/route.ts) |
| E2 | **Privacy Ledger** — every model call recorded | [`lib/server/ledger.ts:53`](../lib/server/ledger.ts) |
| E2 | `recursiveDelete` so message subcollections are not orphaned | [`app/api/account/delete/route.ts:27`](../app/api/account/delete/route.ts) |
| E2 | Injection delimiters + data-not-instructions rule | [`lib/server/injection.ts:67`](../lib/server/injection.ts) |
| E3 | **Emotional Weather** — mood mixed in oklab between semantic tokens | [`components/insights/weather-ribbon.tsx:28`](../components/insights/weather-ribbon.tsx) |
| E3 | Deterministic force layout for the theme constellation | [`components/insights/theme-constellation.tsx`](../components/insights/theme-constellation.tsx) |
| E4 | **Ask Your Past** — embeds the summary, never raw messages | [`app/api/session/summarize/route.ts:73`](../app/api/session/summarize/route.ts) |
| E4 | Cosine retrieval over uid-scoped vectors | [`lib/server/retrieval.ts:26`](../lib/server/retrieval.ts) |

---

## Reproduce every claim

```bash
npm install
npm test                                  # 14 vault crypto + 26 isolation = 40
npm run build
npm run verify:no-secrets -- --history    # bundle and git history
npm run verify:cloud                      # IAM, secret scoping, no Owner/Editor
```

Then, live:

```bash
npm run dev
```

---

## Demo script — 3 minutes

| Time | Beat |
|---|---|
| 0:00 | *"Most AI apps look great in a demo and leak in production. This one doesn't."* Sign in with Google. |
| 0:20 | Journal with Gemini. Multi-turn, streaming, switch to **Untangle**. |
| 0:50 | End the session → **The Distillation** → summary, mood, themes. |
| 1:10 | **Insights.** Emotional Weather. Click a theme, watch the timeline filter. |
| 1:30 | **Ask Your Past.** *"What kept coming up in August?"* → cited answer, click a citation. |
| 1:50 | **The Seal.** Seal an entry. Cut to the Firestore console → `cipher: "k3Jd8x…"`. *"Gemini never sees this. Neither does my server."* |
| 2:15 | **Security tab.** Every call, every token, every byte that left the device. |
| 2:30 | **The leak test.** Two browser profiles. Paste user A's session URL into user B → denied. Then the rules suite, green. |
| 2:50 | Flash the AI Studio instructions. *"Constitution first. Then code."* |

**Rehearse 2:30 hardest.** A live cross-tenant denial is the most persuasive fifteen seconds
here — it is the one claim a judge watches get tested rather than asserted.

### Two more that land, if there is time

**The build-time guard.** Import `lib/server/secrets.ts` into a client component and run the
build. It fails with *"'server-only' cannot be imported from a Client Component module."*
Fifteen seconds, and it turns "we're careful with secrets" into something the room watches fail.

**The forged cookie.** Set `__session` to any garbage and load `/today`. It passes middleware —
which can only see that a cookie exists — and is rejected by `verifySessionCookie` in the Node
runtime. Shows the boundary is exactly where the comment says it is.

---

## Checklist

- [x] Public repo, clean history — verified by `verify:no-secrets -- --history`
- [x] README with architecture, threat model, and stated tradeoffs
- [x] This requirement → file:line map
- [ ] Screenshot: AI Studio custom instructions
- [ ] Screenshots: 2–3 AI Studio refusals of insecure prompts
- [x] Screenshot-ready: `npm test` → 40 passing
- [ ] 3-minute demo video
- [ ] Live URL

---

## Stated honestly

Judges notice calibration. These are in the README and the threat model already; do not hide
them in the demo.

1. **Prompt injection is unsolved.** The heuristics catch careless cases. The structural
   control is the delimiter plus the system rule, and that is defence in depth, not a
   guarantee.
2. **CSP still allows `unsafe-inline` for styles.** Scripts are nonce-based; style attributes
   cannot carry a nonce. Accepted, because the app renders no untrusted HTML anywhere.
3. **No `strict-dynamic`.** It would ignore the host allowlist and leave the Firebase Auth
   popup dependent on trust propagation — not something to discover on demo day.
4. **In-memory cosine, not Firestore vector search.** Right for hundreds of sessions, wrong
   past a few thousand. The upgrade is one function.
5. **App Check is wired but not enforcing.** It needs a reCAPTCHA Enterprise site key from the
   console. Enforcing without one would lock every user out.
6. **End-to-end encryption moves trust, it does not remove it.** A compromised client can read
   plaintext as you type. Sealing protects against a compromised server and database, which is
   the threat it claims to address.
