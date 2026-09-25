/**
 * Encode the hero clip to the blueprint spec and cut its posters.
 *
 *   node scripts/encode-video.mjs path/to/raw-clip.mov
 *   npm run video -- path/to/raw-clip.mov
 *
 * Writes public/assets/video/shop.mp4, then regenerates the poster set from
 * frame 1 so the still and the first video frame match exactly.
 *
 * Spec: 1280x720, no audio, H.264 crf 25, faststart, target <= 3 MB.
 * After this runs, set hasVideo={true} on <VideoHero> in src/pages/index.astro.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const OUT_DIR = path.join(ROOT, 'public/assets/video');
const OUT = path.join(OUT_DIR, 'shop.mp4');
const MAX_MB = 3;

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/encode-video.mjs <source-clip>');
  process.exit(1);
}
if (!existsSync(FFMPEG)) {
  console.error(`No ffmpeg at ${FFMPEG}. Install ffmpeg and update the path.`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const run = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const mb = (f) => statSync(f).size / 1024 / 1024;

// -an strips audio: an autoplaying hero must be silent, and muted audio is
// still bytes the visitor pays for.
let crf = 25;
run(['-y', '-i', src, '-map', '0:v:0', '-an', '-c:v', 'libx264', '-crf', String(crf),
     '-preset', 'slow', '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
     '-vf', 'scale=1280:-2', OUT]);

// Step the quality down until it fits the budget rather than shipping 8 MB.
while (mb(OUT) > MAX_MB && crf < 34) {
  crf += 3;
  console.log(`  ${mb(OUT).toFixed(1)} MB is over budget — retrying at crf ${crf}`);
  run(['-y', '-i', src, '-map', '0:v:0', '-an', '-c:v', 'libx264', '-crf', String(crf),
       '-preset', 'slow', '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
       '-vf', 'scale=1280:-2', OUT]);
}

console.log(`public/assets/video/shop.mp4 — ${mb(OUT).toFixed(2)} MB at crf ${crf}`);
if (mb(OUT) > MAX_MB) console.log(`  ⚠ still over ${MAX_MB} MB. Shorten the clip — length costs more than quality.`);

console.log('\nRegenerating posters from frame 1…');
execFileSync(process.execPath, [path.join(ROOT, 'scripts/posters.mjs')], { stdio: 'inherit' });

console.log(`
Next:
  1. set hasVideo={true} on <VideoHero> in src/pages/index.astro
  2. set focus="…" to where the sign sits, e.g. focus="38% 50%"
  3. npm run build && node scripts/og-images.mjs && node scripts/audit.mjs
  4. check it on a phone: it must autoplay in normal mode, and show the poster
     with a tap cue in Low Power Mode`);
