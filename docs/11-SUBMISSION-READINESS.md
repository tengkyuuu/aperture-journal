# Submission Readiness

Checked against the official checklist, not against my own plan. The official
list named requirements the original brief did not — read this before submitting.

---

## Status

| # | Requirement | Status |
|---|---|---|
| 1 | Cloud Run app live and publicly accessible | ✅ **Done** |
| 2 | Service labelled `dev-tutorial=cloud-run-ai-challenge` | ✅ **Done** |
| 3 | Repo public, with `README.md` and Firestore rules | ⛔ **BLOCKED — needs you** |
| 4 | Social post live with `#AccelerateAIwithCloudRun` | ⛔ **Needs you** |
| 5 | Every mandatory field in the Prototype Submission tab | ⛔ **Needs you** |

---

## 1 & 2 — Cloud Run ✅

**Live URL:** https://aperture-123144439483.asia-southeast1.run.app

```
$ gcloud run services describe aperture --region=asia-southeast1 \
    --format="value(metadata.labels)"

cloud.googleapis.com/location=asia-southeast1;
dev-tutorial=cloud-run-ai-challenge;      ← the required label
run.googleapis.com/satisfiesPzs=true
```

Deployed as a container rather than through App Hosting, deliberately: the
checklist asks for a **Cloud Run service with a specific label**, and deploying
directly makes that literal and verifiable. App Hosting would also have needed a
connected GitHub repo before it could deploy at all, which would have made
requirement 3 a blocker for requirements 1 and 2.

Runtime detail:

| | |
|---|---|
| Region | `asia-southeast1` — same as Firestore, so no cross-region hop |
| Identity | `journal-runtime@` — the least-privilege SA, not the default |
| Image | Multi-stage, Next `standalone`, non-root user, ~200MB |
| Scaling | min 0, max 3 — scales to zero, capped against a surprise bill |
| Secrets | Still fetched at runtime from Secret Manager. Nothing baked in. |

**The Cloud Run domain was added to Firebase authorized domains.** Without it the
Google sign-in popup fails in production with an unhelpful error — an easy thing
to discover during a live demo instead of before one.

### Verified against production, not localhost

```
$ E2E_BASE=https://aperture-...run.app npm run test:e2e
48 passed, 0 failed
```

The full suite ran against the deployed service: sign-in, streamed conversation,
structured summary, embeddings, grounded retrieval with citations, the ledger,
per-entry delete, and **bob 404ing on alice's session**. Production, not a
localhost approximation.

---

## 3 — Public repo ⛔ **This is the blocker**

**There is no git remote.** Twelve commits exist only on this laptop. The repo has
`README.md` and `firestore.rules` at the root, so the content requirement is met —
it just is not published anywhere.

`gh` is not installed, so this needs you. Either:

**With the GitHub CLI**
```bash
winget install GitHub.cli
gh auth login
gh repo create aperture-journal --public --source=. --remote=origin --push
```

**Or by hand** — create an empty public repo at github.com/new, then:
```bash
git remote add origin https://github.com/<you>/aperture-journal.git
git push -u origin master
```

> Note the branch is **`master`**, not `main`. If the form or a reviewer expects
> `main`: `git branch -M main` before pushing.

### Before you push

```bash
npm run verify:no-secrets -- --history
```

It scans **every commit**, not just the working tree — a key committed once and
deleted later is still published. Last run: clean across 12 commits, with the
only key-shaped string being the public Firebase web config value, which belongs
in the bundle.

---

## 4 & 5 — Yours

The social post and the submission form are yours. For the form, likely fields:

| Field | Answer |
|---|---|
| Live URL | https://aperture-123144439483.asia-southeast1.run.app |
| Repo | (after step 3) |
| Project | `aperture-journal`, region `asia-southeast1` |
| What it does | An authenticated journal where you think alongside Gemini, and every session is distilled into a summary, a mood and themes — with entries you can seal so that neither the server nor the model can read them. |
| Cloud Run service | `aperture` |
| Models | `gemini-3.1-flash-lite` (chat, synthesis), `gemini-embedding-001` (retrieval) |

---

## What to lead with

The demo has more in it than three minutes can hold. In order of what actually
lands:

1. **The Seal** — seal an entry, then open the Firestore console and show
   ciphertext. *"Gemini never sees this. Neither does my server."*
2. **The leak test** — two accounts side by side, one tries to open the other's
   entry, denied. Then the rules suite green. It is the only claim a judge
   watches get **tested** rather than asserted.
3. **The Distillation** — end a session and let the summary land.
4. **Ask Your Past** — a cited answer drawn from your own entries.
5. **The Security tab** — every model call, every token, every byte that left.

If there is time, the fifteen-second one: import `lib/server/secrets.ts` into a
client component and run the build. It fails with *"'server-only' cannot be
imported from a Client Component module."* That turns "we are careful with
secrets" into something the room watches fail.

---

## Known gaps, stated plainly

Judges reward calibration. These are in the README and the threat model already.

| Gap | Why it is acceptable |
|---|---|
| Gemini runs on a **free-tier** key from a different project | `aperture-journal` returns "prepayment credits are depleted" — separate from Cloud Billing, topped up at ai.studio. Swapping is one `gcloud secrets versions add`, no redeploy. |
| App Check wired but **not enforcing** | Needs a reCAPTCHA Enterprise site key from the Console. Enforcing without one locks every user out. |
| CSP allows `unsafe-inline` for **styles** | React writes style attributes; they cannot carry a nonce. Scripts are nonce-based. |
| Prompt injection detection is heuristic | It is an unsolved problem. The structural control is the delimiter plus the system rule. |
| Retrieval is in-memory cosine, not `findNearest` | Right for hundreds of sessions, wrong past a few thousand. One function to change. |
