"""Renderer -- owns the <head> and writes pages to disk.

Generalized from the original sites/phils-auto-fleet-repair/build.py render(),
which hardcoded that shop's og:image, og:image:alt, geo.placename, theme-color
and manifest path. Those all come from SiteConfig now.
"""

import os
import re


class Renderer(object):
    def __init__(self, cfg, out_dir, relative=False, header=None, footer=None,
                 css="/assets/css/site.css", js="/assets/js/site.js",
                 extra_head="", extra_body=""):
        self.cfg = cfg
        self.out = out_dir
        self.relative = relative
        self.header = header or (lambda **kw: "")
        self.footer = footer or (lambda **kw: "")
        self.css = css
        self.js = js
        self.extra_head = extra_head
        self.extra_body = extra_body
        # (url_path, priority, changefreq, lastmod, title, description)
        self.pages = []

    # ------------------------------------------------------------------
    def _icon_links(self):
        cfg = self.cfg
        fav = cfg.favicon or cfg.logo or "/assets/img/favicon.svg"
        ftype = "image/svg+xml" if fav.endswith(".svg") else (
            "image/png" if fav.endswith(".png") else "image/x-icon")
        return ('<link rel="icon" href="%s" type="%s">\n'
                '<link rel="apple-touch-icon" href="%s">\n'
                '<link rel="manifest" href="/site.webmanifest">' % (fav, ftype, fav))

    def _alternates(self, alternates):
        """hreflang links. Emitted on EVERY page that declares them, not just
        the home page -- reciprocal per-page hreflang is the part most sites
        get wrong."""
        if not alternates:
            return ""
        out = []
        for code, url in alternates:
            out.append('\n<link rel="alternate" hreflang="%s" href="%s%s">'
                       % (code, self.cfg.base_url, url))
        return "".join(out)

    # ------------------------------------------------------------------
    def render(self, path, title, description, body, graph=None, active=None,
               noindex=False, lang="en", alternates=None, priority="0.5",
               changefreq="monthly", lastmod=None, og_type="website",
               og_image=None, in_sitemap=True, css_extra="", body_class=""):
        cfg = self.cfg
        canonical = cfg.base_url + path
        image = cfg.abs_asset(og_image or cfg.og_image)
        theme_color = cfg.theme.get("theme_color", "#111111")

        head_schema = ""
        if graph is not None:
            head_schema = ('\n<script type="application/ld+json">%s</script>'
                           % (graph if isinstance(graph, str) else graph.json()))

        doc = """<!DOCTYPE html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
%(robots)s<meta name="theme-color" content="%(theme)s">
<meta property="og:type" content="%(ogtype)s">
<meta property="og:site_name" content="%(name)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(image)s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="%(imagealt)s">
<meta property="og:locale" content="%(locale)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(image)s">
%(geo)s%(icons)s
<link rel="stylesheet" href="%(css)s">%(cssextra)s%(alts)s%(schema)s%(extrahead)s
</head>
<body%(bodyclass)s>
<a class="skip" href="#main">Skip to content</a>
%(header)s
<main id="main">
%(body)s
</main>
%(footer)s
%(extrabody)s<script src="%(js)s" defer></script>
</body>
</html>
""" % {
            "lang": lang,
            "title": _esc(title),
            "desc": _esc(description),
            "canonical": canonical,
            "robots": '<meta name="robots" content="noindex,follow">\n' if noindex else "",
            "theme": theme_color,
            "ogtype": og_type,
            "name": _esc(cfg.name),
            "image": image,
            "imagealt": _esc(cfg.og_image_alt or cfg.name),
            "locale": cfg.locale,
            "geo": self._geo(),
            "icons": self._icon_links(),
            "css": self.css,
            "cssextra": css_extra,
            "alts": self._alternates(alternates),
            "schema": head_schema,
            "extrahead": self.extra_head,
            "bodyclass": ' class="%s"' % body_class if body_class else "",
            "header": self.header(active=active, lang=lang),
            "body": body,
            "footer": self.footer(lang=lang),
            "extrabody": self.extra_body,
            "js": self.js,
        }

        if self.relative:
            depth = 0 if path == "/" else path.strip("/").count("/") + 1
            prefix = "./" if depth == 0 else "../" * depth
            doc = re.sub(r'(href|src)="/(?!/)', r'\1="%s' % prefix, doc)

        rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
        dest = os.path.join(self.out, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(doc)

        if in_sitemap and not noindex:
            self.pages.append({
                "path": path, "priority": priority, "changefreq": changefreq,
                "lastmod": lastmod, "title": title, "description": description,
            })
        return dest

    def _geo(self):
        cfg = self.cfg
        if not (cfg.lat and cfg.lng):
            return ""
        return ('<meta name="geo.region" content="%s-%s">\n'
                '<meta name="geo.placename" content="%s">\n'
                '<meta name="geo.position" content="%s;%s">\n'
                '<meta name="ICBM" content="%s, %s">\n'
                % (cfg.country, cfg.region, cfg.locality,
                   cfg.lat, cfg.lng, cfg.lat, cfg.lng))


def _esc(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;"))
