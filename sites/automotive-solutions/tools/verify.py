#!/usr/bin/env python3
"""
Static checks over the built site. Run after build.py; exits non-zero on any
error so it can gate a deploy.

  python3 tools/verify.py [public-dir]

Checks: balanced/parsable HTML, exactly one H1 per page, unique titles under
60 characters, unique meta descriptions between 70 and 160, canonical present,
OG/Twitter/geo tags present, every internal link and anchor resolving, valid
JSON-LD on every page, sitemap entries all existing, and hreflang pairs
pointing at each other.
"""

import json
import os
import re
import sys
from html.parser import HTMLParser

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else
                      os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public"))

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

errors = []
warnings = []


class Checker(HTMLParser):
    """Tracks tag balance, counts h1s, and collects links, ids and metadata."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.h1 = 0
        self.title = None
        self._in_title = False
        self.desc = None
        self.canonical = None
        self.links = []          # href values
        self.ids = set()
        self.ld = []
        self._in_ld = False
        self.metas = set()
        self.props = set()
        self.hreflangs = []
        self.imbalance = []
        self.imgs_without_alt = 0
        self.lang = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag not in VOID:
            self.stack.append(tag)
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self._in_title = True
        if tag == "a" and "href" in a:
            self.links.append(a["href"])
        if tag == "img":
            if not a.get("alt") and a.get("alt") != "":
                self.imgs_without_alt += 1
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in_ld = True
            self.ld.append("")
        if tag == "meta":
            if a.get("name"):
                self.metas.add(a["name"])
                if a["name"] == "description":
                    self.desc = a.get("content", "")
            if a.get("property"):
                self.props.add(a["property"])
        if tag == "link":
            if a.get("rel") == "canonical":
                self.canonical = a.get("href")
            if a.get("rel") == "alternate" and a.get("hreflang"):
                self.hreflangs.append((a["hreflang"], a.get("href", "")))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == "title":
            self._in_title = False
        if tag == "script":
            self._in_ld = False
        if not self.stack:
            self.imbalance.append("stray </%s>" % tag)
            return
        if self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                self.imbalance.append("unclosed <%s>" % self.stack.pop())
            if self.stack:
                self.stack.pop()
        else:
            self.imbalance.append("stray </%s>" % tag)

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or "") + data
        if self._in_ld and self.ld:
            self.ld[-1] += data


def page_url(path):
    """Filesystem path -> the URL path it is served at."""
    rel = os.path.relpath(path, OUT).replace(os.sep, "/")
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[:-len("index.html")]
    return "/" + rel


def resolve(link, from_url):
    """Resolve an internal href to a URL path, or None if it is external."""
    if re.match(r"^(https?:|tel:|mailto:|#|data:|javascript:)", link):
        return None
    if link.startswith("//"):
        return None
    if link.startswith("/"):
        return link
    # relative link
    base = from_url if from_url.endswith("/") else from_url.rsplit("/", 1)[0] + "/"
    parts = (base + link).split("/")
    out = []
    for p in parts:
        if p == "..":
            if out:
                out.pop()
        elif p not in (".", ""):
            out.append(p)
    tail = "/" if (base + link).endswith("/") else ""
    return "/" + "/".join(out) + tail


def exists(url_path):
    if url_path.endswith("/"):
        return os.path.isfile(os.path.join(OUT, url_path.strip("/"), "index.html")) or url_path == "/"
    return os.path.isfile(os.path.join(OUT, url_path.lstrip("/")))


def main():
    html_files = []
    for root, _dirs, files in os.walk(OUT):
        for f in files:
            if f.endswith(".html"):
                html_files.append(os.path.join(root, f))
    if not html_files:
        print("No HTML found in %s" % OUT)
        return 1

    titles, descs, pages = {}, {}, {}

    for path in sorted(html_files):
        url = page_url(path)
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        c = Checker()
        c.feed(src)
        c.close()
        pages[url] = c
        tag = url

        if c.imbalance:
            errors.append("%s: unbalanced tags: %s" % (tag, ", ".join(c.imbalance[:5])))
        if c.stack:
            errors.append("%s: never closed: %s" % (tag, ", ".join(c.stack[:5])))
        if c.h1 != 1:
            errors.append("%s: %d <h1> (must be exactly 1)" % (tag, c.h1))

        # --- title -------------------------------------------------------
        t = (c.title or "").strip()
        if not t:
            errors.append("%s: no <title>" % tag)
        elif len(t) > 60:
            errors.append("%s: title %d chars (max 60): %r" % (tag, len(t), t))
        titles.setdefault(t, []).append(tag)

        # --- description --------------------------------------------------
        d = (c.desc or "").strip()
        if not d:
            errors.append("%s: no meta description" % tag)
        elif not (70 <= len(d) <= 160):
            errors.append("%s: description %d chars (must be 70-160)" % (tag, len(d)))
        descs.setdefault(d, []).append(tag)

        # --- head essentials ---------------------------------------------
        if not c.canonical:
            errors.append("%s: no canonical" % tag)
        for prop in ("og:title", "og:description", "og:image", "og:url", "og:type"):
            if prop not in c.props:
                errors.append("%s: missing %s" % (tag, prop))
        for name in ("twitter:card", "geo.region", "geo.position", "ICBM", "viewport"):
            if name not in c.metas:
                errors.append("%s: missing meta %s" % (tag, name))
        if not c.lang:
            errors.append("%s: <html> has no lang" % tag)
        if c.imgs_without_alt:
            errors.append("%s: %d <img> without alt" % (tag, c.imgs_without_alt))

        # --- JSON-LD -------------------------------------------------------
        if not c.ld:
            warnings.append("%s: no JSON-LD" % tag)
        for i, blob in enumerate(c.ld):
            try:
                data = json.loads(blob)
            except Exception as e:
                errors.append("%s: JSON-LD block %d invalid: %s" % (tag, i + 1, e))
                continue
            if "@context" not in data or "@type" not in data:
                errors.append("%s: JSON-LD block %d missing @context/@type" % (tag, i + 1))
            # aggregateRating must not be self-published
            if "aggregateRating" in json.dumps(data):
                errors.append("%s: JSON-LD self-publishes aggregateRating" % tag)

    # --- duplicates --------------------------------------------------------
    # /404.html is a deliberate byte-for-byte copy of /404/ (hosts look for it
    # at the root), and both carry noindex, so they are one page for this check.
    def dedupe(where):
        return [w for w in where if w != "/404.html"] or where

    for t, where in titles.items():
        if len(dedupe(where)) > 1:
            errors.append("duplicate title %r on: %s" % (t, ", ".join(where)))
    for d, where in descs.items():
        if len(dedupe(where)) > 1:
            errors.append("duplicate description on: %s" % ", ".join(where))

    # --- internal links ----------------------------------------------------
    for url, c in pages.items():
        for href in c.links:
            frag = ""
            if "#" in href and not href.startswith("#"):
                href, frag = href.split("#", 1)
                if not href:
                    continue
            target = resolve(href, url)
            if target is None:
                continue
            if not exists(target):
                errors.append("%s: broken internal link -> %s" % (url, href))
            elif frag:
                tgt_page = pages.get(target)
                if tgt_page and frag not in tgt_page.ids:
                    errors.append("%s: link to missing anchor #%s on %s" % (url, frag, target))
        # same-page anchors
        for href in c.links:
            if href.startswith("#") and len(href) > 1 and href[1:] not in c.ids:
                errors.append("%s: anchor %s has no target on the page" % (url, href))

    # --- sitemap -----------------------------------------------------------
    sm = os.path.join(OUT, "sitemap.xml")
    if not os.path.isfile(sm):
        errors.append("no sitemap.xml")
    else:
        locs = re.findall(r"<loc>(.*?)</loc>", open(sm, encoding="utf-8").read())
        if not locs:
            errors.append("sitemap.xml has no <loc> entries")
        for loc in locs:
            p = re.sub(r"^https?://[^/]+", "", loc)
            if not exists(p):
                errors.append("sitemap lists a page that was not built: %s" % p)
        listed = {re.sub(r"^https?://[^/]+", "", l) for l in locs}
        for url in pages:
            if url in ("/404.html", "/404/", "/thank-you/"):
                continue
            if url not in listed:
                warnings.append("built but not in sitemap: %s" % url)

    # --- hreflang reciprocity ----------------------------------------------
    for url, c in pages.items():
        if not c.hreflangs:
            continue
        codes = {code for code, _ in c.hreflangs}
        if "x-default" not in codes:
            warnings.append("%s: hreflang set without x-default" % url)
        for _code, href in c.hreflangs:
            p = re.sub(r"^https?://[^/]+", "", href)
            other = pages.get(p)
            if other is None:
                errors.append("%s: hreflang points at a page that does not exist: %s" % (url, p))
            elif not other.hreflangs:
                errors.append("%s: hreflang to %s but that page has no return hreflang" % (url, p))

    # --- deploy files -------------------------------------------------------
    for f in ("robots.txt", ".htaccess", "_redirects", "_headers", "404.html",
              "assets/css/site.css", "assets/js/site.js", "assets/img/logo.png"):
        if not os.path.isfile(os.path.join(OUT, f)):
            errors.append("missing deploy file: %s" % f)

    # --- report --------------------------------------------------------------
    print("Checked %d pages in %s" % (len(pages), OUT))
    for w in warnings:
        print("  WARN  %s" % w)
    for e in errors:
        print("  ERROR %s" % e)
    if errors:
        print("\n%d error(s), %d warning(s)" % (len(errors), len(warnings)))
        return 1
    print("\nAll checks passed (%d warnings)" % len(warnings))
    return 0


if __name__ == "__main__":
    sys.exit(main())
