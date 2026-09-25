/**
 * Encode the hero clip to the blueprint spec and cut its posters.
 *
 *   node scripts/encode-video.mjs raw.mp4
 *   node scripts/encode-video.mjs raw.mp4 --start 6.2 --speed 0.75 --pingpong
 *
 * Options
 *   --start <s>   trim everything before this timestamp
 *   --end <s>     trim everything after this timestamp
 *   --speed <n>   playback rate; 0.75 = 25% slower, for a steadier push
 *   --pingpong    play forward then backward, so the loop has no visible cut.
 *                 Use it for a push-in or a pan, where the first and last
 *                 frames are nothing like each other and a hard loop jumps.
 *
 * Writes public/assets/video/shop.mp4, then regenerates the poster set from
 * frame 1 so the still and the first video frame match exactly.
 *
 * Spec: 1280x720, no audio, H.264 crf 25+, faststart, target <= 3 MB.
 * After this runs, set hasVideo={true} on <VideoHero> in src/pages/index.astro.
 */
import { existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FFMPEG, FFPROBE } from './ffmpeg-path.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'public/assets/video');
const OUT = path.join(OUT_DIR, 'shop.mp4');
const OUT_WEBM = path.join(OUT_DIR, 'shop.webm');
const MAX_MB = 3;

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const src = argv.find((a) => !a.startsWith('--') && !/^[\d.]+$/.test(a));
const START = flag('start');
const END = flag('end');
const SPEED = Number(flag('speed', '1'));
const PINGPONG = argv.includes('--pingpong');

if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/encode-video.mjs <source-clip> [--start s] [--end s] [--speed n] [--pingpong]');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const run = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'ignore'] });
const mb = (f) => statSync(f).size / 1024 / 1024;
const probe = (f, entries) => execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', entries, '-of', 'default=noprint_wrappers=1:nokey=1', f])
  .toString().trim();

const dur = Number(probe(src, 'format=duration'));
const [w, h] = probe(src, 'stream=width,height').split('\n').map(Number);
console.log(`source: ${w}x${h}, ${dur.toFixed(1)}s`);
if (w / h < 1.5) console.log('  ⚠ not 16:9 — desktop will letterbox or crop hard');

const tmp = path.join(os.tmpdir(), `hero-${Date.now()}`);
const fwd = `${tmp}-fwd.mp4`;

// -an strips audio: an autoplaying hero must be silent, and muted audio is
// still bytes the visitor pays for.
function encode(crf) {
  const trim = [];
  if (START) trim.push('-ss', String(START));
  if (END) trim.push('-to', String(END));
  const filters = ['scale=1280:-2'];
  if (SPEED !== 1) filters.unshift(`setpts=${(1 / SPEED).toFixed(4)}*PTS`);

  run(['-y', ...trim, '-i', src, '-map', '0:v:0', '-an', '-c:v', 'libx264',
       '-crf', String(crf), '-preset', 'slow', '-movflags', '+faststart',
       '-pix_fmt', 'yuv420p', '-vf', filters.join(','), '-r', '24', fwd]);

  if (!PINGPONG) { run(['-y', '-i', fwd, '-c', 'copy', '-movflags', '+faststart', OUT]); return; }

  // Forward then reversed, concatenated. The join is frame-identical at both
  // ends, so the loop point is invisible without needing the source to loop.
  const rev = `${tmp}-rev.mp4`;
  run(['-y', '-i', fwd, '-vf', 'reverse', '-an', '-c:v', 'libx264', '-crf', String(crf),
       '-preset', 'slow', '-pix_fmt', 'yuv420p', rev]);
  const list = `${tmp}-list.txt`;
  execFileSync('/bin/sh', ['-c', `printf 'file %s\\nfile %s\\n' '${fwd}' '${rev}' > '${list}'`]);
  run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy',
       '-movflags', '+faststart', OUT]);
  for (const f of [rev, list]) rmSync(f, { force: true });
}

let crf = 25;
encode(crf);
while (mb(OUT) > MAX_MB && crf < 34) {
  crf += 3;
  console.log(`  ${mb(OUT).toFixed(1)} MB is over budget — retrying at crf ${crf}`);
  encode(crf);
}
rmSync(fwd, { force: true });

// VP9/WebM alongside the H.264 MP4. Chrome, Firefox, Edge and Android take the
// WebM (smaller at the same quality); Safari and iOS take the MP4. Shipping both
// is also the only way this path is testable in a Chromium build without the
// proprietary H.264 decoder.
console.log('encoding the WebM/VP9 companion…');
{
  const trim = [];
  if (START) trim.push('-ss', String(START));
  if (END) trim.push('-to', String(END));
  const filters = ['scale=1280:-2'];
  if (SPEED !== 1) filters.unshift(`setpts=${(1 / SPEED).toFixed(4)}*PTS`);
  const fwdW = `${tmp}-fwd.webm`;
  run(['-y', ...trim, '-i', src, '-map', '0:v:0', '-an', '-c:v', 'libvpx-vp9',
       '-crf', '36', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3',
       '-pix_fmt', 'yuv420p', '-vf', filters.join(','), '-r', '24', fwdW]);
  if (PINGPONG) {
    const revW = `${tmp}-rev.webm`;
    run(['-y', '-i', fwdW, '-vf', 'reverse', '-an', '-c:v', 'libvpx-vp9', '-crf', '36',
         '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3',
         '-pix_fmt', 'yuv420p', revW]);
    const listW = `${tmp}-listw.txt`;
    execFileSync('/bin/sh', ['-c', `printf 'file %s\\nfile %s\\n' '${fwdW}' '${revW}' > '${listW}'`]);
    run(['-y', '-f', 'concat', '-safe', '0', '-i', listW, '-c', 'copy', OUT_WEBM]);
    for (const f of [revW, listW]) rmSync(f, { force: true });
  } else {
    run(['-y', '-i', fwdW, '-c', 'copy', OUT_WEBM]);
  }
  rmSync(fwdW, { force: true });
  console.log(`public/assets/video/shop.webm — ${mb(OUT_WEBM).toFixed(2)} MB`);
}

const outDur = Number(probe(OUT, 'format=duration'));
console.log(`public/assets/video/shop.mp4 — ${mb(OUT).toFixed(2)} MB, ${outDur.toFixed(1)}s at crf ${crf}` +
            `${PINGPONG ? ' (ping-pong loop)' : ''}`);
if (mb(OUT) > MAX_MB) console.log(`  ⚠ still over ${MAX_MB} MB. Shorten the clip — length costs more than quality.`);
if (probe(OUT, 'stream=codec_type').includes('audio')) console.log('  ⚠ audio survived the encode');

console.log('\nRegenerating posters from frame 1…');
execFileSync(process.execPath, [path.join(ROOT, 'scripts/posters.mjs')], { stdio: 'inherit' });

console.log(`
Next:
  1. set hasVideo={true} on <VideoHero> in src/pages/index.astro
  2. set focus="…" to where the key subject sits, e.g. focus="50% 42%"
  3. npm run build && node scripts/og-images.mjs && node scripts/audit.mjs
  4. check it on a phone: it must autoplay in normal mode, and show the poster
     with a tap cue in Low Power Mode`);
