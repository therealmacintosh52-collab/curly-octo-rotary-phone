#!/usr/bin/env python3
"""Bundle the generated site into ONE self-contained HTML file.

Every page, its CSS, its JavaScript and its images end up in a single file
with a small hash router, so the whole site can be opened, clicked through
and shared without a web server — handy for showing the shop the site before
it goes live, or for emailing a reviewable copy.

Usage: python3 make-preview.py [output.html]
"""
import base64
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview.html")


def read(*parts):
    with open(os.path.join(PUB, *parts), encoding="utf-8") as fh:
        return fh.read()


def data_uri(rel, mime):
    with open(os.path.join(PUB, rel.lstrip("/")), "rb") as fh:
        return "data:%s;base64,%s" % (mime, base64.b64encode(fh.read()).decode())


def routes():
    found = {}
    for dirpath, _, files in os.walk(PUB):
        if "index.html" not in files:
            continue
        rel = os.path.relpath(dirpath, PUB)
        path = "/" if rel == "." else "/%s/" % rel.replace(os.sep, "/")
        found[path] = os.path.join(dirpath, "index.html")
    return dict(sorted(found.items()))


MAP_PLACEHOLDER = (
    '<div class="map-frame" style="display:grid;place-items:center;text-align:center;'
    'padding:32px;color:#c4d3e0">'
    '<div><strong style="display:block;font-size:1.05rem;color:#fff;margin-bottom:6px">'
    'Google map</strong>Loads on the live site — this preview is a single offline file.</div></div>'
)


def main():
    css = read("assets", "css", "site.css")
    js = read("assets", "js", "site.js")
    logo = data_uri("/assets/img/logo.png", "image/png")
    scene = data_uri("/assets/img/shop-scene.svg", "image/svg+xml")

    templates = []
    for path, filename in routes().items():
        with open(filename, encoding="utf-8") as fh:
            html = fh.read()
        body = html.split("<body>", 1)[1].rsplit("</body>", 1)[0]
        body = body.replace('<script src="/assets/js/site.js" defer></script>', "")
        body = body.replace("/assets/img/logo.png", logo)
        body = body.replace("/assets/img/shop-scene.svg", scene)
        body = re.sub(r'<iframe class="map-frame".*?</iframe>', MAP_PLACEHOLDER, body, flags=re.S)
        templates.append('<template data-route="%s">%s</template>' % (path, body))

    # The bundle is one document, so it takes the shop's name rather than the
    # home page's search-result title.
    title = "Phil's Auto &amp; Fleet Repair"

    page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<style>
%(css)s
</style>
</head>
<body>
<div id="app"></div>
%(templates)s
<script>
(function () {
  "use strict";
  var SITE_JS = %(js)s;
  var app = document.getElementById("app");
  var views = {};
  Array.prototype.forEach.call(document.querySelectorAll("template[data-route]"), function (t) {
    views[t.dataset.route] = t.innerHTML;
  });

  function routeFor(href) {
    var path = href.split("#")[0].split("?")[0];
    if (!path) return null;
    if (views[path]) return path;
    if (views[path + "/"]) return path + "/";
    return "/404/";
  }

  function render(path, anchor) {
    app.innerHTML = views[path] || views["/404/"];
    try { new Function(SITE_JS)(); } catch (e) {}
    previewForms();
    var target = anchor && document.getElementById(anchor.slice(1));
    if (target) { target.scrollIntoView(); } else { window.scrollTo(0, 0); }
  }

  /* The live site posts to a form endpoint or falls back to email; neither can
     run inside a preview, so say so plainly instead of failing quietly. */
  function previewForms() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-quote-form]"), function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var status = form.querySelector(".form-status");
        if (status) {
          status.textContent = "Preview only — on the live site this request goes straight to the shop.";
          status.className = "form-status show ok";
        }
      }, true);
    });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) === "#") {
      var el = document.getElementById(href.slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({behavior: "smooth"}); }
      return;
    }
    if (href.charAt(0) !== "/") return;              /* external links stay external */
    e.preventDefault();
    var hash = href.split("#")[1];
    window.location.hash = "#" + routeFor(href) + (hash ? "#" + hash : "");
  });

  function fromHash() {
    var raw = window.location.hash.replace(/^#/, "");
    var parts = raw.split("#");
    var path = parts[0] || "/";
    render(views[path] ? path : routeFor(path), parts[1] ? "#" + parts[1] : null);
  }

  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
</script>
</body>
</html>
""" % {"title": title, "css": css, "templates": "\n".join(templates),
       "js": __import__("json").dumps(js)}

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("%s (%.0f KB, %d pages)" % (OUT, os.path.getsize(OUT) / 1024, len(views_count())))


def views_count():
    return routes()


if __name__ == "__main__":
    main()
