---
name: Aperture
description: A private journal that feels like a calm notebook on a warm desk.
colors:
  paper: "#f7f2eb"
  card: "#fffdf9"
  elevated: "#ffffff"
  paper-sunk: "#f0e9df"
  line: "#e4dacd"
  line-faint: "#ece4d9"
  line-strong: "#958574"
  ink: "#2d2522"
  ink-2: "#5c504a"
  ink-3: "#73665f"
  rose: "#b23f66"
  rose-wash: "#fbe7ee"
  honey: "#f4dc9c"
  sealed: "#7a5a3c"
  danger: "#b93a32"
  mood-lighter: "#2f7d5b"
  mood-heavier: "#b2456b"
  mood-level: "#6a5aa8"
  night-paper: "#1a1614"
  night-card: "#231e1b"
  night-elevated: "#2a2421"
  night-paper-sunk: "#151210"
  night-line: "#3a322d"
  night-line-strong: "#756860"
  night-ink: "#f3ece5"
  night-ink-2: "#cfc4bb"
  night-ink-3: "#a99d94"
  night-rose: "#f19ab5"
  night-rose-wash: "#3a2229"
typography:
  title:
    fontFamily: "Newsreader, Iowan Old Style, Georgia, serif"
    fontSize: "32-36px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  writing:
    fontFamily: "Newsreader, Iowan Old Style, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Figtree, system-ui, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Figtree, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  label:
    fontFamily: "Figtree, system-ui, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.01em"
rounded:
  control: "12px"
  card: "18px"
  sheet: "22px"
  pill: "999px"
shadows:
  card: "0 1px 2px rgba(74,52,36,.06), 0 4px 14px rgba(74,52,36,.06)"
  card-lg: "0 2px 4px rgba(74,52,36,.06), 0 12px 32px rgba(74,52,36,.10)"
  sheet: "0 4px 8px rgba(74,52,36,.06), 0 24px 56px rgba(74,52,36,.16)"
components:
  button-primary:
    backgroundColor: "{colors.rose}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    typography: "{typography.ui}"
  button-secondary:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.line-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  nav-item-active:
    backgroundColor: "{colors.rose-wash}"
    textColor: "{colors.rose}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.line}"
    rounded: "{rounded.card}"
    shadow: "{shadows.card}"
  segmented-pills:
    trackColor: "{colors.paper-sunk}"
    activeColor: "{colors.card}"
    rounded: "{rounded.pill}"
---

# Design System: Aperture

## Overview

**Soft paper.** Aperture is a calm notebook on a warm desk: cream paper, white cards resting on it with a soft shadow, a gentle serif for titles and for your own writing, and a friendly sans for everything you operate. One accent, the rose of the logo, marks the main action and where you are.

It replaced "The Lexicon" (a sharp-cornered, dictionary-style system) because that felt too hard-edged and was hard to find your way around. Two lessons from it carry forward: navigation must say what it is in words, and there must be one obvious place to start writing.

Audience: the user and a small group of friends, writing at a desk, often in the evening. Avoid clinical (health-app) and cute (childish) registers.

## Colors

- **Paper** `#f7f2eb` is the page. **Card** `#fffdf9` is anything that rests on it. **Paper-sunk** `#f0e9df` is hover, wells and pill tracks.
- **Ink** is warm near-black, never pure black. Three steps: ink, ink-2 (secondary), ink-3 (muted, still 4.5:1 on paper).
- **Rose** `#b23f66` is the logo's pink deepened until white text reads on it (5.5:1). It is used for the primary button, the active nav row, links and the AI badge. **Rose-wash** is its pale fill for selected states.
- **Mood inks** stay three discrete colours, never blended: sage (lighter), dusky rose (heavier), lavender (about level). A mood colour always appears with its word.
- **Honey** is a soft highlight fill only ("One thing to try").
- **Night** is warm brown-black, not blue-grey, with the logo pink itself as the accent.

### Lines

Everyday lines (`line`, `line-faint`) are deliberately faint and decorative. The outline of anything you type into uses `line-strong`, which clears 3:1 in both themes. `scripts/verify-contrast.mjs` checks every pair.

## Typography

- **Newsreader** (serif, 400–600) sets page titles (h1, 32–36px, weight 500) and the writing itself (`.prose-journal`, 18px / 1.7): your entries, the AI's replies, summaries.
- **Figtree** (sans, 400–700) sets everything you operate: navigation, buttons, labels, metadata. Body 16px, controls 14px, labels 13px semibold, metadata 12px.
- No all-caps, no letter-spaced labels, no italics for structure. Weight and size carry hierarchy.

## Layout

- **Desktop (≥768px):** one 272px sidebar, then the page on a ~66ch measure. The sidebar, top to bottom: logo and name, **New entry** (rose), Today / Insights / Ask your past, a "Privacy" group (Vault, Security), **Your entries** grouped by Today / Yesterday / This week…, then a footer row (you → Profile & settings, Help, theme).
- **Phone:** a top bar (menu, logo, theme) and a five-item bottom tab bar. The menu opens the same sidebar as a sheet.
- If the screen is short, the whole sidebar scrolls. Your entries always keeps at least 220px.

## Elevation

Three soft, warm-tinted shadows: **card** (resting), **card-lg** (focused composer, hovered primary button), **sheet** (dialogs, tour, Help, phone menu). No hard offset shadows and no black outlines.

## Shapes

12px controls, 18px cards, 22px sheets, full pills for chips, mode tabs and the mood dots. Nothing is square.

## Components

- **Buttons:** primary is a rose fill with white text and lifts slightly on hover. Secondary is a card fill with a `line-strong` outline. Destructive actions are danger-coloured text with a faint danger outline, never a red fill. Pressing scales to 0.98.
- **Mode picker:** four pills in a sunk track. The active pill is a white card. On a phone it stays on one line and scrolls sideways.
- **Composer:** a rounded card with the writing in Newsreader. Focusing it turns the outline rose and deepens the shadow.
- **Cards and charts:** `.brut` / `.plate` / `.sheet` are kept as class names but now mean "card", "chart card" and "dialog".
- **Chips:** pills with a faint border.
- **The AI's turn:** a small rose "AI" badge in the margin.
- **Entries list:** compact rounded rows showing the title (14px, medium) and a mood dot, mood word and relative time. The current entry gets rose-wash.

## Do's and Don'ts

**Do:** say where things are in words. Keep one rose action per view. Let the writing be serif and everything else sans. Round every corner. Pair mood colour with its word.

**Don't:** use icon-only navigation, all-caps labels, black borders, hard shadows, italic "part of speech" mode labels, ruled-paper backgrounds, or more than one accent colour.
