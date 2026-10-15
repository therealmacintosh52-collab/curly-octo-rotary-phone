// Flat vector D-mark: the logo's slanted D plus its three speed lines, as plain geometry (no bevel, no glow), so it stays crisp at 16 px.
// Coordinates are in the 1408x1408 source logo's pixel space (brand/logo.jpg). They were fitted to the trace of the logo made by
// scripts/trace-dmark.mjs (potrace, then Douglas-Peucker corner extraction): straight edges are exact lines, the bowl is two cubic curves
// per side. The overlay check is in DECISIONS P9-004. Colours come from the brand tokens: gold #C9A24A on onyx #0B0B0C.
export const GOLD = '#C9A24A';
export const ONYX = '#0B0B0C';

export const D_PATH =
  'M602 482L795 482C836 485 871 534 871 590C872 628 840 672 798 697C770 711 740 719 700 726L557 742L663 550L729 550L653 686L728 670' +
  'C765 659 796 632 808 610C818 565 800 525 755 524L638 524Z';
export const LINES = [
  'M475 549L626 547L616 567L471 558Z',
  'M426 596L602 594L587 613L424 603Z',
  'M446 645L574 642L561 661L444 651Z',
];
// D alone spans x 557..871, y 482..742. With the lines the mark spans x 424..871.
export const BOX_D = { x: 557, y: 482, w: 314, h: 260 };
export const BOX_FULL = { x: 424, y: 482, w: 447, h: 260 };

/** Thicker, shorter lines for small icons: the logo's hairline speed lines would turn into a grey smudge at 32 px. */
const BOLD_LINES = [
  'M520 546L626 544L614 572L516 563Z',
  'M470 590L602 588L588 617L466 608Z',
  'M500 637L574 635L560 664L496 655Z',
];
export const BOX_BOLD = { x: 466, y: 482, w: 405, h: 260 };

/**
 * One square SVG of the mark.
 *  variant: 'full' (logo proportions) | 'bold' (heavier lines, for 32-64 px) | 'd' (the letter only, for 16 px)
 *  size: output pixels; pad: fraction of the side kept empty on every side; bg: null (transparent) or a colour; radius: corner radius fraction
 */
export function dmarkSvg({ variant = 'full', size = 512, pad = 0.12, bg = ONYX, radius = 0, fill = GOLD } = {}) {
  const box = variant === 'd' ? BOX_D : variant === 'bold' ? BOX_BOLD : BOX_FULL;
  const lines = variant === 'd' ? [] : variant === 'bold' ? BOLD_LINES : LINES;
  const inner = size * (1 - 2 * pad);
  const k = inner / Math.max(box.w, box.h);
  const tx = (size - box.w * k) / 2 - box.x * k;
  const ty = (size - box.h * k) / 2 - box.y * k;
  const bgEl = bg ? `<rect width="${size}" height="${size}" rx="${(radius * size).toFixed(2)}" fill="${bg}"/>` : '';
  const d = [D_PATH, ...lines].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgEl}<path transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${k.toFixed(5)})" fill="${fill}" d="${d}"/></svg>`;
}

/** Standalone SVG (viewBox in logo units, transparent), used as the scalable favicon and the brand master. */
export function dmarkMasterSvg({ withLines = true, fill = GOLD } = {}) {
  const b = withLines ? BOX_FULL : BOX_D;
  const m = 12;
  const d = [D_PATH, ...(withLines ? LINES : [])].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}" role="img" aria-label="916 Dent &amp; Detail D mark"><path fill="${fill}" d="${d}"/></svg>\n`;
}
