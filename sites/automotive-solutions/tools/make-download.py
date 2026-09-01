#!/usr/bin/env python3
"""Build the upload-ready zip.

  python3 tools/make-download.py

Produces download/automotive-solutions-website.zip from a fresh --relative
build, so the folder works whether it is dropped at the root of a domain, in
a subfolder, or on a staging URL.

Before it finishes it opens the zip back up and asserts that the HTML, the
CSS, the JavaScript, the images AND the .htaccess are all actually inside.
A zip that quietly lost its stylesheet or its dotfile looks fine in a file
listing and is broken on the server, so this is checked rather than assumed.
"""

import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, "build", "zip-stage")
DOWNLOAD = os.path.join(ROOT, "download")
ZIP = os.path.join(DOWNLOAD, "automotive-solutions-website.zip")

READ_ME = """AUTOMOTIVE SOLUTIONS BY SINGLE - WEBSITE FILES
=============================================

This zip contains the complete website. It is plain HTML, CSS, JavaScript
and images. There is nothing to install, no database, and no monthly
software to pay for. Any normal web host will serve it.


-------------------------------------------------------------------
BEFORE YOU UPLOAD: one thing has to be filled in
-------------------------------------------------------------------

The "request a quote" form on the site is not connected to an inbox yet,
because we did not have the shop's email address. Until it is connected,
the form politely tells visitors to call (916) 686-5277 instead. Nothing
is broken and nothing is lost - but you are leaving leads on the table.

To connect it, see "CONNECTING THE QUOTE FORM" further down. It is a
one-line change and a single confirmation email.


-------------------------------------------------------------------
HOW TO UPLOAD IT (cPanel - the most common kind of hosting)
-------------------------------------------------------------------

1. Unzip this file on your computer. You will get a folder of files
   including index.html, an "assets" folder, and folders like "services"
   and "about".

2. Log in to your hosting control panel (cPanel) and open FILE MANAGER.

3. *** TURN ON HIDDEN FILES FIRST. THIS STEP MATTERS. ***
   In File Manager, click SETTINGS (top right) and tick
   "Show Hidden Files (dotfiles)". Then click Save.

   Why: one of the files in this zip is called ".htaccess". The dot at the
   start makes most file managers and FTP programs hide it. If you skip
   this step, that file will silently not be uploaded, and two things will
   break: the site will not force HTTPS, and every old page address from
   the previous website will show a "404 Not Found" instead of forwarding
   to the new page. That costs you Google rankings you already earned.

4. Go into the folder called public_html. This is the folder the public
   sees. If there is an old website in there, back it up first (select
   everything, Compress, download the zip) before you delete anything.

5. Click UPLOAD and upload every file and folder from the unzipped folder.
   Upload the CONTENTS of the folder, not the folder itself - index.html
   must end up directly inside public_html, not inside another folder.

6. Visit your website. You should see the new site. Click a few links,
   including a service page, to confirm they load.

If your host uses FTP instead of cPanel: same idea. Connect with FileZilla
or similar, turn on "show hidden files" in the FTP program's settings, and
upload everything into public_html (or www, or htdocs - whichever your
host uses as the public folder).


-------------------------------------------------------------------
WHAT IS IN THE ZIP
-------------------------------------------------------------------

  index.html            The home page
  404.html              The "page not found" page
  services/             One page per service (13 of them)
  about/                About the shop
  reviews/              Reviews, with links to Google, Yelp and the BBB
  service-areas/        The towns the shop serves
  contact/              Contact details, map and the quote form
  advice/               Five plain-English guides for customers
  es/                   The Spanish-language page
  privacy/              Privacy policy
  thank-you/            Where the form sends people after they submit
  assets/               The stylesheet, the JavaScript, the logo, artwork
  sitemap.xml           The list of pages, for Google
  robots.txt            Tells search engines the sitemap is there
  .htaccess             HTTPS, canonical domain, and the old-URL forwards
                        (HIDDEN FILE - see step 3 above)
  _redirects            The same forwards, for Netlify or Cloudflare Pages
  _headers              Caching and security headers, same two hosts
  site.webmanifest      Icon and name if someone saves the site to a phone


-------------------------------------------------------------------
CONNECTING THE QUOTE FORM
-------------------------------------------------------------------

The form uses a service called FormSubmit. It needs no account, no signup
and no password, and it is free.

If you have the source files (build.py):
  1. Open build.py in any text editor.
  2. Near the top, find the line:
         "email": "REPLACE-ME@example.com",
  3. Put the shop's real email address between the quotes.
  4. Save, run:  python3 build.py
     then re-upload the site (or run tools/make-download.py for a new zip).

If you only have this zip and no source files, a web person can do the same
thing by replacing REPLACE-ME@example.com everywhere it appears in the HTML
files - but changing build.py is the correct way, because it keeps every
page consistent.

*** THE ONE-TIME CONFIRMATION EMAIL ***
The very first time somebody submits the form, FormSubmit sends ONE email
to the address you set, asking you to confirm you want to receive these
messages. Click the link in that email. Until you do, submissions are held
and will not arrive. This happens once, ever. Check the spam folder if it
does not appear within a few minutes.

Test it yourself after uploading: fill the form in with your own details
and submit it. That triggers the confirmation email, and after you click
the link, that same test submission and every one after it lands in the
inbox.


-------------------------------------------------------------------
IMPORTANT: CHECK THE OLD PAGE ADDRESSES
-------------------------------------------------------------------

The .htaccess and _redirects files forward the old website's page
addresses to the matching new pages, so Google keeps the ranking those
pages have already earned.

Those forwards were written from the old addresses we could see from the
outside. They are almost certainly not the complete list.

Before you switch over, get the real list:
  - In Google Search Console, open Indexing > Pages and export the list of
    indexed URLs; or
  - Ask whoever ran the old site for a list of its pages; or
  - Note down every page address from the old site's own menu.

Then check each old address against the forwards. Anything missing should
be added, or that page's Google ranking is thrown away rather than passed
on. Whoever maintains the site can add lines to OLD_URL_MAP in build.py.


-------------------------------------------------------------------
IF SOMETHING LOOKS WRONG
-------------------------------------------------------------------

The site has no styling / looks like plain text
  The "assets" folder did not upload, or did not upload completely.
  Re-upload it and make sure assets/css/site.css is there.

Old page addresses show "404 Not Found"
  The .htaccess file did not upload. Go back to step 3 - hidden files.

The site does not switch to https:// automatically
  Same cause: .htaccess is missing, or your host has HTTPS turned off.
  Most hosts include a free certificate; turn it on in the control panel.

The map does not appear on the contact page
  The map loads from Google. It needs a live internet connection and does
  not work if you open the files directly from your computer - upload them
  to the host first.

A form submission never arrives
  The one-time confirmation email has not been clicked yet. See above.
"""


def main():
    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE, exist_ok=True)
    os.makedirs(DOWNLOAD, exist_ok=True)

    # A relative-link build, so the folder works from a subfolder, a staging
    # URL, or straight out of the zip.
    subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--relative",
                    "--out", STAGE], check=True, stdout=subprocess.DEVNULL)

    with open(os.path.join(STAGE, "READ-ME-FIRST.txt"), "w", encoding="utf-8") as fh:
        fh.write(READ_ME)

    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for dirpath, _dirs, files in os.walk(STAGE):
            for f in sorted(files):
                full = os.path.join(dirpath, f)
                z.write(full, os.path.relpath(full, STAGE))

    # ---- assert the zip really contains everything ----------------------
    # A zip missing its stylesheet or its dotfile looks perfectly fine in a
    # listing and is broken the moment it is served, so check rather than hope.
    with zipfile.ZipFile(ZIP) as z:
        names = set(z.namelist())
        sizes = {n: z.getinfo(n).file_size for n in names}

    required = [
        "index.html", "404.html", "READ-ME-FIRST.txt",
        "sitemap.xml", "robots.txt", "site.webmanifest",
        ".htaccess", "_redirects", "_headers",
        "assets/css/site.css", "assets/js/site.js",
        "assets/img/logo.png", "assets/img/shop-scene.svg",
        "assets/img/favicon.svg", "assets/img/og-cover.png",
        "assets/img/bay-classic.jpg", "assets/img/bay-subaru.jpg",
        "services/index.html", "services/brake-repair/index.html",
        "about/index.html", "contact/index.html", "reviews/index.html",
        "es/index.html", "advice/index.html", "privacy/index.html",
        "thank-you/index.html", "service-areas/index.html",
    ]
    missing = [r for r in required if r not in names]
    empty = [r for r in required if r in names and sizes[r] == 0]
    if missing:
        raise SystemExit("ZIP IS INCOMPLETE - missing: %s" % ", ".join(missing))
    if empty:
        raise SystemExit("ZIP CONTAINS EMPTY FILES: %s" % ", ".join(empty))

    # count what is actually in there, by kind
    kinds = {"html": 0, "css": 0, "js": 0, "img": 0, "other": 0}
    for n in names:
        if n.endswith(".html"):
            kinds["html"] += 1
        elif n.endswith(".css"):
            kinds["css"] += 1
        elif n.endswith(".js"):
            kinds["js"] += 1
        elif n.endswith((".png", ".svg", ".jpg", ".jpeg", ".webp")):
            kinds["img"] += 1
        else:
            kinds["other"] += 1
    if kinds["css"] < 1 or kinds["js"] < 1 or kinds["img"] < 5 or kinds["html"] < 25:
        raise SystemExit("ZIP LOOKS WRONG: %s" % kinds)

    print("%s (%.0f KB)" % (ZIP, os.path.getsize(ZIP) / 1024))
    print("  verified inside the zip: %d HTML, %d CSS, %d JS, %d images, "
          "%d other (.htaccess, _redirects, _headers, sitemap, robots, manifest, readme)"
          % (kinds["html"], kinds["css"], kinds["js"], kinds["img"], kinds["other"]))
    shutil.rmtree(STAGE)


if __name__ == "__main__":
    main()
