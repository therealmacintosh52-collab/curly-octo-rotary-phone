#!/usr/bin/env python3
"""Render the $29 review-request card kit (EXP-A5, T-010) to PDF + PNG.

    python3 library/templates/review-card/render_card.py CONFIG.json [--out DIR]

CONFIG.json (copy sample.json): business, review_url, variant A|B|C,
accent (#rrggbb), sample (true only for the fictional sample).

Writes to DIR (default library/templates/review-card/out/<slug>/, gitignored):
  card-sheet.pdf  letter page, 10 cards of 3.5 x 2 in, cut lines  <- print this
  sign.pdf        letter counter sign                              <- or this
  card-sheet.png, sign.png (300 dpi), card.png (one card, for a text preview)
  qr.svg, qr.png  the bare QR (encodes ONLY review_url)
  card-sheet.html, sign.html  the filled templates

Reuses what the repo already uses, adds nothing:
  - reportlab's QR encoder (reportlab: dropship-os/assets/render_gift_note.py)
  - Pillow (same script) for PNG crops and the QR self-check
  - headless Chromium, the binary sites/cali-tints/scripts/og-images.mjs uses
Gates built in: wording is one of growth's three approved variants (no free
text, so no gating or incentive wording can get in; C4); the review link must
be https on a Google host; layout-fit check; every QR module in the PNG and in
the rasterized PDF is compared with the encoder's matrix (0 mismatches needed).
Exit: 0 ok · 2 config error · 3 no Chromium · 4 a self-check failed.
"""
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

from PIL import Image
from reportlab.graphics.barcode import qrencoder

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from check_deliverable import FAIL_PATTERNS  # noqa: E402  (shared wording lint)

DPI_SCALE = 3.125            # 96 CSS px/in x 3.125 = 300 dpi
PX = 96 * DPI_SCALE           # image px per inch
QUIET = 4                     # quiet-zone modules around the QR
# Hosts Google review links are known to use. The exact link format Google's
# "ask for reviews" share option gives is UNVERIFIED (growth kit); extend this
# list from a real owner screenshot, never to make a non-Google link pass.
GOOGLE_HOSTS = {"g.page", "search.google.com", "www.google.com", "google.com",
                "maps.google.com", "maps.app.goo.gl", "goo.gl"}
# Growth's three approved variants (library/outreach/review-card-kit-2026-10-13.md)
VARIANTS = {
    "A": "Thanks for choosing {biz}. We'd love your honest Google review: "
         "scan the code or visit <span class=\"u\">{link}</span>.",
    "B": "Your honest review helps other customers decide. Scan to leave one on Google.",
    "C": "Tell us what you think, good or bad. Scan to leave your honest Google review.",
}
# Geometry shared with card.html / sign.html (inches). Change both together.
CARD_ORIGIN, CARD_W, CARD_H, COLS, ROWS = (0.75, 0.5), 3.5, 2.0, 2, 5
CARD_QR = (2.05, 0.15, 1.3)   # left, top, size inside a card
SIGN_QR = (2.25, 4.4, 4.0)    # left, top, size on the sign

FIT_JS = """<script>
(function(){var bad=[];function r(e){return e.getBoundingClientRect();}
function chk(name,a,b){if(a&&b&&r(a).bottom>r(b).top+0.5)bad.push(name);}
document.querySelectorAll('.card').forEach(function(c,i){
  var lim=c.querySelector('.sample')||c.querySelector('.scan');
  chk('card'+i+':text',c.querySelector('.txt'),lim);
  if(r(c.querySelector('.link')).bottom>r(c).bottom-1)bad.push('card'+i+':link');});
if(!document.querySelector('.card')){
  chk('sign:name',document.querySelector('.biz'),document.querySelector('.ask'));
  chk('sign:ask',document.querySelector('.ask'),document.querySelector('.qr'));
  var s=document.querySelector('.sample');
  if(s)chk('sign:link',document.querySelector('.link'),s);
  else if(r(document.querySelector('.link')).bottom>r(document.body).bottom)bad.push('sign:link');}
var m=document.createElement('meta');m.id='fit';m.content=bad.length?'fail:'+bad.join(','):'ok';
document.head.appendChild(m);})();
</script>"""


def die(msg, code):
    print("ERROR: " + msg)
    sys.exit(code)


def find_chrome():
    cands = [os.environ.get("PW_CHROME", "")]
    cands += sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"), reverse=True)
    cands += sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome")), reverse=True)
    cands += [shutil.which(n) or "" for n in ("chromium", "chromium-browser", "google-chrome")]
    return next((c for c in cands if c and os.path.exists(c)), None)


def load_config(path):
    cfg = json.load(open(path, encoding="utf-8"))
    biz = str(cfg.get("business", "")).strip()
    url = str(cfg.get("review_url", "")).strip()
    variant = str(cfg.get("variant", "")).strip().upper()
    accent = str(cfg.get("accent", "#1f2a44")).strip()
    sample = cfg.get("sample") is True
    if not biz or len(biz) > 60:
        die("business must be 1-60 characters", 2)
    if variant not in VARIANTS:
        die("variant must be A, B or C (growth's approved wording; no free text)", 2)
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", accent):
        die("accent must be #rrggbb", 2)
    u = urlparse(url)
    host = (u.hostname or "").lower()
    if u.scheme != "https":
        die("review_url must start with https://", 2)
    if sample:
        if not host.endswith(".example"):
            die("sample:true requires a reserved .example host (no real business in samples)", 2)
        if "SAMPLE" not in biz:
            die("sample:true requires the word SAMPLE in the business name", 2)
    elif host not in GOOGLE_HOSTS:
        die(f"review_url host '{host}' is not a Google host; the QR must encode ONLY the "
            "business's Google review link. If Google gave a link on another Google host, "
            "send qa the screenshot to extend GOOGLE_HOSTS.", 2)
    elif "SAMPLE" in biz.upper():
        die("a real client config must not contain SAMPLE", 2)
    if len(url) > 120:
        die("review_url over 120 characters will not fit the card", 2)
    for pat, why in FAIL_PATTERNS:
        if re.search(pat, biz):
            die(f"business name fails the wording lint ({why})", 2)
    link = re.sub(r"^https://", "", url).rstrip("/")
    if variant == "A" and len(link) > 40:
        die(f"variant A prints the link inside the sentence; this link is {len(link)} "
            "characters (max 40). Use variant B or C; the link is still printed under the QR.", 2)
    return dict(biz=biz, url=url, variant=variant, accent=accent, sample=sample, link=link)


def qr_matrix(url):
    q = qrencoder.QRCode(None, qrencoder.QRErrorCorrectLevel.M)
    q.addData(url)
    q.make()
    n = q.getModuleCount()
    return [[bool(q.isDark(r, c)) for c in range(n)] for r in range(n)]


def qr_svg(mx):
    n, m = len(mx), len(mx) + 2 * QUIET
    d = "".join(f"M{c + QUIET} {r + QUIET}h1v1h-1z" for r in range(n) for c in range(n) if mx[r][c])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {m} {m}" '
            f'shape-rendering="crispEdges" role="img" aria-label="QR code to the Google review page">'
            f'<rect width="{m}" height="{m}" fill="#fff"/><path d="{d}" fill="#000"/></svg>')


def qr_png(mx, path, module_px=20):
    n, m = len(mx), len(mx) + 2 * QUIET
    img = Image.new("L", (m * module_px, m * module_px), 255)
    px = img.load()
    for r in range(n):
        for c in range(n):
            if mx[r][c]:
                for y in range((r + QUIET) * module_px, (r + QUIET + 1) * module_px):
                    for x in range((c + QUIET) * module_px, (c + QUIET + 1) * module_px):
                        px[x, y] = 0
    img.save(path)


def fill(template, cfg, svg, sample_html):
    biz = html.escape(cfg["biz"])
    ask = VARIANTS[cfg["variant"]].format(biz=biz, link=html.escape(cfg["link"]))
    out = (template.replace("{{BUSINESS}}", biz).replace("{{ASK}}", ask)
           .replace("{{QR_SVG}}", svg).replace("{{LINK_TEXT}}", html.escape(cfg["link"]))
           .replace("{{ACCENT}}", cfg["accent"]).replace("{{SAMPLE_MARK}}", sample_html))
    left = re.findall(r"\{\{[A-Z_]+\}\}", out)
    if left:
        die(f"unfilled template tokens: {left}", 4)
    return out


def chrome(binary, args, url):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [binary, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
               f"--user-data-dir={prof}"] + args + [url]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if res.returncode != 0:
        die(f"Chromium failed ({res.returncode}): {res.stderr[-400:]}", 4)
    return res.stdout


def render(binary, html_path, pdf_path, png_path):
    url = "file://" + html_path
    chrome(binary, ["--no-pdf-header-footer", f"--print-to-pdf={pdf_path}"], url)
    chrome(binary, [f"--force-device-scale-factor={DPI_SCALE}", "--window-size=816,1056",
                    f"--screenshot={png_path}"], url)
    for p in (pdf_path, png_path):
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            die(f"render produced no file: {p}", 4)


def fit_check(binary, filled_html, tmpdir, name):
    p = os.path.join(tmpdir, f"fit-{name}.html")
    open(p, "w", encoding="utf-8").write(filled_html.replace("</body>", FIT_JS + "</body>"))
    dom = chrome(binary, ["--window-size=816,1056", "--virtual-time-budget=3000", "--dump-dom"], "file://" + p)
    m = re.search(r'id="fit" content="([^"]*)"', dom)
    return m.group(1) if m else "fail:no-result"


def qr_mismatches(img, box_in, mx):
    """Sample every module centre of the QR (incl. quiet zone) inside box_in."""
    g = img.convert("L")
    left, top, size = (v * PX for v in box_in)
    n, m = len(mx), len(mx) + 2 * QUIET
    step, bad = size / m, 0
    for r in range(m):
        for c in range(m):
            want = QUIET <= r < n + QUIET and QUIET <= c < n + QUIET and mx[r - QUIET][c - QUIET]
            v = g.getpixel((int(left + (c + 0.5) * step), int(top + (r + 0.5) * step)))
            bad += (v < 128) != want
    return bad


def card_boxes():
    ox, oy = CARD_ORIGIN
    for r in range(ROWS):
        for c in range(COLS):
            x, y = ox + c * CARD_W, oy + r * CARD_H
            yield (x, y), (x + CARD_QR[0], y + CARD_QR[1], CARD_QR[2])


def verify(sheet_img, sign_img, mx, label):
    if sheet_img.size != (2550, 3300) or sign_img.size != (2550, 3300):
        return [f"{label}: image size {sheet_img.size}/{sign_img.size}, expected 2550x3300"]
    errs = []
    for i, (_, box) in enumerate(card_boxes()):
        bad = qr_mismatches(sheet_img, box, mx)
        if bad:
            errs.append(f"{label} card {i}: {bad} QR modules differ")
    bad = qr_mismatches(sign_img, SIGN_QR, mx)
    if bad:
        errs.append(f"{label} sign: {bad} QR modules differ")
    return errs


def main(argv):
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    cfg = load_config(argv[0])
    slug = re.sub(r"[^a-z0-9]+", "-", cfg["biz"].lower()).strip("-")
    out = os.path.abspath(argv[argv.index("--out") + 1]) if "--out" in argv else \
        os.path.join(HERE, "out", ("SAMPLE-" if cfg["sample"] else "") + slug)
    os.makedirs(out, exist_ok=True)
    binary = find_chrome()
    mx = qr_matrix(cfg["url"])
    svg = qr_svg(mx)
    open(os.path.join(out, "qr.svg"), "w").write(svg)
    qr_png(mx, os.path.join(out, "qr.png"))
    card_t = open(os.path.join(HERE, "card.html"), encoding="utf-8").read()
    sign_t = open(os.path.join(HERE, "sign.html"), encoding="utf-8").read()
    m = re.search(r"<!--CARD-->(.*?)<!--/CARD-->", card_t, flags=re.S)
    if not m:
        die("card.html is missing its CARD markers", 4)
    card_t = card_t[: m.start()] + m.group(1) * (COLS * ROWS) + card_t[m.end():]
    mark_card = '<div class="sample">SAMPLE, NOT A REAL BUSINESS</div>' if cfg["sample"] else ""
    mark_sign = '<div class="sample">SAMPLE, NOT A REAL BUSINESS</div>' if cfg["sample"] else ""
    files = {}
    for name, tpl, mark in (("card-sheet", card_t, mark_card), ("sign", sign_t, mark_sign)):
        filled = fill(tpl, cfg, svg, mark)
        hp = os.path.join(out, f"{name}.html")
        open(hp, "w", encoding="utf-8").write(filled)
        files[name] = (hp, filled)
    if not binary:
        die(f"no Chromium found (set PW_CHROME). HTML + QR written to {out}", 3)
    errs = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, (hp, filled) in files.items():
            render(binary, hp, os.path.join(out, f"{name}.pdf"), os.path.join(out, f"{name}.png"))
            fit = fit_check(binary, filled, tmp, name)
            print(f"layout fit {name}: {fit}")
            if fit != "ok":
                errs.append(f"layout {name}: {fit}")
        sheet = Image.open(os.path.join(out, "card-sheet.png"))
        sign = Image.open(os.path.join(out, "sign.png"))
        errs += verify(sheet, sign, mx, "PNG")
        (x, y), _ = next(card_boxes())
        sheet.crop(tuple(int(v * PX) for v in (x, y, x + CARD_W, y + CARD_H))).save(
            os.path.join(out, "card.png"))
        if shutil.which("pdftoppm"):
            for name in files:
                subprocess.run(["pdftoppm", "-r", "300", "-png", "-singlefile",
                                os.path.join(out, f"{name}.pdf"), os.path.join(tmp, name)], check=True)
            errs += verify(Image.open(os.path.join(tmp, "card-sheet.png")),
                           Image.open(os.path.join(tmp, "sign.png")), mx, "PDF")
            print("PDF raster check: done (pdftoppm, 300 dpi)")
        else:
            print("PDF raster check: SKIPPED (pdftoppm not installed); PNG check still ran")
    n = len(mx)
    print(f"QR: version {(n - 17) // 4}, {n}x{n} modules, ECC M, encodes {cfg['url']}")
    for e in errs:
        print("CHECK FAIL: " + e)
    if errs:
        return 4
    print("QR fidelity: 0 mismatched modules on 10 cards + sign")
    for f in sorted(os.listdir(out)):
        print(f"  {os.path.join(out, f)}  {os.path.getsize(os.path.join(out, f))} bytes")
    if cfg["sample"]:
        print("SAMPLE output: never send to anyone.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
