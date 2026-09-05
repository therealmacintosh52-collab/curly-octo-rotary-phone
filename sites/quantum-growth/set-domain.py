#!/usr/bin/env python3
"""Stamp the real domain into the site before deploying.

    python3 set-domain.py quantumgrowth.com

Canonical tags, Open Graph URLs and the schema @id all carry an absolute
domain. Deploying with the placeholder — or with the wrong domain — tells
Google this page belongs somewhere else, which is the one SEO mistake that
is genuinely expensive to undo. Run this once, then deploy.

Re-runnable: it rewrites whatever domain is currently in the file.
"""
import io, os, re, sys

PLACEHOLDER = "REPLACE-WITH-YOUR-DOMAIN.com"
PUB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
FILES = ["index.html", "robots.txt", "llms.txt", "sitemap.xml"]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    domain = sys.argv[1].strip().lower()
    domain = re.sub(r"^https?://", "", domain).strip("/")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}", domain):
        sys.exit("That does not look like a domain: %s" % domain)

    page = os.path.join(PUB, "index.html")
    with io.open(page, encoding="utf-8") as fh:
        s = fh.read()

    current = PLACEHOLDER
    m = re.search(r'<link rel="canonical" href="https://([^/"]+)/?">', s)
    if m:
        current = m.group(1)
    if current == domain:
        print("Already set to %s — nothing to do." % domain)
        return

    total = 0
    for name in FILES:
        fp = os.path.join(PUB, name)
        if not os.path.exists(fp):
            continue
        with io.open(fp, encoding="utf-8") as fh:
            text = fh.read()
        n = text.count(current)
        if n:
            with io.open(fp, "w", encoding="utf-8") as fh:
                fh.write(text.replace(current, domain))
            total += n
            print("  %-12s %d reference%s" % (name, n, "" if n == 1 else "s"))

    print("Set %d references from %s to %s" % (total, current, domain))
    print("Deploy public/ to Cloudflare Pages, then add %s as the custom domain." % domain)


if __name__ == "__main__":
    main()
