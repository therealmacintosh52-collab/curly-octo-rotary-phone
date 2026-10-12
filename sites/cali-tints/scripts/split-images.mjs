/**
 * Before/after images for the service pages, cut from the owner's collage.
 *
 *   npm run splits   ->  public/assets/img/splits/<slug>.{jpg,webp}  (1280x640)
 *
 * Source: src/assets/source/before-after-collage.jpg, an AI-generated
 * 1792x1008 grid of 13 tiles (4 columns x 3 rows; the last cell holds two
 * short tiles). Each tile is one scene split down the middle, "before" on the
 * left and "after" on the right, with BEFORE/AFTER words baked into the top
 * corners and a label strip along the bottom. Tiles 1-11 map onto the eleven
 * services in order; 12 (dent repair) and 13 (headlight restoration) are not
 * services and are skipped.
 *
 * Each tile is cropped to the largest 2:1 rectangle that fits below the
 * baked-in words and above the label strip, centred on the tile's own divider
 * so the split stays at exactly 50%; then upscaled about 3x. The van in tile 4
 * carries another company's mark, which is painted over with Cali Tints
 * lettering. The grid numbers below were measured on the file (white gutter
 * lines and dark strips); re-measure if the collage is ever regenerated.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src/assets/source/before-after-collage.jpg');
const OUT = path.join(ROOT, 'public/assets/img/splits');
const LOGO = path.join(ROOT, 'public/assets/img/logo-800.png');
const S = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8')).site;
mkdirSync(OUT, { recursive: true });

const OW = 1280, OH = 640;
const TRIM_TOP = 34;                      // the BEFORE / AFTER words live in this band
// Columns: [left, right) of the photo, and the x of the tile's own divider line.
const COLS = [
  { x0: 0,    x1: 434,  div: 210.5 },
  { x0: 437,  x1: 879,  div: 657 },
  { x0: 882,  x1: 1331, div: 1102.5 },
  { x0: 1335, x1: 1792, div: 1560.5 },
];
// Rows: [top of the tile, top of its label strip).
const ROWS = [
  { y0: 0,   y1: 257 },
  { y0: 309, y1: 557 },
  { y0: 608, y1: 956 },
];
const SLUGS = [
  'window-tinting', 'tint-removal-repair', 'vinyl-wraps', 'commercial-wraps',
  'paint-protection-film', 'ceramic-coating', 'detailing', 'paint-correction',
  'customization', 'upholstery', 'inspections-mechanic',
];

/** Largest 2:1 crop centred on the divider, below the words, above the strip. */
function cropFor(col, row) {
  const top = row.y0 + TRIM_TOP;
  const availH = row.y1 - top;
  const halfW = Math.min(col.div - col.x0, col.x1 - col.div);
  let w = Math.floor(halfW * 2);
  let h = Math.floor(w / 2);
  if (h > availH) { h = availH; w = h * 2; }
  const left = Math.round(col.div - w / 2);
  const y = Math.round(top + (availH - h) / 2);
  return { left, top: y, width: w, height: h };
}

async function tile(i) {
  const col = COLS[i % 4], row = ROWS[Math.floor(i / 4)];
  const c = cropFor(col, row);
  return sharp(SRC).extract(c).resize(OW, OH, { kernel: 'lanczos3' }).sharpen({ sigma: 0.8, m1: 0.6, m2: 0.2 }).png().toBuffer();
}

/** Tile 4: cover the other company's mark on the van with Cali Tints lettering. */
async function rebrandVan(buf) {
  // The mark sits on the white panel, upper right of the "after" half
  // (about x 740-1125, y 95-175 after upscaling). Paint a feathered panel over
  // it whose shading runs from the paint sampled just above the mark to the
  // paint sampled just below it, so the patch follows the van's own gradient.
  const PATCH = { left: 716, top: 84, width: 440, height: 170 };
  const avg = async (left, top) => {
    const { data } = await sharp(buf).extract({ left, top, width: 36, height: 16 }).raw().toBuffer({ resolveWithObject: true });
    const n = data.length / 3; let r = 0, g = 0, b = 0;
    for (let k = 0; k < data.length; k += 3) { r += data[k]; g += data[k + 1]; b += data[k + 2]; }
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  };
  const [cTop, cBot] = [await avg(1170, 96), await avg(1170, 236)];
  const panel = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PATCH.width}" height="${PATCH.height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cTop}"/><stop offset="1" stop-color="${cBot}"/></linearGradient></defs>
    <rect width="${PATCH.width}" height="${PATCH.height}" fill="url(#g)"/></svg>`)).png().toBuffer();
  const feather = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PATCH.width}" height="${PATCH.height}">
    <rect x="8" y="8" width="${PATCH.width - 16}" height="${PATCH.height - 16}" rx="14" fill="#fff"/></svg>`)).blur(5).toColourspace('b-w').png().toBuffer();
  const soft = await sharp(panel).removeAlpha().joinChannel(feather).png().toBuffer();
  const logo = await sharp(LOGO).resize(92, 92).png().toBuffer();
  const logo64 = `data:image/png;base64,${logo.toString('base64')}`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">
    <g transform="translate(748,120) skewY(-1.5)">
      <image href="${logo64}" x="0" y="0" width="92" height="92"/>
      <text x="108" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="34" letter-spacing="1.5" fill="#1a1a1a">CALI TINTS</text>
      <text x="109" y="64" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="15" letter-spacing=".6" fill="#2e8b2e">TINT · WRAPS · PPF · CERAMIC</text>
      <text x="109" y="88" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" fill="#1a1a1a">${S.phone_display}</text>
    </g>
  </svg>`);
  return sharp(buf).composite([{ input: soft, left: PATCH.left, top: PATCH.top }, { input: svg }]).png().toBuffer();
}

console.log('split images →', path.relative(ROOT, OUT));
for (let i = 0; i < SLUGS.length; i++) {
  let buf = await tile(i);
  if (SLUGS[i] === 'commercial-wraps') buf = await rebrandVan(buf);
  await sharp(buf).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, `${SLUGS[i]}.jpg`));
  await sharp(buf).webp({ quality: 74 }).toFile(path.join(OUT, `${SLUGS[i]}.webp`));
  console.log('  ', SLUGS[i]);
}
console.log('done');
