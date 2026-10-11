/**
 * Before/after pairs for the service pages, derived from the hero poster.
 *
 *   npm run compare   ->  public/assets/img/compare/<slug>-{before,after}.{jpg,webp}
 *
 * There are no photos of customer cars yet, so every pair is the same model car
 * (the hero clip's BMW) with the effect applied or removed through the masks in
 * src/data/masks.json. Every slider on the site says so in its caption. When the
 * shop supplies real before/after photos, drop them over these files (same
 * names, 1280x720) and delete this script's entry for that slug — nothing else
 * changes.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const M = JSON.parse(readFileSync(path.join(ROOT, 'src/data/masks.json'), 'utf8'));
const S = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8')).site;
const SRC = path.join(ROOT, 'public/assets/img/hero-poster.jpg');
const OUT = path.join(ROOT, 'public/assets/img/compare');
const LOGO = path.join(ROOT, 'public/assets/img/logo-800.png');
const W = M.width, H = M.height;
mkdirSync(OUT, { recursive: true });

const P = M.polygons;
const pts = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');

/** Grayscale mask PNG: white inside `fills`, black inside `holes`, feathered. */
async function maskPng(fills, holes = [], feather = 1.2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#000"/>
    ${fills.map((n) => `<polygon points="${pts(P[n])}" fill="#fff"/>`).join('')}
    ${holes.map((n) => `<polygon points="${pts(P[n])}" fill="#000"/>`).join('')}
  </svg>`;
  return sharp(Buffer.from(svg)).blur(feather).toColourspace('b-w').png().toBuffer();
}

/** Apply `fn` to a copy of `base`, keep it only inside the mask, lay it over `base`. */
async function maskedVariant(base, fn, fills, holes = [], feather = 1.2) {
  const variant = await fn(sharp(base)).removeAlpha().png().toBuffer();
  const mask = await maskPng(fills, holes, feather);
  // The mask's luminance becomes the variant's alpha channel.
  const cut = await sharp(variant).joinChannel(mask).png().toBuffer();
  return sharp(base).composite([{ input: cut }]).png().toBuffer();
}

/** Composite an arbitrary RGBA/SVG layer, limited to the mask. */
async function maskedLayer(base, layer, fills, holes = [], feather = 1.0, blend = 'over') {
  const mask = await maskPng(fills, holes, feather);
  const rgba = await sharp(layer).ensureAlpha().png().toBuffer();
  // alpha = layer alpha × mask luminance
  const alpha = await sharp(rgba).extractChannel(3).png().toBuffer();
  const combined = await sharp(alpha).composite([{ input: mask, blend: 'multiply' }]).toColourspace('b-w').png().toBuffer();
  const cut = await sharp(rgba).removeAlpha().joinChannel(combined).png().toBuffer();
  return sharp(base).composite([{ input: cut, blend }]).png().toBuffer();
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Deterministic pseudo-random so the images do not change between builds.
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
function scatter(names, n, draw) {
  const polys = names.map((k) => P[k]);
  let out = '', made = 0, tries = 0;
  while (made < n && tries < n * 60) {
    tries++;
    const x = rnd() * W, y = rnd() * H;
    if (polys.some((p) => inside(p, x, y))) { out += draw(x, y, made); made++; }
  }
  return out;
}
const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${inner}</svg>`);

async function save(buf, name) {
  await sharp(buf).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, `${name}.jpg`));
  await sharp(buf).webp({ quality: 74 }).toFile(path.join(OUT, `${name}.webp`));
  console.log('  ', name);
}

const base = await sharp(SRC).png().toBuffer();
const GLASS = M.glass;
const BODY_HOLES = M.body_holes;

// ---------------------------------------------------------------- effects
const tinted = (pct) => (img) => img.linear(pct, 0);                 // 5% VLT ≈ keep 5–8% of the light
const smoked = (img) => img.linear(0.33, 0).modulate({ saturation: 0.6 });
const dull = (img) => img.modulate({ saturation: 0.55, brightness: 0.92 }).linear(0.72, 32).blur(0.9);
const satin = (img) => img.modulate({ saturation: 0.35 }).linear(0.5, 10).blur(0.7);
const glossier = (img) => img.linear(1.06, -5);
const purple = (img) => img.modulate({ brightness: 0.5, saturation: 0.45 }).tint({ r: 96, g: 70, b: 122 });

console.log('compare images →', path.relative(ROOT, OUT));

// 1. Window tinting: factory glass → 5% across every window (owner's call).
await save(base, 'window-tinting-before');
await save(await maskedVariant(base, tinted(0.07), GLASS), 'window-tinting-after');

// 2. Tint removal: purple, bubbled film → factory glass.
{
  const bubbles = svg(scatter(GLASS, 140, (x, y) => `<ellipse cx="${x}" cy="${y}" rx="${2 + rnd() * 7}" ry="${1.5 + rnd() * 4}" fill="#cdbde6" fill-opacity="${0.08 + rnd() * 0.16}"/>`));
  let b = await maskedVariant(base, purple, GLASS);
  b = await maskedLayer(b, bubbles, GLASS);
  await save(b, 'tint-removal-repair-before');
  await save(base, 'tint-removal-repair-after');
}

// 3. Vinyl wraps: gloss black → satin black (reflections flattened).
await save(base, 'vinyl-wraps-before');
await save(await maskedVariant(base, satin, ['body'], BODY_HOLES, 2.5), 'vinyl-wraps-after');

// 4. Commercial wraps: plain → lettered (badge + name + phone on the front fender/door).
{
  const logo = await sharp(LOGO).resize(64, 64).png().toBuffer();
  const logo64 = `data:image/png;base64,${logo.toString('base64')}`;
  const layer = svg(`
    <g transform="translate(600,392) skewY(-4) scale(1.18,1.2)">
      <image href="${logo64}" x="0" y="4" width="64" height="64"/>
      <text x="74" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="23" letter-spacing="1" fill="#80d850">CALI TINTS</text>
      <text x="74" y="52" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="13" letter-spacing=".5" fill="#ffffff">TINT · WRAPS · PPF · CERAMIC</text>
      <text x="74" y="70" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#ffffff">${S.phone_display}</text>
    </g>`);
  await save(base, 'commercial-wraps-before');
  await save(await sharp(base).composite([{ input: layer, blend: 'over' }]).png().toBuffer(), 'commercial-wraps-after');
}

// 5. PPF: chipped front end → protected (clean).
{
  const chips = svg(
    scatter(['hood', 'bumper'], 150, (x, y) => `<circle cx="${x}" cy="${y}" r="${0.8 + rnd() * 1.8}" fill="#e8e8e8" fill-opacity="${0.55 + rnd() * 0.4}"/>`) +
    scatter(['bumper', 'hood'], 26, (x, y) => `<ellipse cx="${x}" cy="${y}" rx="${2 + rnd() * 3}" ry="${1.5 + rnd() * 2.5}" fill="#cfcfcf" fill-opacity="0.9"/>`)
  );
  await save(await maskedLayer(base, chips, ['hood', 'bumper'], ['headlight']), 'paint-protection-film-before');
  await save(base, 'paint-protection-film-after');
}

// 6. Ceramic coating: dull, hazed paint → deep gloss.
await save(await maskedVariant(base, dull, ['body'], BODY_HOLES, 1.5), 'ceramic-coating-before');
await save(await maskedVariant(base, glossier, ['body'], BODY_HOLES, 1.5), 'ceramic-coating-after');

// 7. Detailing: road grime on the lower body → clean.
{
  const noise = await sharp({ create: { width: W, height: H, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 38 } } })
    .blur(0.6).tint({ r: 150, g: 128, b: 100 }).ensureAlpha(0.55).png().toBuffer();
  let b = await maskedVariant(base, dull, ['body'], BODY_HOLES, 1.5);
  b = await maskedLayer(b, noise, ['lower_body'], ['wheel_front'], 6, 'overlay');
  const dust = svg(scatter(['lower_body'], 400, (x, y) => `<circle cx="${x}" cy="${y}" r="${0.6 + rnd() * 1.4}" fill="#b9a58a" fill-opacity="${0.25 + rnd() * 0.4}"/>`));
  b = await maskedLayer(b, dust, ['lower_body'], ['wheel_front'], 2);
  await save(b, 'detailing-before');
  await save(base, 'detailing-after');
}

// 8. Paint correction: swirl marks → corrected.
{
  let arcs = '';
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * W, cy = rnd() * H, r = 12 + rnd() * 60;
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity="${0.08 + rnd() * 0.12}" stroke-width="0.7" stroke-dasharray="${3 + rnd() * 9} ${6 + rnd() * 14}"/>`;
  }
  let b = await maskedVariant(base, (img) => img.linear(0.86, 14), ['body'], BODY_HOLES, 1.5);
  b = await maskedLayer(b, svg(arcs), ['body'], BODY_HOLES, 1.5);
  await save(b, 'paint-correction-before');
  await save(base, 'paint-correction-after');
}

// 9. Customization: clear headlight → smoked.
await save(base, 'customization-before');
await save(await maskedVariant(base, smoked, ['headlight'], [], 1.0), 'customization-after');

console.log('done');
