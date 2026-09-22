"""sitemap.xml with an HONEST per-URL lastmod.

Three approaches, and why this one:

  date.today() for every URL      -- claims the whole site changed daily. A
                                     signal obviously wrong enough to be worth
                                     less than none. (The original build.py.)
  file mtime                      -- useless for a static generator, because
                                     every page is rewritten on every build, so
                                     mtime is always "now". Same bug, subtler.
  content hash + committed stamp  -- what this does.

A small manifest next to the site records the hash of each generated page and
the date it last actually changed. Rebuild with no content change, and the date
is preserved. It must be committed for CI builds to benefit, which is why it
lives beside build.py rather than inside public/.
"""

import datetime
import hashlib
import json
import os

MANIFEST = ".lastmod.json"


def _page_file(out_dir, path):
    rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
    return os.path.join(out_dir, rel)


def build_sitemap(cfg, pages, out_dir, manifest_dir=None, today=None):
    today = today or datetime.date.today().isoformat()
    manifest_dir = manifest_dir or os.path.dirname(os.path.abspath(out_dir.rstrip("/")))
    mpath = os.path.join(manifest_dir, MANIFEST)

    try:
        with open(mpath, encoding="utf-8") as fh:
            prev = json.load(fh)
    except (IOError, ValueError):
        prev = {}

    current, rows = {}, []
    for p in sorted(pages, key=lambda x: x["path"]):
        disk = _page_file(out_dir, p["path"])
        try:
            with open(disk, "rb") as fh:
                digest = hashlib.sha256(fh.read()).hexdigest()[:16]
        except IOError:
            digest = ""

        if p.get("lastmod"):
            # Explicit override from the page itself always wins.
            stamp = p["lastmod"]
        else:
            was = prev.get(p["path"])
            stamp = was["date"] if was and was.get("hash") == digest else today

        current[p["path"]] = {"hash": digest, "date": stamp}
        rows.append(
            "  <url>\n"
            "    <loc>%s%s</loc>\n"
            "    <lastmod>%s</lastmod>\n"
            "    <changefreq>%s</changefreq>\n"
            "    <priority>%s</priority>\n"
            "  </url>" % (cfg.base_url, p["path"], stamp,
                          p["changefreq"], p["priority"]))

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(rows) + "\n</urlset>\n")
    dest = os.path.join(out_dir, "sitemap.xml")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(xml)
    with open(mpath, "w", encoding="utf-8") as fh:
        json.dump(current, fh, indent=1, sort_keys=True)
        fh.write("\n")
    return dest
