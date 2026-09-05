# Design System — "Paper Cut"

> **Current system.** Supersedes ["Quiet Ink"](05-UI-UX-SPEC.md), which is kept as
> the record of what came before and why this replaced it.

Neo-brutalism, with pixels, for a journal.

---

## The tension, and how it is resolved

Neo-brutalism is loud. This app is for writing down things you have not said out loud. Played
straight, the style would fight the product: shouting borders around someone's 2am anxiety.

So this is the **handmade zine** end of brutalism, not the banner-ad end:

- **Cream stock, never white.** `#FFFCF2`. Newsprint, not a form.
- **Ink borders as structure**, not aggression. One weight, one colour, everywhere.
- **Cards slightly askew.** ±1.4°, used sparingly. The page reads as assembled by hand.
- **Colour used as fills with ink text on top** — which is how brutalism keeps loud colour
  accessible, and the reason every pair still clears WCAG AA.

Chunky and warm. Not shouting.

---

## System rules

Taken from the design-intelligence database's neo-brutalism entry, not invented:

| Rule | Value |
|---|---|
| Borders | 3px ink on every major element (2px on secondary) |
| Shadows | Hard offset, **zero blur** — `4px 4px 0` |
| Press | Translate by **exactly** the shadow offset, shadow to `0` |
| Rotation | ±1–2° on a minority of cards |
| Colour | High-saturation blocking. No gradients anywhere. |
| Easing | Spring or linear only. Nothing eases out softly. |

The database also rates this style **light-first with weak dark support** and flags that it
"requires careful contrast tuning". Both warnings shaped the work — see Dark mode and
Contrast below.

---

## Palette

Light ground, ink structure, four saturated pops.

```
--paper-0  #FFFCF2   canvas, warm newsprint
--paper-1  #FFFFFF   surface
--paper-2  #F5F0E1   sunken
--ink-0    #111111   borders and body text

--pop-blue    #4D5BF9   interaction
--pop-yellow  #FFD400   emphasis, streaks, the one-thing-to-try card
--pop-orange  #FF6B35   the vault
--pop-mint    #00C48C   positive valence
--pop-rose    #FF4D6D   negative valence
```

### Dark mode is not an inversion

The database says this style barely supports dark. Rather than flip the palette and hope, dark
mode is built as its own thing: the ground goes to ink (`#141414`), **the borders go to
paper** (`#F5F0E1`), and every pop is lifted until it clears 4.5:1 on a dark ground — blue
`#4D5BF9` → `#9AA5FF`, orange `#FF6B35` → `#FF8B5E`.

### Contrast is verified, not assumed

`npm run verify:contrast` reads the tokens out of `globals.css` — so it checks what ships, not
a copy that drifts — and fails the run under 4.5:1 for text or 3:1 for borders. It covers the
risky pairs specifically: ink on every saturated fill, and accent text on the ground.

Both themes pass. Tightest is accent-on-canvas in light at **4.89:1** — real headroom is thin
there, so that blue should not be lightened.

> The first version of this checker reported identical numbers for both themes: a naive
> `indexOf('[data-theme="dark"]')` matched the `@custom-variant` line at the top of the file
> and read the light values twice. It now brace-matches the actual rule. A checker that
> reports the same numbers for two different themes is not checking anything.

---

## Type

| Role | Face | Why |
|---|---|---|
| Everything | **Space Grotesk** 400–700 | Brutalism runs on one loud voice, not a serif/sans conversation. The old pairing is gone. |
| 10px labels | **Silkscreen** | An actual bitmap face. At 10px a pixel font is genuinely **crisper** than an antialiased one — the pixels are functional, not just thematic. |
| Ledger | **JetBrains Mono** | Tabular figures. Silkscreen has none, and the ledger is columns of digits. |

Journal prose stays at 18px / 1.72 on a 66ch measure. The face changed; the reading comfort
did not get to.

---

## The primitives

Four classes carry the whole system, so components stay legible:

```
.brut        3px border + hard shadow          the workhorse
.brut-flat   3px border, no shadow             things IN the page, not on it
.brut-press  hover lifts, press drives down    every interactive element
.chip-brut   filled sticker with ink border    labels, themes, moods
```

`.brut-flat` matters more than it looks: if everything floats, depth stops meaning anything.

### The mechanical press

```css
.brut-press:hover  { transform: translate(-2px, -2px); box-shadow: 6px 6px 0; }
.brut-press:active { transform: translate(4px, 4px);   box-shadow: 0 0 0; }
```

The press travel **equals the shadow offset**, so the element lands exactly where its shadow
was. That is what makes it read as a key bottoming out rather than a div moving.

The composer's mode tabs use it as state: the selected mode sits flush, shadow gone, as though
held down. Selection is depth *and* fill — which survives colour-blindness and a bad projector
equally well.

---

## Where the pixels are

Not decoration in any of these cases:

**The pixel loader.** Three blocks on `steps(3, end)`. A dot pulsing on a sine curve says
"something is smoothly happening"; blocks jumping between three discrete frames say "a machine
is ticking through work", which is what is actually happening. The step function is what makes
it a sprite rather than three wobbling dots.

**The weather strip, as pixel columns.** The strongest case. Mood is a fuzzy, model-inferred
reading — a smooth gradient ribbon implies a precision the number does not have. Quantising
into whole blocks says the true thing: *roughly* this heavy, *roughly* this charged. The
medium matches the confidence of the data.

**Silkscreen at 10px**, where a bitmap face is simply sharper.

**The pixel grid** on sign-in — the only texture in the app, setting the medium before a word
is read.

---

## The three signature moments

1. **The Stamp** — sealing. Arrives at 3× scale rotated 18°, overshoots, settles a few degrees
   off square. A hand-pressed stamp never lands straight, and the slight wrongness is what
   sells it as physical. The only element permitted to be this loud, because sealing is the
   one action that cannot be undone.
2. **The Distillation** — pixel loader, then summary cards dealt onto the table 140ms apart,
   each with a spring overshoot.
3. **The Weather** — a fortnight of pixel columns on a ruled baseline.

---

## Accessibility

Everything from the previous contract still holds, plus:

- **Contrast is enforced by a script**, not a promise. `npm run verify:contrast`.
- **Reduced motion removes travel and tilt**, but keeps the shadow change on hover and press —
  so the interface stays legible without moving. `prefers-reduced-motion` also flattens
  `.tilt-l` / `.tilt-r`, because a permanent rotation is a hazard for some vestibular
  conditions even when static.
- **Mood still never encodes by colour alone.** Every band, chip and column carries its word.
- Focus is a 3px accent ring at 2px offset — consistent with the border language and
  impossible to miss.

---

## What did not change

The architecture, the security boundary, the data model, the tests. This was a re-skin: token
values moved and components followed. `npm test` (40) and `npm run test:e2e` (33) both stayed
green throughout, which is the point of having them.
