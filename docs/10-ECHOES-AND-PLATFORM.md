# Roadmap — Echoes, and the whole web platform

> **Echoes is BUILT.** `app/api/echo/route.ts`, `components/journal/echoes.tsx`,
> 13 e2e assertions. What follows is the original design; the two notes marked
> **BUILT** record where the implementation departed from it.

The four graded requirements are done. The four enhancements are done. This is what would
make it unforgettable rather than merely complete.

---

## THE HEADLINE: Echoes

> **Your journal interrupts you — gently — when you have been here before.**

### The problem nobody names

Most journals are **write-only**. People stop journaling not because writing is hard but
because it goes nowhere: you pour something in, and the archive never speaks back. Every
"insights dashboard" is a report you have to remember to go and read.

Echoes inverts that. It brings the past to you, **at the exact moment it is relevant** — while
you are typing the thing you have typed before.

### What it looks like

You are writing. You pause. A small stamped card slides in beneath the composer:

```
┌─────────────────────────────────────────────┐
│ YOU'VE BEEN HERE                            │
│                                             │
│ "The job that fits badly"                   │
│ 14 March — 6 weeks ago                      │
│                                             │
│ You felt quite differently then: hopeful.   │
│                          [ READ IT ]  [ × ] │
└─────────────────────────────────────────────┘
```

The emotional delta is the interesting half. *"You have written about this four times since
June, and each time you were angrier"* is a thing no person and no chatbot can tell you. Only
a journal that remembers can.

### Why it is genuinely unique

Not "search your notes" — every notes app has search, and nobody uses it. The difference is
**unprompted, in-context, and about the delta**. It requires all three of: your own history,
embeddings over it, and a model that extracted mood at write time. We already built the last
two for other reasons. Echoes is what they were secretly for.

### How it works

```
draft text  ──debounce──▶  /api/echo
                             │  requireUid()
                             │  embed(draft, RETRIEVAL_QUERY)
                             │  cosine over THIS user's session vectors
                             │  filter: score ≥ 0.72
                             │          older than 7 days
                             │          not sealed, not this session
                             ▼
                     top 1–2 + mood delta
```

Almost all of it exists: `lib/server/retrieval.ts` does the search, `embed()` does the vector,
and every closed session already carries a 768-dim embedding and a mood.

**Trigger conditions**, tuned so it feels perceptive rather than twitchy:

| Condition | Why |
|---|---|
| Typing paused ≥ 2.5s | Interrupting mid-sentence is unforgivable |
| Draft ≥ 120 characters | Below that, everything looks like everything |
| ≥ 60 characters changed since last check | Stops it re-firing on the same thought |
| ≥ 20s since the last check | Free-tier rate limits, and restraint |
| Similarity ≥ 0.68 | Below this it surfaces noise and loses trust instantly |
| Match older than 7 days | "You wrote this yesterday" is not an insight |

**One wrong echo costs more than ten right ones.** A false positive makes the feature feel
stupid, and people stop reading them. The threshold should err high.

> **BUILT — 0.72 was the right instinct and the wrong number.** "Err high" was
> argued, not measured. Measuring it (`npm run calibrate:echo`) gave: same
> subject **0.729–0.773**, adjacent **0.597–0.636**, unrelated **0.539–0.554**.
> So 0.72 left **0.009** of headroom above the weakest true match, and the e2e
> assertion passed or failed depending on which summary the model happened to
> write that run. The bar is now **0.68** — the midpoint of the separable band,
> still far above an adjacent entry. A threshold defended by argument alone is a
> guess wearing a justification.

### ⚠ The privacy problem, and the answer

**This sends unsent text to an embedding model.** You are typing something you have not
committed to, may delete, and never intended to share — and we would be shipping it off the
device to look for matches.

That is a real escalation of what leaves the machine, and it is exactly the kind of thing this
whole project exists to refuse to do quietly. So:

1. **Opt-in, off by default.** A one-time explanation, in plain words, of what gets sent.
2. **A new ledger data class, `draft_text`**, so it appears in the Privacy Ledger like
   everything else. If it is happening, it is on the record.
3. **Never while the vault is unlocked.** If someone is writing under a sealed session, no
   draft leaves the browser, full stop.
4. **A visible indicator** in the composer while it is armed — never a silent background
   process.

That handling *is* the demo. Any team can bolt on a retrieval feature; showing that you noticed
it changed the privacy contract and dealt with it is the submission.

**Effort: ~4h.** Most of the machinery exists.

> **BUILT — no generation call.** The design implies asking a model for the mood
> delta. It does not: the delta is arithmetic over moods already stored, compared
> against the most recent entry that has one. Asking a model how someone's
> feelings changed invites it to invent a feeling they did not have, and this is
> a record, not a reading. It also means Echoes costs exactly one embedding call,
> which is what makes it viable on a free-tier key.

---

## Supporting feature: The Long Argument

> Pick a theme. See how your position on it actually changed, with the pivot points named.

Click **work** in the theme constellation and get a staged sequence:

```
JAN   "It's fine. I just need to get through Q1."
        ↓  something shifted around 12 Feb
MAR   "I keep telling people it's fine."
        ↓  you stopped saying fine
JUN   "I dismissed the option because it was embarrassing."
```

One `generateContent` call with a `responseSchema` over the theme's sessions, ordered by time.
The model identifies 2–4 positions you held, when each gave way, and what changed — every
claim cited back to the entry it came from.

This is the thing a journal is *for*, and nobody has ever had the patience to do it by hand.

**Effort: ~3h.** Retrieval and structured output already exist.

---

## Supporting feature: Voice

Speak instead of type — `SpeechRecognition`, on-device in Chrome, **zero API cost**.

The real prize is the second phase: send the **audio** to Gemini rather than the transcript, and
ask about delivery as well as words. How you sound and what you say diverge constantly, and the
gap is the interesting part. *"You said the week was fine, twice, and both times you trailed
off."*

**Effort: ~2h dictation, ~4h prosody.** Prosody costs real tokens; dictation costs nothing.

---

## Supporting feature: Passkey vault

The vault's honesty is also its cruelty: **forget the passphrase and the data is gone.**

WebAuthn's **PRF extension** derives a stable secret from an authenticator — Touch ID, Windows
Hello, a phone. Same zero-knowledge property, no passphrase to forget, and passkeys sync
through iCloud and Google Password Manager, so the secret survives a lost laptop.

Caveats, stated up front: PRF support is good in Chrome and uneven elsewhere, so the passphrase
stays as the fallback and as the recovery path. Two doors to the same key.

**Effort: ~5h**, and it is the most technically impressive thing on this list for a security
audience.

---

## The platform layer

Everything below is a real browser capability used for a reason, not a checklist.

### Offline and installable

| Capability | What it buys |
|---|---|
| **Service Worker + Cache API** | The app opens on a plane. A journal you cannot reach is not a journal. |
| **IndexedDB** | Drafts survive a crash, a closed tab, a dead battery. |
| **Background Sync** | Write offline; it posts itself when the network returns. |
| **Web App Manifest** | Installs to the dock and home screen. Journals belong next to your apps, not in a tab. |
| **`navigator.storage.persist()`** | Asks the browser not to evict those drafts under pressure. |

The offline draft store is the one that matters most. Losing an entry to a dropped connection
is the worst thing this app could do to someone.

### Trust and locking

| Capability | What it buys |
|---|---|
| **Idle Detection API** | Auto-lock the vault on real idleness, not a naive timer. |
| **Page Visibility** | Lock when the tab is hidden — the shared-laptop threat, which is the realistic one. |
| **Broadcast Channel** | Lock in one tab, locked in every tab. A vault open in a forgotten tab is not locked. |
| **Web Locks** | Stop two tabs racing the same session write. |

### Feel

| Capability | What it buys |
|---|---|
| **Vibration API** | A haptic tick on the mechanical press. The design is *about* physical keys; on a phone it can actually be felt. |
| **View Transitions API** | Cards morph between the timeline and the session they open. Continuity without a router animation library. |
| **Wake Lock** | The screen does not sleep while you are mid-thought. |
| **Speculation Rules** | Prefetch the session under the cursor. Opening an entry should be instant. |

### Reach

| Capability | What it buys |
|---|---|
| **Web Push** | The daily nudge, and Time Capsule delivery. |
| **Web Share** | Share a single insight card — never an entry. |
| **File System Access** | Export to a file *you* choose, not the downloads folder. |
| **Clipboard** | Copy a summary. Small, constantly wanted. |

### Time Capsule

Write to yourself, delivered on a date you pick. Cloud Scheduler fires a Web Push months
later. It is the only feature here that makes the app reach *out* to you, and it turns the
journal from a place you visit into a correspondence.

**Effort: ~3h** with push already wired.

---

## What I would deliberately NOT build

**Streaks, badges, a pixel garden that dies if you skip a day.** They would fit the pixel
aesthetic perfectly and they are wrong for this product. This app already refuses to render
open loops as an unchecked to-do list, for the stated reason that an unanswered question should
not feel like a failure. A wilting plant because someone had a bad fortnight is the same
mistake with better art. Journaling apps that gamify get used for eleven days.

**Mood prediction.** "You will probably feel low on Thursday" is unfalsifiable, potentially
self-fulfilling, and edges toward clinical claims the safety clause explicitly refuses.

**Sentiment scores shown as a number out of 100.** False precision on a fuzzy reading — the
same reason the weather strip became pixel blocks.

---

## Order of work

| # | Item | Effort | Why here |
|---|---|---|---|
| ~~1~~ | ~~**Echoes**~~ | ~~4h~~ | ✅ **BUILT** |
| 2 | Offline drafts + PWA | 4h | Protects against the worst failure: losing someone's writing. |
| 3 | The Long Argument | 3h | High payoff, low cost, reuses retrieval. |
| 4 | Voice dictation | 2h | Free, and changes who can use the app at all. |
| 5 | Haptics + View Transitions | 2h | Cheap; makes the brutalist design pay off on a phone. |
| 6 | Cross-tab vault locking | 2h | Closes a real hole in the current lock. |
| 7 | Passkey vault | 5h | Most impressive, largest risk, needs a fallback either way. |
| 8 | Time Capsule + Push | 3h | Delightful, but nothing else depends on it. |

**Echoes alone is the demo.** Items 2–6 make it feel like a product rather than a prototype.
