# Putting a client site under their domain

Roughly **35–45 minutes of hands-on work** per client. Cost to you: **$0/month.**
The domain is the client's, registered in their name and billed to them.

## Why Cloudflare Pages

| | Cloudflare Pages (free) | Netlify (free, 2026) |
|---|---|---|
| Commercial use | Explicitly allowed | Discouraged for client production |
| Bandwidth | Unlimited (fair use) | ~15 GB, **pooled across all sites** |
| Deploys | 500 builds/month | ~20/month, pooled |
| Custom domains | 100 per project | — |
| Projects | ~100 per account | No stated cap |
| Over the limit | — | Site **suspended** until you upgrade |

Netlify's pooled quota means one busy client can take every other client offline.
Cloudflare's free tier covers your entire realistic client ceiling at $0.

**The tradeoff:** the free plan has no SLA and no direct technical support —
community and Discord only. Acceptable for a static brochure site, and worth
knowing before you promise uptime in writing.

## The steps

**1 · Domain — 5 min**
Register at Cloudflare Registrar, which sells at wholesale with no markup
(~$10/yr for .com). Register it **in the client's name, on their card** where
possible. If they already own it, have them move the nameservers instead.

**2 · Build — 1 min**
```bash
python3 build.py --client <slug>
python3 build.py --lint          # after --all, catches leaked reference copy
```

**3 · Host — 5 min**
Create a Pages project, direct-upload `public/`. No build command, no
framework preset — it is plain static files.

**4 · Custom domain — 5 min**
Add the domain in the Pages project. If the domain is already on Cloudflare
the DNS records are written automatically and propagation is minutes. Off
Cloudflare, add the CNAME yourself and allow up to 48 hours.

**5 · SSL — 0 min**
Provisioned automatically and free. Confirm it went green before handing over.

**6 · Email DNS — 10 min**
Add MX, SPF, DKIM and DMARC for whichever provider you chose. Set DMARC to
`p=quarantine` — `p=none` no longer satisfies the major receivers.

**7 · Search Console — 5 min**
Verify the property (instant if the domain is on Cloudflare) and submit
`/sitemap.xml`. The build already generates it.

**8 · Google Business Profile — 5 min**
Set the website field to the new domain. Confirm the client is listed as
**Owner**, not Manager.

## Before handing over

- [ ] `https://` and `https://www.` both resolve, no certificate warning
- [ ] Quote form submits and the notification actually arrives
- [ ] Phone links dial on a real phone
- [ ] `--lint` clean — no other client's town or name anywhere
- [ ] Sitemap submitted, profile updated
- [ ] Domain, hosting, profile and email all in the client's name

That last line is the product. Verify it in front of them.
