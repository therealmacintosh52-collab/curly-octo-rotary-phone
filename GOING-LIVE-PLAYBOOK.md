# Putting a built site on a domain — and doing it repeatedly

The site is plain files. Every route below is a way of getting those files to answer when someone
types the domain.

---

## Case 1 — the client already has a domain AND a website

Two ways. Pick by what you're allowed to touch.

### 1a. Replace the files on their existing host (safest)

You need their hosting login (cPanel, Plesk, whatever the host gives).

1. `python3 tools/make-download.py site.zip`
2. cPanel → File Manager → `public_html`
3. Select all → Compress → **download that backup**
4. Move old files to `old-site/`
5. Upload the zip → Extract → confirm `index.html` is at the top level
6. Settings → Show Hidden Files → confirm `.htaccess` uploaded
7. Load the domain, hard-refresh

**Nothing about DNS changes, so their email keeps working.** This is why it's the safe default.

### 1b. Move hosting to Netlify or Cloudflare Pages

Better hosting, free, and it honours `_redirects` and `_headers`. But now you're touching DNS.

1. Deploy the folder (drag onto app.netlify.com/drop, or connect the repo)
2. Add the custom domain in the dashboard
3. It shows you records to create. **Create those records at the current DNS host — do not switch
   nameservers.**

> **The mistake that gets people fired:** switching nameservers moves *all* DNS, including `MX`.
> The client's email stops that afternoon and nobody connects it to the website. If you ever do
> switch nameservers, copy every existing record first — MX, TXT/SPF, DKIM, anything — into the new
> provider before the switch.

Lower the record TTL to 300s a day before you cut over, so a mistake is 5 minutes to undo instead
of 24 hours.

---

## Case 2 — the client has a domain but no website

Same as 1b, minus the redirect worry. Check whether the domain already has MX records (they may
have email even without a site) and leave them alone.

---

## Case 3 — no domain at all

1. **Buy it** — Cloudflare Registrar (at cost, ~$10/yr) or Namecheap. Register it in **the client's
   name with the client's email**, then take admin access. A domain in your name is a hostage
   situation nobody wants later.
2. Deploy to Netlify or Cloudflare Pages, add the domain, create the records it shows.
3. **Set up email** — Google Workspace (~$7/user/mo) or Zoho Mail (free for one domain). A shop
   with a gmail.com address on a real domain looks unfinished.
4. Claim the Google Business Profile before anything else. For a local business it out-earns the
   website.

---

## Doing this for many businesses

**Structure.** One folder per client in one repo: `sites/<client>/`. Everything a site needs is in
its own `build.py` `SITE` dict, so a new client is a copy of the folder plus new facts.

**Hosting.** One Netlify or Cloudflare account holds many sites on the free tier. Cloudflare Pages
has no bandwidth cap, which matters if one of them ever gets busy.

**Per-client running cost:** domain ~$12/yr, hosting $0, forms $0 (FormSubmit), email $0–7/mo. Your
only real input is the build and the launch.

**Who owns what.** Client owns the domain and the Google Business Profile. You hold the code and
the deploy. Clean handoff if they leave, no leverage games, and you're not the reason their email
breaks in two years.

**Order of operations per client:**
1. Collect the facts (name, address, phone, email, hours, services, reviews, logo, domain)
2. Build → preview link → their edits
3. Back up the old site
4. Deploy, verify redirects with `curl -I` on old URLs
5. Submit the sitemap in Search Console, update the Google Business Profile link
6. Test the form and the call button from a phone
7. Hand over the backup and the login list

**Where the money actually is:** the build is a day. The recurring work worth charging for is the
Google Business Profile, review collection, and keeping the pages current — and that's also what
determines whether they rank, which determines whether they stay.
