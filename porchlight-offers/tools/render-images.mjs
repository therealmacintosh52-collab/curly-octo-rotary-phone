/**
 * Regenerates the social card and app icons from the HTML sources in
 * assets/img-src/ using a headless Chromium.
 *
 *   node tools/render-images.mjs [--chrome /path/to/chrome]
 *
 * The generated PNGs are committed, so you only need this when you change the
 * artwork. Headless Chromium's screenshot is as tall as --window-size but only
 * paints the (shorter) viewport, so we render tall and crop the exact box.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `${root}/assets/img-src`;
const OUT = `${root}/assets/img`;

const CHROME_CANDIDATES = [
  process.argv.includes('--chrome')
    ? process.argv[process.argv.indexOf('--chrome') + 1]
    : null,
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome/Chromium found. Pass --chrome /path/to/chrome.');
  process.exit(1);
}

/* --------------------------------------------------------------- PNG crop */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Crop a truecolour 8-bit PNG to its top-left `w`×`h` box. */
function cropPng(file, w, h) {
  const buf = readFileSync(file);
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = Buffer.from(data);
    if (type === 'IDAT') idat.push(Buffer.from(data));
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG (depth ${depth}, colour type ${colorType})`);
  }
  if (width === w && height === h) return; // nothing to do

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
  }

  const cropStride = w * bpp;
  const rows = Buffer.alloc(h * (cropStride + 1));
  for (let y = 0; y < h; y++) {
    rows[y * (cropStride + 1)] = 0; // filter: none
    out.copy(rows, y * (cropStride + 1) + 1, y * stride, y * stride + cropStride);
  }

  const newIhdr = Buffer.from(ihdr);
  newIhdr.writeUInt32BE(w, 0);
  newIhdr.writeUInt32BE(h, 4);
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', newIhdr),
      chunk('IDAT', deflateSync(rows, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

/* ------------------------------------------------------------ probe + shoot */

/** Headless paints only the viewport, which is shorter than --window-size. */
function chromeChromeHeight() {
  const probe = `${SRC}/.probe.html`;
  writeFileSync(
    probe,
    `<!doctype html><body style="margin:0"><div id=o></div><script>document.getElementById('o').textContent='VP:'+window.innerHeight;</script>`,
  );
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--virtual-time-budget=800',
      '--dump-dom',
      '--window-size=1000,1000',
      `file://${probe}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const m = dom.match(/VP:(\d+)/);
  return m ? 1000 - Number(m[1]) : 0;
}

const overhead = chromeChromeHeight();

function shoot(src, out, w, h) {
  mkdirSync(OUT, { recursive: true });
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=1200',
      `--window-size=${w},${h + overhead}`,
      `--screenshot=${out}`,
      `file://${src}`,
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
  cropPng(out, w, h);
  console.log(`✓ ${out.replace(root + '/', '')} (${w}×${h})`);
}

shoot(`${SRC}/og.html`, `${OUT}/og-default.png`, 1200, 630);
shoot(`${SRC}/icon.html`, `${OUT}/logo.png`, 512, 512);
shoot(`${SRC}/icon.html`, `${OUT}/apple-touch-icon.png`, 180, 180);
