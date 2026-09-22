#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stark's Hot Chicken -- static site generator.

    python3 build.py                 build into ./public
    python3 build.py --relative      relative links (file:// or subdirectory hosting)
    python3 build.py --out DIR       build somewhere else

Edit content.py, never public/. Everything -- pages, schema, sitemap, llms.txt,
nav -- regenerates from it.

Design brief: match the reference site's cinematic feel, invert its
discoverability. The reference renders its entire menu client-side, which means
no AI crawler can read it (GPTBot, ClaudeBot and PerplexityBot do not execute
JavaScript). Here every word ships in the HTML and the animation is layered on
top as progressive enhancement only.
"""

import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from _engine import (SiteConfig, Renderer, SchemaGraph, esc, seo_title,   # noqa: E402
                     crumbs_html, build_sitemap, build_deploy_files,
                     build_llms_files)
from content import (CFG, HEAT, MENU, MENU_DISCLAIMER, GALLERY,           # noqa: E402
                     DOORDASH, UBEREATS, PICKUP)

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public")
RELATIVE = "--relative" in sys.argv
if "--out" in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])

BRAND = "Stark's Hot Chicken"
# Pages no longer carry a hard-coded lastmod. sitemap.py stamps a page
# only when its rendered bytes actually change, tracked in .lastmod.json.
PUBLISHED = "2026-09-22"   # fixed guide publication date

NAV = [
    ("/menu/", "Menu"),
    ("/heat-levels/", "Heat Levels"),
    ("/order/", "Order"),
    ("/koreatown/", "Visit"),
    ("/about/", "About"),
]


# --------------------------------------------------------------------------
# Chrome
# --------------------------------------------------------------------------
def header_html(active=None, lang="en"):
    links = "".join(
        '<a href="%s"%s>%s</a>'
        % (url, ' aria-current="page"' if active == url else "", esc(label))
        for url, label in NAV)
    return """<header class="nav" id="siteNav">
  <a class="nav-brand" href="/">
    <img src="/assets/img/logo.png" alt="" width="40" height="40" loading="eager">
    <span>Stark&#x27;s</span>
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navLinks" aria-label="Menu">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <nav class="nav-links" id="navLinks" aria-label="Main">%s
    <a class="btn-order-nav" href="/order/">Order Now</a>
  </nav>
</header>""" % links


def footer_html(lang="en"):
    return """<footer class="footer">
  <div class="foot-main">
    <div class="foot-nap">
      <strong>%(name)s</strong>
      <address>%(addr)s</address>
      <a class="foot-phone" href="tel:%(tel)s">%(phone)s</a>
      <dl class="foot-hours">%(hours)s</dl>
    </div>
    <nav class="foot-nav" aria-label="Footer">
      <div>
        <h3>Eat</h3>
        <a href="/menu/">Full menu</a>
        <a href="/heat-levels/">Heat levels</a>
        <a href="/order/">Order online</a>
        <a href="/catering/">Catering</a>
      </div>
      <div>
        <h3>More</h3>
        <a href="/about/">About</a>
        <a href="/koreatown/">Find us</a>
        <a href="/faq/">FAQ</a>
        <a href="/guides/">Guides</a>
      </div>
      <div>
        <h3>Order</h3>
        <a href="%(dd)s" rel="noopener">DoorDash</a>
        <a href="%(ue)s" rel="noopener">Uber Eats</a>
        <a href="/es/">Espa&ntilde;ol</a>
        <a href="/ko/">&#54620;&#44397;&#50612;</a>
      </div>
    </nav>
  </div>
  <div class="foot-legal">
    <span>&copy; 2026 %(name)s</span>
    <a href="/privacy/">Privacy</a>
    <span class="muted">%(disc)s</span>
  </div>
</footer>""" % {
        "name": esc(BRAND),
        "addr": esc(CFG.full_address),
        "tel": CFG.phone_link,
        "phone": esc(CFG.phone_display),
        "hours": "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(a), esc(b))
                         for a, b in CFG.hours_rows),
        "dd": DOORDASH, "ue": UBEREATS,
        "disc": esc(MENU_DISCLAIMER),
    }


R = Renderer(CFG, OUT, relative=RELATIVE, header=header_html, footer=footer_html,
             css="/assets/css/site.css", js="/assets/js/site.js",
             # No webfont preload and no Google Fonts link. The reference site
             # render-blocks on fonts.googleapis.com; the CSS stack here falls
             # back cleanly. Drop self-hosted anton.woff2 / manrope.woff2 into
             # assets/fonts/ and add an @font-face + preload when available.
             extra_head="")


# --------------------------------------------------------------------------
# Reusable blocks
# --------------------------------------------------------------------------
def answer_block(text, label="The short answer"):
    """Answer-first lede. This is the block LLMs lift, and the one `speakable`
    points at, so it leads every page and stays self-contained."""
    return ('<div class="answer" data-speakable>'
            '<span class="answer-label">%s</span>'
            '<p>%s</p></div>' % (esc(label), text))


def order_cta(heading="Ready to get crispy?", sub=None):
    sub = sub or "Delivery through the official Stark&#x27;s stores. Pickup on Vermont."
    return """<section class="order-moment">
  <div class="wrap">
    <h2>%s</h2>
    <p class="lede">%s</p>
    <div class="platform-row">
      <a class="platform-card dd" href="%s" rel="noopener"><small>Online Delivery</small><span class="pf-name">DoorDash</span><span class="go">Start your order &rarr;</span></a>
      <a class="platform-card ue" href="%s" rel="noopener"><small>Online Delivery</small><span class="pf-name">Uber Eats</span><span class="go">Get the heat &rarr;</span></a>
      <a class="platform-card pk" href="%s" rel="noopener"><small>In-store</small><span class="pf-name">Pickup</span><span class="go">Order pickup &rarr;</span></a>
    </div>
    <p class="foot-note">Prefer to call? <a href="tel:%s">%s</a></p>
  </div>
</section>""" % (esc(heading), sub, DOORDASH, UBEREATS, PICKUP,
                 CFG.phone_link, esc(CFG.phone_display))


def heat_strip(compact=False):
    pills = "".join(
        '<a class="heat-pill h%d" href="/heat-levels/#%s"><b>%s</b><small>%s</small></a>'
        % (i, _slug(h["name"]), esc(h["name"]), esc(h["sub"]))
        for i, h in enumerate(HEAT))
    return '<div class="heat-strip%s">%s</div>' % (
        " compact" if compact else "", pills)


def _slug(name):
    return name.lower().replace(" ", "-").replace("(", "").replace(")", "")


def faq_block(faqs, heading="Frequently asked questions"):
    items = "".join(
        "<details><summary><h3>%s</h3></summary><div>%s</div></details>"
        % (esc(q), a if a.startswith("<") else "<p>%s</p>" % esc(a))
        for q, a in faqs)
    return ('<section class="faq"><div class="wrap"><h2>%s</h2>%s</div></section>'
            % (esc(heading), items))


def menu_section_html(sec, heading_level="h2", show_all=True):
    cards = []
    for it in sec["items"]:
        img = ('<img src="%s" alt="%s" loading="lazy" decoding="async" width="400" height="300">'
               % (it["image"], esc(it["name"])) if it.get("image")
               else '<span class="ph" aria-hidden="true"></span>')
        price = ('<span class="price">$%s</span>' % esc(it["price"])
                 if it.get("price") else "")
        cards.append(
            '<li class="item"><div class="item-media">%s</div>'
            '<div class="item-body"><h3>%s</h3>%s<p>%s</p></div></li>'
            % (img, esc(it["name"]), price, esc(it.get("desc", ""))))
    return ('<section class="menu-sec" id="%s">'
            '<%s>%s</%s><p class="sec-blurb">%s</p>'
            '<ul class="item-grid">%s</ul></section>'
            % (sec["slug"], heading_level, esc(sec["name"]), heading_level,
               esc(sec["blurb"]), "".join(cards)))


def base_graph(url, title, desc, kind="WebPage", trail=None, faqs=None,
               speakable=True, published=None, modified=None, image=None):
    """Every page gets the same linked spine: business + organization +
    website + this page, with the page-specific nodes hung off it."""
    g = SchemaGraph(CFG)
    g.add(g.organization())
    g.add(g.business())
    g.add(g.website())
    g.add(g.webpage(url, title, desc, kind=kind, primary_image=image,
                    speakable_css=["[data-speakable]"] if speakable else None,
                    published=published, modified=modified))
    if trail:
        g.add(g.breadcrumb(trail, CFG.base_url))
    if faqs:
        g.add(g.faq(faqs, url))
    return g


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------
HOME_FAQS = [
    ("Where is Stark's Hot Chicken?",
     "Stark's Hot Chicken is at 207 S Vermont Ave, Los Angeles, CA 90004, in "
     "Koreatown between Beverly and 3rd. Call (213) 378-0138."),
    ("What are Stark's Hot Chicken's hours?",
     "Monday through Thursday 11:00 AM to 12:45 AM, Friday and Saturday 11:00 AM "
     "to 1:45 AM, and Sunday 11:00 AM to 10:30 PM. The kitchen runs past midnight "
     "six nights a week."),
    ("How spicy is Stark's hot chicken?",
     "There are six heat levels: Original (no spice), Mild, Medium, Hot, Extra Hot "
     "and Stark Hot. Medium is the crowd favorite and the one to order if you are "
     "unsure. Stark Hot is the top of the board and is genuinely hot."),
    ("Does Stark's Hot Chicken deliver?",
     "Yes. Delivery runs through DoorDash and Uber Eats. In-store pickup can be "
     "ordered online, or call (213) 378-0138."),
    ("What should I order at Stark's Hot Chicken the first time?",
     "The Stark Sando at Medium heat with a side of slaw. If you are sharing, add "
     "Sloppy Cheeto Fries -- chopped hot chicken, cheese sauce and crushed Hot "
     "Cheetos over seasoned fries."),
    ("Is Stark's Hot Chicken Nashville style or Korean style?",
     "Both. The base is Nashville hot chicken -- cayenne-forward dry rub, fried "
     "crisp, dunked in spiced oil. The Korean side shows up in the gochujang glaze "
     "on the Sweet Pop Chicken and rice cakes, which is where Koreatown gets a say."),
    ("Does Stark's Hot Chicken take reservations?",
     "No. It is counter service -- walk in, order, or order ahead for pickup."),
]


def build_home():
    url = CFG.url("/")
    title = "Stark's Hot Chicken | Nashville Hot Chicken in Koreatown, LA"
    desc = ("Nashville-inspired hot chicken in Koreatown, LA. Six heat levels, "
            "sandos, jumbo tenders and wings. 207 S Vermont Ave, open past "
            "midnight. Pickup and delivery.")
    answer = ("Stark&#x27;s Hot Chicken serves Nashville-inspired hot chicken at "
              "207 S Vermont Ave in Koreatown, Los Angeles. Six heat levels from "
              "Original to Stark Hot, on sandos, jumbo tenders and wings. Open "
              "until 12:45 AM on weeknights and 1:45 AM Friday and Saturday. "
              "Pickup, DoorDash and Uber Eats.")

    feat = "".join(
        '<a class="feat-card" href="/menu/%s/"><div class="feat-media">%s</div>'
        '<h3>%s</h3><p>%s</p><span class="feat-go">See the %s &rarr;</span></a>'
        % (s["slug"],
           ('<img src="%s" alt="%s" loading="lazy" decoding="async" width="480" height="360">'
            % (s["items"][0]["image"], esc(s["items"][0]["name"]))
            if s["items"] and s["items"][0].get("image")
            else '<span class="ph" aria-hidden="true"></span>'),
           esc(s["name"]), esc(s["blurb"]), esc(s["name"].lower()))
        for s in MENU[:4])

    gallery = "".join(
        '<figure class="mas-item"><img src="%s" alt="%s" loading="lazy" '
        'decoding="async" width="500" height="500"><figcaption>%s</figcaption></figure>'
        % (src, esc(alt), esc(cap)) for src, cap, alt in GALLERY)

    body = """<section class="hero">
  <div class="hero-media">
    <img src="/assets/img/gallery/storefront.png" alt="" width="1600" height="900" fetchpriority="high" decoding="async">
    <div class="hero-scrim"></div>
  </div>
  <div class="hero-content">
    <span class="hero-kicker">Los Angeles &middot; Vermont Ave &middot; Koreatown</span>
    <h1><span class="line">Stark&#x27;s Hot Chicken</span><span class="line accent">Crispy Heat. Big Flavor.</span></h1>
    <p class="hero-sub">Nashville-inspired hot chicken made fresh, crispy, and your way.</p>
    <div class="hero-ctas">
      <a class="btn btn-fire" href="/order/">Order Now</a>
      <a class="btn btn-ghost-light" href="/menu/">Explore the menu</a>
    </div>
    <p class="hero-meta"><a href="tel:%(tel)s">%(phone)s</a> &middot; 207 S Vermont Ave &middot; Open till 12:45 AM tonight</p>
  </div>
</section>

<section class="section intro">
  <div class="wrap intro-grid">
    <div>
      <span class="eyebrow">Welcome to Stark&#x27;s</span>
      <h2>This is your sign to <span class="hl">get the heat.</span></h2>
      %(answer)s
      <p class="lede">Fresh chicken, fried crispy to order, dunked in your heat level
      and finished with bold house-made sauces. Comfort sides on deck, and it is all a
      pickup or delivery away.</p>
      <ul class="intro-chips">
        <li>Freshly prepared chicken</li><li>Crispy coating</li>
        <li>Six custom heat levels</li><li>Bold house sauces</li>
        <li>Comfort-food sides</li><li>Fast pickup &amp; delivery</li>
      </ul>
    </div>
    <figure class="intro-figure">
      <div class="frame"><img src="/assets/img/gallery/signature-sando.png" alt="Stark&#x27;s hot chicken sando with slaw, pickles and comeback sauce, served with seasoned fries" loading="lazy" decoding="async" width="600" height="700"></div>
      <span class="sticker">Made<br>Fresh<br>Daily</span>
    </figure>
  </div>
</section>

<section class="section featured">
  <div class="wrap">
    <span class="eyebrow">The Heavy Hitters</span>
    <h2>Featured <span class="hl">dishes</span></h2>
    <div class="feat-grid">%(feat)s</div>
    <p class="center"><a class="btn btn-ghost" href="/menu/">See the full menu</a></p>
  </div>
</section>

<section class="section heat-teaser">
  <div class="wrap">
    <span class="eyebrow">Choose Your Burn</span>
    <h2>Six levels of <span class="hl">heat</span></h2>
    <p class="lede">Every sando, tender and wing comes your way &mdash; from zero spice
    to the one we make you earn.</p>
    %(heat)s
    <p class="center"><a class="btn btn-ghost" href="/heat-levels/">Which level is right for me?</a></p>
  </div>
</section>

<section class="section gallery">
  <div class="wrap">
    <span class="eyebrow">Fresh Out The Fryer</span>
    <h2>The good <span class="hl">stuff</span></h2>
    <div class="masonry">%(gallery)s</div>
  </div>
</section>

%(order)s

<section class="section location">
  <div class="wrap loc-grid">
    <div>
      <span class="eyebrow">Come Say Hi</span>
      <h2>Find us on <span class="hl">Vermont</span></h2>
      <div class="loc-card">
        <div class="loc-row"><b>Address</b><address>%(addr)s</address></div>
        <div class="loc-row"><b>Hours</b><dl class="hours">%(hours)s</dl></div>
        <div class="loc-row"><b>Phone</b><a href="tel:%(tel)s">%(phone)s</a></div>
        <div class="loc-actions">
          <a class="btn-outline" href="%(map)s" rel="noopener">Open in Google Maps</a>
          <a class="btn-mini" href="/order/">Order Now</a>
        </div>
      </div>
      <p><a href="/koreatown/">Parking, transit and what&#x27;s nearby &rarr;</a></p>
    </div>
    <figure class="loc-figure">
      <img src="/assets/img/gallery/storefront.png" alt="The Stark&#x27;s Hot Chicken storefront at 207 S Vermont Ave at dusk" loading="lazy" decoding="async" width="700" height="500">
      <figcaption>207 S Vermont Ave &middot; Los Angeles</figcaption>
    </figure>
  </div>
</section>

%(faq)s
""" % {
        "answer": answer_block(answer),
        "feat": feat, "gallery": gallery,
        "heat": heat_strip(),
        "order": order_cta(),
        "faq": faq_block(HOME_FAQS),
        "addr": esc(CFG.full_address),
        "hours": "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(a), esc(b))
                         for a, b in CFG.hours_rows),
        "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
        "map": ("https://www.google.com/maps/search/?api=1&amp;query="
                "Stark%27s+Hot+Chicken+207+S+Vermont+Ave+Los+Angeles+CA+90004"),
    }

    g = base_graph(url, title, desc, faqs=HOME_FAQS,
                   image="/assets/img/gallery/signature-sando.png")
    for r in g.reviews():
        g.add(r)
    R.render("/", title, desc, body, graph=g, active="/", priority="1.0",
             changefreq="weekly", alternates=CFG.locales)


def build_menu_index():
    url = CFG.url("/menu/")
    title = "Full Menu | Stark's Hot Chicken, Koreatown LA"
    desc = ("The full Stark's Hot Chicken menu with prices: sandos, jumbo "
            "tenders, wings, Korean Sweet Pop Chicken, loaded fries, sides and "
            "combos, in six heat levels.")
    answer = ("Stark&#x27;s Hot Chicken serves sandos, jumbo tenders, wings, popcorn "
              "chicken, loaded fries, sides and combos. Sandos start at $12.99, "
              "tenders at $11.99, wings at $10.99 and combos run $16.99 to $19.99. "
              "Every chicken item comes in one of six heat levels, from Original "
              "(no spice) to Stark Hot.")
    trail = [("Home", "/"), ("Menu", "/menu/")]

    jump = "".join('<a href="#%s">%s</a>' % (s["slug"], esc(s["name"])) for s in MENU)
    sections = "".join(menu_section_html(s) for s in MENU)

    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">The Whole Lineup</span>
    <h1>The full <span class="hl">menu</span></h1>
    %(answer)s
    %(heat)s
  </div>
</section>
<div class="wrap">
  <nav class="jump" aria-label="Menu sections">%(jump)s</nav>
  <div class="menu-tools">
    <label class="menu-search">
      <span class="vh">Search the menu</span>
      <input id="menuSearch" type="search" placeholder="Search the menu &mdash; sando, wings, fries..." autocomplete="off">
    </label>
  </div>
  <div id="menuBody">%(sections)s</div>
  <p class="menu-empty" id="menuEmpty" hidden>No matches &mdash; try another craving.</p>
  <p class="menu-note">%(disc)s</p>
</div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "heat": heat_strip(compact=True), "jump": jump, "sections": sections,
       "disc": esc(MENU_DISCLAIMER), "order": order_cta()}

    g = base_graph(url, title, desc, trail=trail,
                   image="/assets/img/gallery/signature-sando.png")
    g.add(g.menu([(s["name"], s["blurb"], s["items"]) for s in MENU],
                 url, name="Stark's Hot Chicken Menu",
                 disclaimer=MENU_DISCLAIMER))
    R.render("/menu/", title, desc, body, graph=g, active="/menu/",
             priority="0.9", changefreq="weekly")


def build_menu_section(sec):
    path = "/menu/%s/" % sec["slug"]
    url = CFG.url(path)
    title = seo_title("%s in Koreatown LA" % sec["name"], BRAND)
    prices = [i["price"] for i in sec["items"] if i.get("price")]
    lo = min(prices, key=float) if prices else ""
    desc = ("%s at Stark's Hot Chicken, 207 S Vermont Ave, Los Angeles. %s%s"
            % (sec["name"], sec["blurb"],
               " From $%s." % lo if lo else ""))[:160]
    answer = ("%s at Stark&#x27;s Hot Chicken%s. %s Every item comes in six heat "
              "levels, from Original (no spice) to Stark Hot."
              % (esc(sec["name"]), " start at $%s" % esc(lo) if lo else "",
                 esc(sec["blurb"])))
    trail = [("Home", "/"), ("Menu", "/menu/"), (sec["name"], path)]

    others = "".join(
        '<a href="/menu/%s/">%s</a>' % (s["slug"], esc(s["name"]))
        for s in MENU if s["slug"] != sec["slug"])

    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">Menu</span>
    <h1>%(name)s</h1>
    %(answer)s
  </div>
</section>
<div class="wrap">
  %(sec)s
  %(heat)s
  <nav class="jump" aria-label="Other menu sections"><span class="jump-label">More:</span>%(others)s</nav>
</div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "name": esc(sec["name"]),
       "answer": answer_block(answer),
       "sec": menu_section_html(sec, heading_level="h2"),
       "heat": heat_strip(compact=True), "others": others,
       "order": order_cta()}

    g = base_graph(url, title, desc, trail=trail)
    g.add(g.menu([(sec["name"], sec["blurb"], sec["items"])], url,
                 name="%s - %s" % (BRAND, sec["name"]),
                 disclaimer=MENU_DISCLAIMER))
    R.render(path, title, desc, body, graph=g, active="/menu/",
             priority="0.8", changefreq="weekly")


HEAT_FAQS = [
    ("Which Stark's heat level should I order?",
     "Medium. It is the crowd favourite and the level most people re-order -- real "
     "heat that still lets you taste the chicken. Order Mild if you rarely eat "
     "spicy food, and Hot if you drink hot sauce regularly."),
    ("How hot is Stark Hot?",
     "Stark Hot is the top of the six-level board, well past habanero territory. It "
     "is a gloves-on heat that keeps building after the last bite. Order it only if "
     "you routinely finish the hottest thing on a menu, and get slaw or horchata "
     "alongside it."),
    ("What is the difference between Hot and Extra Hot?",
     "Hot is classic Nashville heat -- cayenne-forward, roughly a jalapeno and a "
     "half, and you will sweat. Extra Hot sustains and builds across the whole "
     "sandwich instead of spiking early."),
    ("Can I get no spice at all?",
     "Yes. Original is genuinely zero spice -- just the seasoning and the crust. It "
     "is the safe order for kids and for anyone who wants the crunch without the burn."),
    ("What helps when it is too spicy?",
     "Dairy and starch, not water. The slaw, the spicy mac and cheese, horchata and "
     "the Texas toast all cut capsaicin. Water spreads it around."),
    ("Can I order different heat levels in one order?",
     "Yes. Wings can be split across heat levels -- twelve wings across two, "
     "twenty-four across up to four. Sliders are a cheap way to try a second level."),
]


def build_heat_levels():
    path = "/heat-levels/"
    url = CFG.url(path)
    title = "Heat Levels Explained | Stark's Hot Chicken"
    desc = ("All six Stark's heat levels compared -- Original, Mild, Medium, "
            "Hot, Extra Hot and Stark Hot -- what each tastes like and which "
            "one to order.")
    answer = ("Stark&#x27;s Hot Chicken has six heat levels: Original (no spice), "
              "Mild, Medium, Hot, Extra Hot and Stark Hot. Medium is the crowd "
              "favourite and the right default if you are unsure. Hot is classic "
              "Nashville heat. Stark Hot is the top of the board and is genuinely "
              "punishing &mdash; order it only if you seek out the hottest thing on "
              "every menu.")
    trail = [("Home", "/"), ("Heat Levels", path)]

    rows = "".join(
        '<tr id="%s"><th scope="row"><span class="dot h%d" aria-hidden="true"></span>%s</th>'
        '<td>%s</td><td>%s</td><td>%s</td></tr>'
        % (_slug(h["name"]), i, esc(h["name"]), esc(h["sub"]),
           esc(h["scoville"]), esc(h["who"]))
        for i, h in enumerate(HEAT))

    cards = "".join(
        '<article class="heat-card h%d" id="card-%s">'
        '<span class="heat-index">%d of 6</span>'
        '<h3>%s <small>%s</small></h3><p>%s</p>'
        '<p class="who"><b>Order it if:</b> %s</p></article>'
        % (i, _slug(h["name"]), i + 1, esc(h["name"]), esc(h["sub"]),
           esc(h["note"]), esc(h["who"]))
        for i, h in enumerate(HEAT))

    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">Choose Your Burn</span>
    <h1>Six levels of <span class="hl">heat</span></h1>
    %(answer)s
  </div>
</section>
<div class="wrap">
  <h2>How the six levels compare</h2>
  <div class="table-wrap">
    <table class="heat-table">
      <caption>Stark&#x27;s Hot Chicken heat levels, mildest to hottest. Scoville
      figures are indicative of the spice blend, not laboratory measurements.</caption>
      <thead><tr><th scope="col">Level</th><th scope="col">In short</th>
      <th scope="col">Approx. Scoville</th><th scope="col">Who it is for</th></tr></thead>
      <tbody>%(rows)s</tbody>
    </table>
  </div>
  <h2>What each level actually tastes like</h2>
  <div class="heat-cards">%(cards)s</div>
  <h2>What to drink and eat alongside the heat</h2>
  <p>Capsaicin is fat-soluble, so dairy and starch help and water does not. The
  slaw is the cheapest fix on the menu, the spicy mac and cheese doubles as a
  buffer, and horchata is the best answer to anything above Hot.</p>
</div>
%(faq)s
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "rows": rows, "cards": cards,
       "faq": faq_block(HEAT_FAQS, "Heat level questions"),
       "order": order_cta("Pick your level.")}

    g = base_graph(url, title, desc, trail=trail, faqs=HEAT_FAQS)
    R.render(path, title, desc, body, graph=g, active="/heat-levels/",
             priority="0.9", changefreq="monthly")


def build_order():
    path, url = "/order/", CFG.url("/order/")
    title = "Order Online | Stark's Hot Chicken, Los Angeles"
    desc = ("Order Stark's Hot Chicken for pickup at 207 S Vermont Ave, or "
            "delivery on DoorDash and Uber Eats. Open past midnight six nights "
            "a week.")
    answer = ("Order Stark&#x27;s Hot Chicken three ways: in-store pickup at 207 S "
              "Vermont Ave, delivery on DoorDash, or delivery on Uber Eats. Pickup "
              "is usually the fastest and the cheapest &mdash; delivery-platform "
              "prices are higher than in-store. Call (213) 378-0138 to order by phone.")
    trail = [("Home", "/"), ("Order", path)]
    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">Get The Heat</span>
    <h1>Order <span class="hl">Stark&#x27;s</span></h1>
    %(answer)s
  </div>
</section>
%(order)s
<div class="wrap">
  <h2>Pickup or delivery?</h2>
  <div class="table-wrap"><table class="cmp">
    <thead><tr><th scope="col">&nbsp;</th><th scope="col">Pickup</th><th scope="col">DoorDash</th><th scope="col">Uber Eats</th></tr></thead>
    <tbody>
      <tr><th scope="row">Price</th><td>Lowest</td><td>Platform pricing</td><td>Platform pricing</td></tr>
      <tr><th scope="row">Fees</th><td>None</td><td>Delivery + service</td><td>Delivery + service</td></tr>
      <tr><th scope="row">Best for</th><td>Nearby, want it hottest</td><td>Delivery across LA</td><td>Delivery across LA</td></tr>
    </tbody>
  </table></div>
  <p class="menu-note">%(disc)s</p>
  <h2>Where to pick up</h2>
  <p>207 S Vermont Ave, Los Angeles, CA 90004 &mdash; in Koreatown, between
  Beverly and 3rd. <a href="/koreatown/">Parking and transit details &rarr;</a></p>
</div>
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "order": order_cta("Three ways to order."), "disc": esc(MENU_DISCLAIMER)}
    g = base_graph(url, title, desc, trail=trail)
    R.render(path, title, desc, body, graph=g, active="/order/",
             priority="0.9", changefreq="monthly")


KTOWN_FAQS = [
    ("Where exactly is Stark's Hot Chicken in Koreatown?",
     "207 S Vermont Ave, Los Angeles, CA 90004 -- on Vermont between Beverly Blvd "
     "and W 3rd St, on the eastern edge of Koreatown."),
    ("Is there parking at Stark's Hot Chicken?",
     "There is metered street parking on Vermont and the residential side streets "
     "just east and west. Evenings are busy; the side streets past 3rd usually turn "
     "over faster than Vermont itself."),
    ("What is the closest Metro stop?",
     "Wilshire/Vermont station on the Metro B and D lines is about a ten-minute walk "
     "south. Beverly/Vermont on the B line is a shorter walk north."),
    ("Is Stark's Hot Chicken open late?",
     "Yes -- until 12:45 AM Monday through Thursday and 1:45 AM Friday and Saturday, "
     "which makes it one of the later hot chicken kitchens on this stretch of Vermont. "
     "Sunday closes at 10:30 PM."),
]


def build_koreatown():
    path, url = "/koreatown/", CFG.url("/koreatown/")
    title = "Hot Chicken in Koreatown | Stark's, 207 S Vermont Ave"
    desc = ("Stark's Hot Chicken is at 207 S Vermont Ave in Koreatown, Los Angeles. "
            "Parking, Metro directions, hours and what's nearby.")
    answer = ("Stark&#x27;s Hot Chicken is at 207 S Vermont Ave, Los Angeles, CA "
              "90004, on Vermont between Beverly and 3rd on the eastern edge of "
              "Koreatown. Metered street parking on Vermont and the side streets; "
              "Wilshire/Vermont Metro station is a ten-minute walk. Open until "
              "12:45 AM weeknights and 1:45 AM Friday and Saturday.")
    trail = [("Home", "/"), ("Visit", path)]
    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">Come Say Hi</span>
    <h1>Find us on <span class="hl">Vermont</span></h1>
    %(answer)s
  </div>
</section>
<div class="wrap loc-grid">
  <div>
    <h2>Address and hours</h2>
    <div class="loc-card">
      <div class="loc-row"><b>Address</b><address>%(addr)s</address></div>
      <div class="loc-row"><b>Hours</b><dl class="hours">%(hours)s</dl></div>
      <div class="loc-row"><b>Phone</b><a href="tel:%(tel)s">%(phone)s</a></div>
      <div class="loc-actions"><a class="btn-outline" href="%(map)s" rel="noopener">Open in Google Maps</a></div>
    </div>
    <h2>Getting here</h2>
    <p><b>Driving.</b> Metered street parking runs along Vermont; the residential
    streets just east and west turn over faster in the evening.</p>
    <p><b>Metro.</b> Wilshire/Vermont on the B and D lines is about ten minutes on
    foot. Beverly/Vermont on the B line is closer still.</p>
    <p><b>Walking.</b> The stretch of Vermont between Beverly and 3rd is dense with
    Korean restaurants, cafes and late-night spots &mdash; Stark&#x27;s runs later
    than most of them.</p>
  </div>
  <figure class="loc-figure">
    <img src="/assets/img/gallery/storefront.png" alt="The Stark&#x27;s Hot Chicken storefront at 207 S Vermont Ave in Koreatown" loading="lazy" decoding="async" width="700" height="500">
    <figcaption>207 S Vermont Ave &middot; Koreatown, Los Angeles</figcaption>
  </figure>
</div>
%(faq)s
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "addr": esc(CFG.full_address),
       "hours": "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(a), esc(b))
                        for a, b in CFG.hours_rows),
       "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
       "map": ("https://www.google.com/maps/search/?api=1&amp;query="
               "Stark%27s+Hot+Chicken+207+S+Vermont+Ave+Los+Angeles+CA+90004"),
       "faq": faq_block(KTOWN_FAQS, "Visiting Stark's"),
       "order": order_cta("Order ahead, skip the wait.")}
    g = base_graph(url, title, desc, trail=trail, faqs=KTOWN_FAQS)
    R.render(path, title, desc, body, graph=g, active="/koreatown/",
             priority="0.8", changefreq="monthly")


def build_about():
    path, url = "/about/", CFG.url("/about/")
    title = "About Stark's Hot Chicken | Nashville Heat, Koreatown Address"
    desc = ("How Stark's Hot Chicken brings Nashville-style hot chicken to "
            "Koreatown, Los Angeles -- the dry rub, the six heat levels and the "
            "Korean side of the menu.")
    answer = ("Stark&#x27;s Hot Chicken is a counter-service hot chicken restaurant "
              "at 207 S Vermont Ave in Koreatown, Los Angeles. The base is Nashville "
              "hot chicken &mdash; cayenne-forward dry rub, fried to order, dunked in "
              "spiced oil at one of six heat levels. The Korean side of the menu, "
              "like the gochujang-glazed Sweet Pop Chicken with rice cakes, is where "
              "the neighbourhood gets a say.")
    trail = [("Home", "/"), ("About", path)]
    body = """%(crumbs)s
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">Our Story</span>
    <h1>Nashville heat, <span class="hl">Koreatown</span> address</h1>
    %(answer)s
  </div>
</section>
<div class="wrap prose">
  <h2>What makes it Nashville hot chicken?</h2>
  <p>Nashville hot chicken is not just fried chicken with hot sauce on it. The
  chicken is brined, dredged and fried, then painted with a paste of cayenne and
  spices bloomed in the frying oil. That last step is what makes the crust dark,
  lacquered and hot all the way through instead of hot only on the surface.</p>
  <h2>Why six heat levels instead of two?</h2>
  <p>Because the spread between someone who wants warmth and someone who wants
  to suffer is enormous, and collapsing it into mild-or-hot loses both. Original
  has no spice at all. Stark Hot is the top of the board.
  <a href="/heat-levels/">The full breakdown is here &rarr;</a></p>
  <h2>Where the Korean influence comes in</h2>
  <p>This is Koreatown, and the menu reflects it. The Korean Sweet Pop Chicken
  is glazed in sweet-spicy gochujang and served with rice cakes &mdash; a
  different kind of heat to the cayenne, sweeter and slower.</p>
  <h2>How to order if it is your first time</h2>
  <p>The Stark Sando at Medium, with slaw. If you are sharing, add Sloppy Cheeto
  Fries. <a href="/menu/">The full menu is here &rarr;</a></p>
</div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "order": order_cta()}
    g = base_graph(url, title, desc, trail=trail, kind="AboutPage")
    R.render(path, title, desc, body, graph=g, active="/about/",
             priority="0.7", changefreq="monthly")


GUIDES = [
    {
        "slug": "nashville-vs-korean-fried-chicken",
        "title": "Nashville Hot Chicken vs Korean Fried Chicken",
        "desc": ("Nashville hot chicken and Korean fried chicken are not the same "
                 "dish. The difference is in the crust, the heat source and when "
                 "the sauce goes on."),
        "answer": ("Nashville hot chicken gets its heat from a cayenne paste "
                   "bloomed in frying oil and brushed on after frying, giving a "
                   "dark, dry, lacquered crust. Korean fried chicken is "
                   "double-fried for a thin, glassy crust and then tossed in a wet "
                   "glaze, usually gochujang-based, which is sweeter and slower to "
                   "build. One is dry and sharp; the other is sticky and sweet-hot."),
        "body": """<h2>How the crust differs</h2>
<p>Nashville chicken is fried once in a seasoned dredge. The crust is craggy and
stays dry, because the heat arrives as an oil-based paste rather than a sauce.
Korean fried chicken is fried twice at different temperatures, which drives out
moisture and leaves a thin, brittle shell engineered to survive being sauced.</p>
<h2>How the heat differs</h2>
<p>Cayenne is sharp, immediate and fades. Gochujang is fermented, sweet, savoury
and builds slowly. They sit in genuinely different places on the palate, which is
why people who find one overwhelming often get on fine with the other.</p>
<h2>When the sauce goes on</h2>
<p>Nashville: after frying, brushed on, absorbed into the crust. Korean: after
frying, tossed in a wok or bowl, coating the outside. That timing is the whole
technical difference.</p>
<h2>Which to order at Stark's</h2>
<p>Both are on the menu. The sandos and tenders are Nashville-style across
<a href="/heat-levels/">six heat levels</a>. The
<a href="/menu/popcorn-chicken/">Korean Sweet Pop Chicken</a> is the
gochujang-glazed side of the house.</p>""",
        "faqs": [
            ("Is Nashville hot chicken hotter than Korean fried chicken?",
             "Usually yes at equivalent levels, because cayenne paste delivers a "
             "sharper, more immediate burn than a gochujang glaze. But Stark's "
             "runs six Nashville levels, and Original has no spice at all."),
            ("Which is sweeter?",
             "Korean. Gochujang glazes are built on fermented chilli paste with "
             "sugar; Nashville heat has effectively no sweetness."),
        ],
    },
    {
        "slug": "how-to-pick-your-heat-level",
        "title": "How to Pick Your Hot Chicken Heat Level",
        "desc": ("A practical way to choose between six hot chicken heat levels "
                 "without ruining dinner -- what each level means and how to "
                 "calibrate from food you already eat."),
        "answer": ("Order Medium if you are unsure &mdash; it is the level most "
                   "people re-order. Calibrate from food you already eat: if "
                   "jalapenos are your limit, order Mild; if you finish a plate of "
                   "hot wings comfortably, order Hot; if you seek out the hottest "
                   "item on every menu, Extra Hot or Stark Hot. Order slaw "
                   "alongside anything above Medium."),
        "body": """<h2>Calibrate from something you already eat</h2>
<p>Abstract heat scales are useless. Anchor to a real food. Jalapeno is your
ceiling: order Mild. Comfortable with buffalo wings: Medium to Hot. You put
habanero sauce on things by choice: Extra Hot. You own a bottle of something with
a skull on it: Stark Hot.</p>
<h2>Order down, not up</h2>
<p>You can add heat to a mild sandwich with a sauce on the side. You cannot take
it out of a hot one. When ordering for a group, order a level below the bravest
person at the table.</p>
<h2>Buy yourself an exit</h2>
<p>Slaw, mac and cheese, Texas toast and horchata all cut capsaicin because it is
fat-soluble. Water does not &mdash; it spreads it around. Ordering a side is
cheap insurance.</p>
<h2>Split the order</h2>
<p>Wings can be split across heat levels, and sliders are a cheap way to try a
second level in the same order. <a href="/heat-levels/">The full level-by-level
breakdown is here &rarr;</a></p>""",
        "faqs": [
            ("What is the most popular heat level?",
             "Medium. It is the crowd favourite and the one most people re-order."),
            ("What should I drink with hot chicken?",
             "Horchata or anything dairy. Capsaicin is fat-soluble, so milk-based "
             "drinks strip it; water spreads it around."),
        ],
    },
    {
        "slug": "best-hot-chicken-los-angeles",
        "title": "Where to Eat Hot Chicken in Los Angeles",
        "desc": ("What separates good hot chicken from bad in Los Angeles, and "
                 "what to look for on a menu before you order."),
        "answer": ("Good hot chicken in Los Angeles comes down to four things: the "
                   "chicken is fried to order rather than held, the heat is a "
                   "cayenne paste bloomed in oil rather than a bottled sauce, "
                   "there are enough heat levels to actually choose, and the sides "
                   "are built to cut the burn. Stark&#x27;s Hot Chicken in "
                   "Koreatown does all four and runs past midnight six nights a week."),
        "body": """<h2>Fried to order, not held under a lamp</h2>
<p>Hot chicken degrades fast. A crust that has been sitting goes soft, and the
spice paste separates. If it arrives in under four minutes at a busy hour, it was
not fried for you.</p>
<h2>Paste, not bottled sauce</h2>
<p>Real Nashville heat is cayenne and spices bloomed in the frying oil and
brushed on. Bottled hot sauce sits on the surface and makes the crust soggy.</p>
<h2>Enough levels to actually choose</h2>
<p>Two levels is a menu that has not decided who it is for.
<a href="/heat-levels/">Six</a> lets a table with very different tolerances order
the same dish.</p>
<h2>Sides that do a job</h2>
<p>Slaw, pickles and mac and cheese are not garnish on a hot chicken menu. They
are the thing that lets you finish the plate.</p>
<h2>Late hours</h2>
<p>Hot chicken is late-night food. Stark&#x27;s runs to 12:45 AM on weeknights
and 1:45 AM on Friday and Saturday at
<a href="/koreatown/">207 S Vermont Ave in Koreatown</a>.</p>""",
        "faqs": [
            ("What makes hot chicken different from fried chicken?",
             "The cayenne paste applied after frying. It is bloomed in the frying "
             "oil, which carries the heat into the crust instead of sitting on top."),
            ("Is hot chicken always spicy?",
             "No. At Stark's, Original has no spice at all -- same crust, same "
             "seasoning, zero heat."),
        ],
    },
]


def build_guide(g_data):
    path = "/guides/%s/" % g_data["slug"]
    url = CFG.url(path)
    title = seo_title(g_data["title"], BRAND)
    trail = [("Home", "/"), ("Guides", "/guides/"), (g_data["title"], path)]
    body = """%(crumbs)s
<article class="guide">
  <header class="page-head"><div class="wrap">
    <span class="eyebrow">Guide</span>
    <h1>%(title)s</h1>
    %(answer)s
  </div></header>
  <div class="wrap prose">%(body)s</div>
</article>
%(faq)s
%(order)s
""" % {"crumbs": crumbs_html(trail), "title": esc(g_data["title"]),
       "answer": answer_block(g_data["answer"]), "body": g_data["body"],
       "faq": faq_block(g_data["faqs"], "Common questions"),
       "order": order_cta()}
    g = base_graph(url, title, g_data["desc"], trail=trail, faqs=g_data["faqs"],
                   published=PUBLISHED, modified=PUBLISHED)
    g.add(g.article(g_data["title"], g_data["desc"], url, PUBLISHED, PUBLISHED,
                    image=CFG.og_image))
    R.render(path, title, g_data["desc"], body, graph=g, active=None,
             priority="0.7", changefreq="monthly",
             og_type="article")


def build_guides_index():
    path, url = "/guides/", CFG.url("/guides/")
    title = "Hot Chicken Guides | Stark's Hot Chicken"
    desc = ("Plain-language guides to hot chicken: Nashville versus Korean, how "
            "to pick your heat level, and what separates good hot chicken from bad.")
    answer = ("Three guides: how Nashville hot chicken differs from Korean fried "
              "chicken, how to pick the right heat level out of six, and what to "
              "look for in hot chicken anywhere in Los Angeles.")
    trail = [("Home", "/"), ("Guides", path)]
    cards = "".join(
        '<a class="guide-card" href="/guides/%s/"><h2>%s</h2><p>%s</p>'
        '<span class="feat-go">Read &rarr;</span></a>'
        % (g["slug"], esc(g["title"]), esc(g["desc"])) for g in GUIDES)
    body = """%(crumbs)s
<section class="page-head"><div class="wrap">
  <span class="eyebrow">Guides</span><h1>Know before you order</h1>%(answer)s
</div></section>
<div class="wrap"><div class="guide-grid">%(cards)s</div></div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "cards": cards, "order": order_cta()}
    g = base_graph(url, title, desc, trail=trail, kind="CollectionPage")
    R.render(path, title, desc, body, graph=g, priority="0.6",
             changefreq="monthly")


def build_faq():
    path, url = "/faq/", CFG.url("/faq/")
    title = "FAQ | Stark's Hot Chicken, Koreatown Los Angeles"
    desc = ("Answers about Stark's Hot Chicken: hours, address, parking, heat "
            "levels, delivery, catering and what to order first.")
    answer = ("Stark&#x27;s Hot Chicken is at 207 S Vermont Ave, Los Angeles, CA "
              "90004, open 11:00 AM to 12:45 AM Monday to Thursday, to 1:45 AM "
              "Friday and Saturday, and to 10:30 PM Sunday. Six heat levels. "
              "Pickup, DoorDash and Uber Eats. Call (213) 378-0138.")
    trail = [("Home", "/"), ("FAQ", path)]
    allf = HOME_FAQS + HEAT_FAQS + KTOWN_FAQS
    body = """%(crumbs)s
<section class="page-head"><div class="wrap">
  <span class="eyebrow">Questions</span><h1>Everything people ask</h1>%(answer)s
</div></section>
%(faq)s
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "faq": faq_block(allf, "Questions and answers"), "order": order_cta()}
    g = base_graph(url, title, desc, trail=trail, faqs=allf)
    R.render(path, title, desc, body, graph=g, priority="0.7",
             changefreq="monthly")


def build_catering():
    path, url = "/catering/", CFG.url("/catering/")
    title = "Catering | Stark's Hot Chicken, Los Angeles"
    desc = ("Hot chicken catering in Los Angeles from Stark's -- party wing "
            "counts, tender trays and combos for offices and events. "
            "Call (213) 378-0138.")
    answer = ("Stark&#x27;s Hot Chicken caters events across Los Angeles from 207 S "
              "Vermont Ave in Koreatown. Party counts run to 24 wings split across "
              "up to four heat levels, plus tender trays, loaded fries and sides. "
              "Call (213) 378-0138 to arrange an order.")
    trail = [("Home", "/"), ("Catering", path)]
    body = """%(crumbs)s
<section class="page-head"><div class="wrap">
  <span class="eyebrow">For Groups</span><h1>Feed the whole room</h1>%(answer)s
</div></section>
<div class="wrap prose">
  <h2>What works for a crowd</h2>
  <p>Wings split across heat levels are the easiest group order &mdash; twenty-four
  wings across up to four levels means nobody is stuck with the wrong one. Tender
  trays and combo counts scale the same way.</p>
  <h2>How to order catering</h2>
  <p>Call <a href="tel:%(tel)s">%(phone)s</a>. Give the head count, the spread of
  heat levels and the pickup time. <a href="/menu/">Full menu &rarr;</a></p>
  <h2>How much heat to order for a group</h2>
  <p>Order one level below the bravest person at the table, and add slaw. See
  <a href="/heat-levels/">the heat level guide</a>.</p>
</div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
       "order": order_cta("Planning something bigger?")}
    g = base_graph(url, title, desc, trail=trail)
    g.add(g.service("Hot chicken catering",
                    "Hot chicken catering for offices and events across Los Angeles.",
                    url, service_type="Catering"))
    R.render(path, title, desc, body, graph=g, priority="0.6",
             changefreq="monthly")


# --------------------------------------------------------------------------
# Translated landing pages
#
# Spanish leads. Koreatown reads as Korean-first, but the 90004 data says
# otherwise: Spanish is the most common language spoken at home in the
# Koreatown Northeast neighbourhood (~34.6% of households) against ~18.3% of
# wider Koreatown residents speaking Korean at home. Both ship; Spanish gets
# the fuller page.
# --------------------------------------------------------------------------
def build_spanish():
    path, url = "/es/", CFG.url("/es/")
    title = "Stark's Hot Chicken | Pollo Picante en Koreatown, Los Angeles"
    desc = ("Pollo picante estilo Nashville en Koreatown, Los Angeles. Seis "
            "niveles de picante. 207 S Vermont Ave. Para recoger y a "
            "domicilio.")
    answer = ("Stark&#x27;s Hot Chicken sirve pollo picante estilo Nashville en el "
              "207 S Vermont Ave, Koreatown, Los Angeles. Seis niveles de picante, "
              "desde Original (sin picante) hasta Stark Hot. Abierto hasta las "
              "12:45 AM de lunes a jueves y hasta la 1:45 AM viernes y s&aacute;bado. "
              "Para llevar, DoorDash y Uber Eats. Tel&eacute;fono (213) 378-0138.")
    levels = "".join("<li><b>%s</b> &mdash; %s</li>" % (esc(h["name"]), esc(h["sub"]))
                     for h in HEAT)
    body = """<section class="page-head"><div class="wrap">
  <span class="eyebrow">Koreatown, Los Angeles</span>
  <h1>Pollo picante <span class="hl">estilo Nashville</span></h1>
  %(answer)s
</div></section>
<div class="wrap prose">
  <h2>&iquest;D&oacute;nde estamos?</h2>
  <p>207 S Vermont Ave, Los Angeles, CA 90004, en Koreatown entre Beverly y la 3.
  Tel&eacute;fono <a href="tel:%(tel)s">%(phone)s</a>.</p>
  <h2>Horario</h2>
  <dl class="hours"><div><dt>Lunes a jueves</dt><dd>11:00 AM &ndash; 12:45 AM</dd></div>
  <div><dt>Viernes y s&aacute;bado</dt><dd>11:00 AM &ndash; 1:45 AM</dd></div>
  <div><dt>Domingo</dt><dd>11:00 AM &ndash; 10:30 PM</dd></div></dl>
  <h2>Los seis niveles de picante</h2>
  <ul>%(levels)s</ul>
  <p>Si es su primera vez, pida <b>Medium</b> &mdash; es el favorito. Pida ensalada
  de col para equilibrar el picante.</p>
  <h2>&iquest;Qu&eacute; pedir?</h2>
  <p>El Stark Sando con nivel Medium. Para compartir, las Sloppy Cheeto Fries.
  <a href="/menu/">Men&uacute; completo &rarr;</a></p>
  <h2>C&oacute;mo pedir</h2>
  <p>Para recoger en la tienda, o a domicilio por DoorDash y Uber Eats.
  <a href="/order/">Ver opciones &rarr;</a></p>
</div>
%(order)s
""" % {"answer": answer_block(answer, "En resumen"), "levels": levels,
       "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
       "order": order_cta("&iquest;List@ para el picante?",
                          "Para recoger o a domicilio.")}
    g = base_graph(url, title, desc)
    R.render(path, title, desc, body, graph=g, lang="es", priority="0.7",
             changefreq="monthly", alternates=CFG.locales)


def build_korean():
    path, url = "/ko/", CFG.url("/ko/")
    title = "Stark's Hot Chicken | 외국인 핫치킨, LA 코리아타운"
    desc = ("LA 코리아타운 207 S Vermont Ave. 내슈빌 "
            "스타일 핫치킨, 6단계 매운맛. "
            "포장 및 배달 가능.")
    answer = ("Stark&#x27;s Hot Chicken은 LA 코리아타운 207 S "
              "Vermont Ave에 위치한 내슈빌 스타일 "
              "핫치킨 집입니다. Original(안 매운맛)"
              "부터 Stark Hot까지 6단계. 월~목 오후 "
              "12:45까지, 금~토 새벽 1:45까지 영업. "
              "전화 (213) 378-0138.")
    levels = "".join("<li><b>%s</b> &mdash; %s</li>" % (esc(h["name"]), esc(h["sub"]))
                     for h in HEAT)
    body = """<section class="page-head"><div class="wrap">
  <span class="eyebrow">LA 코리아타운</span>
  <h1>내슈빌 스타일 <span class="hl">핫치킨</span></h1>
  %(answer)s
</div></section>
<div class="wrap prose">
  <h2>위치</h2>
  <p>207 S Vermont Ave, Los Angeles, CA 90004 &mdash; Beverly와 3rd 사이.
  전화 <a href="tel:%(tel)s">%(phone)s</a>.</p>
  <h2>영업시간</h2>
  <dl class="hours"><div><dt>월~목</dt><dd>11:00 AM &ndash; 12:45 AM</dd></div>
  <div><dt>금~토</dt><dd>11:00 AM &ndash; 1:45 AM</dd></div>
  <div><dt>일</dt><dd>11:00 AM &ndash; 10:30 PM</dd></div></dl>
  <h2>6단계 매운맛</h2>
  <ul>%(levels)s</ul>
  <p>처음이라면 <b>Medium</b>을 추천합니다.
  <a href="/heat-levels/">자세히 보기 &rarr;</a></p>
  <h2>메뉴</h2>
  <p>Stark Sando, 점보 텔더, 윈금, 한국식 스윗 팝
  치킨. <a href="/menu/">전체 메뉴 &rarr;</a></p>
  <h2>주문</h2>
  <p>매장 포장, DoorDash, Uber Eats.
  <a href="/order/">주문하기 &rarr;</a></p>
</div>
%(order)s
""" % {"answer": answer_block(answer, "한줄 요약"), "levels": levels,
       "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
       "order": order_cta("주문하세요", "포장 및 배달.")}
    g = base_graph(url, title, desc)
    R.render(path, title, desc, body, graph=g, lang="ko", priority="0.7",
             changefreq="monthly", alternates=CFG.locales)


def build_contact():
    path, url = "/contact/", CFG.url("/contact/")
    title = "Contact Stark's Hot Chicken | (213) 378-0138"
    desc = ("Call Stark's Hot Chicken at (213) 378-0138 or visit 207 S Vermont "
            "Ave, Los Angeles, CA 90004. Hours, directions and ordering links.")
    answer = ("Call Stark&#x27;s Hot Chicken on (213) 378-0138, or visit 207 S "
              "Vermont Ave, Los Angeles, CA 90004. Open 11:00 AM to 12:45 AM "
              "Monday to Thursday, to 1:45 AM Friday and Saturday, and to 10:30 PM "
              "Sunday.")
    trail = [("Home", "/"), ("Contact", path)]
    body = """%(crumbs)s
<section class="page-head"><div class="wrap">
  <span class="eyebrow">Get In Touch</span><h1>Contact us</h1>%(answer)s
</div></section>
<div class="wrap">
  <div class="loc-card">
    <div class="loc-row"><b>Phone</b><a href="tel:%(tel)s">%(phone)s</a></div>
    <div class="loc-row"><b>Address</b><address>%(addr)s</address></div>
    <div class="loc-row"><b>Hours</b><dl class="hours">%(hours)s</dl></div>
  </div>
</div>
%(order)s
""" % {"crumbs": crumbs_html(trail), "answer": answer_block(answer),
       "tel": CFG.phone_link, "phone": esc(CFG.phone_display),
       "addr": esc(CFG.full_address),
       "hours": "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(a), esc(b))
                        for a, b in CFG.hours_rows),
       "order": order_cta()}
    g = base_graph(url, title, desc, trail=trail, kind="ContactPage")
    R.render(path, title, desc, body, graph=g, priority="0.6",
             changefreq="yearly")


def build_privacy():
    path, url = "/privacy/", CFG.url("/privacy/")
    title = seo_title("Privacy", BRAND)
    desc = "How Stark's Hot Chicken handles information collected through this website."
    trail = [("Home", "/"), ("Privacy", path)]
    body = """%(crumbs)s
<section class="page-head"><div class="wrap"><h1>Privacy</h1></div></section>
<div class="wrap prose">
  <p>This site does not set advertising cookies and does not sell personal
  information.</p>
  <h2>What this site collects</h2>
  <p>Standard server logs only. If you follow an ordering link to DoorDash, Uber
  Eats or the pickup site, that service&#x27;s own privacy policy applies to
  anything you do there.</p>
  <h2>Contact</h2>
  <p>Questions about this policy: call <a href="tel:%(tel)s">%(phone)s</a> or
  visit %(addr)s.</p>
</div>
""" % {"crumbs": crumbs_html(trail), "tel": CFG.phone_link,
       "phone": esc(CFG.phone_display), "addr": esc(CFG.full_address)}
    g = base_graph(url, title, desc, trail=trail, speakable=False)
    R.render(path, title, desc, body, graph=g, priority="0.2",
             changefreq="yearly")


def build_404():
    body = """<section class="page-head"><div class="wrap">
  <h1>That page is not on the menu</h1>
  <p class="lede">The link may be old. Try the
  <a href="/menu/">full menu</a>, the <a href="/heat-levels/">heat levels</a>,
  or <a href="/order/">order online</a>.</p>
</div></section>"""
    R.render("/404", "Page not found | Stark's Hot Chicken",
             "That page could not be found.", body, noindex=True,
             in_sitemap=False)
    # Also emit a flat 404.html, which is what most hosts look for.
    src = os.path.join(OUT, "404", "index.html")
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(OUT, "404.html"))


# --------------------------------------------------------------------------
def clean():
    """Wipe generated pages but keep public/assets, which holds real photography."""
    if not os.path.isdir(OUT):
        return
    for entry in os.listdir(OUT):
        if entry == "assets":
            continue
        p = os.path.join(OUT, entry)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)


def copy_assets():
    src = os.path.join(ROOT, "assets")
    dst = os.path.join(OUT, "assets")
    if os.path.isdir(src):
        for dirpath, _d, files in os.walk(src):
            rel = os.path.relpath(dirpath, src)
            target = os.path.join(dst, rel) if rel != "." else dst
            os.makedirs(target, exist_ok=True)
            for f in files:
                shutil.copyfile(os.path.join(dirpath, f), os.path.join(target, f))


def main():
    os.makedirs(OUT, exist_ok=True)
    clean()
    copy_assets()

    build_home()
    build_menu_index()
    for sec in MENU:
        build_menu_section(sec)
    build_heat_levels()
    build_order()
    build_koreatown()
    build_about()
    build_guides_index()
    for g in GUIDES:
        build_guide(g)
    build_faq()
    build_catering()
    build_spanish()
    build_korean()
    build_contact()
    build_privacy()
    build_404()

    build_sitemap(CFG, R.pages, OUT)
    build_deploy_files(CFG, OUT, redirects=[
        # The reference site is a single page with hash anchors. Anyone who
        # bookmarked one lands on a real page instead of the home page.
        ("/index.html", "/"),
        ("/menu.html", "/menu/"),
        ("/heat", "/heat-levels/"),
        ("/location", "/koreatown/"),
        ("/visit", "/koreatown/"),
        ("/gallery", "/"),
        ("/featured", "/menu/"),
    ])

    build_llms_files(
        CFG, R.pages, OUT,
        summary=("Stark's Hot Chicken is a Nashville-style hot chicken restaurant "
                 "at 207 S Vermont Ave, Los Angeles, CA 90004, in Koreatown. Six "
                 "heat levels, counter service, open past midnight six nights a "
                 "week. Pickup and delivery via DoorDash and Uber Eats."),
        key_facts=[
            ("Address", CFG.full_address),
            ("Phone", CFG.phone_display),
            ("Neighborhood", "Koreatown, Los Angeles"),
            ("Hours", "Mon-Thu 11:00 AM-12:45 AM; Fri-Sat 11:00 AM-1:45 AM; "
                      "Sun 11:00 AM-10:30 PM"),
            ("Cuisine", ", ".join(CFG.cuisines)),
            ("Price range", "$$"),
            ("Heat levels", " / ".join(h["name"] for h in HEAT)),
            ("Ordering", "Pickup in store; delivery via DoorDash and Uber Eats"),
            ("Reservations", "Not accepted - counter service"),
        ],
        full_sections=[
            ("Heat levels", "\n".join(
                "- **%s** (%s): %s Order it if: %s"
                % (h["name"], h["sub"], h["note"], h["who"]) for h in HEAT)),
            ("Menu", "\n\n".join(
                "### %s\n%s\n%s" % (
                    s["name"], s["blurb"],
                    "\n".join("- %s%s%s" % (
                        i["name"],
                        " - $%s" % i["price"] if i.get("price") else "",
                        ": %s" % i["desc"] if i.get("desc") else "")
                        for i in s["items"]))
                for s in MENU)),
            ("Menu disclaimer", MENU_DISCLAIMER),
            ("Frequently asked questions", "\n\n".join(
                "**%s**\n%s" % (q, a) for q, a in HOME_FAQS + HEAT_FAQS + KTOWN_FAQS)),
        ])

    print("built %d indexable pages into %s" % (len(R.pages), OUT))


if __name__ == "__main__":
    main()
