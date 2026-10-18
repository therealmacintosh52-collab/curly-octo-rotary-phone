#!/usr/bin/env python3
"""Stamp placeholders in the built site.

  python3 tools/stamp.py --domain example.org --form-endpoint https://forms.example.org/f/abc --analytics none --phone-confirmed

Tokens: {{DOMAIN}} (host only, no scheme), {{FORM_ENDPOINT}} (URL or /path that accepts a multipart POST),
{{ANALYTICS_ID}} (an ID, or "none" to remove the hook), {{FORM_ORIGIN}} (derived in _headers from the endpoint).
--phone-confirmed removes the phone-status marker (also settable by PHONE_CONFIRMED = True in build/config.py and a rebuild).
Stamping a form endpoint also removes the "isn't connected" notice and enables the submit buttons.
Default: stamps public/ in place; use --out DIR to stamp a copy and leave public/ with its tokens."""
import argparse
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
TEXT = {".html", ".xml", ".txt", ".webmanifest", ".json", ""}
NAMES = {"_headers", "_redirects"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--public", default=str(ROOT / "public"))
    ap.add_argument("--out")
    ap.add_argument("--domain")
    ap.add_argument("--form-endpoint")
    ap.add_argument("--analytics")
    ap.add_argument("--phone-confirmed", action="store_true")
    a = ap.parse_args()
    src = Path(a.public)
    if a.out:
        out = Path(a.out)
        if out.exists():
            shutil.rmtree(out)
        shutil.copytree(src, out)
        src = out
    if a.domain and not re.fullmatch(r"[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}", a.domain):
        sys.exit("--domain must be a bare host such as example.org (no https://, no slash)")
    origin = ""
    if a.form_endpoint:
        if a.form_endpoint.startswith("/"):
            origin = ""
        else:
            u = urlparse(a.form_endpoint)
            if u.scheme != "https" or not u.netloc:
                sys.exit("--form-endpoint must be an https:// URL or a /path on this site")
            origin = "%s://%s" % (u.scheme, u.netloc)
    n = 0
    for f in src.rglob("*"):
        if not f.is_file() or f.parts[len(src.parts)] == "assets" or not (f.suffix in TEXT or f.name in NAMES):
            continue
        try:
            s = f.read_text()
        except UnicodeDecodeError:
            continue
        o = s
        if a.domain:
            s = s.replace("{{DOMAIN}}", a.domain)
        if a.analytics:
            if a.analytics.lower() == "none":
                s = re.sub(r'<meta name="analytics-id" content="\{\{ANALYTICS_ID\}\}">', "", s)
            else:
                s = s.replace("{{ANALYTICS_ID}}", a.analytics)
        if a.form_endpoint:
            s = re.sub(r"<!--FORM-UNCONNECTED-->.*?<!--/FORM-UNCONNECTED-->", "", s, flags=re.S)
            s = s.replace(' disabled aria-disabled="true" data-unconnected', "")
            s = s.replace("{{FORM_ENDPOINT}}", a.form_endpoint).replace("{{FORM_ORIGIN}}", origin)
            s = re.sub(r"connect-src 'self' ;", "connect-src 'self';", s)
            s = s.replace("connect-src 'self'  ", "connect-src 'self' ").replace("form-action 'self' ;", "form-action 'self';")
        if a.phone_confirmed:
            s = s.replace('<meta name="phone-status" content="unconfirmed">', "")
        if s != o:
            f.write_text(s)
            n += 1
    print("stamped %d files in %s" % (n, src))


if __name__ == "__main__":
    main()
