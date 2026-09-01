#!/usr/bin/env python3
"""
Scaffold a new client config from what you can collect on one phone call.

    python3 newclient.py \
        --name "Ridgeline Auto Care" --domain ridgelineautocare.com \
        --phone "(209) 555-0142" --email service@ridgelineautocare.com \
        --street "418 W Harding Way" --city Stockton --region CA --zip 95204 \
        --areas "Stockton,Lodi,Manteca,Lathrop"

Writes clients/<slug>.json, then:

    python3 build.py --client <slug>     # into ./public
    python3 build.py --all               # every client into ./dist/<slug>/

Fields the shop has to confirm before launch are written as empty strings or
marked TODO. Do not invent them — a wrong address or a made-up rating is the
one mistake that costs the Google listing.
"""

import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR = os.path.join(ROOT, "clients")

WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def tel_link(display, country="1"):
    digits = re.sub(r"\D", "", display)
    if len(digits) == 10:
        return "+%s%s" % (country, digits)
    return "+" + digits


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="Legal shop name, exactly as on Google")
    ap.add_argument("--domain", required=True, help="apex domain, no scheme")
    ap.add_argument("--phone", required=True, help='display form, e.g. "(209) 555-0142"')
    ap.add_argument("--email", required=True, help="where quote requests land")
    ap.add_argument("--street", required=True)
    ap.add_argument("--city", required=True)
    ap.add_argument("--region", required=True, help="two-letter state")
    ap.add_argument("--zip", required=True)
    ap.add_argument("--slug", help="defaults to a slug of --name")
    ap.add_argument("--short", help="short name for tight spaces")
    ap.add_argument("--areas", default="", help="comma-separated towns served")
    ap.add_argument("--open", default="08:00", help="weekday open, 24h")
    ap.add_argument("--close", default="17:00", help="weekday close, 24h")
    ap.add_argument("--saturday", action="store_true", help="also open Saturday")
    ap.add_argument("--force", action="store_true", help="overwrite an existing config")
    a = ap.parse_args()

    slug = a.slug or slugify(a.name)
    path = os.path.join(CLIENT_DIR, slug + ".json")
    if os.path.exists(path) and not a.force:
        sys.exit("%s already exists. Pass --force to overwrite." % path)

    def h12(t):
        hh, mm = (int(x) for x in t.split(":"))
        ap_ = "AM" if hh < 12 else "PM"
        return "%d:%02d %s" % (hh % 12 or 12, mm, ap_)

    days = WEEK[:6] if a.saturday else WEEK[:5]
    span = "%s – %s" % (h12(a.open), h12(a.close))
    rows = [[d, span] for d in days] + [[d, "Closed"] for d in WEEK[len(days):]]
    human = "%s – %s, %s" % (days[0], days[-1], span)

    areas = [x.strip() for x in a.areas.split(",") if x.strip()] or [a.city]
    short = a.short or (a.name if len(a.name) <= 22 else a.name.split(" ")[0] + " Auto")

    cfg = {
        "name": a.name,
        "short": short,
        "base_url": "https://" + a.domain.replace("https://", "").replace("http://", "").strip("/"),
        "phone_display": a.phone,
        "phone_link": tel_link(a.phone),
        "email": a.email,
        "street": a.street,
        "city": a.city,
        "region": a.region.upper(),
        "region_long": a.region.upper(),
        "zip": a.zip,
        "lat": "",                     # TODO: right-click the pin in Google Maps
        "lng": "",                     # TODO: same
        "hours_human": human,
        "hours_rows": rows,
        "hours_schema": [{"days": days, "opens": a.open, "closes": a.close}],
        "rating": "",                  # TODO: from the live Google listing, never estimated
        "review_count": "",            # TODO: same
        "areas": areas,
        "founded_note": "a locally owned shop serving %s drivers" % a.city,
        "logo": "",
        "logo_dark_bg": "",
        "logo_lockup": "badge",
        "custom_domain": "",
        "favicon": "",
        "title_suffixes": [" | " + a.name, " | " + short],
        "profiles": [],                # TODO: paste Yelp / Nextdoor / MapQuest / Carfax URLs
        "yelp_url": "",
        "reviews": [],                 # TODO: real, attributed, verbatim. Never write these.
        "review_themes": [],
        "area_notes": {},
    }

    os.makedirs(CLIENT_DIR, exist_ok=True)
    with io.open(path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    todo = [k for k in ("lat", "lng", "rating", "review_count") if not cfg[k]]
    print("Wrote %s" % path)
    print("\nStill needed before launch:")
    print("  - coordinates (%s)" % ", ".join(todo[:2]))
    print("  - the live Google rating and review count")
    print("  - real review quotes, attributed and verbatim")
    print("  - the shop's logo into public/assets/img/")
    print("\nBuild it:  python3 build.py --client %s" % slug)


if __name__ == "__main__":
    main()
