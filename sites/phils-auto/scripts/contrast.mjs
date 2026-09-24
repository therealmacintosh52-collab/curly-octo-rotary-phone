/** WCAG contrast, so palette choices are checked rather than eyeballed. */
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
if (process.argv[1].endsWith("contrast.mjs")) {
  const pairs = [
    ["--eyebrow on ink", "#8b7dff", "#07071a"],
    ["--eyebrow on black", "#8b7dff", "#05050f"],
    ["marquee on black", "#8a94ad", "#05050f"],
    ["footer fine on black", "#8590a6", "#05050f"],
    ["muted on ink", "#94a4bd", "#07071a"],
    ["text on ink", "#e8edf6", "#07071a"],
    ["signal on ink", "#f5a623", "#07071a"],
  ];
  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    console.log(`${name.padEnd(24)} ${fg} on ${bg}  ${r.toFixed(2)}:1  ${r >= 4.5 ? "PASS" : r >= 3 ? "large-text only" : "FAIL"}`);
  }
}
