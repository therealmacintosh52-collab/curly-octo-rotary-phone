#!/usr/bin/env python3
"""Build a client's download: the whole site, zipped, ready to upload.

    python3 tools/make-download.py --client ridgeline-auto-care
    python3 tools/make-download.py --client ridgeline-auto-care --out ~/ridgeline.zip

A zip is built FOR ONE DOMAIN. Relative links make the asset paths portable,
but canonical tags, Open Graph URLs, schema @id and every <loc> in sitemap.xml
carry the absolute domain from the client's config. Shipping a zip built for
one domain to a different one points Google at somebody else's site — so this
script reads base_url from the client config, and refuses to write the archive
if any other domain survives into the output.

Set base_url in clients/<slug>.json to the domain the site will actually live
on, then build. One client, one domain, one zip.
"""

import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_DIR = os.path.join(ROOT, "clients")

# Hosts the pages legitimately link out to. Anything else that looks like a
# domain is treated as a leak from another client's config.
EXTERNAL_OK = {
    "schema.org", "www.google.com", "maps.google.com", "www.yelp.com",
    "nextdoor.com", "www.mapquest.com", "www.carfax.com", "formsubmit.co",
    "www.w3.org", "www.sitemaps.org", "fonts.googleapis.com", "fonts.gstatic.com",
}


def domain_of(url):
    return url.replace("https://", "").replace("http://", "").strip("/").split("/")[0]


def readme(cfg):
    d = domain_of(cfg["base_url"])
    return """%(name)s — WEBSITE FILES
%(rule)s

WHAT THIS IS
Every file of the finished website. Plain HTML, CSS and images — no database,
no WordPress, no plugins. Nothing to install and nothing that breaks on an
update.

Built for the domain: %(domain)s
These files carry that address inside them. Do not put them on a different
domain — ask for a rebuild instead, it takes a minute.


>>> BEFORE YOU TOUCH DNS, READ THIS <<<

If the business has email on this domain, DO NOT change the nameservers
unless you are ready to re-create the mail records. Nameservers control
everything, and moving them to a new provider drops the MX, SPF, DKIM and
DMARC records with them. The website comes up and the email silently stops.

The safe change is a single record — the A record or CNAME for the website.
Leave MX and TXT records exactly as they are. If you must move nameservers,
write down every existing record first and re-enter them at the new provider
BEFORE switching.


WHICH SITUATION ARE YOU IN?

  A. There is already a domain AND a hosting account (cPanel, Bluehost,
     GoDaddy hosting, etc.)  ->  Section A
  B. There is a domain but no hosting  ->  Section B
  C. The current website company controls the domain  ->  Section C


SECTION A — EXISTING HOSTING (cPanel or similar)
1. Log in to the hosting control panel and open File Manager.
2. Open public_html. That folder IS the current website.
3. Back it up first: select everything, click Compress, download that zip.
   That is the undo button. Do not skip it.
4. Move the old files into a folder called old-site.
5. Upload this zip into public_html, then right-click it and Extract.
6. Check index.html sits directly inside public_html, not one folder deeper.
7. Settings > tick "Show Hidden Files". Confirm .htaccess is present — it
   forwards the old page addresses to the new ones so the ranking carries over.
8. Visit the domain and hard-refresh: Ctrl+F5, or Cmd+Shift+R on a Mac.

No DNS change is needed in this case. The domain already points here.

WANT TO PREVIEW IT FIRST?
Put the files in public_html/new/ and visit %(domain)s/new/. Links are
relative, so it works from a subfolder too. Move them up when you are happy.


SECTION B — DOMAIN, BUT NO HOSTING
1. Create a free Cloudflare Pages project and upload this zip (direct upload —
   there is no build step, these are finished files).
2. It goes live immediately on a temporary .pages.dev address. Open that and
   check the whole site BEFORE pointing the real domain at it.
3. In the Pages project, add %(domain)s as a custom domain.
4. At the domain registrar, add the CNAME record Cloudflare shows you.
   Change NOTHING else — see the DNS warning above.
5. HTTPS turns itself on within a few minutes. Wait for the padlock.

Propagation is usually minutes, occasionally up to 48 hours.

TIP: lower the record's TTL to 300 seconds the day before. The switch then
takes minutes instead of hours.


SECTION C — THE CURRENT WEBSITE COMPANY CONTROLS THE DOMAIN
Check first, before promising a launch date. At the registrar, look at who the
domain is registered to and who can log in.

If the vendor holds it, the site cannot be pointed anywhere until that is
resolved. Options, best first:
  - Have the owner request a transfer to their own registrar account. This is
    their legal right for a domain registered on their behalf, and it takes
    5-7 days.
  - Or register a fresh domain in the owner's name and launch there.

Either way: the domain, the hosting, the Google profile and the phone number
belong in the business owner's name. Verify it, do not assume it.


THE CONTACT FORM — ONE CLICK, ONCE
The form is already connected. The first time somebody submits it, a
confirmation email arrives at %(email)s from FormSubmit. Click the link in it
once. Every request after that lands in the inbox directly, with the
customer's name, phone, vehicle and description.

Do this before launch: submit the form yourself, then click the confirmation
link. Until that happens, no submissions arrive.


CHECK BEFORE GOING LIVE
- Both %(domain)s and www.%(domain)s load, with no certificate warning.
- The hours on the site match Google and Yelp exactly.
- Tap the phone number on a real phone and confirm it dials.
- Submit the form and confirm the email arrives.
- Old page addresses land on the matching new page, not an error.
- Email still works. Send one to the business and reply to it.
""" % {
        "name": cfg["name"].upper(),
        "rule": "=" * (len(cfg["name"]) + 10),
        "domain": d,
        "email": cfg["email"],
    }


def verify(tmp, cfg):
    """Refuse to ship a zip carrying a domain other than this client's."""
    own = {domain_of(cfg["base_url"])}
    own.add("www." + list(own)[0])
    for url in cfg.get("profiles", []) + [cfg.get("yelp_url", "")]:
        if url:
            own.add(domain_of(url))
    allowed = own | EXTERNAL_OK

    found = {}
    for dirpath, _dirs, files in os.walk(tmp):
        for fn in files:
            if not fn.endswith((".html", ".xml", ".txt", ".webmanifest")):
                continue
            fp = os.path.join(dirpath, fn)
            with io.open(fp, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
            for host in re.findall(r"https?://([A-Za-z0-9.-]+\.[A-Za-z]{2,})", text):
                if host not in allowed:
                    found.setdefault(host, set()).add(os.path.relpath(fp, tmp))

    if found:
        print("\nRefusing to build — foreign domains in the output:\n", file=sys.stderr)
        for host, files in sorted(found.items()):
            sample = ", ".join(sorted(files)[:3])
            print("  %-34s %s" % (host, sample), file=sys.stderr)
        print("\nSet base_url in clients/%s.json to the domain this site will "
              "live on, then rebuild.\n" % cfg["_slug"], file=sys.stderr)
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--client", default="phils-auto-fleet-repair")
    ap.add_argument("--out", help="output path (default: ./download/<slug>.zip)")
    a = ap.parse_args()

    cpath = os.path.join(CLIENT_DIR, a.client + ".json")
    if not os.path.exists(cpath):
        sys.exit("No client config at %s" % cpath)
    with io.open(cpath, encoding="utf-8") as fh:
        cfg = json.load(fh)
    cfg["_slug"] = a.client

    out = os.path.abspath(a.out or os.path.join(ROOT, "download", a.client + ".zip"))
    os.makedirs(os.path.dirname(out), exist_ok=True)

    tmp = tempfile.mkdtemp()
    try:
        # assets/ is hand-maintained rather than generated, so it has to be
        # copied into a build made outside ./public
        shutil.copytree(os.path.join(ROOT, "public", "assets"), os.path.join(tmp, "assets"))
        subprocess.run([sys.executable, "build.py", "--client", a.client,
                        "--relative", "--out", tmp],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)

        verify(tmp, cfg)

        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for dirpath, _dirs, files in os.walk(tmp):
                for f in files:
                    full = os.path.join(dirpath, f)
                    z.write(full, os.path.relpath(full, tmp))
            z.writestr("READ-ME-FIRST.txt", readme(cfg))

        with zipfile.ZipFile(out) as z:
            names = z.namelist()
        for required in ("index.html", ".htaccess", "sitemap.xml", "robots.txt",
                         "READ-ME-FIRST.txt", "assets/css/site.css", "assets/js/site.js"):
            assert required in names, "archive is missing %s" % required

        print("%s\n  %.0f KB · %d files · built for %s"
              % (out, os.path.getsize(out) / 1024, len(names), domain_of(cfg["base_url"])))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
