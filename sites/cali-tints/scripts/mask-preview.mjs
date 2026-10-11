/** Renders src/data/masks.json over the hero poster so the polygons can be checked by eye.
    node scripts/mask-preview.mjs [out.jpg]  (default: scratch/masks/preview.jpg next to dist) */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const M = JSON.parse(readFileSync(path.join(ROOT, 'src/data/masks.json'), 'utf8'));
const out = process.argv[2] || path.join(ROOT, 'mask-preview.jpg');
const colors = { windshield:'#00e5ff', window_front:'#00ff88', window_rear:'#ffee00', headlight:'#ff4dd2', hood:'#ff8800', bumper:'#8888ff', body:'#ffffff', wheel_front:'#ff0000', lower_body:'#aa5500', door_front:'#00ffcc' };
let shapes = '';
for (const [name, pts] of Object.entries(M.polygons)) {
  const p = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const c = colors[name] || '#fff';
  const fill = name === 'body' ? 'none' : c;
  shapes += `<polygon points="${p}" fill="${fill}" fill-opacity="0.35" stroke="${c}" stroke-width="2"/>`;
  const [lx, ly] = pts[0];
  shapes += `<text x="${lx + 4}" y="${ly - 4}" font-size="13" fill="${c}" stroke="#000" stroke-width=".5">${name}</text>`;
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${M.width}" height="${M.height}">${shapes}</svg>`);
await sharp(path.join(ROOT, 'public/assets/img/hero-poster.jpg')).composite([{ input: svg }]).jpeg({ quality: 90 }).toFile(out);
console.log('wrote', out);
