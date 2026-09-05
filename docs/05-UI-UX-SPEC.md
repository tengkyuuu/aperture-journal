# UI/UX Design Contract — "Quiet Ink"

> **Status: implemented, and extended past the original contract.** See
> "What shipped beyond this contract" at the end.

## Design thesis

**This is a notebook, not a chatbot.** Every AI journaling app on the internet is a chat
bubble UI with a lavender gradient. Ours reads like a well-set book: serif prose, generous
measure, chrome that recedes until you need it. The writing *is* the interface.

Three rules that follow from that:
1. **No chat bubbles.** Typographic blocks with a hairline rule for the model's voice.
2. **No avatars, no "AI is thinking…" spinners.** A breathing dot. Stillness reads as calm.
3. **Latency becomes ceremony.** The summarize wait is reframed as a closing ritual, not a load.

---

## Tokens (three layers: primitive → semantic → component)

### Primitives

```css
/* ink (dark) */
--ink-950:#0B0B0C;  --ink-900:#141416;  --ink-800:#1C1C1F;
--ink-600:#3A3A40;  --ink-400:#6B6B75;  --ink-200:#A9A9B4;

/* paper (light) — warm, never clinical white */
--paper-50:#FAF8F4; --paper-100:#F3EFE7; --paper-200:#E7E1D5; --paper-300:#D6CEBD;

/* expressive */
--accent-500:#6B7BD6;  --accent-400:#8B99E6;   /* muted indigo — interaction */
--ember-500:#C8825A;                            /* vault / sealed state */
--sage-500:#6E9B7A;                             /* positive valence */
--clay-500:#C4736B;                             /* negative valence */
--danger-500:#D0574E;
```

### Semantic (dark-first; light mode remaps the same names)

```
--bg-canvas · --bg-surface · --bg-elevated · --border-subtle · --border-strong
--fg-primary · --fg-secondary · --fg-muted · --fg-onAccent
--accent · --sealed · --danger · --positive · --negative
```

Dark: canvas `#0B0B0C`, surface `#141416`, elevated `#1C1C1F`, fg-primary `#F3EFE7`.
Light: canvas `#FAF8F4`, surface `#FFFFFF`, elevated `#FFFFFF`, fg-primary `#141416`.

**Never define a colour only inside a media query.** Full light palette on bare `:root`,
overrides under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`,
then again under `:root[data-theme="dark"]` so the manual toggle wins both directions.

### Typography

| Role | Face | Spec |
|---|---|---|
| Journal prose | **Newsreader** (Google Fonts) | 18px / 1.7, measure 62–68ch |
| Display | **Newsreader** 300 | 40–56px, tight tracking |
| UI | **Inter** | 14px base, `-0.01em` on labels |
| Ledger / code | **JetBrains Mono** | 13px, tabular numerals |

Scale: 12 · 14 · 16 · 18 · 21 · 28 · 40 · 56.
Serif for what the human writes and what the model writes back; sans for controls. That split
is the entire personality of the product.

### Space, radius, elevation

Spacing 4pt base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
Radius: 6 controls · 12 cards · 20 sheets · 999 pills.
Elevation in dark = 1px `--border-subtle` + a 1px inner top highlight. **No heavy shadows in
dark mode** — they read as smudges. Light mode gets soft ambient shadows.

---

## Layout

| Breakpoint | Structure |
|---|---|
| ≥1280 | **Rail** 72px · **Timeline** 320px · **Canvas** fluid · **Drawer** 360px (collapsible) |
| 768–1279 | Rail + Canvas; Timeline becomes an overlay |
| <768 | Single column, bottom tab bar, Timeline as a bottom sheet |

Canvas max-width 68ch and centred, regardless of viewport. Wide content — the ledger table,
the constellation — scrolls inside its own `overflow-x:auto` container. The page body never
scrolls horizontally.

---

## Screens

**1 · Sign-in.** Full-bleed near-black. One line of Newsreader 300 at 44px: *"A private place
to think."* One Google button. A slowly drifting ambient gradient. No feature list, no
marketing copy. The restraint sets every expectation that follows.

**2 · Today.** The composer is the hero, pre-focused, with a rotating prompt-of-the-day as
placeholder. Beneath it: this week's Emotional Weather strip, then recent sessions as
typographic cards (title, first line, mood dot, timestamp).

**3 · Conversation canvas.** Messages as blocks, not bubbles. User text in serif at full
opacity; model text in serif with a 1px left rule in `--accent` at 30% and a small dot marker.
Streaming reveals in token-groups: opacity 0→1 plus a 2px rise, staggered 12ms, with a soft
caret. Mode selector as a quiet pill in the header. `⌘↵` sends, `⌘E` ends the session.

**4 · The Closing Ritual.** Ending a session does *not* show a spinner. The canvas dims, a
single dot breathes at 1.4s in/out, the word *distilling* fades in. Then the summary reveals
line by line — title, then summary, then bullets, then the mood chip and theme tags —
staggered 180ms. Roughly 2–3 seconds of deliberate ceremony that makes the wait feel
intentional. **This is signature moment #2.**

**5 · Insights.** Full-year Emotional Weather ribbon at the top. Theme Constellation below —
force-directed, click a node to filter. Chapters listed as reading cards.

**6 · Ask Your Past.** One search field, centred, nothing else on the page. The answer streams
in with inline citation chips; clicking a chip expands the source session inline beneath the
paragraph that cited it.

**7 · Vault.** Locked state shows real cards with their content redacted to a soft blur and an
ember wax-seal glyph. Unlock via a passphrase sheet. Sealing animates: the card content
blurs, an ember seal presses down with a 600ms weighted ease, the card locks.
**Signature moment #1.**

**8 · Security & Privacy.** The data-flow diagram from the architecture doc rendered live, the
ledger table in mono, and the two data-rights buttons. Delete requires typing the word.

---

## Motion

| Class | Duration | Easing |
|---|---|---|
| Micro (hover, focus) | 120ms | `cubic-bezier(0.2,0,0,1)` |
| Standard (panels, cards) | 200ms | `cubic-bezier(0.2,0,0,1)` |
| Sheet / drawer | 320ms | `cubic-bezier(0.2,0,0,1)` |
| The Seal | 600ms | weighted, slight overshoot |
| Breathing dot | 1400ms | `ease-in-out` infinite |

Framer Motion for everything; GSAP only if the constellation needs it. Every animation sits
behind a `prefers-reduced-motion` guard — reduced motion gets instant state changes, and the
Closing Ritual collapses to a simple fade that still shows the "distilling" copy.

---

## The three signature moments

1. **The Seal** — content blurs, ember seal presses, card locks. Then you cut to the Firestore
   console showing ciphertext.
2. **The Distillation** — the closing ritual reveal.
3. **The Weather** — a year of your inner life as one continuous gradient ribbon.

Judges remember moments, not feature lists. Build these three properly even if something else
ships rough.

---

## Accessibility — WCAG 2.2 AA, non-negotiable

- 4.5:1 body text, 3:1 UI components and graphical objects. Verify the ambient tint at both
  extremes of the mood range.
- `:focus-visible` ring: 2px `--accent`, 2px offset, on every interactive element.
- Full keyboard path: `⌘K` command palette · `⌘↵` send · `⌘E` end session · `Esc` lock vault ·
  arrow keys through the timeline.
- Streaming responses in an `aria-live="polite"` region, announced on completion rather than
  per token.
- **Mood is never colour-only** — every band, dot and chip carries a text label.
- Respect `prefers-reduced-motion` and `prefers-contrast`.
- Real `<button>` and `<a>` elements. Radix primitives via shadcn handle the rest.

---

## States — build all four for every surface

Empty · Loading · Error · Populated. The empty states carry the product's voice:

- **No sessions yet:** *"Nothing here yet. That's the right amount for a first day."*
- **Vault locked:** *"Sealed. Only your passphrase opens this — not us, not Gemini."*
- **No insights yet:** *"Patterns need a few entries before they show up. Keep going."*

First-run is a guided three-step first session, not a tooltip carousel.

---

## Build shortcut

Google **Stitch** is available as an MCP tool in this workspace and is a Google product —
using it for screen generation both accelerates Day 2 and strengthens the
"built with Google tooling" narrative. Suggested flow: create a design system from these
tokens, generate the eight screens from the descriptions above, then hand-build the three
signature moments (Stitch will not give you the seal animation or the closing ritual).

---

## What shipped beyond this contract

An audit against this document found three promises unbuilt and one piece of
dead code. Fixing them turned up a product gap worth more than any of them.

### Today is a home, not just a composer

The contract asked for the composer plus a weather strip and session cards. It
had only the composer. It now carries, **below** the composer in this order:

1. **Still open** — unresolved threads carried forward
2. **Last two weeks** — a compact weather strip and the writing streak
3. **Lately** — recent sessions as typographic cards

The order is the design. Putting the chart at the top would make this an
analytics page about a journal rather than a journal.

### Open loops — the gap the audit actually found

The summarizer has always extracted `openLoops`, stored them, and then never
shown them again outside the session that produced them. A journal that notices
an unresolved thread and forgets it has the failure mode it exists to prevent.

They now surface on Today, attributed to the session and date they came from.

Deliberately **not** a to-do list: no checkbox, no "done", no count remaining.
An open loop is a question worth sitting with, and an unchecked box would make
an unanswered question feel like a failure — the opposite of the point.

### The ambient mood tint was dead code

`--mood-tint` was defined in `globals.css` and consumed by `body`, and nothing
ever set it. It now drifts with the fortnight's mood, under three constraints
that make it safe rather than merely pretty:

- **Background only.** No text token moves, so no contrast ratio can degrade.
- **Mixed in `oklab` from the semantic tokens**, so it follows the theme rather
  than being a wash that looks wrong in one of them.
- **Capped at ~7%, and off entirely for a neutral fortnight.** A tint that is
  always on is a gradient; one that appears only when there is something to say
  is information.

### Keyboard-first, finally made discoverable

The shortcuts existed and were documented nowhere a user would look. `?` now
opens a reference — suppressed while typing, because stealing a question mark
mid-sentence in a journal would be unforgivable.

### Two more

- **Skip link.** Tabbing in previously meant traversing a five-item rail and a
  fifty-item session list before reaching the writing.
- **Timeline grouped by date** — Today, Yesterday, This week, then by month.
  "Yesterday" is a better landmark than a timestamp you have to convert.
- **A real favicon.** The tab showed the Next.js default, which is a small
  thing that looks unfinished in every screenshot.

All of it is covered by `npm run test:e2e`, which asserts the rendered HTML —
open loops that a query returns but nobody sees would be the exact bug this
work set out to fix.
