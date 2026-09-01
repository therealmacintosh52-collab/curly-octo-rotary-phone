# Putting the site live

The site is static — one HTML file plus images. No build step, no server.

**Use Netlify.** Not because it's the only option, but because the form is
already wired to Netlify Forms (`data-netlify="true"`). Anywhere else and you
have to replace the form backend before launch, or the form will fail — visibly
now, since it no longer claims success when the post doesn't land.

Free tier covers this comfortably: 100 form submissions a month, custom domain,
automatic HTTPS.

---

## Before you deploy — two blockers

### 1. The phone number

It is still `(000) 000-0000` in 13 places. From this folder:

```sh
sed -i '' 's/(000) 000-0000/(916) 555-0142/g; s/+10000000000/+19165550142/g' index.html   # macOS
sed -i    's/(000) 000-0000/(916) 555-0142/g; s/+10000000000/+19165550142/g' index.html   # Linux
```

Use your real number in both formats: the pretty one for display, the
`+1` E.164 one for the `tel:` and `sms:` links. Also update `telephone` in the
JSON-LD block near the top.

Make sure the number can receive **texts**. The page tells people to text you
twice, and the sticky mobile bar has a TEXT button.

### 2. Confirm the email works

`hello@steadhauldispatch.com` appears on the page. Send it a test.

Then run the check:

```sh
sh preflight.sh
```

It greps for placeholder content and missing files, and exits non-zero if
anything is still outstanding. Run it before every deploy.

---

## Deploy — fastest path (5 minutes, no account setup)

1. Go to **app.netlify.com/drop**
2. Drag this `steadhaul` folder onto the page
3. It's live at something like `random-name-12345.netlify.app`

That's genuinely it. Good for showing someone today. Downside: updates mean
re-dragging the folder, and there's no version history.

## Deploy — git-connected (recommended for anything ongoing)

1. Sign in to Netlify → **Add new site** → **Import an existing project**
2. Connect GitHub, pick `therealmacintosh52-collab/curly-octo-rotary-phone`
3. Branch: `claude/high-converting-site-logo-64dtt8` (or merge to `main` first
   and deploy that — cleaner)
4. **Base directory:** `sites/steadhaul`
   **Build command:** leave empty
   **Publish directory:** `sites/steadhaul`
5. Deploy

Now every push redeploys. `netlify.toml` in this folder sets the security and
cache headers automatically.

---

## Custom domain

The page's canonical URL, OG tags, robots.txt and sitemap.xml all say
`https://steadhauldispatch.com`. If you own it:

1. Netlify → **Domain settings** → **Add a domain**
2. Enter `steadhauldispatch.com`
3. Either point your registrar's nameservers at Netlify DNS (simplest), or add
   the CNAME/A records Netlify shows you
4. HTTPS provisions itself within a few minutes — check
   **Domain settings → HTTPS** says "Your site has HTTPS enabled"
5. Force HTTPS on

**If you don't own the domain yet, buy it before launch.** Otherwise every
canonical tag, social preview and sitemap entry points at a domain that isn't
yours, which is worse than having no custom domain — Google will index the
`.netlify.app` URL while being told the canonical is somewhere else entirely.
If you'd rather use a different domain, search and replace
`steadhauldispatch.com` across `index.html`, `robots.txt` and `sitemap.xml`.

---

## After deploying — verify these four things

1. **Submit the form yourself.** Then check Netlify → **Forms** →
   `carrier-intake`. If the submission isn't there, Netlify didn't detect the
   form; redeploy and check the form tag still has `data-netlify="true"`.
2. **Turn on form notifications.** Netlify → Forms → **Form notifications** →
   add an email notification, and ideally a Slack or webhook one. Without this
   nobody tells you a lead arrived — submissions just sit in the dashboard.
   This is the single most common way a working form still loses you business.
3. **Tap the call and text buttons on an actual phone.** `tel:` and `sms:`
   links don't do anything meaningful on desktop.
4. **Check the social preview** at
   `opengraph.xyz` or by pasting the URL into a Slack DM to yourself.

## Then

- **Google Search Console** — add the property, submit `sitemap.xml`.
- **Google Business Profile** — for "truck dispatch Sacramento" searches this
  matters more than the website does. Free, and most dispatch competitors have
  a thin one or none.
- **Analytics** — Netlify Analytics is server-side ($9/mo, no cookie banner
  needed). Plausible or Fathom are similar. Google Analytics is free but drags
  in consent-banner obligations you don't otherwise have.

## Other hosts

Cloudflare Pages, Vercel and GitHub Pages will all serve this fine and cost
nothing — but **none of them handle forms**. If you use one, replace the
`fetch('/')` target in the form script with a Formspree, Basin or Web3Forms
endpoint, and change the `<form>` action for the no-JS path too. The failure
panel means a broken backend will at least be visible rather than silently
swallowing leads, but it's still a launch blocker. Netlify avoids the whole
problem.
