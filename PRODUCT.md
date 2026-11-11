# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A small group of friends invited by the owner. Most have never used a journaling app with an
AI in it, arrive through a shared link, and have no one standing next to them to explain it, so
every screen has to explain itself.

They use it at a desk on a laptop, in longer sessions, to think something through properly
rather than to log a quick note. Phone use exists (the app is fully responsive) but is not the
primary scene.

## Product Purpose

A private journal you think out loud in. You write; an AI answers with one question at a time
to help you work the thought through. When you end the session, the conversation is turned into
a short summary with a mood, themes, open questions and one small thing to try, and kept.
Over time those summaries become something you can look back on and ask questions of.

Success: a first-time visitor understands the write → talk → end session loop without help,
finishes a session, and comes back to read or ask about what they wrote.

## Positioning

Most journals are write-only, and most AI chat forgets you. Aperture keeps a structured record
of every finished conversation and lets your own past speak back: "Ask your past" answers only
from your entries with citations, and Echoes points out when you are writing about something
you have written about before.

It is also unusually honest about privacy: a per-user list of every request sent to the AI,
optional client-side encryption ("sealing") that even the server cannot read, and real
export and delete.

## Operating Context

- Core loop: Today → write → AI asks a question (four modes: Reflect, Brainstorm, Untangle,
  Rubber Duck) → End session → distilled summary saved under Sessions.
- Supporting surfaces: Insights (mood over time, recurring themes), Ask your past, Vault
  (sealing), Security (AI request log, warnings, export, delete), Profile (settings, Echoes).
- First-run guided tour, Help sheet with a glossary, and "?" explainers next to invented terms.
- Runs at $0: Vercel Hobby, Firebase Auth and Firestore on the free plan, Groq for text,
  Cloudflare Workers AI for search. Free-tier rate limits are real and the UI must handle
  "the AI is busy" gracefully.

## Capabilities and Constraints

- Next.js 15 App Router, React 19, Tailwind v4, TypeScript.
- Terminology the product keeps, always explained where it appears: entry/session, distilled,
  still open, modes, seal/vault, echoes, ask your past.
- Not a therapist or crisis service; the AI stops and points to real help on any sign of harm.
- Sealed entries have no summary and are excluded from search by design.

## Brand Commitments

- The name "Aperture" stays.
- The pink bubble-letter logo (`public/logo*.webp`, source `assets/logo-source.png`) stays.
- The current neo-brutalist look (thick outlines, hard offset shadows, pixel labels) is not a
  commitment and may be replaced.
- Must never feel clinical (therapy app, wellness dashboard) or cute/childish (bubbly,
  mascot-heavy, sticker-book).

## Evidence on Hand

- No real testimonials, user counts or press. Do not invent any.
- Demo content can be generated with `npm run seed` and must be labelled as sample data.

## Product Principles

1. Explain before you impress: a stranger with a link must understand what to do next on every
   screen.
2. The writing is the interface; everything else sits below it.
3. Say exactly what leaves the device, every time.
4. Remember the person, not just the conversation.
5. Warm but adult: neither a clinic nor a toy.

## Accessibility & Inclusion

WCAG AA contrast in both themes (`npm run verify:contrast`), full keyboard use, reduced-motion
support (OS setting plus an in-app override), touch targets of at least 44px on phones.
