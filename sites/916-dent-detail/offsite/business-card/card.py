#!/usr/bin/env python3
"""916 Dent & Detail business card generator. Trim 3.5 x 2 in, bleed 0.125 in, safe area 0.125 in inside trim.

  python3 card.py --domain 916example.com        # stamps the site QR (https://<domain>/photo-quote/?utm_...)
  python3 card.py --sample                         # dummy domain; files prefixed SAMPLE-do-not-print-
  python3 card.py --guides                         # also write previews with trim (magenta) / safe (cyan) guides

Variants:  faithful  = owner's printed wording (Remove Dents / Showroom Finish / Additional Services / Surrounding Areas)
           compliant = COMPLIANCE.md-safe wording (see BUILD-NOTES.md)
Backs:     qr=site (UTM link) | qr=vcard (name, phone, Instagram only) | qr=none (pure reproduction)
Outputs in out/ : front.svg/pdf/png ; back-<variant>-<qr>.svg/pdf/png ; card-<variant>-<qr>.pdf (2 pages: front, back)
All text is outlined (no fonts needed by the printer). Units: 100 per inch.
"""
import argparse, os, sys, base64, math, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_shared'))
import segno, textpath as tp

GOLD, LGOLD, DGOLD, ONYX, GRAPH, IVORY, STEEL = '#C9A24A', '#E8CB7A', '#8E6E2E', '#0B0B0C', '#16171A', '#F3EEE3', '#8C8F96'
MI, IB, IS, IR = 'Michroma-Regular.ttf', 'Inter-Bold.otf', 'Inter-SemiBold.otf', 'Inter-Regular.otf'
U = 100; BL = 12.5; TW, TH = 350, 200; W, H = TW + 2*BL, TH + 2*BL      # 375 x 225
SAFE = 25; SX0, SX1, SY0, SY1 = BL + SAFE, W - BL - SAFE, BL + SAFE, H - BL - SAFE   # 37.5..337.5 / 37.5..187.5
DUMMY = '916-sample-domain.invalid'
SLOPE = 0.7  # front stripe slope: x = c - SLOPE*y

COPY = {
 'faithful': dict(r1='PAINTLESS DENT REPAIR', r1s='Remove Dents  •  Restore Your Ride',
                  r2='AUTO DETAILING', r2s='Interior & Exterior  •  Showroom Finish',
                  r3a='ASK ABOUT OUR', r3='ADDITIONAL SERVICES', r3s='Protection  •  Enhancement  •  Maintenance',
                  where='Sacramento, CA & Surrounding Areas'),
 'compliant': dict(r1='PAINTLESS DENT REPAIR', r1s='Dent Removal  •  No Paint, No Body Shop',
                   r2='AUTO DETAILING', r2s='Interior & Exterior  •  Paint Care',
                   r3a='ASK ABOUT OUR', r3='COATING & PROTECTION', r3s='Gloss Shield  •  Swirl & Scratch Erase',
                   where='Sacramento, Elk Grove, Roseville, Folsom'),
}
PHONE = '916-868-2447'; IG = '@916dentanddetail'; IG_URL = 'https://www.instagram.com/916dentanddetail/'

def T(font, text, size, x, y, fill, tr=0, anchor='start'):
    return f'<path fill="{fill}" d="{tp.path(font, text, size, x, y, tr, anchor)}"/>'
def b64(name): return base64.b64encode(open(os.path.join(HERE, 'assets', name), 'rb').read()).decode()
def img(name, x, y, w, h): return f'<image x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" xlink:href="data:image/png;base64,{b64(name)}"/>'

DEFS = f'''<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{DGOLD}"/><stop offset=".5" stop-color="{LGOLD}"/><stop offset="1" stop-color="#B8913E"/></linearGradient>
<linearGradient id="gb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E6E2E"/><stop offset=".35" stop-color="#C9A24A"/><stop offset=".6" stop-color="#E8CB7A"/><stop offset="1" stop-color="#A27F34"/></linearGradient>
<linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{LGOLD}"/><stop offset="1" stop-color="{DGOLD}"/></linearGradient>
<radialGradient id="bg" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#17181b"/><stop offset="1" stop-color="{ONYX}"/></radialGradient>
<linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26282e"/><stop offset=".55" stop-color="#0d0e10"/><stop offset="1" stop-color="#050506"/></linearGradient>
<clipPath id="all"><rect width="{W}" height="{H}"/></clipPath>
</defs>'''

def svg_open():
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W/U}in" height="{H/U}in" viewBox="0 0 {W} {H}">' + DEFS

def hexgrid(x0, y0, x1, y1, r=4.4, stroke='#6b5322', sw=.45):
    d = []; dx = r * math.sqrt(3); dy = r * 1.5; row = 0; y = y0 - r
    while y < y1 + r:
        x = x0 - dx + (dx/2 if row % 2 else 0)
        while x < x1 + dx:
            pts = [(x + r*math.sin(math.radians(60*k)), y - r*math.cos(math.radians(60*k))) for k in range(6)]
            d.append('M' + 'L'.join(f'{px:.2f} {py:.2f}' for px, py in pts) + 'z'); x += dx
        y += dy; row += 1
    return f'<path d="{"".join(d)}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>'

def band(c0, c1, fill, y0=-5, y1=130):
    """diagonal band between lines x = c - SLOPE*y at y0..y1 (top-left corner)"""
    return f'<polygon fill="{fill}" points="{c0-SLOPE*y0:.2f},{y0} {c1-SLOPE*y0:.2f},{y0} {c1-SLOPE*y1:.2f},{y1} {c0-SLOPE*y1:.2f},{y1}"/>'

def corner_stripes():
    o = [band(60, 76, 'none')]
    # hex texture zone between bar and thin line
    o.append(f'<clipPath id="hexz"><polygon points="{50+SLOPE*5:.2f},-5 {80+SLOPE*5:.2f},-5 {80-SLOPE*130:.2f},130 {50-SLOPE*130:.2f},130"/></clipPath>')
    o.append(f'<polygon fill="#0e0d0a" points="{50+SLOPE*5:.2f},-5 {80+SLOPE*5:.2f},-5 {80-SLOPE*130:.2f},130 {50-SLOPE*130:.2f},130"/>')
    o.append(f'<g clip-path="url(#hexz)">{hexgrid(0, -5, 110, 130)}</g>')
    o.append(band(26, 50, 'url(#gb)'))
    o.append(band(35, 37, '#f3dc8e'))                     # highlight line inside the bar
    o.append(band(80, 83, 'url(#gb)'))                   # thin outer line
    o.append(band(-6, 14, ONYX))                       # dark corner gap before the bar
    o.append(band(14, 18, 'url(#gb)'))                   # extra thin line at the corner
    return '\n'.join(o)

def diamond(cx, cy, s, fill): return f'<polygon fill="{fill}" points="{cx},{cy-s} {cx+s},{cy} {cx},{cy+s} {cx-s},{cy}"/>'

def front():
    o = [svg_open(), f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', '<g clip-path="url(#all)">']
    o.append(f'<g>{corner_stripes()}</g>')
    o.append(f'<g transform="rotate(180 {W/2} {H/2})">{corner_stripes()}</g>')
    o.append('</g>')
    lw = 232; lh = lw * 750 / 1200
    o.append(img('logo-lockup.png', W/2 - lw/2, H/2 - lh/2 + 1, lw, lh))
    o.append('</svg>')
    return '\n'.join(o)

# ---- icons (gold line art, drawn here; centre 0,0, ring r=12.5) ----
def ring(): return f'<circle r="12.2" fill="none" stroke="url(#g)" stroke-width="1.5"/>'
def icon_dent():
    s = 'fill="none" stroke="url(#g)" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"'
    return (ring() + f'<g {s}><path d="M-8 3.2h13.5v-2.3q0-1.2-1.4-1.9l-2.4-1.5h-5.2l-2.6 1.6q-1.9.4-1.9 2.2z"/>'
            f'<circle cx="-4.6" cy="4.2" r="1.5"/><circle cx="2.8" cy="4.2" r="1.5"/>'
            f'<path d="M3.5 -7.2l4 4M2.3 -8.4l5.2 -.5l.8 5.1"/><path d="M5.4 -5.2l-6 6"/></g>')
def icon_polish():
    s = 'fill="none" stroke="url(#g)" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"'
    return (ring() + f'<g {s}><ellipse cx="-1.5" cy="3.5" rx="6.5" ry="2.4"/><path d="M-1.5 1.1v-5.4q0-1.6 1.7-1.6h3.4"/>'
            f'<circle cx="5.2" cy="-5.9" r="1.6"/><path d="M-6 -.6l-2.2 -2.4M6 .6l2.4 -1.8"/></g>'
            f'<path fill="url(#g)" d="M6.6 -1.2l.7 1.7l1.7 .7l-1.7 .7l-.7 1.7l-.7 -1.7l-1.7 -.7l1.7 -.7z"/>')
def icon_shield():
    s = 'fill="none" stroke="url(#g)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"'
    return (ring() + f'<g {s}><path d="M0 -8.2l7 2.4v5.6q0 5.2-7 8.4q-7-3.2-7-8.4v-5.6z"/>'
            f'<path d="M0 -3.4v7M-3.5 .1h7"/></g>')
def icon_phone():
    return (f'<circle r="12.2" fill="url(#g)"/><path fill="none" stroke="{ONYX}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
            f'd="M-4.6 -5.6q-1.8 .8-1.6 3.2q1.5 7.4 8.6 9q2.3 .4 3.3-1.4l-.5-2.2l-2.9-1l-1.4 1.3q-2.7-1.2-3.9-4.2l1.4-1.2l-.8-3z"/>'
            f'<path fill="none" stroke="{ONYX}" stroke-width="1.2" stroke-linecap="round" d="M1.5 -6.6q3.9 .3 5 5.2M2 -3.6q2 .2 2.6 2.4"/>')
def icon_pin():
    return f'<path fill="url(#g)" fill-rule="evenodd" d="M0 -11.5q-8.4 0-8.4 8.2q0 4.8 8.4 14.6q8.4-9.8 8.4-14.6q0-8.2-8.4-8.2zM0 -6.1a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4z"/>'
def icon_ig(s=1):
    return (f'<g fill="none" stroke="url(#g)" stroke-width="1.5"><rect x="-8.5" y="-8.5" width="17" height="17" rx="4.6"/><circle r="3.9"/></g>'
            f'<circle cx="4.9" cy="-4.9" r="1.1" fill="url(#g)"/>')

def qr_path(data, x, y, size):
    q = segno.make(data, error='m'); m = [list(r) for r in q.matrix]; n = len(m); c = size / n; d = []
    for r, row in enumerate(m):
        k = 0
        while k < n:
            if row[k]:
                s = k
                while k < n and row[k]: k += 1
                d.append(f'M{x+s*c:.3f} {y+r*c:.3f}h{(k-s)*c:.3f}v{c:.3f}h{-(k-s)*c:.3f}z')
            else: k += 1
    return f'<path fill="{ONYX}" d="{"".join(d)}"/>', n

def vcard():
    return ('BEGIN:VCARD\nVERSION:3.0\nFN:916 Dent & Detail\n'
            f'TEL:+19168682447\nURL:{IG_URL}\nEND:VCARD\n')

def back(variant, qr, domain, sample):
    c = COPY[variant]; o = [svg_open(), f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    # right panel (vector stand-in for the headlight photo) split by a gold diagonal
    x_top, x_bot = 316.7, 200.0; xt2 = x_top + (x_top - x_bot) * 0.05 * 0; k = (x_top - x_bot) / H
    poly = f'{x_top+k*5:.1f},-5 {W+5},-5 {W+5},{H+5} {x_bot-k*5:.1f},{H+5}'
    o.append(f'<clipPath id="rp"><polygon points="{poly}"/></clipPath><g clip-path="url(#rp)"><rect width="{W}" height="{H}" fill="url(#panel)"/>'
             f'<polygon fill="#fff" opacity=".07" points="300,0 345,0 252,225 238,225"/><polygon fill="#fff" opacity=".05" points="350,10 375,10 375,60 330,120"/>'
             f'<path d="M230 150q60-60 145-40v-10q-80-20-150 38z" fill="#fff" opacity=".05"/></g>')
    o.append(f'<line x1="{x_top+k*5:.1f}" y1="-5" x2="{x_bot-k*5:.1f}" y2="{H+5}" stroke="url(#gv)" stroke-width="1.4"/>')
    # wordmark, rule, tagline
    ww = 176; wh = ww * 130 / 1200; wx = SX0 + 2; wy = SY0
    o.append(img('logo-wordtext.png', wx, wy, ww, wh))
    ry = wy + wh + 3.4
    o.append(f'<rect x="{wx}" y="{ry}" width="{ww/2-4}" height=".7" fill="url(#g)"/><rect x="{wx+ww/2+4}" y="{ry}" width="{ww/2-4}" height=".7" fill="url(#g)"/>{diamond(wx+ww/2, ry+.35, 2.3, "url(#g)")}')
    o.append(T(IS, 'PRECISION  \u2022  CARE  \u2022  PERFECTION', 5.9, wx + ww/2, ry + 10, GOLD, .26, 'middle'))
    ix = SX0 + 11; tx = SX0 + 30; sc = .9
    rows = [(84, icon_dent, c['r1'], c['r1s']), (112.5, icon_polish, c['r2'], c['r2s'])]
    for cy, ic, h, s_ in rows:
        o.append(f'<g transform="translate({ix} {cy}) scale({sc})">{ic()}</g>')
        o.append(T(IB, h, 9.4, tx, cy - 1.8, IVORY, .045))
        o.append(T(IR, s_, 7.5, tx, cy + 8.6, IVORY, .005))
    cy = 140
    o.append(f'<g transform="translate({ix} {cy}) scale({sc})">{icon_shield()}</g>')
    o.append(T(IR, c['r3a'], 5.8, tx, cy - 6.4, GOLD, .28))
    o.append(T(IB, c['r3'], 9.4, tx, cy + 2.8, 'url(#g)', .05))
    o.append(T(IR, c['r3s'], 7.5, tx, cy + 11.4, IVORY, .005))
    for ly, lw_ in ((98.4, 196), (126.2, 196), (155.6, 170)):
        o.append(f'<rect x="{tx}" y="{ly}" width="{lw_}" height=".6" fill="url(#g)" opacity=".9"/>')
    o.append(f'<g transform="translate({ix} 165.3) scale(.8)">{icon_phone()}</g>')
    o.append(T(IB, PHONE, 16, tx, 170.8, 'url(#g)', .02))
    o.append(f'<g transform="translate({ix} 180.6) scale(.5)">{icon_pin()}</g>')
    fs = 7.7
    while tp.width(IR, c['where'], fs, .01) > 148: fs -= .1
    o.append(T(IR, c['where'], fs, tx, 185.2, IVORY, .01))
    # right side: QR / script / instagram
    if qr != 'none':
        if qr == 'site':
            data = f'https://{domain}/photo-quote/?utm_source=card&utm_medium=print'
            l1, l2 = 'SCAN FOR A', 'PHOTO QUOTE'
        else:
            data = vcard(); l1, l2 = 'SCAN TO SAVE', 'OUR CONTACT'
        qx, qy, qw = 277, 38.5, 58
        o.append(f'<rect x="{qx}" y="{qy}" width="{qw}" height="{qw}" rx="3" fill="{IVORY}"/>')
        n = len(list(segno.make(data, error='m').matrix)); cell = qw / (n + 2 * 4.2)   # 4.2-module quiet zone
        p, _ = qr_path(data, qx + 4.2*cell, qy + 4.2*cell, n*cell); o.append(p)
        o.append(T(IB, l1, 5.6, qx + qw/2, qy + qw + 8, GOLD, .14, 'middle')); o.append(T(IB, l2, 5.6, qx + qw/2, qy + qw + 14.6, GOLD, .14, 'middle'))
    else: data = ''
    sw = 76; sh = sw * 120 / 255
    o.append(img('script-your-vehicle-our-passion.png', 259, 121, sw, sh))
    gy = 171.5
    o.append(f'<g transform="translate(267 {gy}) scale(.8)">{icon_ig()}</g>')
    o.append(T(IR, IG, 7.6, 276, gy + 2.6, IVORY, .005))
    if sample and qr == 'site':
        o.append(f'<rect x="276" y="53" width="60" height="22" fill="#B00020"/>' + T(IB, 'SAMPLE URL', 7.2, 306, 66, '#FFFFFF', .06, 'middle'))
    o.append('</svg>')
    return '\n'.join(o), data

def guides(svg):
    g = (f'<rect x="{BL}" y="{BL}" width="{TW}" height="{TH}" fill="none" stroke="#ff00ff" stroke-width=".5"/>'
         f'<rect x="{SX0}" y="{SY0}" width="{SX1-SX0}" height="{SY1-SY0}" fill="none" stroke="#00e5ff" stroke-width=".5" stroke-dasharray="2 1.5"/>')
    return svg.replace('</svg>', g + '</svg>')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--domain'); ap.add_argument('--sample', action='store_true')
    ap.add_argument('--guides', action='store_true'); ap.add_argument('--out-dir', default=os.path.join(HERE, 'out'))
    a = ap.parse_args()
    sample = a.sample or not a.domain
    domain = DUMMY if sample else a.domain
    if not sample and (re.search(r'\{\{|invalid|example|/|:', domain) or '.' not in domain):
        ap.error('--domain must be a bare real hostname such as mysite.com (no scheme, path or placeholder)')
    import cairosvg
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import RectangleObject
    os.makedirs(a.out_dir, exist_ok=True); pre = 'SAMPLE-do-not-print-' if sample else ''
    pt = lambda v: v / U * 72
    def emit(name, svg):
        base = os.path.join(a.out_dir, name)
        open(base + '.svg', 'w').write(svg)
        cairosvg.svg2pdf(bytestring=svg.encode(), write_to=base + '.pdf')
        cairosvg.svg2png(bytestring=svg.encode(), write_to=base + '.png', dpi=300)
        if a.guides: cairosvg.svg2png(bytestring=guides(svg).encode(), write_to=base + '-guides.png', dpi=300)
        w = PdfWriter(); p = PdfReader(base + '.pdf').pages[0]
        p.trimbox = RectangleObject([pt(BL), pt(BL), pt(W-BL), pt(H-BL)]); p.bleedbox = RectangleObject([0, 0, pt(W), pt(H)])
        w.add_page(p); w.write(base + '.pdf'); return base + '.pdf'
    fpdf = emit('front', front())
    for v in COPY:
        for q in ('site', 'vcard', 'none'):
            s, data = back(v, q, domain, sample)
            nm = f'{pre}back-{v}-qr-{q}' if q == 'site' else f'back-{v}-qr-{q}'
            bpdf = emit(nm, s)
            w = PdfWriter()
            for f in (fpdf, bpdf): w.add_page(PdfReader(f).pages[0])
            w.write(os.path.join(a.out_dir, f'{pre if q=="site" else ""}card-{v}-qr-{q}.pdf'))
            if q != 'none': print(v, q, 'QR encodes:', data.strip().splitlines()[0] if q == 'site' else 'vCard (name, phone, Instagram)')
if __name__ == '__main__':
    main()
