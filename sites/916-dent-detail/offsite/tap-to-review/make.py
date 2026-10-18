#!/usr/bin/env python3
"""Tap-to-review plate generator (4 x 6 in trim, 0.125 in bleed, 0.25 in safe area).

  python3 make.py --url https://g.page/r/XXXX/review [--short https://916dd.example/r] [--out-dir .]
  python3 make.py --sample            # dummy URL, watermarked, filename SAMPLE-do-not-print

The REAL review URL does not exist until the Google Business Profile is verified
(see ../REVIEWS-KIT.md). Never print a plate made with the sample URL.

Outputs: <name>.svg, <name>.pdf (page = trim + bleed, TrimBox set), <name>-preview.png, nfc-url.txt
QR encodes --short when given (so the destination can change without reprinting), else --url.
"""
import argparse, os, sys, base64, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_shared'))
import segno, textpath as tp

GOLD, LGOLD, ONYX, GRAPH, IVORY, STEEL = '#C9A24A', '#E8CB7A', '#0B0B0C', '#16171A', '#F3EEE3', '#8C8F96'
MI, IB, IS, IR = 'Michroma-Regular.ttf', 'Inter-Bold.otf', 'Inter-SemiBold.otf', 'Inter-Regular.otf'
U = 100  # user units per inch
BLEED, TW, TH, SAFE = 12.5, 400, 600, 25
W, H = TW + 2*BLEED, TH + 2*BLEED
DUMMY = 'https://example.invalid/review'

def t(font, text, size, x, y, fill, tracking=0, anchor='start', extra=''):
    return f'<path fill="{fill}" {extra} d="{tp.path(font, text, size, x, y, tracking, anchor)}"/>'

def qr_modules(data, x, y, size, dark):
    q = segno.make(data, error=('q'), micro=False)
    m = [list(r) for r in q.matrix]; n = len(m); cell = size / n
    d = []
    for r, row in enumerate(m):
        c = 0
        while c < n:
            if row[c]:
                s = c
                while c < n and row[c]: c += 1
                d.append(f'M{x+s*cell:.3f} {y+r*cell:.3f}h{(c-s)*cell:.3f}v{cell:.3f}h{-(c-s)*cell:.3f}z')
            else: c += 1
    return f'<path fill="{dark}" d="{"".join(d)}"/>', n

def build(qr_data, short_text, sample):
    cx = W / 2
    mark = base64.b64encode(open(os.path.join(HERE, 'assets', 'logo-mark.png'), 'rb').read()).decode()
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W/U}in" height="{H/U}in" viewBox="0 0 {W} {H}">')
    o.append(f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8E6E2E"/><stop offset=".5" stop-color="{LGOLD}"/><stop offset="1" stop-color="#B8913E"/></linearGradient>'
             f'<clipPath id="bleedclip"><rect width="{W}" height="{H}"/></clipPath></defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="{ONYX}"/>')
    # diagonal gold stripes, top-left and bottom-right, run into the bleed
    o.append('<g clip-path="url(#bleedclip)">')
    for (dx, wid, col) in [(0, 26, 'url(#g)'), (38, 7, GOLD), (54, 2.5, LGOLD)]:
        o.append(f'<polygon fill="{col}" points="{dx},0 {dx+wid},0 {dx+wid-95},95 {dx-95},95"/>')
    for (dx, wid, col) in [(0, 26, 'url(#g)'), (38, 7, GOLD), (54, 2.5, LGOLD)]:
        o.append(f'<polygon fill="{col}" points="{W-dx},{H} {W-dx-wid},{H} {W-dx-wid+95},{H-95} {W-dx+95},{H-95}"/>')
    o.append('</g>')
    # mark (safe area: y >= BLEED+SAFE = 37.5)
    mw = 118; mh = mw * 465 / 560
    o.append(f'<image x="{cx-mw/2}" y="52" width="{mw}" height="{mh:.1f}" xlink:href="data:image/png;base64,{mark}"/>')
    y = 52 + mh + 34
    o.append(t(MI, 'LEAVE US A REVIEW', 21, cx, y, 'url(#g)', 0.04, 'middle'))
    o.append(t(IR, 'Tap the top of your phone here, or scan the code.', 12.5, cx, y + 24, IVORY, 0, 'middle'))
    # QR panel
    pw = 232; px = cx - pw/2; py = y + 44
    o.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{pw}" rx="10" fill="{IVORY}"/>')
    n = len(list(segno.make(qr_data, error='q').matrix))
    cell = pw / (n + 2 * 4.5)   # quiet zone = 4.5 modules each side (spec minimum is 4)
    qsz = cell * n
    qs, n = qr_modules(qr_data, px + (pw - qsz)/2, py + (pw - qsz)/2, qsz, ONYX)
    qz_modules = ((pw - qsz)/2) / cell
    o.append(qs)
    # NFC marker
    ny = py + pw + 40
    o.append(f'<circle cx="{cx-98}" cy="{ny-6}" r="19" fill="none" stroke="{GOLD}" stroke-width="2"/>')
    for i, r in enumerate((5, 10, 15)):
        o.append(f'<path d="M{cx-103+i*4.5:.1f} {ny-6-r*0.75:.1f} A{r} {r} 0 0 1 {cx-103+i*4.5:.1f} {ny-6+r*0.75:.1f}" fill="none" stroke="{GOLD}" stroke-width="2" stroke-linecap="round"/>')
    o.append(t(IB, 'NFC', 10.5, cx-98, ny+30, GOLD, 0.12, 'middle'))
    o.append(t(IS, 'Google review', 14, cx-62, ny-8, IVORY, 0, 'start'))
    o.append(t(IR, 'Opens in the Google app or browser', 10.5, cx-62, ny+10, '#B9BBC1', 0, 'start'))
    o.append(t(IR, short_text, 12.5, cx, ny + 58, LGOLD, 0.02, 'middle'))
    o.append(t(MI, '916 DENT & DETAIL', 11, cx, H - BLEED - SAFE - 10, GOLD, 0.12, 'middle'))
    if sample:
        o.append(f'<g transform="rotate(-35 {cx} {H/2})" opacity=".92"><rect x="-120" y="{H/2-58}" width="{W+240}" height="116" fill="#B00020"/>')
        o.append(t(IB, 'SAMPLE', 44, cx, H/2 + 4, '#FFFFFF', 0.08, 'middle'))
        o.append(t(IB, 'DO NOT PRINT - DUMMY LINK', 22, cx, H/2 + 38, '#FFFFFF', 0.06, 'middle') + '</g>')
    o.append('</svg>')
    return '\n'.join(o), n, qz_modules

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url'); ap.add_argument('--short', default=''); ap.add_argument('--sample', action='store_true')
    ap.add_argument('--out-dir', default=HERE)
    a = ap.parse_args()
    sample = a.sample or (a.url or DUMMY) == DUMMY
    url = DUMMY if sample and not a.url else a.url
    if not url: ap.error('--url is required (or use --sample)')
    if not sample:
        if not re.match(r'^https://', url) or re.search(r'invalid|example\.|localhost|\{\{', url):
            ap.error('refusing: --url must be a real https:// review link (no placeholders, no example.*)')
        if a.short and not re.match(r'^https://', a.short): ap.error('--short must be https://')
    qr_target = a.short or url
    short_text = (re.sub(r'^https://', '', a.short) if a.short else (re.sub(r'^https://', '', url) if len(url) < 34 else 'g.page review link')) if not sample else 'example.invalid/review'
    svg, n, qz = build(qr_target, short_text, sample)
    name = 'SAMPLE-do-not-print' if sample else 'review-plate-4x6'
    os.makedirs(a.out_dir, exist_ok=True)
    base = os.path.join(a.out_dir, name)
    open(base + '.svg', 'w').write(svg)
    import cairosvg
    cairosvg.svg2pdf(bytestring=svg.encode(), write_to=base + '.pdf')
    cairosvg.svg2png(bytestring=svg.encode(), write_to=base + '-preview.png', dpi=150)
    try:
        from pypdf import PdfReader, PdfWriter
        from pypdf.generic import RectangleObject
        r = PdfReader(base + '.pdf'); w = PdfWriter(); p = r.pages[0]
        b = BLEED / U * 72; pw = W / U * 72; ph = H / U * 72
        p.trimbox = RectangleObject([b, b, pw - b, ph - b]); p.bleedbox = RectangleObject([0, 0, pw, ph])
        w.add_page(p); w.write(base + '.pdf')
    except Exception as e:
        print('note: TrimBox not set (', e, ')')
    open(os.path.join(a.out_dir, 'nfc-url.txt'), 'w').write(qr_target + '\n' if not sample else 'SAMPLE ONLY - ' + qr_target + '\n')
    print(f'{name}: QR v{n} modules, quiet zone {qz:.1f} modules, encodes {qr_target}')

if __name__ == '__main__':
    main()
