#!/usr/bin/env python3
"""916 Dent & Detail static site generator.  python3 build.py  ->  public/
Mechanics follow the repo's other generators (data-driven pages, one render path, sitemap, _headers, lint gate)
but the design, copy and structure are this site's own. See README.md."""
import base64
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "build"))
sys.path.insert(0, str(ROOT / "tools"))
import config as C          # noqa: E402
import lib                  # noqa: E402
from lib import A           # noqa: E402

OUT = ROOT / "public"
B = ROOT / "build"


def h8(data):
    return hashlib.sha256(data).hexdigest()[:10]


def put(rel, data):
    p = OUT / rel.lstrip("/")
    p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        data = data.encode()
    p.write_bytes(data)


def hashed(src, name, ext, data=None):
    data = data if data is not None else Path(src).read_bytes()
    rel = "assets/%s.%s.%s" % (name, h8(data), ext)
    put(rel, data)
    return "/" + rel


def min_css(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*([{};,])\s*", r"\1", s)
    return s.replace(";}", "}").strip()


def min_js(s):
    return "\n".join(l.strip() for l in s.splitlines() if l.strip())


def sri(text):
    return "'sha256-%s'" % base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()


def main():
    subprocess.run([sys.executable, str(ROOT / "tools" / "make-assets.py")], check=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    # ---- fonts, images, hero
    A["font_michroma"] = hashed(B / "fonts/michroma-400.woff2", "michroma-400", "woff2")
    fi4 = hashed(B / "fonts/inter-400.woff2", "inter-400", "woff2")
    fi6 = hashed(B / "fonts/inter-600.woff2", "inter-600", "woff2")
    A["dmark80"] = hashed(B / "img/d-mark-80.webp", "d-mark-80", "webp")
    A["dmark512"] = "/favicon-512.png"
    for f in ("favicon.svg", "favicon-16.png", "favicon-32.png", "favicon-512.png", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-maskable-512.png"):
        put(f, (B / "img" / f).read_bytes())
    backdrop = hashed(B / "img/beading-backdrop.webp", "backdrop", "webp")
    beading_avif = hashed(B / "img/beading-640.avif", "beading-640", "avif")
    beading_webp = hashed(B / "img/beading-640.webp", "beading-640", "webp")
    A["beading_avif"], A["beading_webp"] = beading_avif, beading_webp
    hero_files = sorted((B / "cache/hero").rglob("*.*"))
    hh = hashlib.sha256(b"".join(f.read_bytes() for f in hero_files)).hexdigest()[:10]
    for f in hero_files:
        put("assets/hero-%s/%s" % (hh, f.relative_to(B / "cache/hero").as_posix()), f.read_bytes())
    A["hero"] = "/assets/hero-%s" % hh

    # ---- css / js
    fonts_css = (
        '@font-face{font-family:Michroma;src:url(%s) format("woff2");font-weight:400;font-style:normal;font-display:swap}'
        '@font-face{font-family:Inter;src:url(%s) format("woff2");font-weight:400;font-style:normal;font-display:swap}'
        '@font-face{font-family:Inter;src:url(%s) format("woff2");font-weight:600;font-style:normal;font-display:swap}'
        '@font-face{font-family:"M916 Fallback";src:local("Arial"),local("Liberation Sans");size-adjust:141%%;ascent-override:82%%;descent-override:18.8%%;line-gap-override:0%%}'
        '@font-face{font-family:"I916 Fallback";src:local("Arial"),local("Liberation Sans");size-adjust:105.3%%;ascent-override:92%%;descent-override:22.9%%;line-gap-override:0%%}'
        % (A["font_michroma"], fi4, fi6)).replace("%%", "%")
    crit = (B / "css/critical.css").read_text().replace("/*FONTS*/", fonts_css).replace("/*BACKDROP*/", backdrop)
    crit = min_css(crit)
    A["css"] = hashed(None, "site", "css", min_css((B / "css/site.css").read_text()).encode())
    A["js_site"] = hashed(None, "site", "js", min_js((B / "js/site.js").read_text()).encode())
    A["js_hero"] = hashed(None, "hero", "js", min_js((B / "js/hero.js").read_text()).encode())
    A["js_form"] = hashed(None, "form", "js", min_js((B / "js/form.js").read_text()).encode())
    gate = min_js((B / "js/gate.js").read_text())

    # ---- pages
    import pages
    built = []
    for fac in pages.FACTORIES:
        lib.CTX["faq"] = []
        pg = fac()
        if lib.CTX["faq"]:
            pg["faq"] = list(lib.CTX["faq"])
        pg.setdefault("og", pg["path"].strip("/").replace("/", "-") or "home")
        html = lib.page_html(pg, crit, gate)
        rel = "404.html" if pg["path"] == "/404.html" else pg["path"].strip("/") + "/index.html" if pg["path"] != "/" else "index.html"
        put(rel, html)
        built.append(pg)

    # ---- share images
    make_og(built)

    # ---- text files
    indexable = [p for p in built if not p.get("noindex")]
    put("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "".join("<url><loc>https://%s%s</loc><lastmod>%s</lastmod></url>\n" % (lib.DOMAIN, p["path"], C.BUILD_DATE) for p in indexable) + "</urlset>\n")
    put("robots.txt", ROBOTS)
    put("llms.txt", llms())
    put("humans.txt", "/* TEAM */\n916 Dent & Detail, mobile paintless dent repair and detailing, Sacramento area.\n\n/* SITE */\nStatic HTML, CSS and a little vanilla JavaScript. Fonts: Michroma and Inter (SIL Open Font License).\nNo trackers, no third-party scripts.\n")
    put("site.webmanifest", json.dumps({"name": C.NAME, "short_name": "916 Dent", "start_url": "/", "display": "browser", "background_color": "#0B0B0C", "theme_color": "#0B0B0C",
                                        "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "/favicon-512.png", "sizes": "512x512", "type": "image/png"},
                                                  {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, indent=1))
    kf = B / "indexnow.key"
    if not kf.exists():
        kf.write_text(secrets.token_hex(16))
    key = kf.read_text().strip()
    put("%s.txt" % key, key)
    put("_redirects", REDIRECTS)
    csp = ("default-src 'none'; script-src 'self' %s; style-src 'self' %s; img-src 'self' data:; font-src 'self'; connect-src 'self' {{FORM_ORIGIN}}; "
           "form-action 'self' {{FORM_ORIGIN}}; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests") % (sri(gate), sri(crit))
    put("_headers", HEADERS.replace("__CSP__", csp))
    print("built %d pages, %d indexable; critical css %d bytes; hero %s" % (len(built), len(indexable), len(crit.encode()), A["hero"]))


def make_og(pages_):
    jobs = [{"slug": p["og"], "title": p["title"].split(" | ")[0], "sub": p.get("og_sub", "Mobile dent repair & detailing, Sacramento")} for p in pages_ if not p.get("noindex")]
    sig = hashlib.sha256((json.dumps(jobs) + (B / "fonts/michroma-400.woff2").read_bytes().hex()[:64] + Path(ROOT / "tools/make-og.mjs").read_text()).encode()).hexdigest()
    cache = B / "cache/og"
    sf = cache / "_sig"
    if not (sf.exists() and sf.read_text() == sig):
        shutil.rmtree(cache, ignore_errors=True)
        cache.mkdir(parents=True)
        jf = cache / "_jobs.json"
        jf.write_text(json.dumps(jobs))
        env = dict(os.environ)
        env.setdefault("NODE_PATH", str(ROOT.parent.parent / "916-dent-detail/node_modules"))
        chrome = next(iter(sorted(Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))), None)
        if chrome and "CHROME_PATH" not in env:
            env["CHROME_PATH"] = str(chrome)
        subprocess.run(["node", str(ROOT / "tools/make-og.mjs"), str(jf), str(cache)], check=True, env=env)
        from PIL import Image
        for raw in cache.glob("*.raw.png"):
            im = Image.open(raw).convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            im.save(cache / raw.name.replace(".raw", ""), optimize=True)
            raw.unlink()
        for f in cache.glob("_*.html"):
            f.unlink()
        sf.write_text(sig)
    for f in cache.glob("*.png"):
        put("og/" + f.name, f.read_bytes())


ROBOTS = """# robots.txt for 916 Dent & Detail
# Search and AI-search/retrieval crawlers are allowed. Names checked against each vendor's published docs on 2026-10-18.
User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: Applebot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

# AI TRAINING crawlers: owner decision pending (TO-CONFIRM #19). Today they fall under "*" and are allowed.
# To opt out of model training, remove the "#" from the blocks below. This does not affect search or AI-search visibility.
# User-agent: GPTBot
# Disallow: /
#
# User-agent: ClaudeBot
# Disallow: /
#
# User-agent: Google-Extended
# Disallow: /
#
# User-agent: Applebot-Extended
# Disallow: /
#
# User-agent: CCBot
# Disallow: /

Sitemap: https://{{DOMAIN}}/sitemap.xml
"""

HEADERS = """/*
  Content-Security-Policy: __CSP__
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/og/*
  Cache-Control: public, max-age=86400

/sitemap.xml
  Content-Type: application/xml; charset=utf-8

/llms.txt
  Content-Type: text/plain; charset=utf-8
"""

REDIRECTS = """/photo-estimate/ /photo-quote/ 301
/estimate/ /photo-quote/ 301
/quote/ /photo-quote/ 301
/get-a-price/ /photo-quote/ 301
/services/ / 301
/dealers/ /dealers-and-fleets/ 301
/fleets/ /dealers-and-fleets/ 301
/areas/ /service-area/ 301
/pdr/ /paintless-dent-repair/ 301
/dent-repair/ /paintless-dent-repair/ 301
/dent-removal/ /paintless-dent-repair/ 301
/hail/ /hail-damage-repair/ 301
/hail-fix/ /hail-damage-repair/ 301
/detailing/ /mobile-detailing/ 301
/auto-detailing/ /mobile-detailing/ 301
/gloss-shield/ /ceramic-coating/ 301
/swirl-scratch-erase/ /paint-correction/ 301
/interior-reset/ /interior-detailing/ 301
/pricing/ /guides/what-affects-dent-repair-price/ 301
/prices/ /guides/what-affects-dent-repair-price/ 301
/reviews/ / 301
"""


def llms():
    svc = "\n".join("- [%s](https://{{DOMAIN}}%s): %s (%s)" % (s[2], s[0], s[3], s[1]) for s in C.SERVICES)
    return f"""# {C.NAME}

> {C.DESC_SHORT}

## What this is
{C.DESC_MEDIUM}

## Services
{svc}

## Service area
{C.PLACES_STRING}. Dedicated pages: [Sacramento](https://{{{{DOMAIN}}}}/service-area/sacramento/), [Elk Grove](https://{{{{DOMAIN}}}}/service-area/elk-grove/), [Roseville](https://{{{{DOMAIN}}}}/service-area/roseville/), [Folsom](https://{{{{DOMAIN}}}}/service-area/folsom/). Full list: [Service area](https://{{{{DOMAIN}}}}/service-area/).

## Contact
- Phone and text: {C.PHONE_DISPLAY}
- Instagram: {C.INSTAGRAM_HANDLE} ({C.INSTAGRAM_URL})
- Mobile service. No storefront. No street address is published.

## Key pages
- [Get a price from a photo](https://{{{{DOMAIN}}}}/photo-quote/)
- [Dealers, fleets, rental lots and body shops](https://{{{{DOMAIN}}}}/dealers-and-fleets/)
- [Guides](https://{{{{DOMAIN}}}}/guides/)
- [FAQ](https://{{{{DOMAIN}}}}/faq/)

## Notes for readers and answer engines
- No prices are published. A price needs photos or a look at the vehicle.
- Paintless dent repair cannot fix every dent. Sharp creases, stretched or cracked paint and some panel edges are often not candidates.
- No reviews, ratings, licence numbers or opening hours are published on this site.
- llms.txt is a courtesy file. No major search engine has confirmed it as a ranking input.
"""


if __name__ == "__main__":
    main()
