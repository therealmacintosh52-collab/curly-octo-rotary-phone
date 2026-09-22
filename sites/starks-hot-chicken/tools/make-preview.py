#!/usr/bin/env python3
"""Bundle the generated site into ONE self-contained HTML file.

Every page, its CSS, its JS and its images end up in a single file with a small
hash router, so the whole site can be opened and clicked through from file://
with no web server -- handy for showing the owner before it goes live.

Usage: python3 tools/make-preview.py [output.html]
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview.html")

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
        ".webp": "image/webp", ".woff2": "font/woff2"}


def data_uri(rel):
    path = os.path.join(PUB, rel.lstrip("/"))
    ext = os.path.splitext(path)[1].lower()
    with open(path, "rb") as fh:
        return "data:%s;base64,%s" % (MIME.get(ext, "application/octet-stream"),
                                      base64.b64encode(fh.read()).decode())


def main():
    css = open(os.path.join(PUB, "assets/css/site.css"), encoding="utf-8").read()
    js = open(os.path.join(PUB, "assets/js/site.js"), encoding="utf-8").read()

    pages = {}
    for dirpath, _d, files in os.walk(PUB):
        for f in files:
            if f != "index.html":
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, PUB)
            route = "/" if rel == "index.html" else "/" + rel[:-len("index.html")]
            html = open(full, encoding="utf-8").read()
            body = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
            if not body:
                continue
            frag = body.group(1)
            frag = re.sub(r"<script.*?</script>", "", frag, flags=re.S)
            # Inline every image as a data URI.
            def sub_img(m):
                try:
                    return '%s="%s"' % (m.group(1), data_uri(m.group(2)))
                except IOError:
                    return m.group(0)
            frag = re.sub(r'(src)="(/assets/[^"]+)"', sub_img, frag)
            # Rewrite internal links onto the hash router.
            frag = re.sub(r'href="(/(?!/)[^"]*)"', r'href="#\1"', frag)
            title = re.search(r"<title>(.*?)</title>", html, re.S)
            pages[route] = {"html": frag,
                            "title": title.group(1) if title else route}

    doc = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stark's Hot Chicken - preview</title>
<style>%s
.preview-bar{position:fixed;left:0;right:0;bottom:0;z-index:999;background:#111;
 border-top:1px solid #333;padding:.5rem .8rem;font:600 12px/1.4 system-ui;
 color:#999;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.preview-bar b{color:#F26419}
.preview-bar a{color:#ccc;text-decoration:none;padding:.25rem .55rem;
 border:1px solid #333;border-radius:99px}
.preview-bar a:hover{border-color:#F26419;color:#F26419}
body{padding-bottom:64px}
</style></head><body>
<div id="app"></div>
<div class="preview-bar"><b>PREVIEW</b><span>%d pages - images are placeholders</span>%s</div>
<script>
var PAGES = %s;
function go(){
  var r = location.hash.slice(1) || "/";
  var p = PAGES[r] || PAGES[r + "/"] || PAGES["/"];
  document.getElementById("app").innerHTML = p.html;
  document.title = p.title;
  window.scrollTo(0,0);
  if (window.__enhance) window.__enhance();
}
window.addEventListener("hashchange", go);
window.addEventListener("DOMContentLoaded", go);
</script>
<script>window.__enhance = function(){ %s };</script>
</body></html>
""" % (css, len(pages),
       "".join('<a href="#%s">%s</a>' % (r, r) for r in sorted(pages)),
       json.dumps(pages), js)

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(doc)
    print("%s  (%d pages, %.1f KB)" % (OUT, len(pages), os.path.getsize(OUT) / 1024.0))


if __name__ == "__main__":
    main()
