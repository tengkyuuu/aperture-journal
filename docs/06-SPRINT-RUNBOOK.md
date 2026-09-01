# Sprint Runbook — 4 Days

Roughly 35 productive hours. Every day ends at a **gate**. A gate is binary: if it is not
green, you do not advance — you cut scope from the [cut list](04-FEATURES.md#the-cut-list) instead.

Commit at every ✅. Small commits are your undo button when you are tired.

---

## Day 0 — Foundation (~2h, the evening before)

**This is also Phase 1 of the challenge. Do it first, literally.**

1. Paste the Constitution into AI Studio → System Instructions. **Screenshot it.** ✅ *Deliverable 1 done.*
2. Bait it with three insecure prompts (see [01-AI-STUDIO-CONSTITUTION.md](01-AI-STUDIO-CONSTITUTION.md)).
   Screenshot the refusals — that is your proof Phase 1 shaped Phase 2.
3. Cloud setup:

```bash
gcloud auth login
gcloud projects create aperture-journal --name="Aperture"
gcloud config set project aperture-journal
# link billing (Blaze) in console

gcloud services enable \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  identitytoolkit.googleapis.com \
  generativelanguage.googleapis.com \
  run.googleapis.com \
  firebaseapphosting.googleapis.com

gcloud firestore databases create --location=asia-southeast1

# dedicated runtime identity — never the default SA
gcloud iam service-accounts create journal-runtime --display-name="Aperture runtime"

# the secret
printf 'YOUR_AI_STUDIO_KEY' | gcloud secrets create GEMINI_API_KEY --data-file=-

# least privilege: scoped to the SECRET, not the project
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:journal-runtime@aperture-journal.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding aperture-journal \
  --member="serviceAccount:journal-runtime@aperture-journal.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding aperture-journal \
  --member="serviceAccount:journal-runtime@aperture-journal.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"

# required for session-cookie signing
gcloud iam service-accounts add-iam-policy-binding \
  journal-runtime@aperture-journal.iam.gserviceaccount.com \
  --member="serviceAccount:journal-runtime@aperture-journal.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

4. **Set a billing budget alert at $10 and $25.** Do this before you write a single model call.
5. Scaffold:

```bash
npx create-next-app@latest aperture --ts --tailwind --app --eslint --src-dir=false
cd aperture && npx shadcn@latest init
npm i firebase firebase-admin @google/genai @google-cloud/secret-manager zod \
      framer-motion server-only
npm i -D @firebase/rules-unit-testing vitest
firebase init firestore emulators
```

6. `.gitignore` check, `git init`, first commit.

> **Gate 0:** AI Studio configured and screenshotted · `gcloud secrets versions access latest --secret=GEMINI_API_KEY` returns the key · budget alert live · app boots.

---

## Day 1 — The Boundary (~10h)

The unglamorous day. Everything downstream depends on it being right.

| Time | Work |
|---|---|
| 09:00–11:00 | **Auth.** Client Google sign-in → `POST /api/auth/session` verifies the ID token and mints an httpOnly session cookie → `middleware.ts` protects `(app)/*` → sign-out revokes. |
| 11:00–12:30 | **The primitives.** `lib/server/auth.ts` → `requireUid()`. `lib/server/secrets.ts` → `getSecret()`. Both with `import 'server-only'`. Prove the guard: temporarily import `secrets.ts` into a client component, watch the build fail, revert. |
| 13:30–15:30 | **Data + rules.** Firestore model, `firestore.rules`, and the full isolation suite from [03](03-DATA-MODEL-AND-RULES.md). **Get it green.** |
| 15:30–18:00 | **Gemini.** `POST /api/chat` — Zod validation, `requireUid()`, rate-limit check, streaming `generateContentStream`, persist both turns, write the ledger row. |
| 18:00–19:00 | Deliberately ugly chat UI. Unstyled. Only proving the pipe works end to end. |

> **Gate 1 (hard):** rules suite green · sign in → chat → both turns persisted under your uid ·
> a second browser profile cannot read the first user's session · production bundle contains no key.
>
> **Do not start Day 2 until every one of those is true.** This gate is the entire submission.

---

## Day 2 — The Product (~10h)

| Time | Work |
|---|---|
| 09:00–10:30 | Design tokens, Newsreader + Inter + JetBrains Mono, theme provider, dark/light, base shadcn components restyled. |
| 10:30–13:00 | App shell: rail · timeline · canvas · drawer. All three breakpoints. |
| 14:00–16:00 | **Conversation canvas.** Typographic blocks, streaming reveal, composer, mode selector, `⌘K` palette. |
| 16:00–18:00 | **Summarize route** with `responseSchema` → **the Closing Ritual** → session cards with mood dots. |
| 18:00–19:00 | Today screen, empty states, first-run flow. |

> **Gate 2:** all four core requirements are demoable *and look good*. If you are behind here,
> cut an enhancement now rather than shipping four half-built ones.

---

## Day 3 — The Differentiators (~10h)

Build in this order. It is the value-per-hour order, so whatever you run out of time for is
correctly the least important thing.

| Time | Work |
|---|---|
| 09:00–12:00 | **E1 Zero-Knowledge Vault.** WebCrypto PBKDF2 600k → AES-GCM, in-memory key context, seal/unseal, exclusion logic, the seal animation. |
| 13:00–15:00 | **E2 Privacy Ledger + Injection Firewall.** Security tab, ledger table, delimiters, heuristic detector, events feed, export/delete. |
| 15:00–17:00 | **E3 Emotional Weather + Theme Constellation.** Weather ribbon first — it is the one that matters. |
| 17:00–19:00 | **E4 Ask Your Past.** Embeddings on summarize, cosine retrieval route, citation chips. |

> **Gate 3:** all four enhancements demo end to end. Rough edges are acceptable; broken paths
> are not. Anything not working by 19:00 gets deleted from the demo script, not debugged at midnight.

---

## Day 4 — Ship (~5h)

| Time | Work |
|---|---|
| 09:00–11:00 | **Hardening.** Rate limits live · CSP + HSTS + nosniff + Referrer-Policy in `next.config.ts` · log redaction · error boundaries · audit every surface for its four states. |
| 11:00–12:30 | **Deploy** to Firebase App Hosting. Verify Secret Manager works in prod (not just locally). Smoke-test the full flow on the live URL. |
| 13:30–15:00 | **Rehearse the demo three times.** Record the 3-minute video. Capture screenshots. |
| 15:00–16:00 | README with the architecture diagram, threat model table, and tradeoffs. Assemble the submission package. |

> **Gate 4:** live URL works from a phone on cellular data · video recorded · README complete.

---

## The 3-minute demo script

Rehearse it. Timing is the difference between "impressive" and "ran out of time".

| Time | Beat |
|---|---|
| 0:00 | *"Most AI apps look great in a demo and leak in production. This one doesn't."* Sign in with Google. |
| 0:20 | Journal with Gemini. Multi-turn, streaming, switch to **Untangle** mode. |
| 0:50 | End the session → **The Distillation** → summary, mood, themes appear. |
| 1:10 | **Insights.** A year of Emotional Weather. Click a theme, watch the timeline filter. |
| 1:30 | **Ask Your Past.** *"What kept coming up in August?"* → cited answer, click a citation. |
| 1:50 | **The Seal.** Seal an entry. Cut to the Firestore console → ciphertext. *"Gemini never sees this. Neither does my server."* |
| 2:15 | **Security tab.** Every call, every token, every byte that left the device. |
| 2:30 | **The leak test.** Two browser profiles side by side. Paste user A's session URL into user B → denied. Then the rules suite, green. |
| 2:50 | Flash the AI Studio custom instructions. *"Constitution first. Then code."* |

**Practise the 2:30 beat most.** A live, visible cross-tenant denial is the single most
persuasive fifteen seconds in the whole submission.

---

## Submission package

- [ ] Public repo, clean history, no secrets (`git log -p | grep -i "AIza"` returns nothing)
- [ ] README: architecture diagram · threat model table · **stated tradeoffs and residual risks**
- [ ] Screenshot: AI Studio custom instructions
- [ ] Screenshots: 2–3 AI Studio refusals of insecure prompts
- [ ] Screenshot: rules test suite green
- [ ] 3-minute demo video
- [ ] Live URL
- [ ] One page mapping each of the four core requirements to the file and line that satisfies it

That last item costs twenty minutes and makes a judge's job trivially easy. Do not skip it.

---

## Standing risks

| Risk | Mitigation |
|---|---|
| Model IDs drift | Verify in AI Studio on Day 0. Centralise IDs in one config constant. |
| `createSessionCookie` signing error in prod | Grant `serviceAccountTokenCreator` on the SA to itself (Day 0, step 3). |
| App Hosting first deploy is slow / surprising | **Deploy a hello-world on Day 1, not Day 4.** Never let the first deploy be the final one. |
| Vault key lost mid-demo | Use a memorised throwaway passphrase. Seed the demo account the night before. |
| Ask Your Past has nothing to retrieve | Seed 15–20 realistic sessions on the demo account on Day 3 evening. |
| Cost blowout | Budget alerts (Day 0) · `maxOutputTokens` · per-uid daily quota · `maxInstances: 3`. |
| Fatigue-driven scope creep on Day 3 | The cut list is decided *now*, while rested. Obey it. |
