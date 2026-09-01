# Download

**[phils-auto-website.zip](phils-auto-website.zip)** — the complete website, ready to upload.

Click the file above, then click **Download** (or the download icon) on the next page.

## What to do with it

1. Log in to the hosting control panel and open **File Manager**
2. Open **`public_html`** — that folder is the current website
3. Back it up: select everything → **Compress** → download that zip
4. Move the old files into a folder called `old-site`
5. **Upload** `phils-auto-website.zip` into `public_html`, then right-click → **Extract**
6. Confirm `index.html` sits directly in `public_html`, not inside a subfolder
7. **Settings → Show Hidden Files**, and confirm **`.htaccess`** is present — it forwards the old
   page addresses to the new ones, so the site keeps the search rankings it has earned
8. Visit the domain and hard-refresh (Ctrl+F5 / Cmd+Shift+R)

To try it without touching the live site first, put the files in `public_html/new/` and visit
`yourdomain.com/new/` — the links are relative, so it works from a subfolder too.

`READ-ME-FIRST.txt` inside the zip repeats these steps, plus the one-time contact-form
confirmation.

This zip is a snapshot. Rebuild it any time with:

```bash
python3 tools/make-download.py download/phils-auto-website.zip
```
