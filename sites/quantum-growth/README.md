# Quantum Growth — the agency site

One static page. No build step, no framework, no dependencies.

## Before you launch

Three things, in order. Skip any of them and the page is broken in a way that
costs money rather than looking wrong.

1. **Stamp the domain.** `python3 set-domain.py yourdomain.com`
   Then **set the lead address** (see the note below): `python3 set-lead-email.py you@yourdomain.com`
2. **Check the share card.** Paste the live URL into a text message to yourself
   and confirm the picture appears.

> **The lead form needs an address before it collects anything.** Until you
> set one, the form tells the visitor it is not connected and posts nothing.
> Run `python3 set-lead-email.py you@yourdomain.com`. FormSubmit emails that
> address once to confirm it before the first lead arrives, so submit one test
> lead yourself and click the confirmation. The address is stamped into the page
> source; FormSubmit can give you a masked alias after activation if you would
> rather it were not public.

## Still missing before this converts

- **Social proof.** No testimonials, case studies or client names. This is the
  ceiling on the whole page and no redesign fixes it — one client with real
  before-and-after numbers does. The comparison table and the ownership
  argument are doing the work social proof should be doing.
- **A face.** The one-person section carries the logo mark. Deciding whether to
  put a real name and photo on it is a live trade-off: anonymity looks bigger,
  a name converts better and is the thing the incumbent cannot offer.
- **The competitor figures.** Everything in the right-hand column of the
  comparison table, and the "Others charge..." lines in the plan cards, come
  from a single sales call. They are now stated in a table, which raises the
  stakes on being right. Confirm them before treating them as fact. The
  footnote under the table says explicitly that it is one call, not a survey.

## Do not expect this to rank

It is one page for a nationwide business, competing against every agency in
the country. The head tags stop it looking like a hypocrite selling schema
markup, and they help it show up when someone searches the business by name.
They will not win competitive terms. Traffic has to come from somewhere else.

## Careful when editing

`public/index.html` is the source of truth. The head — meta, canonical, Open
Graph and the three schema blocks — lives only in this file. Overwriting it
with a copy from anywhere else silently drops all of it, which has happened
twice. If you regenerate the page, re-add the head, and check with:

```bash
python3 -c "import re,io;print(len(re.findall(r'ld\+json', io.open('public/index.html',encoding='utf-8').read())))"
```

Three is correct. Zero means the head is gone.

Two CSS traps worth knowing, both already hit once:

- `.hero-grid` also carries `.wrap`. Setting `padding` as a shorthand there
  resets the wrap's side gutters to zero and the hero runs to the screen edge
  below about 1224px. Use `padding-top` / `padding-bottom`.
- `set-domain.py` lowercases its input, so the placeholder constant must stay
  lowercase. A case mismatch once left `index.html` and `sitemap.xml` holding
  different domains, and the next run silently skipped the sitemap.

## Answer engine files

`robots.txt` names sixteen AI crawlers explicitly and allows them — GPTBot,
OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended and the rest. A
blanket `User-agent: *` already permits them, but several are blocked by
default by hosts and plugins, so naming them removes the doubt.

`llms.txt` is a plain-text index of the plans, terms, consulting options and
the head-to-head comparison, for answer engines to read. **It is a proposed
convention, not a standard.** Google has confirmed its systems do not read it.
Ship it because it is free and some crawlers do fetch it — never sell it as a
ranking factor.
