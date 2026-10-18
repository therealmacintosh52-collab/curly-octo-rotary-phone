"""Rendering helpers: markdown-lite, icons, components, page layout, JSON-LD."""
import html as _h
import json
import re
from urllib.parse import quote

import config as C

A = {}          # asset URLs, filled by build.py
CTX = {"faq": []}
NOSCRIPT_CSS = ".hero-media picture{display:none}"
DOMAIN = "{{DOMAIN}}"
SITE = "https://" + DOMAIN


def esc(s):
    return _h.escape(s, quote=True)


def plain(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", _h.unescape(s))).strip()


# ---------- markdown-lite ----------
def inline(t):
    t = esc(t)
    t = re.sub(r"(\w)'(\w)", "\\1\u2019\\2", t)
    t = t.replace("&#x27;", "'")
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)

    def link(m):
        txt, url = m.group(1), m.group(2).replace("&amp;", "&")
        ext = url.startswith("http")
        extra = ' rel="noopener"' if ext else ""
        ev = ""
        if url.startswith("tel:"):
            ev = ' data-event="call_click"'
        elif url.startswith("sms:"):
            ev = ' data-event="text_click"'
        return '<a href="%s"%s%s>%s</a>' % (url.replace('"', "%22"), extra, ev, txt)
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, t)


def mdl(html):
    """markdown links inside an already-HTML string"""
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', html)


def md(text):
    out, para, lst, kind = [], [], [], None

    def flush_p():
        if para:
            out.append("<p>%s</p>" % inline(" ".join(para)))
            para.clear()

    def flush_l():
        nonlocal kind
        if lst:
            out.append("<%s>%s</%s>" % (kind, "".join("<li>%s</li>" % inline(i) for i in lst), kind))
            lst.clear()
            kind = None
    for raw in text.strip().split("\n"):
        line = raw.strip()
        if not line:
            flush_p(); flush_l(); continue
        m_ul = re.match(r"^[-*] (.*)", line)
        m_ol = re.match(r"^\d+\. (.*)", line)
        if m_ul or m_ol:
            flush_p()
            k = "ul" if m_ul else "ol"
            if kind and kind != k:
                flush_l()
            kind = k
            lst.append((m_ul or m_ol).group(1))
        elif line.startswith("### "):
            flush_p(); flush_l(); out.append("<h3>%s</h3>" % inline(line[4:]))
        else:
            flush_l(); para.append(line)
    flush_p(); flush_l()
    return "\n".join(out)


# ---------- phone / links ----------
def tel_href():
    return "tel:" + C.PHONE_E164


def sms_href(body="Hi 916 Dent & Detail, here are photos of my dent. Vehicle: ___. City: ___."):
    return "sms:%s?&body=%s" % (C.PHONE_E164, quote(body))


# ---------- icons (stroke icons, currentColor, presentation attributes only) ----------
def _svg(inner, vb="0 0 24 24", extra=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"%s>%s</svg>' % (vb, extra, inner))


ICON = {
    "call": _svg('<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    "text": _svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
    "camera": _svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    "menu": _svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    "arrow": _svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
}


def dent_svg(kind):
    """Our own cross-section drawings: a side view of a panel (top line) with the metal behind it."""
    base = '<path d="M8 20h264" stroke-opacity=".35"/>'
    if kind == "shallow":
        d = '<path d="M8 40h92c14 0 22 4 40 4s26-4 40-4h92" stroke-width="3"/>'
    elif kind == "crease":
        d = '<path d="M8 40h120l12 34 12-34h120" stroke-width="3"/>'
    elif kind == "stretch":
        d = '<path d="M8 40h96c10 0 14 8 22 8l8 2 8-12 8 14 8-12c8 4 14-6 22-6h92" stroke-width="3"/><path d="M118 20l4 14M140 18l2 16M160 20l-2 14" stroke-opacity=".6" stroke-dasharray="2 4"/>'
    else:
        d = ""
    return _svg(base + d, "0 0 280 90", ' role="img" aria-label="%s"' % {
        "shallow": "Side-view drawing of a panel with a shallow, round dent",
        "crease": "Side-view drawing of a panel with a sharp crease",
        "stretch": "Side-view drawing of a panel with stretched, cracked metal"}[kind])


def shot_svg(n):
    panel = '<rect x="8" y="22" width="80" height="36" rx="4"/><circle cx="52" cy="40" r="3.5" fill="currentColor"/>'
    cam = '<path d="M70 66h14l3 4h8v14H67V70h3z"/>'
    if n == 1:   # whole panel, from about six feet
        inner = panel + '<path d="M60 104V92" stroke-opacity=".5"/><path d="M8 100h80M8 96v8M88 96v8" stroke-opacity=".5"/>'.replace("M60 104V92", "")
        cam = '<path d="M40 92h12l2 3h6v11H36V95h2z"/>'
        inner = panel + cam
    elif n == 2:  # straight on
        inner = panel + '<path d="M48 62v22M44 78l4 6 4-6"/><path d="M40 88h16v14H40z"/>'
    elif n == 3:  # low angle, light across the panel
        inner = ('<path d="M8 50l80-10v18L8 66z"/><circle cx="48" cy="52" r="3" fill="currentColor"/>'
                 '<path d="M8 96l36-30M14 104l36-30" stroke-opacity=".6" stroke-dasharray="3 4"/><path d="M60 98h14v10H60z"/>')
    else:         # close up of the edge
        inner = panel + '<circle cx="52" cy="40" r="18" stroke-width="2.4"/><path d="M65 53l16 16"/>'
    return _svg(inner, "0 0 96 112", ' role="img" aria-label="%s"' % {
        1: "Drawing: the whole panel photographed from about six feet",
        2: "Drawing: the dent photographed straight on",
        3: "Drawing: the dent photographed from a low angle with light across it",
        4: "Drawing: a close-up of the paint at the dent"}[n])


# ---------- components ----------
def btn(label, href, cls="", icon=None, event=None):
    ic = ICON[icon] if icon else ""
    ev = ' data-event="%s"' % event if event else ""
    return '<a class="btn %s" href="%s"%s>%s%s</a>' % (cls, esc(href), ev, ic, esc(label))


def b_quote(label="Get a price from a photo", cls="btn-gold"):
    return btn(label, "/photo-quote/", cls, "camera", "photo_quote_cta_click")


def b_call(cls=""):
    return btn("Call " + C.PHONE_DISPLAY, tel_href(), cls, "call", "call_click")


def b_text(label="Text photos", cls=""):
    return btn(label, sms_href(), cls, "text", "text_click")


def actions(kind="quote", for_param=None):
    if kind == "b2b":
        return '<div class="actions">%s%s%s</div>' % (b_call("btn-gold"), b_text("Text us"), btn("Send a vehicle list or photos", "/photo-quote/?for=fleet", "", "camera", "photo_quote_cta_click"))
    if kind == "quote-text":
        return '<div class="actions">%s%s%s</div>' % (b_quote(), b_text(), b_call())
    return '<div class="actions">%s%s</div>' % (b_quote(), b_call())


def plate(kicker, h2, body, g=False, rail=None, num=None, pid=None, extra_cls=""):
    pid = pid or "p-" + re.sub(r"[^a-z0-9]+", "-", (h2 or kicker or "x").lower())[:40]
    cls = "plate" + (" g" if g else "") + (" " + extra_cls if extra_cls else "")
    r = ""
    inner_cls = "plate-in"
    if rail:
        inner_cls += " has-rail"
        r = '<div class="rail">%s<p class="rail-l">%s</p></div>' % ('<p class="num" aria-hidden="true">%s</p>' % num if num else "", esc(rail))
    k = '<p class="kicker">%s</p>' % esc(kicker) if kicker else ""
    h = '<h2 id="%s">%s</h2>' % (pid, h2) if h2 else ""
    lab = ' aria-labelledby="%s"' % pid if h2 else ""
    return '<section class="%s"%s><div class="wrap"><div class="%s">%s<div class="plate-body">%s%s%s</div></div></div></section>' % (cls, lab, inner_cls, r, k, h, body)


def rows(items):
    li = []
    for i, (href, name, term, line) in enumerate(items, 1):
        li.append('<li><a href="%s"><span class="n" aria-hidden="true">%02d</span><span><strong>%s</strong><small>%s</small><span class="d">%s</span></span>%s</a></li>'
                  % (href, i, esc(name), esc(term), inline(line), ICON["arrow"]))
    return '<ul class="rows">%s</ul>' % "".join(li)


def steps(items):
    return '<ol class="steps">%s</ol>' % "".join("<li><h3>%s</h3>%s</li>" % (esc(t), md(b)) for t, b in items)


def table(caption, headers, data, first_th=True):
    th = "".join("<th scope=\"col\">%s</th>" % esc(h) for h in headers)
    trs = []
    for r in data:
        cells = []
        for i, c in enumerate(r):
            if i == 0 and first_th:
                cells.append('<th scope="row">%s</th>' % inline(c))
            else:
                cells.append('<td data-label="%s">%s</td>' % (esc(headers[i]), inline(c)))
        trs.append("<tr>%s</tr>" % "".join(cells))
    return '<table class="tbl"><caption>%s</caption><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (esc(caption), th, "".join(trs))


def faq_block(items, heading="Common questions", kicker="Questions", g=False):
    CTX["faq"].extend(items)
    ds = "".join('<details><summary>%s</summary><div class="a">%s</div></details>' % (esc(q), md(a)) for q, a in items)
    return plate(kicker, heading, '<div class="faq">%s</div>' % ds, g=g, pid="faq")


def sources(items, label="Sources"):
    li = "".join('<li><a href="%s" rel="noopener">%s</a></li>' % (esc(u), esc(t)) for t, u in items)
    return '<div class="src"><p>%s</p><ul>%s</ul></div>' % (esc(label), li)


def end_cta(h2="Send a photo and see what we can do", text="Text or upload two to four photos. We look at them and tell you what we can do, including when a dent is not a PDR job.", kind="quote"):
    return plate("Next step", h2, '<div class="cta-end"><p class="prose">%s</p>%s</div>' % (inline(text), actions(kind)), g=True, pid="next")


def related(title, items):
    li = "".join('<li><a href="%s"><span class="n" aria-hidden="true"></span><span><strong>%s</strong><span class="d">%s</span></span>%s</a></li>' % (u, esc(t), inline(d), ICON["arrow"]) for u, t, d in items)
    return plate("Keep reading", title, '<ul class="rows">%s</ul>' % li, pid="related")


# ---------- layout ----------
def nav_links():
    return [("/paintless-dent-repair/", "Dent removal"), ("/hail-damage-repair/", "Hail damage"), ("/mobile-detailing/", "Mobile detailing"),
            ("/paint-correction/", "Paint correction"), ("/ceramic-coating/", "Ceramic coating"), ("/interior-detailing/", "Interior detailing")]


def header(path):
    dd = "".join('<a href="%s">%s</a>' % (u, esc(t)) for u, t in nav_links())
    top = [("/dealers-and-fleets/", "Dealers & Fleets"), ("/guides/", "Guides"), ("/service-area/", "Service area"), ("/contact/", "Contact")]

    def cur(u):
        return ' aria-current="page"' if u == path else ""
    d_nav = ('<nav class="nav-d" aria-label="Main"><details><summary>Services</summary><div class="dd">%s</div></details>%s</nav>'
             % (dd, "".join('<a href="%s"%s>%s</a>' % (u, cur(u), esc(t.replace("&", "&amp;") if False else t)) for u, t in top)))
    m_nav = ('<nav aria-label="Menu"><p class="lbl">Services</p><div class="sub">%s</div><p class="lbl">More</p>%s<a href="/photo-quote/">Get a price from a photo</a><a href="/about/">About</a><a href="/faq/">FAQ</a></nav>'
             % (dd, "".join('<a href="%s"%s>%s</a>' % (u, cur(u), esc(t)) for u, t in top)))
    return ('<header class="hd"><div class="wrap hd-in"><a class="brand" href="/"><img src="%s" width="40" height="40" alt=""><span class="brand-t">916 Dent &amp; Detail</span></a>'
            '%s<a class="hd-tel" href="%s" data-event="call_click">%s</a><a class="btn btn-gold hd-cta" href="/photo-quote/" data-event="photo_quote_cta_click">Get a price from a photo</a>'
            '<a class="ic-call" href="%s" aria-label="Call 916 Dent &amp; Detail" data-event="call_click">%s</a>'
            '<details class="menu"><summary>%s<span>Menu</span></summary>%s</details></div></header>'
            % (A["dmark80"], d_nav, tel_href(), C.PHONE_DISPLAY, tel_href(), ICON["call"], ICON["menu"], m_nav))


def sticky_bar(path):
    if path == "/photo-quote/":
        return ('<nav class="bar two" aria-label="Quick contact">%s%s</nav>' % (btn("Call", tel_href(), "", "call", "call_click"), btn("Text", sms_href(), "btn-gold", "text", "text_click")))
    return ('<nav class="bar" aria-label="Quick contact">%s%s%s</nav>'
            % (btn("Call", tel_href(), "", "call", "call_click"), btn("Text", sms_href(), "", "text", "text_click"),
               btn("Get price", "/photo-quote/", "btn-gold", "camera", "photo_quote_cta_click")))


def footer():
    sv = "".join('<li><a href="%s">%s</a></li>' % (u, esc(t)) for u, t in nav_links())
    gd = "".join('<li><a href="%s">%s</a></li>' % (u, esc(t)) for u, t in [
        ("/guides/what-affects-dent-repair-price/", "What affects the price"), ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed?"),
        ("/guides/pdr-vs-body-shop/", "PDR vs body shop"), ("/guides/should-i-file-a-claim-for-a-small-dent/", "Small dent and insurance")])
    co = "".join('<li><a href="%s">%s</a></li>' % (u, esc(t)) for u, t in [
        ("/photo-quote/", "Get a price from a photo"), ("/dealers-and-fleets/", "Dealers & fleets"), ("/service-area/", "Service area"), ("/about/", "About"),
        ("/contact/", "Contact"), ("/faq/", "FAQ"), ("/privacy/", "Privacy"), ("/terms/", "Terms")])
    rev = '<li><a href="%s" rel="noopener">Leave a review</a></li>' % esc(C.REVIEW_URL) if C.REVIEW_URL else ""
    return ('<footer class="ft"><div class="wrap"><div class="ft-grid"><div><h2>916 Dent &amp; Detail</h2>'
            '<p><a class="tel" href="%s" data-event="call_click">%s</a></p><p>Mobile service. No storefront. We come to your home, workplace or lot in %s.</p>'
            '<p><a href="%s" rel="noopener" data-event="ig_click">Instagram %s</a></p><p>%s</p></div>'
            '<div><h2>Services</h2><ul>%s</ul></div><div><h2>Guides</h2><ul>%s</ul></div><div><h2>Company</h2><ul>%s%s</ul></div></div>'
            '<p class="ft-base">Trouble using this site? Call or text %s and we will help another way. Informational photo prices are estimates until a vehicle is seen.</p></div></footer>'
            % (tel_href(), C.PHONE_DISPLAY, esc(C.PLACES_STRING), C.INSTAGRAM_URL, esc(C.INSTAGRAM_HANDLE), esc(C.TAGLINE), sv, gd, co, rev, C.PHONE_DISPLAY))


# ---------- JSON-LD ----------
def place_nodes():
    return [{"@type": "City" if k == "city" else "Place", "name": n} for n, k in C.PLACES]


def business_node(full=False):
    n = {"@type": C.SCHEMA_TYPE, "@id": SITE + "/#business", "name": C.NAME, "url": SITE + "/", "telephone": C.PHONE_SCHEMA}
    if full:
        n.update({
            "description": C.DESC_LONG, "slogan": C.TAGLINE,
            "image": SITE + A["dmark512"], "logo": SITE + A["dmark512"],
            "areaServed": place_nodes(), "sameAs": [C.INSTAGRAM_URL],
            "knowsAbout": ["Paintless dent repair", "Ceramic coating", "Paint correction", "Interior detailing", "Hail damage repair"],
            "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Services", "itemListElement": [
                {"@type": "Service", "name": s[1], "serviceType": s[2], "url": SITE + s[0]} for s in C.SERVICES]},
        })
    return n


def crumb_node(page):
    items = [("Home", "/")] + page["crumbs"]
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items, 1)]}


def graph(page):
    url = SITE + page["path"]
    g = []
    t = page["type"]
    if t == "404":
        return {}
    if t == "home":
        g.append(business_node(True))
        g.append({"@type": "WebSite", "@id": SITE + "/#website", "name": C.NAME, "url": SITE + "/", "inLanguage": "en-US", "publisher": {"@id": SITE + "/#business"}})
        g.append({"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": page["title"], "description": page["desc"], "isPartOf": {"@id": SITE + "/#website"}, "about": {"@id": SITE + "/#business"}})
    else:
        base = {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": page["title"], "description": page["desc"], "isPartOf": {"@id": SITE + "/#website"}, "inLanguage": "en-US"}
        if t == "service":
            s = page["service"]
            g.append({"@type": "Service", "@id": url + "#service", "name": s["name"], "serviceType": s["term"], "description": page["answer_plain"],
                      "url": url, "provider": business_node(False), "areaServed": place_nodes()})
            base["mainEntity"] = {"@id": url + "#service"}
        elif t == "guide":
            g.append({"@type": "Article", "@id": url + "#article", "headline": plain(page["h1"]), "description": page["desc"], "url": url,
                      "datePublished": C.GUIDE_REVIEWED_ISO, "dateModified": C.GUIDE_REVIEWED_ISO, "inLanguage": "en-US",
                      "author": {"@type": "Organization", "name": C.NAME, "@id": SITE + "/#business"}, "publisher": business_node(False),
                      "mainEntityOfPage": {"@id": url + "#webpage"}})
        elif t == "city":
            base["about"] = {"@type": "City", "name": page["city"]}
            base["provider"] = {"@id": SITE + "/#business"}
        elif t == "contact":
            base["@type"] = "ContactPage"
        elif t == "about":
            base["@type"] = "AboutPage"
        elif t == "collection":
            base["@type"] = "CollectionPage"
        g.append(base)
        g.append({"@type": "WebSite", "@id": SITE + "/#website", "name": C.NAME, "url": SITE + "/"})
        g.append(crumb_node(page))
    if page.get("faq"):
        g.append({"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(md(a))}} for q, a in page["faq"]]})
    return {"@context": "https://schema.org", "@graph": g}


# ---------- page shell ----------
def crumbs_html(page):
    items = [("Home", "/")] + page["crumbs"]
    li = []
    for i, (n, u) in enumerate(items):
        if i == len(items) - 1:
            li.append('<li><span aria-current="page">%s</span></li>' % esc(n))
        else:
            li.append('<li><a href="%s">%s</a></li>' % (u, esc(n)))
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>%s</ol></nav>' % "".join(li)


def top_section(page):
    upd = '<p class="updated">Updated %s</p>' % C.GUIDE_REVIEWED_LABEL if page["type"] == "guide" else ""
    return ('<section class="top"><div class="wrap">%s<p class="kicker">%s</p><h1 class="page-h1">%s</h1><p class="answer">%s</p>%s%s</div></section>'
            % (crumbs_html(page), esc(page["kicker"]), page["h1"], inline(page["answer"]), upd, page.get("actions") or actions()))


def head(page, crit_css, gate_js):
    url = SITE + page["path"]
    og = SITE + "/og/%s.png" % page["og"]
    ind = '<meta name="robots" content="noindex">' if page.get("noindex") else ""
    pre = ['<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' % A["font_michroma"]]
    if page["type"] == "home":
        H = A["hero"]
        pre += [
            '<link rel="preload" as="image" href="%s/poster-m.avif" type="image/avif" media="(max-width:899px) and (prefers-reduced-motion:no-preference)" fetchpriority="high">' % H,
            '<link rel="preload" as="image" href="%s/poster-d.avif" type="image/avif" media="(min-width:900px) and (prefers-reduced-motion:no-preference)" fetchpriority="high">' % H,
            '<link rel="preload" as="image" href="%s/static-m.avif" type="image/avif" media="(max-width:899px) and (prefers-reduced-motion:reduce)" fetchpriority="high">' % H,
            '<link rel="preload" as="image" href="%s/static-d.avif" type="image/avif" media="(min-width:900px) and (prefers-reduced-motion:reduce)" fetchpriority="high">' % H,
        ]
    phone = '' if C.PHONE_CONFIRMED else '<meta name="phone-status" content="unconfirmed">'
    gr = graph(page)
    ld = json.dumps(gr, ensure_ascii=False, separators=(",", ":")) if gr else ""
    gate = "<script>%s</script>" % gate_js if page["type"] == "home" else ""
    nos = '<noscript><style>%s</style></noscript>' % NOSCRIPT_CSS if page["type"] == "home" else ""
    return ('<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="%s">%s'
            '<meta name="theme-color" content="#0B0B0C"><meta name="color-scheme" content="dark">%s'
            '<meta property="og:type" content="website"><meta property="og:site_name" content="%s"><meta property="og:title" content="%s"><meta property="og:description" content="%s">'
            '<meta property="og:url" content="%s"><meta property="og:image" content="%s"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="%s">'
            '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%s"><meta name="twitter:description" content="%s"><meta name="twitter:image" content="%s">'
            '<meta name="analytics-id" content="{{ANALYTICS_ID}}">'
            '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">'
            '%s<style>%s</style>%s%s%s</head>'
            % (esc(page["title"]), esc(page["desc"]), url, ind, phone, esc(C.NAME), esc(page["title"]), esc(page["desc"]), url, og,
               esc("916 Dent & Detail: " + plain(page["h1"])[:90]), esc(page["title"]), esc(page["desc"]), og,
               "".join(pre), crit_css, nos, gate, ('<script type="application/ld+json">%s</script>' % ld) if ld else ""))


def hero_html(page):
    H = A["hero"]
    cap = "" if C.HERO_IS_REAL_JOB else '<figcaption class="hero-cap">Illustration. Not a customer vehicle.</figcaption>'
    if C.HERO_IS_REAL_JOB:
        cap = '<figcaption class="hero-cap">Footage from a 916 Dent &amp; Detail job.</figcaption>'
    l1, l2, l3 = C.HERO_LINES
    alt = "Illustration of a dented car door becoming a clean, water-beaded gloss finish"
    pic = ('<picture>'
           '<source media="(prefers-reduced-motion: reduce) and (min-width:900px)" type="image/avif" srcset="{H}/static-d.avif">'
           '<source media="(prefers-reduced-motion: reduce) and (min-width:900px)" type="image/webp" srcset="{H}/static-d.webp">'
           '<source media="(prefers-reduced-motion: reduce)" type="image/avif" srcset="{H}/static-m.avif">'
           '<source media="(prefers-reduced-motion: reduce)" type="image/webp" srcset="{H}/static-m.webp">'
           '<source media="(min-width:900px)" type="image/avif" srcset="{H}/poster-d.avif">'
           '<source media="(min-width:900px)" type="image/webp" srcset="{H}/poster-d.webp">'
           '<source type="image/avif" srcset="{H}/poster-m.avif">'
           '<img src="{H}/poster-m.webp" width="720" height="1280" alt="{alt}" fetchpriority="high" decoding="async" data-static-m="{H}/static-m.avif" data-static-d="{H}/static-d.avif">'
           '</picture>').format(H=H, alt=alt)
    nos = '<noscript><img class="ns" src="%s/static-m.webp" width="720" height="1280" alt="%s"></noscript>' % (H, alt)
    return ('<section class="hero" aria-label="Introduction"><div class="hero-track" data-frames="%s/" data-n="31"><div class="hero-stage">'
            '<figure class="hero-media">%s%s<div class="hero-scrim"></div>%s</figure>'
            '<div class="hero-copy"><div class="hero-top"><h1><span class="hero-eyebrow">Mobile paintless dent repair &amp; detailing in Sacramento</span>'
            '<span class="ln l1">%s</span> <span class="ln l2">%s</span> <span class="ln l3">%s</span></h1>'
            '<p class="hero-sub">Mobile paintless dent repair and detailing across Sacramento. No body shop. No repaint.</p>'
            '<p class="hero-note">Most shallow-to-moderate dents with intact paint. We tell you if yours isn&rsquo;t one.</p></div><div class="hero-bottom">%s</div></div></div></div></section>'
            % (H, pic, nos, cap, esc(l1), esc(l2), esc(l3), actions()))


def page_html(page, crit_css, gate_js):
    blocks = page["blocks"]
    page["answer_plain"] = plain(inline(page.get("answer", ""))) if page.get("answer") else ""
    top = hero_html(page) if page["type"] == "home" else top_section(page)
    link = '<link rel="stylesheet" href="%s">' % A["css"]
    scripts = '<script src="%s" defer></script>' % A["js_site"]
    if page["type"] == "home":
        scripts += '<script src="%s" defer></script>' % A["js_hero"]
    if page.get("form"):
        scripts += '<script src="%s" defer></script>' % A["js_form"]
    return (head(page, crit_css, gate_js) + '<body><a class="skip" href="#main">Skip to content</a>' + header(page["path"]) +
            '<main id="main">' + top + link + "".join(('<div class="wrap srcs">%s</div>' % b) if b.startswith('<div class="src">') else b for b in blocks) + "</main>" + footer() + sticky_bar(page["path"]) + scripts + "</body></html>")
