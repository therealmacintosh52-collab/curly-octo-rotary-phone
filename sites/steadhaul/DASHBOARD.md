# Steadhaul Desk — setup

A live dashboard at `dashboard.steadhauldispatch.com`. Carriers finish the onboarding
form, the record appears on your desk immediately, and you work it from there.

Cost: **$0/month.** Supabase free, Netlify free, GitHub Actions free.

---

## How it fits together

```
onboarding.html  ──POST──►  Supabase Postgres  ──live──►  dashboard
(public, branded)                   ▲
                                    │
                     GitHub Actions, daily:
                     · keepalive ping   · morning digest email
```

**Documents still do not go through this.** W-9, COI and CDL continue through the
signing service. The database holds operating data and a link to the signed packet —
never the packet. That rule is in ONBOARDING.md and it does not change.

---

## 1. Supabase (10 minutes)

1. **supabase.com** → new project. Pick the region nearest Sacramento (`us-west-1`).
   Save the database password somewhere safe; you won't need it day to day.
2. **Turn on two-factor authentication** on the Supabase account before anything else.
   This account holds every carrier's details.
3. **SQL Editor** → **New query** → paste the whole of `db/schema.sql` → **Run**.
   It creates every table, the triggers, the views, and the security policies. It is
   safe to re-run at any time.
4. **Project Settings → API**. Copy two values:
   - **Project URL**
   - **anon / public key**

   There is a third key there called **service_role**. It bypasses all security.
   Never put it in a web page — it belongs only in a GitHub secret.
5. **Authentication → Providers → Email**: ensure it's on. Turn **Confirm email** on.
6. **Authentication → URL Configuration**: add `https://dashboard.steadhauldispatch.com`
   to Site URL and Redirect URLs, or the sign-in link will bounce you somewhere else.

## 2. Wire the public form

```sh
cd sites/steadhaul
cp sh-config.example.js sh-config.js     # paste Project URL + anon key
```

Redeploy the main site. The form now writes straight to the database — and if the
database is ever unreachable it falls back to Netlify Forms rather than losing the lead.

## 3. Deploy the dashboard

```sh
cd sites/steadhaul/dashboard
cp config.example.js config.js           # same two values
```

Then in Netlify: **Add new site** → deploy the `dashboard` folder (drag-and-drop works).
Under **Domain management**, add `dashboard.steadhauldispatch.com` — a CNAME your
registrar points at the Netlify site.

Open it, enter your email, click the link that arrives. That's the login — no password
exists, so none can be stolen.

## 4. The daily job (5 minutes)

GitHub → your repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_SERVICE_KEY` | the **service_role** key |
| `RESEND_API_KEY` | from resend.com, free tier — optional |
| `DIGEST_TO` | where the morning email goes |

Then **Actions → Dispatch desk → Run workflow** to test it now rather than waiting for
6am.

**The keepalive is not optional.** A free Supabase project pauses after 7 days with no
database activity, and a paused project has to be restored by hand from the dashboard —
so without this, a quiet week means your desk is down when you open it on Monday. The
job writes one row a day, which resets the timer.

---

## Using it

**Today** is the landing screen — new carriers, insurance about to expire, brokers due a
re-check, loads delivered but not invoiced, and loads you haven't recorded approval for.
If all five are empty, there is genuinely nothing to do.

**Carriers** → **Open** gives you the full onboarding checklist. Ticking *W-9 deleted*
writes the retention log by itself, so the compliance record stops depending on you
remembering.

**Loads** — add a load, then tick approval, rate con, POD, invoiced, paid as they happen.
The rate per mile is computed by the database, so it cannot disagree with the numbers.

**Brokers** — *Checked today* stamps the bond and authority check and resets the
countdown. Anything over 30 days is flagged, because the site promises a check before
every booking.

**Billing** — *Build this week* creates a row per active carrier. Free weeks, truck-down
weeks, and weeks where you booked nothing all bill **$0 automatically**. You cannot
accidentally invoice against a promise the site makes.

**Friday** — the weekly numbers, straight from the loads. Deadhead over 15% is flagged.

Everything is live: a change from your phone appears on your laptop without a refresh.

---

## Security

- The key in the web pages is the **anon** key, which is public by design. What protects
  the data is Row Level Security in the database: an anonymous caller may insert a
  submission and can read, update, and delete **nothing**. That is enforced in the
  database, not in the JavaScript, so it holds even if someone rewrites the page.
- The **service_role** key exists only as a GitHub secret.
- Sign-in is a magic link. No password to leak or reuse.
- Turn on 2FA for Supabase, Netlify and GitHub. Email is the master key to all three.
- Carrier PII lives here, so Cal. Civ. Code § 1798.81.5 applies — the retention rules in
  ONBOARDING.md carry over unchanged.

## If something breaks

**Dashboard says "Not configured"** — `config.js` is missing or still has the
placeholder.

**Sign-in link goes to the wrong place** — Supabase → Authentication → URL Configuration.

**No data, but you are signed in** — check the project isn't paused (Supabase dashboard
will say). Restore it, then check the keepalive job is green under Actions.

**A carrier says they submitted and you see nothing** — look in Netlify → Forms →
`carrier-onboarding`. The fallback catches submissions whenever the database is
unreachable, so it will be there.
