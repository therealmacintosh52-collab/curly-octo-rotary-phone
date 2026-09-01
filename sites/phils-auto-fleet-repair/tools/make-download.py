#!/usr/bin/env python3
"""Build the shop's download: the whole site, zipped, ready to upload.

Uses relative links so the folder works at a domain root or in a subfolder,
and includes a plain-language READ-ME-FIRST.txt for whoever does the upload.

Usage: python3 make-download.py [output.zip]
"""
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "phils-auto-website.zip"))

README = """PHIL'S AUTO AND FLEET REPAIR — WEBSITE
=======================================

WHAT THIS IS
Every file of the finished website. Plain HTML, CSS and images: no database,
no WordPress, no plugins. Nothing to install, nothing to keep updated, nothing
that can break on an update.

PUTTING IT ON YOUR DOMAIN (cPanel / hosting control panel)
1. Log in to your hosting control panel and open File Manager.
2. Open public_html. That folder IS your current website.
3. Back it up first: select everything, click Compress, download that zip to
    your computer. That is your undo button.
4. Move the old files into a folder called old-site, or delete them once the
    backup is safely downloaded.
5. Click Upload and send this zip file into public_html.
6. Right-click the uploaded zip and choose Extract.
7. Check that index.html sits directly inside public_html, not inside another
    folder. If it landed in a subfolder, move the files up one level.
8. Click Settings and tick "Show Hidden Files (dotfiles)". Confirm a file
    named .htaccess is there. It forwards your old page addresses to the new
    ones so Google keeps the ranking your old site earned.
9. Visit your domain and press Ctrl+F5 (Windows) or Cmd+Shift+R (Mac).

USING FTP INSTEAD (FileZilla)
Unzip on your computer, then upload the CONTENTS of the folder into
public_html. Turn on hidden files first: Server menu > Force showing hidden
files. Otherwise .htaccess is skipped.

WANT TO SEE IT ON YOUR DOMAIN BEFORE REPLACING THE OLD SITE?
Put the files in a folder such as public_html/new/ and visit
yourdomain.com/new/. The links are relative, so it works from there too.

THE CONTACT FORM — ONE CLICK, ONCE
The form is already connected. The first time somebody submits it, a
confirmation email arrives at phil@philsautofleet.com from FormSubmit. Click
the link in it once. Every request after that lands in the inbox directly,
with the customer's name, phone, vehicle and description.

Do this yourself before launch: open the site, submit the form with your own
details, then click the confirmation link in Phil's email. Then the form is
live for real customers.

WORTH CHECKING BEFORE YOU GO LIVE
- Hours on the site (Mon-Sat 8-5) match Google and Yelp exactly.
- Tap the phone number on a mobile phone and confirm it dials.
- Old links still work: visit an old page address and confirm it lands on the
   matching new page rather than an error.

FULL DOCUMENTATION
README.md in the project repository covers everything else, including how to
change text, hours, services and colours.
"""


def main():
    tmp = tempfile.mkdtemp()
    try:
        # assets/ is hand-maintained rather than generated, so it has to be
        # copied into a build made outside ./public
        shutil.copytree(os.path.join(ROOT, "public", "assets"), os.path.join(tmp, "assets"))
        subprocess.run([sys.executable, "build.py", "--relative", "--out", tmp],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
            for dirpath, _, files in os.walk(tmp):
                for f in files:
                    full = os.path.join(dirpath, f)
                    z.write(full, os.path.relpath(full, tmp))
            z.writestr("READ-ME-FIRST.txt", README)
        with zipfile.ZipFile(OUT) as z:
            names = z.namelist()
        for required in ("index.html", ".htaccess", "sitemap.xml", "robots.txt",
                         "assets/css/site.css", "assets/js/site.js",
                         "assets/img/logo.png", "assets/img/og-cover.png"):
            assert required in names, "archive is missing %s" % required
        print("%s — %.0f KB, %d files" % (OUT, os.path.getsize(OUT) / 1024, len(names)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
