#!/usr/bin/env node
/**
 * WCAG contrast check across both themes.
 *
 * The design database rates neo-brutalism "requires careful contrast tuning",
 * and it is right: the style runs on saturated fills, and a saturated fill is
 * exactly where text quietly drops below 4.5:1. Loud is not the same as
 * legible.
 *
 * Colours are read from app/globals.css so this checks what actually ships,
 * not a copy that drifts. Fails the run if any body-text pair is under 4.5:1
 * or any large-text / UI pair is under 3:1.
 *
 *   npm run verify:contrast
 */

import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');

/**
 * Extract the body of a CSS rule by brace matching.
 *
 * Needed because a naive indexOf('[data-theme="dark"]') lands on the
 * `@custom-variant` line at the top of the file and then reads the LIGHT
 * values — which produced two identical columns and a checker that was not
 * checking anything. Brace matching from the actual selector avoids it.
 */
function ruleBody(selector) {
  const at = css.indexOf(selector + ' {');
  if (at === -1) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

const DARK_BLOCK = ruleBody(':root[data-theme="dark"]');
// Primitives (--ink-0, --pop-yellow, …) are declared once and shared by both
// themes, so a token that is not overridden in dark is looked up globally.
const GLOBAL = css;

function rawValue(name, block) {
  const m = new RegExp(`--${name}:\s*([^;]+);`).exec(block);
  return m ? m[1].trim() : null;
}

/** Resolve a --token to a hex, following var() indirection within the theme. */
function resolve(name, scope, depth = 0) {
  if (depth > 4) return null;
  const block = scope === 'dark' ? DARK_BLOCK : GLOBAL;

  let v = rawValue(name, block);
  // Not themed — fall back to the shared primitive layer.
  if (!v && scope === 'dark') v = rawValue(name, GLOBAL);
  if (!v) return null;

  if (v.startsWith('#')) return v;

  const inner = /var\(--([\w-]+)\)/.exec(v);
  return inner ? resolve(inner[1], scope, depth + 1) : null;
}

function srgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = srgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let failures = 0;

function check(label, fg, bg, min, scope) {
  if (!fg || !bg) {
    console.log(`  ? ${label} — token missing (${scope})`);
    failures++;
    return;
  }
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    `  ${pass ? '✓' : '✗'} ${label.padEnd(34)} ${r.toFixed(2)}:1  (needs ${min})  ${fg} on ${bg}`,
  );
}

for (const scope of ['light', 'dark']) {
  console.log(`\n${scope.toUpperCase()}`);

  const canvas = resolve('bg-canvas', scope);
  const surface = resolve('bg-surface', scope);
  const sunken = resolve('bg-sunken', scope);
  const ink = resolve('fg-primary', scope);
  const ink2 = resolve('fg-secondary', scope);
  const ink3 = resolve('fg-muted', scope);
  const onAccent = resolve('fg-on-accent', scope);
  const accent = resolve('accent', scope);
  const pop = resolve('pop', scope);
  const sealed = resolve('sealed', scope);
  const danger = resolve('danger', scope);

  // Body text
  check('body on canvas', ink, canvas, 4.5, scope);
  check('body on surface', ink, surface, 4.5, scope);
  check('secondary on canvas', ink2, canvas, 4.5, scope);
  check('muted on canvas', ink3, canvas, 4.5, scope);
  check('muted on sunken', ink3, sunken, 4.5, scope);

  // Links and filled controls — where brutalism usually fails
  check('accent text on canvas', accent, canvas, 4.5, scope);
  check('on-accent on accent fill', onAccent, accent, 4.5, scope);

  // Ink text on the saturated fills. These are the risky ones: every filled
  // chip and key in the app puts near-black text on a loud colour.
  check('ink on yellow fill', '#111111', pop, 4.5, scope);
  check('ink on sealed fill', '#111111', sealed, 4.5, scope);
  check('ink on danger fill', '#111111', danger, 4.5, scope);

  // Borders are the entire visual system — they must clear the 3:1 UI bar.
  check('border vs canvas', resolve('border-ink', scope), canvas, 3, scope);
}

console.log('');
if (failures) {
  console.log(`${failures} contrast failure(s). Loud is not the same as legible.`);
  process.exitCode = 1;
} else {
  console.log('All pairs pass WCAG AA.');
}
