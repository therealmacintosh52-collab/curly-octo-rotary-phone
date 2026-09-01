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
PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "index.html")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    domain = sys.argv[1].strip().lower()
    domain = re.sub(r"^https?://", "", domain).strip("/")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}", domain):
        sys.exit("That does not look like a domain: %s" % domain)

    with io.open(PAGE, encoding="utf-8") as fh:
        s = fh.read()

    current = PLACEHOLDER
    m = re.search(r'<link rel="canonical" href="https://([^/"]+)/?">', s)
    if m:
        current = m.group(1)
    if current == domain:
        print("Already set to %s — nothing to do." % domain)
        return

    n = s.count(current)
    s = s.replace(current, domain)
    with io.open(PAGE, "w", encoding="utf-8") as fh:
        fh.write(s)

    print("Set %d references from %s to %s" % (n, current, domain))
    print("Deploy public/ to Cloudflare Pages, then add %s as the custom domain." % domain)


if __name__ == "__main__":
    main()
