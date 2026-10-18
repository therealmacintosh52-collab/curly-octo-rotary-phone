#!/usr/bin/env python3
"""Structural checks on public/: HTML sanity, links, sitemap parity, canonicals, one H1, title/meta, images, JSON-LD,
answer length, internal-link rules. Exit 1 on any error. python3 tools/check.py [--public DIR]"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOID = {"meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "track", "wbr"}
errors, warns = [], []


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.ids, self.links, self.imgs, self.h, self.ld = [], [], [], [], [], []
        self.title = self.desc = self.canon = self.lang = None
        self.robots = ""
        self.cur = None
        self.text = []
        self.answer = None
        self.in_answer = False
        self.skip = 0
        self.ld_on = False
        self.refs = []
        self.forms = 0
        self.labels_for, self.controls = set(), []
        self.summ = []
        self.anchors = []
        self.a = None

    def handle_starttag(self, t, attrs):
        d = dict(attrs)
        if t not in VOID:
            self.stack.append(t)
        if "id" in d:
            self.ids.append(d["id"])
        if t == "html":
            self.lang = d.get("lang")
        if t == "meta":
            if d.get("name") == "description":
                self.desc = d.get("content")
            if d.get("name") == "robots":
                self.robots = d.get("content", "")
        if t == "link":
            if d.get("rel") == "canonical":
                self.canon = d.get("href")
            if d.get("href"):
                self.refs.append(d["href"])
        if t == "a" and "href" in d:
            self.links.append((d["href"], d.get("rel", "")))
            self.a = [d["href"], ""]
        if t == "img":
            self.imgs.append(d)
            self.refs.append(d.get("src", ""))
        if t in ("script",) and d.get("src"):
            self.refs.append(d["src"])
        if t == "source" and d.get("srcset"):
            self.refs.append(d["srcset"].split()[0])
        if t == "script" and d.get("type") == "application/ld+json":
            self.ld_on = True
            self.ld.append("")
        if t in ("h1", "h2", "h3", "h4"):
            self.cur = [t, ""]
        if t == "title":
            self.cur = ["title", ""]
        if t == "p" and "answer" in (d.get("class") or "").split():
            self.in_answer = True
            self.answer = ""
        if t == "label" and d.get("for"):
            self.labels_for.add(d["for"])
        if t in ("input", "select", "textarea") and d.get("type") not in ("hidden", "submit"):
            self.controls.append(d)
        if t in ("style", "script"):
            self.skip += 1
        if t == "form":
            self.forms += 1

    def handle_endtag(self, t):
        if t in VOID:
            return
        if t == "a" and self.a:
            self.anchors.append(tuple(self.a))
            self.a = None
        if t in ("style", "script"):
            self.skip -= 1
            self.ld_on = False
        if self.cur and self.cur[0] == t:
            if t == "title":
                self.title = self.cur[1].strip()
            else:
                self.h.append((t, self.cur[1].strip()))
            self.cur = None
        if t == "p" and self.in_answer:
            self.in_answer = False
        if not self.stack or self.stack[-1] != t:
            errors.append("unbalanced </%s>; open stack tail %s" % (t, self.stack[-4:]))
            if t in self.stack:
                while self.stack and self.stack.pop() != t:
                    pass
        else:
            self.stack.pop()

    def handle_data(self, data):
        if self.ld_on:
            self.ld[-1] += data
            return
        if self.skip:
            return
        if self.a is not None:
            self.a[1] += data
        if self.cur:
            self.cur[1] += data
        if self.in_answer:
            self.answer += data
        self.text.append(data)


def main():
    pub = Path(sys.argv[sys.argv.index("--public") + 1]) if "--public" in sys.argv else ROOT / "public"
    pages = {}
    for f in sorted(pub.rglob("*.html")):
        rel = f.relative_to(pub).as_posix()
        url = "/" if rel == "index.html" else "/404.html" if rel == "404.html" else "/" + rel[:-len("index.html")]
        p = P()
        p.feed(f.read_text())
        if p.stack:
            errors.append("%s: unclosed %s" % (rel, p.stack))
        pages[url] = p
    sm = re.findall(r"<loc>https://\{\{DOMAIN\}\}([^<]*)</loc>", (pub / "sitemap.xml").read_text()) if (pub / "sitemap.xml").exists() else []
    index_pages = {u for u, p in pages.items() if "noindex" not in p.robots}
    if set(sm) != index_pages:
        errors.append("sitemap parity: only in sitemap %s; only in pages %s" % (sorted(set(sm) - index_pages), sorted(index_pages - set(sm))))
    titles, descs = {}, {}
    inbound = {u: 0 for u in pages}
    for u, p in pages.items():
        e = lambda m: errors.append("%s: %s" % (u, m))  # noqa
        if p.lang != "en-US":
            e("lang is %r" % p.lang)
        h1 = [x for x in p.h if x[0] == "h1"]
        if len(h1) != 1:
            e("%d h1" % len(h1))
        if not p.title or len(p.title) > 62:
            e("title length %s: %r" % (len(p.title or ""), p.title))
        if p.title in titles:
            e("duplicate title with " + titles[p.title])
        titles[p.title] = u
        if u != "/404.html" and (not p.desc or not (110 <= len(p.desc) <= 165)):
            e("meta description length %s" % len(p.desc or ""))
        if p.desc in descs:
            e("duplicate description with " + descs[p.desc])
        descs[p.desc] = u
        want = "https://{{DOMAIN}}" + u
        if u != "/404.html" and p.canon != want:
            e("canonical %r != %r" % (p.canon, want))
        if u == "/404.html" and "noindex" not in p.robots:
            e("404 must be noindex")
        # heading order
        last = 0
        for t, _ in p.h:
            lv = int(t[1])
            if lv > last + 1 and last:
                e("heading jump h%d -> h%d" % (last, lv))
            last = lv
        if len(p.ids) != len(set(p.ids)):
            e("duplicate ids %s" % sorted({i for i in p.ids if p.ids.count(i) > 1}))
        for im in p.imgs:
            if "alt" not in im:
                e("img without alt %s" % im.get("src"))
            if not (im.get("width") and im.get("height")):
                e("img without dimensions %s" % im.get("src"))
        for c in p.controls:
            if c.get("id") not in p.labels_for and c.get("type") != "checkbox" and "hp" not in c.get("class", ""):
                e("control without label: %s" % c)
            if c.get("type") == "checkbox" and c.get("id") not in p.labels_for:
                e("checkbox without label")
        # links
        photo = 0
        for href, rel in p.links:
            if href.startswith(("tel:", "sms:", "mailto:")):
                continue
            if href.startswith("http"):
                if "noopener" not in rel:
                    e("external link without rel=noopener: %s" % href)
                continue
            if href.startswith("#"):
                if href[1:] not in p.ids:
                    e("broken anchor %s" % href)
                continue
            path = href.split("#")[0].split("?")[0]
            if path not in pages:
                e("broken internal link %s" % href)
            else:
                if path != u:
                    inbound[path] += 1
                if path == "/photo-quote/":
                    photo += 1
        if u not in ("/404.html",) and photo < 2:
            e("only %d links to /photo-quote/" % photo)
        for r in p.refs:
            if r.startswith("/") and not r.startswith("//") and not (pub / r.lstrip("/").split("?")[0]).exists() and r not in pages:
                e("missing asset %s" % r)
        # answer length
        if p.answer is not None and u != "/404.html":
            n = len(p.answer.split())
            if not 40 <= n <= 60:
                e("answer is %d words" % n)
        KW = {"paintless dent repair": "/paintless-dent-repair/", "ceramic coating": "/ceramic-coating/", "hail damage repair": "/hail-damage-repair/", "mobile detailing": "/mobile-detailing/"}
        for href, txt in p.anchors:
            for kw, tgt in KW.items():
                if kw in txt.lower() and href.split("#")[0] != tgt and not href.startswith(("tel:", "sms:", "http")):
                    e("keyword anchor %r points to %s (should be %s)" % (txt.strip()[:60], href, tgt))
        # city pages: no sideways links
        if u.startswith("/service-area/") and u != "/service-area/":
            for href, _ in p.links:
                if href.startswith("/service-area/") and href not in (u, "/service-area/"):
                    e("sideways city link %s" % href)
        # JSON-LD
        blob = " ".join(p.ld)
        if u == "/404.html":
            continue
        try:
            data = json.loads(blob)
        except Exception as ex:
            e("JSON-LD does not parse: %s" % ex)
            continue
        nodes = data["@graph"]
        types = [n["@type"] for n in nodes]
        for bad in ("AggregateRating", "Review"):
            if bad in blob:
                e("JSON-LD contains " + bad)
        if '"address"' in blob or '"priceRange"' in blob or '"offers"' in blob:
            e("JSON-LD has address/priceRange/offers")
        text = " ".join(p.text)
        for n in nodes:
            if n["@type"] == "AutomotiveBusiness" and n.get("telephone") != "+1-916-868-2447":
                e("telephone mismatch")
            if n["@type"] == "FAQPage":
                for q in n["mainEntity"]:
                    if q["name"] not in text:
                        e("FAQ question not visible: %s" % q["name"])
        if u == "/":
            if "AutomotiveBusiness" not in types or "WebSite" not in types:
                e("home schema types %s" % types)
        else:
            if "BreadcrumbList" not in types:
                e("no BreadcrumbList")
            if u.startswith("/guides/") and u != "/guides/" and "Article" not in types:
                e("guide without Article")
        if re.search(r"\(916\) 868-2447", text) is None and u not in ("/404.html",):
            warns.append("%s: phone not in visible text outside header/footer?" % u)
    for u, n in inbound.items():
        if n == 0 and u not in ("/", "/404.html"):
            errors.append("%s: orphan (no inbound links)" % u)
    for w in warns:
        print("WARN", w)
    for x in errors:
        print("ERROR", x)
    print("%d pages checked; %d errors; %d warnings" % (len(pages), len(errors), len(warns)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
