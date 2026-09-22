#!/usr/bin/env python3
"""Offline GEO/AEO audit.

Run against a built public/ directory. Every rule in sites/_standard/
GEO-AEO-STANDARD.md is checked here or it does not belong in the standard.

    python3 sites/_engine/audit.py sites/<site>/public [--warn-only]

Exit code 1 on any ERROR. Online validators (Rich Results Test, Schema Markup
Validator) are the complement to this, not a substitute -- but they need
network access, and this runs anywhere.
"""

import json
import os
import re
import sys

ERRORS = []
WARNINGS = []
CHECKED = {"pages": 0, "graphs": 0, "nodes": 0}


def err(page, msg):
    ERRORS.append("%s: %s" % (page, msg))


def warn(page, msg):
    WARNINGS.append("%s: %s" % (page, msg))


LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
TITLE = re.compile(r"<title>(.*?)</title>", re.S)
DESC = re.compile(r'<meta name="description" content="(.*?)"')
CANON = re.compile(r'<link rel="canonical" href="(.*?)"')
OGIMG = re.compile(r'<meta property="og:image" content="(.*?)"')
ROBOTS = re.compile(r'<meta name="robots" content="(.*?)"')
H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
H2 = re.compile(r"<h2[^>]*>(.*?)</h2>", re.S)
TAGS = re.compile(r"<[^>]+>")
HREFLANG = re.compile(r'<link rel="alternate" hreflang="(.*?)" href="(.*?)"')


def text_of(html):
    return TAGS.sub(" ", html)


def collect_ids(nodes, into):
    """Record every @id this graph defines."""
    for n in nodes:
        if isinstance(n, dict):
            if "@id" in n and isinstance(n["@id"], str):
                into.add(n["@id"])
            for v in n.values():
                if isinstance(v, list):
                    collect_ids([x for x in v if isinstance(x, dict)], into)
                elif isinstance(v, dict):
                    collect_ids([v], into)


def collect_refs(node, into):
    """Record every {"@id": ...} reference that is only a reference."""
    if isinstance(node, dict):
        keys = set(node.keys())
        if keys == {"@id"} and isinstance(node["@id"], str):
            into.add(node["@id"])
        for v in node.values():
            collect_refs(v, into)
    elif isinstance(node, list):
        for v in node:
            collect_refs(v, into)


def hhmm(v):
    m = re.match(r"^(\d{1,2}):(\d{2})(:\d{2})?$", str(v))
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def audit_hours(page, node):
    spec = node.get("openingHoursSpecification")
    if not spec:
        return
    if isinstance(spec, dict):
        spec = [spec]
    for s in spec:
        o, c = hhmm(s.get("opens")), hhmm(s.get("closes"))
        if o is None or c is None:
            err(page, "openingHoursSpecification has unparseable opens/closes: %r"
                % (s.get("opens"), ))
            continue
        # closes < opens is a DECLARED OVERNIGHT WINDOW and is correct per
        # Google's current guidance -- do not flag it. The 23:59/00:00 split
        # form is the older advice and is what we would flag instead.
        if c == o:
            warn(page, "opening window opens and closes at the same time (%s)" % s.get("opens"))
        if str(s.get("closes")) == "23:59" and str(s.get("opens")) == "00:00":
            warn(page, "hours look split across midnight (00:00-23:59); a single "
                       "spec with closes < opens is the current guidance")


REQUIRED = {
    "Restaurant": ["name", "address", "telephone", "openingHoursSpecification", "servesCuisine"],
    "LocalBusiness": ["name", "address", "telephone"],
    "AutoRepair": ["name", "address", "telephone"],
    "Organization": ["name", "url"],
    "WebSite": ["url", "name"],
    "WebPage": ["url", "name"],
    "Article": ["headline", "datePublished", "author"],
    "FAQPage": ["mainEntity"],
    "BreadcrumbList": ["itemListElement"],
    "Menu": ["hasMenuSection"],
    "MenuItem": ["name"],
}


def audit_page(path, rel, base_urls, sitemap_paths, nap):
    CHECKED["pages"] += 1
    html = open(path, encoding="utf-8").read()
    noindex = bool(ROBOTS.search(html) and "noindex" in ROBOTS.search(html).group(1))

    # --- head essentials --------------------------------------------------
    t = TITLE.search(html)
    if not t or not t.group(1).strip():
        err(rel, "missing <title>")
    elif len(t.group(1)) > 70:
        warn(rel, "title is %d chars (SERP truncates around 60)" % len(t.group(1)))

    d = DESC.search(html)
    if not d or not d.group(1).strip():
        err(rel, "missing meta description")
    elif len(d.group(1)) > 165:
        warn(rel, "meta description is %d chars" % len(d.group(1)))

    c = CANON.search(html)
    if not c:
        err(rel, "missing rel=canonical")
    elif not c.group(1).startswith("http"):
        err(rel, "canonical is not absolute: %s" % c.group(1))

    og = OGIMG.search(html)
    if not og:
        err(rel, "missing og:image")
    elif not og.group(1).startswith("http"):
        err(rel, "og:image is not an absolute URL (%s) -- social unfurls will "
                 "fail" % og.group(1))

    h1s = H1.findall(html)
    if not noindex:
        if len(h1s) == 0:
            err(rel, "no <h1>")
        elif len(h1s) > 1:
            warn(rel, "%d <h1> elements" % len(h1s))

    # --- hreflang reciprocity --------------------------------------------
    alts = HREFLANG.findall(html)
    if alts:
        codes = [a for a, _ in alts]
        if "x-default" not in codes:
            warn(rel, "hreflang set has no x-default")

    # --- JSON-LD -----------------------------------------------------------
    defined, refs = set(), set()
    for blob in LD.findall(html):
        CHECKED["graphs"] += 1
        try:
            data = json.loads(blob)
        except ValueError as e:
            err(rel, "JSON-LD does not parse: %s" % e)
            continue
        nodes = data.get("@graph") if isinstance(data, dict) else None
        if nodes is None:
            nodes = [data] if isinstance(data, dict) else list(data)
        collect_ids(nodes, defined)
        for n in nodes:
            collect_refs(n, refs)
            if not isinstance(n, dict):
                continue
            CHECKED["nodes"] += 1
            types = n.get("@type")
            types = types if isinstance(types, list) else [types]
            for ty in types:
                for field in REQUIRED.get(ty, []):
                    if field not in n:
                        err(rel, "%s node is missing required field '%s'" % (ty, field))
                if ty in ("Restaurant", "LocalBusiness", "AutoRepair", "FoodEstablishment"):
                    audit_hours(rel, n)
                    _audit_nap(rel, n, nap)

    dangling = {r for r in refs if r not in defined and not r.startswith("http")}
    for r in sorted(dangling):
        err(rel, "@id reference '%s' resolves to nothing in this page's graph" % r)
    # Cross-page refs to the canonical entity ids are fine; flag only refs to
    # this site that no page ever defines.
    for r in sorted(refs - defined):
        if any(r.startswith(b) for b in base_urls) and r not in base_urls:
            if r not in ALL_DEFINED:
                warn(rel, "@id reference '%s' is not defined on any page" % r)

    # --- sitemap parity ----------------------------------------------------
    if rel == "index.html":
        url_path = "/"
    elif rel.endswith("/index.html") or rel.endswith(os.sep + "index.html"):
        url_path = "/" + rel[: -len("index.html")].replace(os.sep, "/")
    else:
        # A bare file like 404.html -- served at its own path, not a directory.
        url_path = "/" + rel.replace(os.sep, "/")
    if not noindex and sitemap_paths is not None and url_path not in sitemap_paths:
        err(rel, "page is indexable but missing from sitemap.xml")
    if noindex and sitemap_paths and url_path in sitemap_paths:
        err(rel, "page is noindex but listed in sitemap.xml")


def _audit_nap(page, node, nap):
    """Name / address / phone must be byte-identical everywhere."""
    if nap.get("phone") and node.get("telephone") not in (None, nap["phone"]):
        err(page, "telephone in schema (%s) differs from SiteConfig (%s)"
            % (node.get("telephone"), nap["phone"]))
    addr = node.get("address") or {}
    if nap.get("street") and addr.get("streetAddress") not in (None, nap["street"]):
        err(page, "streetAddress in schema (%s) differs from SiteConfig (%s)"
            % (addr.get("streetAddress"), nap["street"]))


ALL_DEFINED = set()


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    root = argv[1]
    warn_only = "--warn-only" in argv
    if not os.path.isdir(root):
        print("not a directory: %s" % root)
        return 2

    # sitemap
    sitemap_paths = None
    sm = os.path.join(root, "sitemap.xml")
    base_urls = set()
    if os.path.exists(sm):
        body = open(sm, encoding="utf-8").read()
        locs = re.findall(r"<loc>(.*?)</loc>", body)
        sitemap_paths = set()
        for loc in locs:
            m = re.match(r"(https?://[^/]+)(/.*)?$", loc)
            if m:
                base_urls.add(m.group(1))
                sitemap_paths.add(m.group(2) or "/")
    else:
        WARNINGS.append("sitemap.xml: not found")

    pages = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.endswith(".html"):
                pages.append(os.path.join(dirpath, f))

    # First pass: collect every @id the site defines, so cross-page references
    # can be validated rather than guessed at.
    for p in pages:
        for blob in LD.findall(open(p, encoding="utf-8").read()):
            try:
                data = json.loads(blob)
            except ValueError:
                continue
            nodes = data.get("@graph") if isinstance(data, dict) else [data]
            if nodes:
                collect_ids(nodes, ALL_DEFINED)

    nap = {}
    cfgfile = os.path.join(os.path.dirname(root.rstrip("/")), ".nap.json")
    if os.path.exists(cfgfile):
        nap = json.load(open(cfgfile))

    for p in sorted(pages):
        rel = os.path.relpath(p, root)
        audit_page(p, rel, base_urls, sitemap_paths, nap)

    # required files
    for required in ("robots.txt", "sitemap.xml", "llms.txt", "site.webmanifest"):
        if not os.path.exists(os.path.join(root, required)):
            err(required, "missing")

    print("audited %(pages)d pages, %(graphs)d JSON-LD blocks, %(nodes)d nodes"
          % CHECKED)
    for w in WARNINGS:
        print("  WARN  %s" % w)
    for e in ERRORS:
        print("  ERROR %s" % e)
    print("%d error(s), %d warning(s)" % (len(ERRORS), len(WARNINGS)))
    if ERRORS and not warn_only:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
