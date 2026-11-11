---
name: Aperture
description: A private journal set like a reference book you are writing.
colors:
  stock: "#ebeeec"
  stock-sunk: "#dfe2e0"
  ink: "#1a1c1d"
  ink-2: "#434847"
  ink-3: "#5b6160"
  rule-faint: "#979c9a"
  rubric: "#b23a16"
  plate-emerald: "#1c6e4c"
  plate-madder: "#a82e58"
  plate-violet: "#56419e"
  plate-ultramarine: "#2a3a94"
  plate-chrome: "#c98f0a"
  plate-sepia: "#6e4a2b"
  night-stock: "#131517"
  night-stock-sunk: "#1b1e21"
  night-ink: "#e6e8e6"
  night-ink-2: "#b4b9b8"
  night-ink-3: "#8d9392"
  night-rule-faint: "#50555a"
  night-rubric: "#f08257"
typography:
  title:
    fontFamily: "Old Standard TT, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  headword:
    fontFamily: "Old Standard TT, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Old Standard TT, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.7
    fontFeature: "onum"
  label:
    fontFamily: "Old Standard TT, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Old Standard TT, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  none: "0px"
  mark: "999px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.stock}"
  button-secondary:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.stock-sunk}"
  button-secondary-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  button-stop:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.rubric}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  plate:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px 28px 20px"
  sheet:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px"
  shoulder-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    padding: "8px 10px"
    width: "104px"
  shoulder-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  footnote-mark:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.mark}"
    size: "18px"
---

# Design System: Aperture

## Overview

**Creative North Star: "The Lexicon"**

Aperture is set like a reference book its owner is writing. Each finished session is filed as an entry and set like a headword: a bold title followed by its mode in italic, the way a dictionary gives a part of speech. Every list of entries is headed by guide words (the first and last thing in view, with the page's own name set in italic between them) so a reader always knows which span of the journal is in front of them. The page is engraving ink on a cool bible-paper stock. Colour is kept to bordered, numbered plates, the way a reference book keeps its colour plates apart from the text.

Rank comes from apparatus, not size. One nineteenth-century "Modern" face is set at three sizes only. Hierarchy comes from bold, italic, tracked capitals and the weight of the rules between things: a 2px head rule, 1px ink rules and faint hairlines. Controls are printed marks: square, edged in ink, flat. The primary action is printed in reverse. Nothing floats, tilts or bounces. The only lifted object is a loose sheet (a dialog, the tour, Help) lying on the page.

The density is that of a well-set reference page: compact metadata at 13px, writing at 17px on a 66 to 68ch measure, and generous space where the writing happens. Day and Night are the same book printed on two stocks. Every ink pair passes WCAG AA in both.

**Key Characteristics:**
- One serif family (Old Standard TT), three sizes: 13 / 17 / 27px.
- Guide words head every list and every page.
- Entries are headwords: bold title, italic mode as part of speech.
- Ink on stock; colour only inside plates and mood marks, plus rubric for what is new until seen.
- Square everywhere; the only round shapes are the mood dot, the unread mark and the "?" footnote mark.
- One shadow, kept for loose sheets.

## Colors

The palette is ink on stock with a row of plate inks: one neutral world, with colour confined to figures and to meaning.

### Primary
- **Engraving Ink** (ink): text, every border and control edge, and the reverse fill of the primary action and the selected shoulder tab. In Night it becomes Night Ink on Night Stock, so the reverse print flips with it.

### Secondary
- **Rubric Vermilion** (rubric): marks what is new or unfinished until it has been seen, such as "not ended yet" on an entry and the rubric chip in the rail. It is also the colour of destructive and stop actions, which are always set as rubric text with a rubric edge, never as a red fill.

### Tertiary (the plate inks)
- **Plate Emerald** (plate-emerald): lighter mood.
- **Plate Madder** (plate-madder): heavier mood.
- **Plate Violet** (plate-violet): mood about level.
- **Plate Ultramarine** (plate-ultramarine): the theme constellation's engraved rings and links.
- **Plate Chrome** (plate-chrome): the fill of a chrome-toned plate, always edged in ink with dark ink set on it.
- **Plate Sepia** (plate-sepia): sealed entries and the "echoes on" disclosure dot.

### Neutral
- **Bible-Paper Stock** (stock): canvas, surfaces, plates and sheets. All of them are the same stock, so depth never comes from tint.
- **Sunk Stock** (stock-sunk): hover ground, the active entry, skeletons and the writing well.
- **Ink 2** (ink-2): ledes, the italic mode, secondary copy.
- **Ink 3** (ink-3): metadata, captions, labels, placeholders.
- **Faint Rule** (rule-faint): decorative hairlines only, such as entry separators, the composer's writing lines and a plate's inner frame. It never carries meaning or edges a control.

### Named Rules
**The Colour-in-Plates Rule.** Pages are ink on stock. Plate inks appear in quantity only inside a bordered plate, and outside one only as a mood dot beside its word. If you can see colour that is not in a plate, a mood mark or rubric, it is wrong.

**The Three Moods Rule.** Mood is always a dot plus a word, in three discrete inks: emerald for lighter (valence above 0.25), madder for heavier (below -0.25), and violet for about level. Energy is carried by the dot's opacity (0.45 to 1.0), never by a fourth hue. Colour is never the only carrier.

**The Rubric Rule.** Rubric means "new until seen" or "this destroys or stops something". It is used for nothing else and never as a fill.

## Typography

**Display Font:** Old Standard TT (with Iowan Old Style, Palatino Linotype, Georgia, serif)
**Body Font:** Old Standard TT (same stack)
**Label/Mono Font:** Old Standard TT in tracked capitals. Monospace (ui-monospace, Cascadia Mono, Menlo) appears only where code-like text demands it.

**Character:** A revival of the Modern faces nineteenth-century dictionaries were set in. Its high contrast and true italic do the ranking work that a second family or a larger size would do elsewhere.

### Hierarchy
- **Title** (700, 27px, 1.25, -0.005em): the page title under the guide words, and the only 27px text on a page.
- **Headword** (700, 17px, 1.375): entry titles, plate titles, glossary terms. It is followed by an italic part of speech (the mode, in lowercase with a full stop) in ink-2.
- **Body** (400, 17px, 1.6 base / 1.7 prose, max 66ch): ledes, writing, replies. Old-style figures by default. Tabular lining figures for counts and times.
- **Label** (700, 13px, 0.08em, uppercase): guide words, section labels, plate numbers ("PLATE II"), shoulder tabs and printed button text.
- **Caption** (400 italic, 13px, 1.625): plate captions saying how to read the figure, the page name in the guide words, and placeholders.

### Named Rules
**The Three Sizes Rule.** 13, 17 and 27px, and nothing else. When something needs more rank, make it bold, italic, capitals or ruled, not bigger.

**The Part-of-Speech Rule.** A mode is always set in lowercase italic with a trailing full stop ("reflect.") wherever it names an entry or a choice.

## Layout

The app is a book spread. From md (768px) a 72px icon rail sits at the left edge. From lg (1024px) a 320px session column, headed by its own live guide words, sits beside it. The main page is a single column on a 68ch measure. From xl (1280px) a 104px shoulder index is cut down the right edge: thumb tabs, one per session group, each with its count. Below lg, the session column becomes a drawer and a bottom navigation takes over. On phones the guide words drop the page name and keep the two words that orient.

Rhythm follows a 4px base. Guide words to title is 32px. Title to lede is 12px. Plates take 24px top, 20px bottom and 20px sides (28px from sm). Entry rows take 10px vertical padding between faint rules. Section labels are sticky within their list and ruled beneath. Lists are separated by rules, not by gaps or cards.

## Elevation & Depth

The page is flat and printed. Plates, controls, entries and inputs carry no shadow. They are distinguished by ink rules and by the faint inner frame of a plate. Hover lays a thing on sunk stock. Pressing prints it in reverse.

### Shadow Vocabulary
- **Loose sheet** (shadow-sheet, `0 1px 0 ink, 0 16px 40px` at 18% ink in Day / 55% black in Night): dialogs, the tour card, the Help sheet and footnote popovers. These are paper lying on the page, nothing else.

### Named Rules
**The One Shadow Rule.** There is exactly one shadow, and it means "a loose sheet lying on this page". A control, plate or card that casts a shadow is wrong.

## Shapes

Everything is square (0px): controls, plates, sheets, chips, inputs, thumb tabs. Borders do the shaping. A 2px rule heads a page or a writing area. 1px ink rules edge plates, sheets and chips. Faint hairlines separate entries. Printed controls take a 2px ink edge. Only three shapes are round: the mood dot (9px), the rubric unread mark (8px) and the "?" footnote mark (18px circle). Plates carry a second 1px faint frame inset 4px, as an engraved plate does.

## Components

### Buttons
Printed marks: square, ink-edged, flat. Nothing moves.
- **Shape:** square (0px), 2px ink edge, label type in tracked capitals.
- **Primary (Send, Continue):** printed in reverse, ink fill with stock text, at least 40px tall (48px on sign-in). Disabled fades to 35%.
- **Hover / Focus / Active:** hover lays the control on sunk stock (the primary moves to ink-2). Active prints in reverse. Focus is a 2px solid ink outline at 2px offset on every ground. Colour transitions take 120ms on the expo-out curve.
- **Secondary (End session):** stock fill, ink edge, ink text, with its keyboard shortcut in ink-3 on pointer devices.
- **Stop / destructive:** the same printed key with a rubric edge and rubric text, never a red fill.
- **Text links:** ink, 1px underline at 3px offset, thickening to 2px on hover.

### Chips
- **Style:** tracked capitals at 13px, 1px ink hairline box, no fill.
- **State:** a rubric-edged variant marks something new until seen.

### Cards / Containers (Plates)
- **Corner Style:** square.
- **Background:** stock, or plate-chrome for a chrome-toned plate, with dark ink on it.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px ink outer edge plus a 1px faint inner frame inset 4px.
- **Internal Padding:** 24px top, 20px bottom, 20 to 28px sides. The head row holds a bold title (with an optional "?" mark) on the left and "PLATE" plus a roman numeral in label type on the right. An italic caption at the foot says in plain words how to read the figure.

### Inputs / Fields
- **The open page (composer):** not a box. It has a 2px ink head rule and a 1px ink foot rule, with faint writing lines drawn at the text's own 1.7em leading. Body type sits at measure. It grows with the writing (to 560px), and an empty entry opens to about 38vh on wider screens.
- **Focus:** the head rule thickens to 3px. Placeholders are italic ink-3.
- **Error / Disabled:** an invalid field takes a rubric edge. Disabled fades to 50%.
- **Keys:** shortcuts are set as small 1px faint-ruled kbd boxes in bold ink-2.

### Navigation
- **Rail:** 72px, line icons in ink-3. The active item sits on sunk stock. Labels appear beside an icon on hover and focus.
- **Session column:** guide words recompute from the entries actually in view as the list scrolls. Sticky ruled group labels are followed by headword entries: bold title, italic mode, then a 13px line with the mood dot and word, a middle dot, and a relative time. The active entry sits on sunk stock.
- **Shoulder index:** 104px thumb tabs on the right edge, label type, count in tabular figures. The current tab is printed in reverse.
- **Mode selector:** the four modes in a row as italic parts of speech separated by middle dots. The chosen mode is bold with a 2px ink underline. The others are ink-2 with a faint underline on hover.

### Guide Words (signature)
A three-column head rule: first word in label type at left, page name in 13px italic at centre, last word in label type at right, closed by a 2px ink rule. It heads every page (PageHead) and every list of entries.

### Footnote Mark and Glossary
An 18px round "?" with a 1px ink edge sits beside any word the app has coined. It opens a loose sheet holding the term in bold and its explanation at 13px. Hover and focus print it in reverse.

### Fortnight Plate (signature)
Plate I on Today: fourteen day-slots on an ink baseline. Each entry is an ink-edged block in its mood ink, with height set by energy. A day without an entry is a 1px faint tick.

### Theme Constellation (signature)
A plate of themes engraved in ultramarine: double rings sized by frequency, dotted faint links between themes that share an entry, and italic labels.

## Do's and Don'ts

### Do:
- **Do** head every page and every list of entries with guide words over a 2px ink rule.
- **Do** set entries as headwords: bold title, then the mode as a lowercase italic part of speech with a full stop.
- **Do** keep all text at 13, 17 or 27px, and gain rank from weight, italic, capitals and rules.
- **Do** put any figure that needs colour in a numbered plate with an italic caption that explains how to read it.
- **Do** show mood as a dot plus its word, in emerald, madder or violet only.
- **Do** print the primary action in reverse (ink fill, stock text). Hover goes to sunk stock and active prints in reverse.
- **Do** keep every control at least 44px tall on phones, and keep the 2px ink focus outline.
- **Do** honour both reduced-motion paths (the OS setting and the in-app override). Motion is a short fade or an 8px rise that stops dead (180ms, expo-out), with no overshoot.

### Don't:
- **Don't** add a second type family or a fourth size.
- **Don't** put colour on the page outside plates, mood marks and rubric. In particular, use no tinted cards or coloured section backgrounds.
- **Don't** cast a shadow from anything that is not a loose sheet, and don't use hard offset shadows. Controls are printed, not stuck on.
- **Don't** round corners. The only round shapes are the mood dot, the unread mark and the footnote mark.
- **Don't** fill a destructive action with red. Say it in rubric.
- **Don't** set a label-style line above a heading as a decorative kicker. Label type is for guide words, section labels and plate numbers.
- **Don't** tilt, bounce or translate a control on press.
- **Don't** recolour or crop the logo. It is the one full-colour picture, shown as-is and framed like a plate.
