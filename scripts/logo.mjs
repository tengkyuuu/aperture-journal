/**
 * Builds every brand asset from the one source artwork.
 *
 * ── WHY THIS EXISTS ──
 * The source is a 1.6MB render sitting on an opaque white page. Serving it as-is
 * would put a white rectangle on a cream page in light mode and a glowing white
 * slab on near-black in dark mode, so every asset the app actually loads is
 * derived here — which also makes the derivation reviewable and repeatable,
 * rather than something someone did once in an image editor.
 *
 * It lives outside `public/` on purpose: everything under public/ is served
 * verbatim and copied into the container, and this is a build input.
 *
 *   node scripts/logo.mjs
 *
 * Re-run it if the source art changes. Nothing else reads the source.
 */
import sharp from 'sharp';

const SRC = 'assets/logo-source.png';
const CREAM = '#FFFCF2';
const NEAR_WHITE = 242;

const { width: W, height: H } = await sharp(SRC).metadata();
const px = await sharp(SRC).ensureAlpha().raw().toBuffer();

// ── Key out the page without touching the artwork ──────────────────────────
// A plain "white becomes transparent" threshold would punch holes through the
// glossy highlights inside the letters, which are also near-white. Flooding
// inward from the border instead only removes white that is CONNECTED to the
// edge; the highlights are enclosed by pink, so the fill never reaches them.
const outside = new Uint8Array(W * H);
const qx = new Int32Array(W * H);
const qy = new Int32Array(W * H);
let head = 0;
let tail = 0;

const isPale = (x, y) => {
  const i = (y * W + x) * 4;
  return px[i] >= NEAR_WHITE && px[i + 1] >= NEAR_WHITE && px[i + 2] >= NEAR_WHITE;
};

const push = (x, y) => {
  const k = y * W + x;
  if (outside[k] || !isPale(x, y)) return;
  outside[k] = 1;
  qx[tail] = x;
  qy[tail] = y;
  tail++;
};

for (let x = 0; x < W; x++) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y++) {
  push(0, y);
  push(W - 1, y);
}
while (head < tail) {
  const x = qx[head];
  const y = qy[head];
  head++;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

for (let k = 0; k < W * H; k++) px[k * 4 + 3] = outside[k] ? 0 : 255;

const art = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .trim({ threshold: 1 })
  .toBuffer();

const { width: aw, height: ah } = await sharp(art).metadata();

/** Centre the artwork in a transparent square with breathing room. */
async function square(size, pad, flattenTo) {
  const inner = size - pad * 2;
  const fitted = await sharp(art)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: fitted, gravity: 'centre' }]);
  const out = flattenTo
    ? sharp(await canvas.png().toBuffer()).flatten({ background: flattenTo })
    : canvas;
  return out.png({ palette: true, quality: 90, effort: 10 }).toBuffer();
}

// What the app loads. WebP, because this is a smooth 3D render — PNG cannot
// compress a gradient and lands around 870KB for the same pixels.
await sharp(art).resize({ width: 640 }).webp({ quality: 88 }).toFile('public/logo.webp');
await sharp(art).resize({ width: 192 }).webp({ quality: 86 }).toFile('public/logo-sm.webp');

// Browser tab. Transparent, so it works on light and dark browser chrome.
await sharp(await square(256, 8, null)).toFile('app/icon.png');
// iOS ignores transparency and composites a home-screen icon onto black, so
// this one is flattened onto the paper colour deliberately.
await sharp(await square(180, 14, CREAM)).toFile('app/apple-icon.png');

const kb = async (f) => `${Math.round((await sharp(f).toBuffer()).length / 1024)}KB`;
console.log(`source        ${W}x${H}`);
console.log(`keyed+trimmed ${aw}x${ah}`);
for (const f of ['public/logo.webp', 'public/logo-sm.webp', 'app/icon.png', 'app/apple-icon.png']) {
  console.log(`  ${f.padEnd(22)} ${await kb(f)}`);
}
