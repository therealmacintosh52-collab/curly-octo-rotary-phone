// Statement PDF (server-side, pdf-lib, built-in Helvetica so nothing is read from disk at runtime). Letter size, paginated,
// black-and-gold header, one row per vehicle with add-ons indented beneath. Pure given its inputs.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { site } from '@/config/site';
import type { Dealer, DealerStatement, Invoice } from '@/lib/db/types';
import { money, monthLabel, type StatementLine } from './billing';

const GOLD = rgb(0.788, 0.635, 0.29);
const INK = rgb(0.07, 0.07, 0.08);
const STEEL = rgb(0.42, 0.43, 0.46);
const RULE = rgb(0.82, 0.8, 0.74);
const W = 612; const H = 792; const M = 48;

/** Helvetica (WinAnsi) cannot draw arbitrary Unicode: map common punctuation, drop the rest. */
export const winAnsi = (s: string): string =>
  String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E -ÿ]/g, '?');

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = winAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) <= max) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export type StatementPdfInput = { statement: DealerStatement; lines: StatementLine[]; dealer: Dealer; invoice?: Invoice | null; termsLabel: string };

export async function statementPdf(i: StatementPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Statement ${i.statement.period_start.slice(0, 7)} - ${i.dealer.name}`);
  doc.setAuthor(site.name);
  doc.setProducer(site.name);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ym = i.statement.period_start.slice(0, 7);

  const cols = { date: M, stock: M + 62, veh: M + 128, work: M + 262, amt: W - M };
  const pages: PDFPage[] = [];
  let page: PDFPage = doc.addPage([W, H]); pages.push(page);
  let y = 0;
  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 9; const font = o.font ?? reg; const t = winAnsi(s);
    p.drawText(t, { x: o.right ? x - font.widthOfTextAtSize(t, size) : x, y: yy, size, font, color: o.color ?? INK });
  };

  const header = (first: boolean) => {
    if (!first) { page = doc.addPage([W, H]); pages.push(page); }
    page.drawRectangle({ x: 0, y: H - 74, width: W, height: 74, color: INK });
    page.drawRectangle({ x: 0, y: H - 78, width: W, height: 4, color: GOLD });
    text(page, '916 DENT & DETAIL', M, H - 38, { size: 16, font: bold, color: GOLD });
    text(page, site.tagline, M, H - 56, { size: 8.5, color: rgb(0.9, 0.87, 0.8) });
    text(page, 'STATEMENT', W - M, H - 38, { size: 14, font: bold, color: rgb(0.95, 0.93, 0.89), right: true });
    text(page, monthLabel(ym), W - M, H - 56, { size: 9.5, color: rgb(0.95, 0.93, 0.89), right: true });
    y = H - 108;
    if (first) {
      text(page, 'BILLED TO', M, y, { size: 7.5, font: bold, color: STEEL });
      text(page, i.dealer.name, M, y - 14, { size: 12, font: bold });
      let yy = y - 28;
      for (const l of [i.dealer.contact_name, ...(i.dealer.lot_addresses ?? []).slice(0, 1), i.dealer.ap_email || i.dealer.email].filter(Boolean) as string[]) { text(page, l, M, yy, { color: STEEL }); yy -= 12; }
      const meta: [string, string][] = [
        ['Period', `${i.statement.period_start} to ${i.statement.period_end}`],
        ['Terms', i.termsLabel],
        ['Invoice', i.invoice?.number ?? 'Not yet invoiced'],
        ...(i.invoice?.due_at ? [['Due', i.invoice.due_at.slice(0, 10)] as [string, string]] : []),
        ['Status', (i.invoice?.status ?? i.statement.status).toUpperCase()],
      ];
      let my = y;
      for (const [k, v] of meta) { text(page, k.toUpperCase(), 360, my, { size: 7.5, font: bold, color: STEEL }); text(page, v, W - M, my, { right: true, font: bold }); my -= 14; }
      y = Math.min(yy, my) - 18;
    }
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 1, color: GOLD });
    text(page, 'DONE', cols.date, y - 8, { size: 7.5, font: bold, color: STEEL });
    text(page, 'STOCK #', cols.stock, y - 8, { size: 7.5, font: bold, color: STEEL });
    text(page, 'VEHICLE', cols.veh, y - 8, { size: 7.5, font: bold, color: STEEL });
    text(page, 'WORK', cols.work, y - 8, { size: 7.5, font: bold, color: STEEL });
    text(page, 'AMOUNT', cols.amt, y - 8, { size: 7.5, font: bold, color: STEEL, right: true });
    y -= 22;
  };

  header(true);
  for (const l of i.lines) {
    const veh = wrap(`${l.label}${l.vin ? ` (VIN ...${l.vin.slice(-6)})` : ''}`, reg, 8.5, cols.work - cols.veh - 8);
    const work = wrap(l.description, reg, 8.5, cols.amt - 62 - cols.work);
    const rows = Math.max(veh.length, work.length);
    const need = rows * 11 + l.addons.length * 11 + 12;
    if (y - need < 120) header(false);
    text(page, l.done_at.slice(0, 10), cols.date, y, { size: 8.5 });
    text(page, l.stock_number ?? '-', cols.stock, y, { size: 8.5 });
    veh.forEach((t, n) => text(page, t, cols.veh, y - n * 11, { size: 8.5 }));
    work.forEach((t, n) => text(page, t, cols.work, y - n * 11, { size: 8.5 }));
    text(page, money(l.base), cols.amt, y, { size: 8.5, right: true });
    y -= rows * 11;
    for (const a of l.addons) {
      text(page, `+ Add-on: ${a.label}`, cols.work, y, { size: 8, color: STEEL });
      text(page, money(a.amount), cols.amt, y, { size: 8, right: true });
      y -= 11;
    }
    page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.4, color: RULE });
    y -= 12;
  }
  if (y - 90 < 70) header(false);
  y -= 6;
  text(page, `${i.lines.length} vehicle${i.lines.length === 1 ? '' : 's'}`, cols.work, y, { size: 8.5, color: STEEL });
  text(page, 'TOTAL', cols.amt - 90, y - 18, { size: 9, font: bold, color: STEEL, right: true });
  text(page, money(i.statement.total), cols.amt, y - 18, { size: 14, font: bold, right: true });
  page.drawLine({ start: { x: cols.amt - 160, y: y - 26 }, end: { x: cols.amt, y: y - 26 }, thickness: 1.2, color: GOLD });
  y -= 52;
  const foot = [
    `Terms: ${i.termsLabel}.`,
    ...(i.invoice?.hosted_invoice_url && !i.invoice.mock ? [`Pay online: ${i.invoice.hosted_invoice_url}`] : []),
    ...(i.invoice?.mock ? ['DEMO invoice: no real payment link in demo mode.'] : []),
    ...(site.email.placeholder ? [] : [`Questions: ${site.email.address}`]),
  ];
  for (const f of foot) for (const t of wrap(f, reg, 8.5, W - 2 * M)) { text(page, t, M, y, { size: 8.5, color: STEEL }); y -= 11; }

  pages.forEach((p, n) => { text(p, `${site.name}  |  Statement ${ym}  |  Page ${n + 1} of ${pages.length}`, W / 2 - 110, 28, { size: 7.5, color: STEEL }); });
  return doc.save();
}
