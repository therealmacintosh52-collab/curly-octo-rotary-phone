// Builds the printable dealer leave-behind: public/dealers/leave-behind.pdf (US Letter, ONE page, black and gold).
//   npm run leave-behind                      (QR points at NEXT_PUBLIC_SITE_URL, else a localhost placeholder + warning)
//   NEXT_PUBLIC_SITE_URL=https://example.com npm run leave-behind
// Prices come ONLY from src/config/pricing.ts (dealerWholesale). While a rate is null the sheet prints a hand-write blank.
// Fonts: Michroma + Inter, embedded from src/fonts (the same subset woff2 files the website serves).
// Loads TS sources with Node's built-in type stripping (they import only relative .ts paths for that reason).
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';
import wawoff2 from 'wawoff2';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dealerServices, resolveRate } = await import('../src/lib/dealers/catalog.ts');
const { site } = await import('../src/config/site.ts');
const { dealerSteps, claimsConfirmed } = await import('../src/content/dealers.ts');

const outPath = path.join(root, 'public/dealers/leave-behind.pdf');
const rawUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
const domainSet = Boolean(rawUrl);
const origin = domainSet ? rawUrl : 'http://localhost:3000';
const signupUrl = `${origin}/dealers/signup?utm_source=leave_behind&utm_medium=print`;
if (!domainSet) console.warn('WARNING: NEXT_PUBLIC_SITE_URL is not set. The QR code points at localhost. Set it and re-run before printing.');

// ---- palette (matches the site tokens)
const ONYX = rgb(0.043, 0.043, 0.047);
const GOLD = rgb(0.788, 0.635, 0.29);
const GOLD_DEEP = rgb(0.557, 0.431, 0.18);
const GOLD_LIGHT = rgb(0.91, 0.796, 0.478);
const IVORY = rgb(0.953, 0.933, 0.89);
const INK = rgb(0.09, 0.09, 0.1);
const STEEL = rgb(0.38, 0.39, 0.42);
const RULE = rgb(0.84, 0.8, 0.7);
const MARK_BG = rgb(0.91, 0.796, 0.478);

const W = 612; const H = 792; const M = 34;

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
doc.setTitle('916 Dent & Detail: dealer rate sheet and recon one-pager');
doc.setAuthor(site.name);
doc.setSubject('Dealer leave-behind');
doc.setProducer(site.name);
doc.setCreator('npm run leave-behind');
// pdf-lib embeds the raw font bytes, and PDF cannot hold woff2: decompress to TTF first, then embed (subset so the PDF stays small).
const font = async (f) => doc.embedFont(await wawoff2.decompress(fs.readFileSync(path.join(root, 'src/fonts', f))), { subset: true });
const display = await font('michroma-400.woff2');
const sans = await font('inter-400.woff2');
const sansB = await font('inter-600.woff2');
const page = doc.addPage([W, H]);

// Subset fonts cover Basic Latin + Latin-1 + common punctuation only: fail loudly instead of printing a missing glyph.
const OK_PUNCT = '\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026';
const safe = (s) => {
  for (const ch of s) if (ch.codePointAt(0) > 0xff && !OK_PUNCT.includes(ch)) throw new Error(`Character U+${ch.codePointAt(0).toString(16)} in "${s}" is outside the font subset`);
  return s;
};
const text = (s, x, y, { size = 9, f = sans, color = INK, right = false, center = false, spacing = 0 } = {}) => {
  const t = safe(s);
  const w = f.widthOfTextAtSize(t, size) + spacing * Math.max(0, t.length - 1);
  const px = right ? x - w : center ? x - w / 2 : x;
  page.drawText(t, { x: px, y, size, font: f, color, characterSpacing: spacing });
  return w;
};
const wrap = (s, f, size, max) => {
  const out = []; let cur = '';
  for (const w of s.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(t, size) <= max) cur = t; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
};
const para = (s, x, y, max, { size = 9, f = sans, color = INK, lead = size * 1.45 } = {}) => {
  const lines = wrap(s, f, size, max);
  lines.forEach((l, i) => text(l, x, y - i * lead, { size, f, color }));
  return y - lines.length * lead;
};
/** Visible [OWNER] marker, same look as the website's .owner-mark. */
const mark = (s, x, y, size = 6.6) => {
  const w = sansB.widthOfTextAtSize(s, size) + 6;
  page.drawRectangle({ x, y: y - 2.2, width: w, height: size + 3.4, color: MARK_BG });
  page.drawText(s, { x: x + 3, y, size, font: sansB, color: rgb(0.1, 0.08, 0.02) });
  return w;
};
const eyebrow = (s, x, y) => text(s.toUpperCase(), x, y, { size: 7.6, f: display, color: GOLD_DEEP, spacing: 1.6 });

// ============================================================ header block (inset so every printer can print it)
const hdrH = 126; const hdrTop = H - M; const hdrY = hdrTop - hdrH;
page.drawRectangle({ x: M, y: hdrY, width: W - 2 * M, height: hdrH, color: ONYX });
page.drawRectangle({ x: M, y: hdrY - 3, width: W - 2 * M, height: 3, color: GOLD });
// 1184x1005 source is 700 KB; ~3x the printed size is plenty for 300 dpi.
const logo = await doc.embedPng(await sharp(path.join(root, 'public/brand/logo-transparent.png')).resize({ height: 360 }).png({ compressionLevel: 9 }).toBuffer());
const lh = 96; const lw = (logo.width / logo.height) * lh;
page.drawImage(logo, { x: M + 14, y: hdrY + (hdrH - lh) / 2, width: lw, height: lh });
const tx = M + 14 + lw + 18;
text('916 DENT & DETAIL', tx, hdrTop - 28, { size: 14.5, f: display, color: GOLD, spacing: 1 });
text('Precision · Care · Perfection.', tx, hdrTop - 45, { size: 8, color: rgb(0.78, 0.76, 0.7), spacing: 0.4 });
text('Faster frontline-ready.', tx, hdrTop - 70, { size: 17, f: display, color: IVORY });
text('On your lot.', tx, hdrTop - 91, { size: 17, f: display, color: GOLD_LIGHT });
para('Mobile paintless dent repair and detailing for dealers, fleets, rental lots and body shops across Greater Sacramento.', tx, hdrTop - 107, W - M - 14 - tx, { size: 8.6, color: rgb(0.86, 0.84, 0.79), lead: 11.5 });

// ============================================================ why + how (two columns)
let y = hdrY - 24;
const colW = (W - 2 * M - 26) / 2;
const xL = M; const xR = M + colW + 26;
eyebrow('Why recon managers call us', xL, y);
eyebrow('How it works', xR, y);
y -= 17;
const why = [
  ['Faster to frontline-ready.', 'Dents and detailing happen where the car is parked: no transport run, no body-shop wait.'],
  ['No repaint on paint-intact panels.', 'Paintless dent removal. We say so first if a panel is not a good fit.'],
  ['Priced per panel.', 'One wholesale sheet, so you can estimate recon before you buy the car.'],
  ['Nothing extra without your OK.', 'Add-ons come with a price. You approve or decline in the portal.'],
];
let yl = y;
for (const [h, b] of why) {
  page.drawRectangle({ x: xL, y: yl + 1.5, width: 4, height: 4, color: GOLD });
  text(h, xL + 11, yl, { size: 8.8, f: sansB });
  yl = para(b, xL + 11, yl - 11, colW - 11, { size: 8.2, color: STEEL, lead: 10.8 }) - 5;
}
let yr = y;
for (const s of dealerSteps) {
  text(s.n, xR, yr - 1, { size: 12, f: display, color: GOLD });
  text(s.t, xR + 30, yr + 1, { size: 8.8, f: sansB });
  yr = para(s.b, xR + 30, yr - 10, colW - 30, { size: 8, color: STEEL, lead: 10.4 }) - 5;
}
y = Math.min(yl, yr) - 8;

// ============================================================ price table (hand-write blanks)
page.drawRectangle({ x: M, y: y + 3, width: W - 2 * M, height: 0.8, color: GOLD });
y -= 14;
eyebrow('Wholesale rates', M, y);
text('Per panel or per vehicle. Hail is quoted from photos.', W - M, y, { size: 7.6, color: STEEL, right: true });
y -= 9;
const rowH = 17.6;
const colX = { svc: M + 6, unit: M + 318, rate: W - M - 6 };
text('SERVICE', colX.svc, y - 9, { size: 6.6, f: sansB, color: STEEL, spacing: 0.8 });
text('PER', colX.unit, y - 9, { size: 6.6, f: sansB, color: STEEL, spacing: 0.8 });
text('YOUR RATE', colX.rate, y - 9, { size: 6.6, f: sansB, color: STEEL, spacing: 0.8, right: true });
y -= 20;
let anyBlank = false;
for (const s of dealerServices) {
  page.drawRectangle({ x: M, y: y - rowH + 4.5, width: W - 2 * M, height: 0.5, color: RULE });
  text(s.plain, colX.svc, y - 8.2, { size: 8.6, f: sansB });
  text(s.term, colX.svc + sansB.widthOfTextAtSize(s.plain, 8.6) + 6, y - 8.2, { size: 7.4, color: STEEL });
  text(s.unit, colX.unit, y - 8.2, { size: 8.4, color: STEEL });
  const rate = resolveRate(s.id, null);
  if (rate === null) {
    anyBlank = true;
    text('$', colX.rate - 78, y - 8.2, { size: 9, f: sansB, color: GOLD_DEEP });
    page.drawRectangle({ x: colX.rate - 70, y: y - 9.6, width: 70, height: 0.8, color: INK });
  } else text(`$${rate.toLocaleString('en-US')}`, colX.rate, y - 8.2, { size: 9.4, f: sansB, right: true });
  y -= rowH;
}
page.drawRectangle({ x: M, y: y + 4.5, width: W - 2 * M, height: 0.5, color: RULE });
y -= 6;
if (anyBlank) {
  const w = mark('[OWNER] write in your rates', M, y);
  text('before you hand this out. Rates are the owner\'s decision; none are printed here.', M + w + 6, y, { size: 7.4, color: STEEL });
  y -= 11;
}

// ============================================================ contact + COI (hand-write lines when still placeholders)
const colC = (W - 2 * M - 30) / 3;
const fields = [
  ['Name', null],
  ['Phone', site.phone.placeholder ? null : site.phone.display],
  ['Email', site.email.placeholder ? null : site.email.address],
];
y -= 6;
const ew = eyebrow('Your contact', M, y);
if (fields.some(([, v]) => !v)) mark('[OWNER] fill in or hand-write', M + ew + 8, y);
y -= 16;
fields.forEach(([label, value], i) => {
  const x = M + i * (colC + 15);
  text(label.toUpperCase(), x, y, { size: 6.6, f: sansB, color: STEEL, spacing: 0.8 });
  if (value) text(value, x, y - 12, { size: 9, f: sansB });
  else { page.drawRectangle({ x, y: y - 24, width: colC, height: 0.8, color: INK }); }
});
y -= 40;
const coi = 'Certificate of insurance on request. W-9 on request.';
const cw = text(coi, M, y, { size: 8.2, f: sansB });
if (!claimsConfirmed.coi) mark('[OWNER] confirm coverage before printing', M + cw + 6, y);
y -= 12;

// ============================================================ footer band with QR
const bandH = 104; const bandY = M;
page.drawRectangle({ x: M, y: bandY, width: W - 2 * M, height: bandH, color: ONYX });
page.drawRectangle({ x: M, y: bandY + bandH, width: W - 2 * M, height: 2.2, color: GOLD });
const qr = QRCode.create(signupUrl, { errorCorrectionLevel: 'M' });
const n = qr.modules.size; const quiet = 3; const cell = Math.floor(((bandH - 24) / (n + quiet * 2)) * 100) / 100;
const qrSide = (n + quiet * 2) * cell;
const qx = W - M - 16 - qrSide; const qy = bandY + 16;
page.drawRectangle({ x: qx, y: qy, width: qrSide, height: qrSide, color: rgb(1, 1, 1) });
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
  if (qr.modules.get(r, c)) page.drawRectangle({ x: qx + (c + quiet) * cell, y: qy + qrSide - (r + quiet + 1) * cell, width: cell + 0.02, height: cell + 0.02, color: ONYX });
}
const fx = M + 16;
text('OPEN A DEALER ACCOUNT', fx, bandY + bandH - 24, { size: 11.5, f: display, color: GOLD, spacing: 0.6 });
para('Submit cars by VIN, one or a whole list. Track every car, approve add-ons, and get one monthly statement.', fx, bandY + bandH - 42, qx - fx - 16, { size: 8.6, color: rgb(0.88, 0.86, 0.8), lead: 11.5 });
const shown = `${origin.replace(/^https?:\/\//, '')}/dealers/signup`;
text(shown, fx, bandY + 18, { size: 8.4, f: sansB, color: GOLD_LIGHT });
text('Scan to open an account', qx + qrSide / 2, bandY + 6, { size: 6.2, color: rgb(0.7, 0.68, 0.62), center: true });
if (!domainSet) mark('[OWNER] set NEXT_PUBLIC_SITE_URL, re-run npm run leave-behind', fx, bandY + 32, 6.2);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const bytes = await doc.save();
fs.writeFileSync(outPath, bytes);
console.log(`wrote ${path.relative(root, outPath)} (${(bytes.length / 1024).toFixed(0)} KB, 1 page) -> QR ${signupUrl}`);
