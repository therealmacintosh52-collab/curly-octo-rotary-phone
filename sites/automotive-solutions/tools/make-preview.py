#!/usr/bin/env python3
"""Bundle the whole generated site into ONE self-contained HTML file.

Every page, its CSS, its JavaScript and its images end up in a single file
with a small hash router, so the entire site can be opened, clicked through
and shared without a web server — for showing the shop the site before it
goes live, or for emailing a reviewable copy.

  python3 tools/make-preview.py                  -> preview.html (standalone)
  python3 tools/make-preview.py out.html --fragment
        -> the same thing without <!doctype>/<html>/<head>/<body>, for hosts
           that supply their own document shell.

Nothing is fetched from the network: the logo and illustration become data
URIs and the Google Maps embed becomes a labelled placeholder, because a
single offline file cannot load a live map.
"""

import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
FRAGMENT = "--fragment" in sys.argv
OUT = args[0] if args else os.path.join(ROOT, "preview.html")

TITLE = "Automotive Solutions by Single"


def read(*parts):
    with open(os.path.join(PUB, *parts), encoding="utf-8") as fh:
        return fh.read()


def data_uri(rel, mime):
    with open(os.path.join(PUB, rel.lstrip("/")), "rb") as fh:
        return "data:%s;base64,%s" % (mime, base64.b64encode(fh.read()).decode())


def routes():
    found = {}
    for dirpath, _dirs, files in os.walk(PUB):
        if "index.html" not in files:
            continue
        rel = os.path.relpath(dirpath, PUB)
        path = "/" if rel == "." else "/%s/" % rel.replace(os.sep, "/")
        found[path] = os.path.join(dirpath, "index.html")
    return dict(sorted(found.items()))


MAP_PLACEHOLDER = (
    '<div class="map-frame" style="display:grid;place-items:center;text-align:center;'
    'padding:32px;color:#c3cbe8">'
    '<div><strong style="display:block;font-size:1.05rem;color:#fff;margin-bottom:6px">'
    'Google map of 9253 Elk Grove Blvd</strong>'
    'The live site embeds the real map here. This preview is a single offline file, '
    'so it cannot load one.</div></div>'
)

ROUTER_JS = r"""
(function () {
  "use strict";
  var SITE_JS = %(js)s;
  var ASSETS = %(assets)s;
  var app = document.getElementById("app");
  var views = {};
  Array.prototype.forEach.call(document.querySelectorAll("template[data-route]"), function (t) {
    views[t.getAttribute("data-route")] = t.innerHTML;
  });

  function routeFor(href) {
    var path = href.split("#")[0].split("?")[0];
    if (!path) return "/";
    if (views[path]) return path;
    if (views[path + "/"]) return path + "/";
    return "/404/";
  }

  function render(path, anchor) {
    app.innerHTML = views[path] || views["/404/"];
    /* one shared copy of each image, applied after the markup lands */
    Array.prototype.forEach.call(app.querySelectorAll("[data-src]"), function (el) {
      var k = el.getAttribute("data-src");
      if (ASSETS[k]) { el.setAttribute("src", ASSETS[k]); el.removeAttribute("data-src"); }
    });
    document.documentElement.lang = (path === "/es/") ? "es" : "en";
    try { new Function(SITE_JS)(); } catch (e) {}
    previewForms();
    var target = anchor && document.getElementById(anchor.replace(/^#/, ""));
    if (target) { target.scrollIntoView(); } else { window.scrollTo(0, 0); }
  }

  /* On the live site the form posts to FormSubmit. That cannot work from a
     single offline file, so say so plainly rather than failing quietly. */
  function previewForms() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-quote-form]"), function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var es = document.documentElement.lang === "es";
        var status = form.querySelector(".form-status");
        if (status) {
          status.textContent = es
            ? "Vista previa — en el sitio real esta solicitud llega directo al taller."
            : "Preview only — on the live site this request goes straight to the shop.";
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
    if (href.charAt(0) !== "/") return;      /* tel:, mailto: and external links stay real */
    e.preventDefault();
    var hash = href.split("#")[1];
    window.location.hash = "#" + routeFor(href) + (hash ? "#" + hash : "");
  });

  function fromHash() {
    var raw = (window.location.hash || "").replace(/^#/, "");
    var parts = raw.split("#");
    var path = parts[0] || "/";
    render(views[path] ? path : routeFor(path), parts[1] || null);
  }

  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
"""


def main():
    css = read("assets", "css", "site.css")
    js = read("assets", "js", "site.js")
    logo = data_uri("/assets/img/logo.png", "image/png")
    scene = data_uri("/assets/img/shop-scene.svg", "image/svg+xml")
    favicon = data_uri("/assets/img/favicon.svg", "image/svg+xml")

    templates = []
    r = routes()
    for path, filename in r.items():
        with open(filename, encoding="utf-8") as fh:
            html = fh.read()
        body = html.split("<body>", 1)[1].rsplit("</body>", 1)[0]
        body = body.replace('<script src="/assets/js/site.js" defer></script>', "")
        # Hand the images to the router as data-src, so the (large) data URI
        # is stored once in ASSETS instead of once per page. Inlining it into
        # every template pushed the bundle past 18 MB.
        body = body.replace('src="/assets/img/', 'data-src="/assets/img/')
        body = re.sub(r'<iframe class="map-frame".*?</iframe>', MAP_PLACEHOLDER, body, flags=re.S)
        templates.append('<template data-route="%s">%s</template>' % (path, body))

    assets = {"/assets/img/logo.png": logo,
              "/assets/img/shop-scene.svg": scene,
              "/assets/img/favicon.svg": favicon}
    router = ROUTER_JS % {"js": json.dumps(js), "assets": json.dumps(assets)}
    core = ("<title>%s</title>\n<style>\n%s\n</style>\n"
            '<div id="app"></div>\n%s\n<script>%s</script>\n'
            % (TITLE, css, "\n".join(templates), router))

    if FRAGMENT:
        page = core
    else:
        page = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
                '<link rel="icon" href="%s">\n%s</head>\n<body>\n%s</body>\n</html>\n'
                % (favicon,
                   core.split("<div id=\"app\">")[0],
                   '<div id="app"></div>\n' + core.split('<div id="app"></div>\n', 1)[1]))

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("%s (%.0f KB, %d pages%s)"
          % (OUT, os.path.getsize(OUT) / 1024, len(r), ", fragment" if FRAGMENT else ""))


if __name__ == "__main__":
    main()
