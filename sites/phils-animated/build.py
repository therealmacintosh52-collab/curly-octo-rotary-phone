#!/usr/bin/env python3
"""
Static site generator for Phil's Auto and Fleet Repair (Lodi, CA).

Run:  python3 build.py
Out:  ./public  (deploy this folder as-is to Netlify, Cloudflare Pages,
                 GitHub Pages, or any shared host)

Everything the shop needs to edit day to day lives in the SITE and SERVICES
dictionaries below. Change it here, re-run the script, and every page,
the sitemap and the structured data stay in sync.
"""

import html
import os
import re
import re
import shutil
import sys
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public")

# `python3 build.py --relative` rewrites internal links to relative paths so the
# folder works wherever it is dropped — the domain root, a subfolder, a staging
# URL — instead of only at the top level of a domain.
RELATIVE = "--relative" in sys.argv
# `python3 build.py --walkthrough` prepends the Street View arrival sequence
# to the home page.
WALKTHROUGH = "--walkthrough" in sys.argv
if "--out" in sys.argv:                      # build somewhere other than ./public
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])

# --------------------------------------------------------------------------
# Business facts — single source of truth (keep identical to Google Business
# Profile, Yelp, Apple Maps and every citation: NAP consistency is a direct
# local-ranking factor).
# --------------------------------------------------------------------------
SITE = {
    "name": "Phil's Auto and Fleet Repair",
    "short": "Phil's Auto & Fleet",
    "base_url": "https://philsautofleet.com",
    "phone_display": "(209) 647-4953",
    "phone_link": "+12096474953",
    "email": "phil@philsautofleet.com",
    "street": "103 E Elm St",
    "city": "Lodi",
    "region": "CA",
    "region_long": "California",
    "zip": "95240",
    "lat": "38.1341",
    "lng": "-121.2724",
    "hours_human": "Monday – Saturday, 8:00 AM – 5:00 PM",
    "hours_rows": [
        ("Monday", "8:00 AM – 5:00 PM"),
        ("Tuesday", "8:00 AM – 5:00 PM"),
        ("Wednesday", "8:00 AM – 5:00 PM"),
        ("Thursday", "8:00 AM – 5:00 PM"),
        ("Friday", "8:00 AM – 5:00 PM"),
        ("Saturday", "8:00 AM – 5:00 PM"),
        ("Sunday", "Closed"),
    ],
    "hours_schema": [
        {"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
         "opens": "08:00", "closes": "17:00"},
    ],
    "rating": "4.4",
    "review_count": "83",
    "areas": ["Lodi", "Stockton", "Galt", "Acampo", "Woodbridge", "Lockeford",
              "Victor", "Thornton", "Clements", "Elk Grove"],
    "founded_note": "a locally owned shop serving Lodi drivers and fleets",
    # --- Logo -------------------------------------------------------------
    # Drop the shop's real logo in public/assets/img/ and put its path here,
    # e.g. "/assets/img/logo.svg" (SVG best, transparent PNG fine). Leave it
    # empty and the site falls back to the "PA" monogram placeholder.
    "logo": "/assets/img/logo.png",
    # Optional light/reversed version for the dark footer. If it's empty and a
    # logo is set, the footer puts the logo on a white chip so it stays legible.
    "logo_dark_bg": "",
    # "badge" keeps the shop name in text beside a round/square logo mark;
    # "full" uses the logo on its own (for a logo that already reads as a
    # wordmark). The badge mark needs the name spelled out next to it.
    "logo_lockup": "badge",
    # Set this when the site is served from a custom domain on GitHub Pages —
    # it writes the CNAME file that Pages requires. Netlify, Cloudflare Pages
    # and traditional hosts do not need it; leave it empty there.
    "custom_domain": "",
    # Street View embed for the arrival sequence. Get it from Google Maps:
    # open the shop → Street View → ⋮ → "Share or embed image" → Embed → copy
    # ONLY the src="..." value and paste it here. No API key needed.
    "streetview_embed": "",
    # A phone video of walking up to and into the shop, scrubbed by scroll.
    # One continuous take, no cuts, 15-25s, landscape. See the README for the
    # ffmpeg line that makes it seek smoothly. Takes priority over Street View.
    "walkthrough_video": "",          # e.g. "/media/walkthrough.mp4"
    "walkthrough_video_webm": "",     # optional, smaller, served first
    "walkthrough_poster": "",         # first frame, shown before the video decodes
    # Editorial controls, applied at playback — no re-encoding needed.
    # Trim: scroll maps to this window of the clip, not the whole file.
    "walkthrough_in": 0.0,            # seconds; where the scroll starts
    "walkthrough_out": 0.0,           # seconds; 0 = run to the end
    # Focal point for the crop, e.g. "50% 40%" to favour the top of frame.
    # Matters most with a portrait clip on a wide screen.
    "walkthrough_focus": "50% 50%",
    # Set False to fall back to Street View / the address panel even though
    # photographs are available.
    "use_photo_walkthrough": True,
    # Optional: a favicon cut from the real logo (SVG or PNG). Falls back to
    # the placeholder mark in assets/img/favicon.svg.
    "favicon": "/assets/img/logo.png",
}

MAPS_DIRECTIONS = ("https://www.google.com/maps/dir/?api=1&destination="
                   + "103+E+Elm+St+Lodi+CA+95240")
MAPS_LISTING = "https://www.google.com/maps/search/?api=1&query=Phil%27s+Auto+and+Fleet+Repair+Lodi+CA"
MAPS_EMBED = ("https://maps.google.com/maps?q=103%20E%20Elm%20St%2C%20Lodi%2C%20CA%2095240"
              "&t=&z=15&ie=UTF8&iwloc=&output=embed")
YELP_URL = "https://www.yelp.com/biz/phils-auto-and-fleet-repair-lodi"

# Profiles that already carry reviews and citations. Listing them as sameAs
# tells search engines these are all one business, which consolidates the
# authority currently split across them (and across two domains).
PROFILES = [
    MAPS_LISTING,
    YELP_URL,
    "https://nextdoor.com/pages/phils-auto-fleet-repair-lodi-ca/",
    "https://www.mapquest.com/us/california/phils-auto-and-fleet-repair-355906651",
    "https://www.carfax.com/Phils-Auto-and-Fleet-Repair-Lodi-CA_bs101148341",
]  # TODO: paste the exact URLs from each dashboard; these are the expected forms

FULL_ADDRESS = "{street}, {city}, {region} {zip}".format(**SITE)

# Where quote requests go. This uses FormSubmit, which needs no account: the
# first time the form is used, FormSubmit emails SITE["email"] a one-time
# confirmation link. Click it once and every submission after that arrives in
# the inbox directly.
#
# To move to another provider later (Formspree, Basin, Netlify Forms, your own
# handler), replace this with their endpoint — the markup does not change.
FORM_ENDPOINT = "https://formsubmit.co/ajax/%s" % SITE["email"]

# --------------------------------------------------------------------------
# Inline SVG icons (no icon font, no network request)
# --------------------------------------------------------------------------
ICONS = {
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.8a2 2 0 0 1 1.7 2z"/>',
    "pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5 11 15l4.5-5"/>',
    "wrench": '<path d="M14.6 6.3a1 1 0 0 0 0 1.4l1.7 1.7a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    "gauge": '<path d="M12 21a9 9 0 1 1 9-9"/><path d="m12 12 5-3"/><circle cx="12" cy="12" r="1.5"/>',
    "truck": '<path d="M1 6h12v10H1z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "disc": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    "drop": '<path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3z"/>',
    "tire": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    "engine": '<path d="M8.5 3h7v5.5l-1.5 2.2V15h-4v-4.3L8.5 8.5z"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M8.5 6h7"/>',
    "gears": '<circle cx="10" cy="10" r="4"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4"/><circle cx="17.5" cy="17.5" r="3"/>',
    "shield": '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.6C7.4 20.3 4 17 4 12V6z"/><path d="M9 12l2 2 4-4"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    "chat": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5A8 8 0 1 1 21 12z"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "dollar": '<path d="M12 2v20"/><path d="M17 6.5c0-2-2.2-3-5-3s-5 1-5 3.2S9 10 12 10.5s5 1.3 5 3.4-2.2 3.4-5 3.4-5-1.2-5-3.1"/>',
    "map": '<path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5z"/><path d="M9 4v14M15 6.5v14"/>',
    "snow": '<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/><path d="M9.5 4.8 12 6.6l2.5-1.8M9.5 19.2 12 17.4l2.5 1.8"/>',
    "spring": '<path d="M7.5 4h9l-9 4h9l-9 4h9l-9 4h9"/><path d="M6 20h12"/>',
    "camera": '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
}


def icon(name, cls="icon"):
    return ('<svg class="%s" viewBox="0 0 24 24" aria-hidden="true" focusable="false">%s</svg>'
            % (cls, ICONS[name]))


def esc(text):
    return html.escape(text, quote=True)


def seo_title(base):
    """Append the longest brand suffix that keeps the title inside the ~60
    characters Google renders before truncating."""
    for suffix in (" | Phil's Auto & Fleet Repair", " | Phil's Auto & Fleet", " | Phil's Auto"):
        if len(base) + len(suffix) <= 60:
            return base + suffix
    return base


def stars(n=5):
    return '<span class="stars" aria-hidden="true">%s</span>' % ("★" * n)


# --------------------------------------------------------------------------
# Claims that must be confirmed with the shop before launch are marked TODO.
# Keep them accurate — false claims cost trust and can cost the listing.
# --------------------------------------------------------------------------
SITE["warranty_text"] = ("We stand behind the work we do. Ask your service advisor for the "
                         "warranty terms that apply to your repair before we start.")  # TODO: confirm exact warranty
SITE["promise"] = ("You get the diagnosis, the price and the reasoning up front — "
                   "then you decide what gets fixed.")

# --------------------------------------------------------------------------
# Services. Each entry becomes an indexed landing page at
# /services/<slug>/ with its own title, meta description, Service schema
# and FAQ schema.
# --------------------------------------------------------------------------
SERVICES = [
    {
        "slug": "auto-repair",
        "nav": "Auto Repair",
        "icon": "wrench",
        "title": "Auto Repair Shop in Lodi, CA",
        "h1": "Auto Repair in Lodi, CA",
        "meta": ("Full-service auto repair in Lodi, CA for domestic and import vehicles. "
                 "Honest diagnostics, clear pricing, no upsells. Call (209) 647-4953."),
        "blurb": "Domestic, import and fleet vehicles — diagnosed properly and repaired right the first time.",
        "intro": [
            "When something goes wrong with your car, the hard part usually isn't the repair — it's "
            "finding a shop that tells you the truth about what's actually wrong. At Phil's Auto and "
            "Fleet Repair, we diagnose the vehicle first, explain what we found in plain language, "
            "and give you a price before any work starts.",
            "We service domestic and import cars, trucks, SUVs and vans, plus diesel and commercial "
            "fleet vehicles. Drivers all over Lodi come to us as a value-driven alternative to "
            "dealership service departments — same quality of work, without the dealership counter."
        ],
        "includes": [
            "Computerized diagnostics and drivability troubleshooting",
            "Engine repair, timing components and cooling systems",
            "Transmission service and repair",
            "Brake systems — pads, rotors, calipers, hydraulics and ABS faults",
            "Suspension, steering, alignment-related wear and front-end work",
            "Electrical faults, batteries, alternators and starters",
            "Heating and air conditioning service",
            "Scheduled maintenance that keeps your factory intervals on track",
        ],
        "signs": [
            "A warning light you've been driving with for weeks",
            "A noise, vibration or smell that started recently and hasn't gone away",
            "A dealership quote that feels far higher than the problem sounds",
            "Another shop replaced a part and the symptom is still there",
            "The car is due for major-mileage service and you want an honest scope",
        ],
        "faqs": [
            ("Do you work on both domestic and import vehicles?",
             "Yes. We repair domestic and international makes — cars, trucks, SUVs and vans — as well "
             "as diesel and commercial fleet vehicles. If you're unsure whether we cover your vehicle, "
             "call us at (209) 647-4953 and just ask."),
            ("Will you tell me the price before you start?",
             "Always. We diagnose first, then walk you through what we found, what it costs and what "
             "can safely wait. Nothing gets repaired until you approve it."),
            ("Do I need an appointment?",
             "Appointments help us get you in and out faster, but call us — we'll tell you honestly "
             "how the schedule looks that day."),
        ],
    },
    {
        "slug": "car-diagnostics",
        "nav": "Check Engine & Diagnostics",
        "icon": "gauge",
        "title": "Check Engine Light & Car Diagnostics, Lodi CA",
        "h1": "Car Diagnostics in Lodi — Find the Real Problem",
        "meta": ("Check engine light on? Expert car diagnostics in Lodi, CA. We find the actual "
                 "cause instead of guessing at parts. Call (209) 647-4953."),
        "blurb": "Strange noise, odd smell, dash light on? We diagnose the cause instead of guessing at parts.",
        "intro": [
            "A trouble code tells you which circuit reported a problem. It does not tell you which "
            "part failed. That difference is why drivers end up paying for a sensor, a coil and a "
            "catalytic converter for one fault that turned out to be a vacuum leak.",
            "Our diagnostic process starts with the code, then verifies it with live data, testing "
            "and inspection until we can point at the actual failure. Customers regularly bring us "
            "vehicles that were misdiagnosed elsewhere — that's the work we're known for."
        ],
        "includes": [
            "Full OBD-II code scan with freeze-frame and live data review",
            "Drivability diagnosis — misfires, hesitation, stalling, rough idle",
            "Electrical and parasitic draw testing",
            "Emissions-related fault diagnosis and smog-failure follow-up",
            "Noise, vibration and harshness (NVH) road-test diagnosis",
            "Second opinions on another shop's diagnosis or a dealer estimate",
            "A written explanation of what failed and why it failed",
        ],
        "signs": [
            "Check engine light — steady or flashing",
            "The car cranks longer than it used to, or stalls at idle",
            "Hesitation, surging or a loss of power under acceleration",
            "Fuel economy dropped noticeably with no change in your driving",
            "A burning, sweet or fuel smell you can't place",
            "A parts-store code read gave you a code but no answer",
        ],
        "faqs": [
            ("A parts store read my code for free. Why pay for a diagnosis?",
             "A free code read gives you a number. A diagnosis tells you which component actually "
             "failed and why — so you replace one correct part instead of three likely ones."),
            ("Can I keep driving with the check engine light on?",
             "A flashing light means stop driving and call us: raw fuel can destroy a catalytic "
             "converter in minutes. A steady light usually means drive gently and get it looked at "
             "soon — small faults get expensive when they're ignored."),
            ("Another shop already replaced parts and it's not fixed. Can you help?",
             "Yes, and that's a common reason people call us. We start over from the symptom and "
             "test our way to the cause instead of trusting the previous assumption."),
        ],
    },
    {
        "slug": "brake-repair",
        "nav": "Brakes",
        "icon": "disc",
        "title": "Brake Repair & Service in Lodi, CA",
        "h1": "Brake Repair in Lodi, CA",
        "meta": ("Brake pads, rotors, calipers and ABS diagnosis in Lodi, CA. Free honest "
                 "assessment of what actually needs replacing. Call (209) 647-4953."),
        "blurb": "Pads, rotors, calipers, hydraulics and ABS faults — inspected honestly, priced clearly.",
        "intro": [
            "Brakes are the one system where a wrong call has immediate consequences, so we measure "
            "instead of guessing. We check pad thickness, rotor condition and thickness variation, "
            "hydraulic components and brake fluid, and we tell you what we measured.",
            "If your pads have life left, we'll tell you that too. Being told your brakes are fine "
            "is a perfectly good outcome of a brake inspection, and it's the reason people come back "
            "to us when they aren't."
        ],
        "includes": [
            "Brake pad and rotor replacement — front, rear or all four corners",
            "Rotor measurement, resurfacing or replacement as required",
            "Caliper, wheel cylinder and brake hose service",
            "Master cylinder and hydraulic diagnosis",
            "Brake fluid exchange and moisture testing",
            "ABS warning light diagnosis and wheel-speed sensor testing",
            "Parking brake adjustment and repair",
            "Fleet and light-truck brake service",
        ],
        "signs": [
            "Squealing, grinding or a metallic scraping when you stop",
            "The pedal pulses or the steering wheel shakes while braking",
            "The pedal feels soft, spongy or sinks toward the floor",
            "The vehicle pulls to one side when you brake",
            "Brake or ABS warning light on the dash",
            "It simply takes longer to stop than it used to",
        ],
        "faqs": [
            ("How often do brakes need replacing?",
             "It depends far more on how and where you drive than on mileage. Stop-and-go city miles "
             "wear pads much faster than highway miles. We measure yours and tell you how much life "
             "is left in millimeters, not guesses."),
            ("Do I have to replace rotors with pads?",
             "Not always. If your rotors are above minimum thickness and within runout spec, they can "
             "often stay. We measure them and show you the numbers."),
            ("Can you do brakes on my work truck or fleet vehicle?",
             "Yes — light and medium-duty fleet brake service is a core part of what we do, and we "
             "schedule it around your downtime."),
        ],
    },
    {
        "slug": "engine-repair",
        "nav": "Engine Repair",
        "icon": "engine",
        "title": "Engine Repair in Lodi, CA",
        "h1": "Engine Repair in Lodi, CA",
        "meta": ("Engine repair in Lodi, CA — misfires, leaks, overheating, timing and major "
                 "engine work with an honest diagnosis first. Call (209) 647-4953."),
        "blurb": "From misfires and oil leaks to timing components and major engine work.",
        "intro": [
            "Engine problems get expensive when they're diagnosed by assumption. Before we quote "
            "engine work, we establish what's actually failing — compression, ignition, fuel, "
            "cooling or mechanical — and we tell you what the repair is worth relative to the vehicle.",
            "Sometimes the right answer is a repair. Sometimes it's telling you honestly that the "
            "money is better spent elsewhere. You'll get that conversation either way."
        ],
        "includes": [
            "Misfire, rough-idle and low-power diagnosis",
            "Compression and cylinder leak-down testing",
            "Timing belt and timing chain service",
            "Head gasket and cooling-system repair",
            "Oil leak diagnosis and gasket or seal replacement",
            "Overheating diagnosis — water pumps, thermostats, radiators, fans",
            "Belts, hoses, tensioners and pulleys",
            "Engine replacement when it's the right economic call",
        ],
        "signs": [
            "Ticking, knocking or tapping that changes with engine speed",
            "Temperature gauge climbing, or coolant disappearing",
            "Blue, white or black smoke from the exhaust",
            "Oil spots on the driveway or a burning-oil smell",
            "The engine shakes at idle or the light is flashing",
            "Power loss on hills or when the vehicle is loaded",
        ],
        "faqs": [
            ("Is it worth repairing the engine or should I replace the car?",
             "That depends on the failure, the rest of the vehicle's condition and what you'd pay to "
             "replace it. We'll give you the real numbers and an honest opinion — including when the "
             "answer is 'don't spend it on this one.'"),
            ("My car is overheating. Can I drive it in?",
             "Please don't. Overheating turns a hose or thermostat repair into a head gasket or a new "
             "engine in a matter of minutes. Shut it off and call us at (209) 647-4953."),
            ("Do you do timing belts?",
             "Yes, timing belts and chains, including the water pump and tensioners that should be "
             "done at the same time so you aren't paying that labor twice."),
        ],
    },
    {
        "slug": "transmission-repair",
        "nav": "Transmission",
        "icon": "gears",
        "title": "Transmission Repair & Service, Lodi CA",
        "h1": "Transmission Repair in Lodi, CA",
        "meta": ("Transmission service, diagnosis and repair in Lodi, CA for automatic and "
                 "manual vehicles. Straight answers, fair pricing. Call (209) 647-4953."),
        "blurb": "Automatic and manual transmission diagnosis, service and repair.",
        "intro": [
            "Not every shifting complaint is a transmission rebuild. Low fluid, a failing solenoid, "
            "a bad sensor, a worn mount or an engine misfire can all feel like a transmission "
            "problem from the driver's seat.",
            "We diagnose before we quote, because the difference between a solenoid and a rebuild is "
            "thousands of dollars, and you deserve to know which one you're actually facing."
        ],
        "includes": [
            "Transmission diagnosis with scan-tool and road-test verification",
            "Fluid and filter service to manufacturer specification",
            "Solenoid, sensor and valve-body related repairs",
            "Clutch service for manual transmissions",
            "Axle, CV joint and driveline repair",
            "Transmission cooler and leak repair",
            "Fleet truck and van driveline service",
        ],
        "signs": [
            "Slipping — the engine revs but the vehicle doesn't accelerate",
            "Hard, delayed or clunking shifts",
            "The vehicle hesitates before engaging drive or reverse",
            "Red or brown fluid on the ground under the middle of the car",
            "A whine or hum that changes with road speed",
            "Check engine light with a transmission-related code",
        ],
        "faqs": [
            ("How often should transmission fluid be changed?",
             "It varies widely by vehicle and how you use it — towing and heavy loads shorten the "
             "interval. Tell us your vehicle and how you drive and we'll give you the correct "
             "interval for it, not a generic one."),
            ("Do I need a whole new transmission?",
             "Often, no. We diagnose the specific failure first. Plenty of 'transmission problems' "
             "turn out to be a sensor, a solenoid, fluid condition or even an engine misfire."),
            ("Can you service my work van's transmission?",
             "Yes. Fleet vans and light trucks are everyday work here, and we schedule around your "
             "operating hours where we can."),
        ],
    },
    {
        "slug": "diesel-repair",
        "nav": "Diesel Repair",
        "icon": "truck",
        "title": "Diesel Repair in Lodi, CA — Trucks & Equipment",
        "h1": "Diesel Repair in Lodi, CA",
        "meta": ("Diesel truck repair and service in Lodi, CA. Engine, fuel system, emissions "
                 "and drivability diagnosis for work trucks. Call (209) 647-4953."),
        "blurb": "Diesel trucks and equipment — engine, fuel system, emissions and drivability work.",
        "intro": [
            "Diesel work is its own discipline. Fuel systems run at pressures gas engines never see, "
            "emissions systems fail in patterns that look like engine problems, and a truck that's "
            "down is usually costing somebody money every hour it sits.",
            "We service diesel pickups, work trucks and fleet vehicles in Lodi — diagnosing the "
            "actual failure and getting the truck back to work without a list of parts you didn't need."
        ],
        "includes": [
            "Diesel engine diagnosis and drivability troubleshooting",
            "Fuel system service — injectors, lift pumps, filters and fuel contamination",
            "Hard-start, no-start and glow plug system diagnosis",
            "Turbocharger and boost-leak diagnosis",
            "Emissions system faults — DPF, EGR and related warning lights",
            "Cooling system, belts and hoses for heavy-duty use",
            "Preventive maintenance intervals for work trucks",
            "Brakes, suspension and driveline for loaded vehicles",
        ],
        "signs": [
            "Hard starting, long crank or white smoke on startup",
            "Loss of power under load or while towing",
            "Excessive black smoke or a sharp rise in fuel use",
            "Check engine, DPF or exhaust-system warning lights",
            "A knock, rattle or new vibration at idle",
            "Derate or limp mode on a work truck",
        ],
        "faqs": [
            ("What diesel vehicles do you work on?",
             "Diesel pickups, work trucks and fleet vehicles. Call us at (209) 647-4953 with your "
             "year, make and engine and we'll tell you straight away whether it's in our wheelhouse."),
            ("My truck is in a derate. Can you get to it quickly?",
             "Tell us when you call — a truck that can't work gets prioritized differently than a "
             "maintenance appointment, and we'll be honest about the soonest we can look at it."),
            ("Do you handle emissions-related diesel faults?",
             "Yes. We diagnose DPF, EGR and related emissions faults and repair them to keep the "
             "truck legal and running the way it should."),
        ],
    },
    {
        "slug": "fleet-services",
        "nav": "Fleet Services",
        "icon": "truck",
        "title": "Fleet Maintenance & Repair in Lodi, CA",
        "h1": "Fleet Maintenance and Repair in Lodi, CA",
        "meta": ("Fleet maintenance and repair in Lodi, CA. Scheduled PM, DOT-ready service and "
                 "fast turnaround for vans and work trucks. Call (209) 647-4953."),
        "blurb": "Scheduled maintenance and repair built around uptime for vans, trucks and work vehicles.",
        "intro": [
            "A fleet vehicle sitting in a service bay isn't a repair bill — it's a route that didn't "
            "run. We build fleet work around that reality: scheduled preventive maintenance so "
            "failures happen on your calendar instead of on a job site, and realistic turnaround "
            "times when something does break.",
            "Whether you run two vans or twenty mixed gas and diesel units, we can maintain them on "
            "a schedule, keep records per vehicle and give one point of contact who knows your fleet."
        ],
        "includes": [
            "Scheduled preventive maintenance (PM) programs by mileage or hours",
            "Fleet oil changes, filters and fluid services",
            "Brake, tire, suspension and steering service for loaded vehicles",
            "Diesel and gas engine diagnosis and repair",
            "Pre-trip and safety inspection support",
            "Electrical, charging and battery service across the fleet",
            "Per-vehicle service history so you can plan replacement",
            "One point of contact and consolidated scheduling",
        ],
        "signs": [
            "Unplanned breakdowns are disrupting routes",
            "You have no consistent service records per vehicle",
            "Different vehicles are serviced at different shops with different standards",
            "Dealer service intervals are costing more than they're returning",
            "You need someone who will call before doing extra work, not after",
        ],
        "faqs": [
            ("How small can a fleet be?",
             "Two vehicles is a fleet if they're how you earn a living. We work with owner-operators "
             "and small business fleets as well as larger operations."),
            ("Can you keep our vehicles on a maintenance schedule?",
             "Yes. We'll set intervals by mileage or hours for each unit and keep service history so "
             "you can budget and plan replacements instead of reacting."),
            ("Can you work around our operating hours?",
             "We'll do what the schedule allows — tell us when your vehicles are idle and we'll build "
             "around it where we can. Call (209) 647-4953 to talk through your fleet."),
        ],
    },
    {
        "slug": "oil-change-maintenance",
        "nav": "Oil Change & Maintenance",
        "icon": "drop",
        "title": "Oil Change & Car Maintenance in Lodi, CA",
        "h1": "Oil Changes and Scheduled Maintenance in Lodi",
        "meta": ("Oil changes and factory-scheduled maintenance in Lodi, CA. Conventional, "
                 "blend and full synthetic — no upsell games. Call (209) 647-4953."),
        "blurb": "Oil, filters, fluids and factory-scheduled service — with a real inspection, not a sales pitch.",
        "intro": [
            "An oil change is the cheapest chance anybody gets to catch an expensive problem early. "
            "We use it that way: the oil and filter get done properly, and the vehicle gets looked "
            "over while it's on the lift.",
            "If we find something, we'll show you and tell you whether it's urgent, worth watching or "
            "fine for now. What we won't do is hand you a color-coded list of services you don't need."
        ],
        "includes": [
            "Conventional, synthetic blend and full synthetic oil changes",
            "Oil filter, cabin and engine air filter replacement",
            "Fluid level and condition checks — coolant, brake, transmission, power steering",
            "Tire pressure and tread depth check",
            "Battery and charging system check",
            "Belt, hose and visible leak inspection",
            "Brake inspection while the wheels are accessible",
            "Factory-scheduled maintenance at 30k / 60k / 90k intervals",
        ],
        "signs": [
            "Oil life monitor or maintenance-required light is on",
            "You're past the interval on the sticker and unsure what's due",
            "You just bought a used car and want a baseline service",
            "You tow, haul or drive dusty roads and need a shorter interval",
            "You want one shop keeping records instead of five quick-lube receipts",
        ],
        "faqs": [
            ("How often should I change my oil?",
             "Follow your manufacturer's interval and adjust for how you actually drive — towing, "
             "short trips, heat and dust all shorten it. Tell us your vehicle and driving and we'll "
             "give you a straight answer for your car."),
            ("Do you use synthetic oil?",
             "Yes — conventional, blend and full synthetic. We'll use what your engine calls for and "
             "explain the difference if you're deciding."),
            ("Will you try to sell me extra services?",
             "No. We tell you what we found and what's urgent. What gets done is your call."),
        ],
    },
    {
        "slug": "tire-repair",
        "nav": "Tires",
        "icon": "tire",
        "title": "Tire Repair, Rotation & Service in Lodi, CA",
        "h1": "Tire Repair and Service in Lodi, CA",
        "meta": ("Tire repair, rotation, balancing and TPMS service in Lodi, CA. Safe, honest, "
                 "affordable tire care for cars and work trucks. Call (209) 647-4953."),
        "blurb": "Flat repair, rotation, balancing and TPMS — for daily drivers and work trucks.",
        "intro": [
            "Tires are the only part of your car that touches the road, and they're the part most "
            "often ignored until something goes wrong. We'll tell you honestly whether a tire can be "
            "safely repaired or whether it needs replacing — the answer depends on where the damage is.",
            "We also handle the things that make tires last: correct pressures, rotation on schedule, "
            "balancing, and catching the suspension or alignment problems that chew tires up early."
        ],
        "includes": [
            "Flat repair and puncture assessment",
            "Tire rotation and balancing",
            "TPMS (tire pressure sensor) diagnosis and service",
            "Tread depth and wear-pattern inspection",
            "Wear diagnosis — identifying the alignment or suspension cause",
            "Light truck and fleet tire service",
            "Valve stems, pressure setting and load-appropriate inflation",
        ],
        "signs": [
            "A tire that keeps going low or a TPMS light that won't stay off",
            "Vibration in the steering wheel or seat at highway speed",
            "Uneven wear — one edge, the center, or scalloped patches",
            "A nail, screw or visible damage in the tread",
            "The vehicle pulls to one side on a flat road",
            "Tread that's low, cracked or older than you can remember",
        ],
        "faqs": [
            ("Can my tire be repaired instead of replaced?",
             "It depends on where the damage is. Punctures in the tread area can usually be repaired "
             "properly; sidewall or shoulder damage cannot be repaired safely, no matter who tells "
             "you otherwise. We'll show you which one you have."),
            ("How often should tires be rotated?",
             "Most vehicles do well rotated at every oil change. We check wear patterns each time so "
             "the rotation is actually solving something."),
            ("Why does my tire keep losing air?",
             "Common causes are a slow puncture, a corroded wheel bead, a leaking valve stem or a "
             "failing TPMS sensor. We test rather than guess."),
        ],
    },
    {
        "slug": "electrical-repair",
        "nav": "Electrical & Batteries",
        "icon": "bolt",
        "title": "Auto Electrical Repair & Batteries, Lodi CA",
        "h1": "Auto Electrical Repair in Lodi, CA",
        "meta": ("Auto electrical diagnosis in Lodi, CA — batteries, alternators, starters, "
                 "no-start and parasitic draw testing. Call (209) 647-4953."),
        "blurb": "No-starts, dead batteries, alternators, starters and electrical gremlins traced properly.",
        "intro": [
            "Electrical faults are where guesswork gets expensive fastest. A no-start can be a "
            "battery, a cable, a starter, a relay, a security system or a ground — and they all look "
            "identical from the driver's seat.",
            "We test the circuit instead of replacing parts in order of price. That's how you end up "
            "paying for the one component that actually failed."
        ],
        "includes": [
            "Battery, starter and alternator testing and replacement",
            "No-start and intermittent-start diagnosis",
            "Parasitic draw testing for batteries that die overnight",
            "Charging system and voltage drop testing",
            "Wiring, connector, ground and fuse repair",
            "Lighting, power window, door lock and accessory faults",
            "Fleet vehicle electrical and upfit-related troubleshooting",
        ],
        "signs": [
            "The car is dead in the morning but fine after a jump",
            "Clicking when you turn the key, or a slow lazy crank",
            "Battery or charging warning light on the dash",
            "Headlights dim at idle and brighten when you rev",
            "Power windows, locks or accessories working intermittently",
            "You've replaced the battery already and it happened again",
        ],
        "faqs": [
            ("My battery is new and the car died again. What now?",
             "That usually points at the charging system or a parasitic draw — something staying "
             "awake after you lock the car. Both are testable, and we test them."),
            ("How do I know if it's the battery or the alternator?",
             "Both can leave you stranded and the symptoms overlap. A proper test of the battery, "
             "starter draw and charging output tells you in minutes which one it is."),
            ("Can you fix wiring problems on an upfitted work truck?",
             "Yes. Aftermarket upfits, lights and accessories are a common source of electrical "
             "faults, and we trace them the same way we would factory wiring."),
        ],
    },
    {
        'slug': 'ac-heating-repair',
        'nav': 'AC & Heating',
        'icon': 'snow',
        'title': 'Car AC Repair & Heating in Lodi, CA',
        'h1': 'Car AC and Heating Repair in Lodi, CA',
        'meta': 'Auto AC repair and heater service in Lodi, CA. We find the leak instead of just recharging it and sending you back out. Call (209) 647-4953.',
        'blurb': 'Air conditioning and heater diagnosis, leak detection and repair — before the valley heat hits.',
        'intro': [
            "In a Lodi summer, air conditioning isn't a luxury. And an AC system that's low on refrigerant is low for a reason — refrigerant doesn't get used up, it leaks out. A recharge without finding the leak is a repair with an expiration date.",
            "We test the system, find where it's losing charge, and tell you what the actual repair costs. Same approach in winter when the heat stops working — a heater problem is usually a cooling-system problem wearing a disguise.",
        ],
        'includes': [
            'AC performance testing and system diagnosis',
            'Refrigerant leak detection and repair',
            'Compressor, condenser and evaporator service',
            'Evacuate and recharge to manufacturer specification',
            'Blower motor, blend door and control faults',
            'Heater core and heating-system diagnosis',
            'Cabin air filter replacement',
            "Fleet vehicle AC service so drivers aren't sitting in the heat",
        ],
        'signs': [
            'Air blows cool but never cold, especially at idle',
            'AC works for a few weeks after a recharge, then fades again',
            'A musty or sour smell from the vents',
            'Loud clicking or squealing when the AC switches on',
            'The heater blows cold, or only warms up on the highway',
            "Windows fog and won't clear",
        ],
        'faqs': [
            ("Can't you just top up the refrigerant?",
             "We can, but if the system is low it's leaking, and you'll be back. We'd rather find the leak and tell you what it costs to fix properly."),
            ('How much does AC repair cost?',
             'It ranges from an inexpensive seal or hose to a compressor replacement. The diagnosis tells us which, and you get the number before we start.'),
            ("My heater isn't working. Is that the same system?",
             'Related. Heat comes from engine coolant, so a heater complaint often points at a thermostat, coolant level or heater core issue — all things we test for.'),
        ],
    },
    {
        'slug': 'suspension-steering',
        'nav': 'Suspension & Steering',
        'icon': 'spring',
        'title': 'Suspension & Steering Repair, Lodi CA',
        'h1': 'Suspension and Steering Repair in Lodi, CA',
        'meta': 'Shocks, struts, ball joints and steering repair in Lodi, CA. We diagnose the clunk, pull or wandering feel properly. Call (209) 647-4953.',
        'blurb': 'Shocks, struts, ball joints, bushings and steering components — for a car that tracks straight again.',
        'intro': [
            "Worn suspension doesn't usually announce itself. It shows up as a car that wanders on the freeway, a clunk over railroad tracks, or tires that wore out thousands of miles early — and it quietly increases how far you need to stop.",
            "We inspect the whole corner rather than replacing the part that's easiest to reach, then show you what's actually worn and what it's costing you in tires and stopping distance.",
        ],
        'includes': [
            'Shock and strut inspection and replacement',
            'Ball joint, tie rod and control arm service',
            'Bushing, sway bar and link replacement',
            'Steering rack, pump and linkage diagnosis',
            'Wheel bearing and hub service',
            'Alignment-related wear diagnosis',
            'Loaded-vehicle and work-truck suspension work',
        ],
        'signs': [
            'A clunk or rattle over bumps and dips',
            "The vehicle wanders, or you're always correcting the wheel",
            'It pulls to one side on a flat road',
            'The front end dives hard when braking, or the ride feels floaty',
            'Uneven or cupped tire wear',
            'Steering feels loose, heavy or notchy',
        ],
        'faqs': [
            ('Do I need an alignment after suspension work?',
             "Usually yes — replacing steering or suspension components changes the geometry, and skipping alignment will chew up your new tires. We'll tell you when it's needed."),
            ('How do I know if my struts are worn?',
             'Bounce, nose dive under braking, cupped tire wear and a floaty feel at speed are the common signs. A proper inspection confirms it in minutes.'),
            ('Is a clunk urgent?',
             "It depends entirely on which component is loose. Some are noise; some are safety items. Call us and we'll look at it rather than guess over the phone."),
        ],
    },
]

SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}


# --------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------
NAV = [
    ("Services", "/services/"),
    ("Fleet", "/services/fleet-services/"),
    ("Diesel", "/services/diesel-repair/"),
    ("Advice", "/advice/"),
    ("Reviews", "/reviews/"),
    ("Contact", "/contact/"),
]

PAGES = []  # (url_path, priority, changefreq) collected for sitemap.xml


def tel_btn(cls="btn btn-accent", loc="page", label=None):
    label = label or "Call %s" % SITE["phone_display"]
    return ('<a class="%s" href="tel:%s" data-loc="%s">%s<span>%s</span></a>'
            % (cls, SITE["phone_link"], loc, icon("phone"), esc(label)))


def business_schema():
    """AutoRepair LocalBusiness. Note: aggregateRating is deliberately NOT
    self-published here — Google discourages self-serving review markup.
    Ratings are shown on-page with a link to the source instead."""
    hours = ",".join(
        '{"@type":"OpeningHoursSpecification","dayOfWeek":[%s],"opens":"%s","closes":"%s"}'
        % (",".join('"%s"' % d for d in h["days"]), h["opens"], h["closes"])
        for h in SITE["hours_schema"]
    )
    areas = ",".join(
        '{"@type":"City","name":"%s","address":{"@type":"PostalAddress","addressRegion":"CA"}}' % a
        for a in SITE["areas"]
    )
    services = ",".join(
        '{"@type":"Offer","itemOffered":{"@type":"Service","name":"%s","url":"%s/services/%s/"}}'
        % (s["title"].split(" in ")[0].split(" &")[0].replace('"', ""), SITE["base_url"], s["slug"])
        for s in SERVICES
    )
    return (
        '{"@context":"https://schema.org","@type":"AutoRepair",'
        '"@id":"%(base)s/#business",'
        '"name":"%(name)s",'
        '"url":"%(base)s/",'
        '"telephone":"%(phone)s",'
        '"email":"%(email)s",'
        '"image":"%(base)s/assets/img/og-cover.png",'
        '"priceRange":"$$",'
        '"description":"Locally owned auto repair, diesel and fleet maintenance shop in Lodi, '
        'California. Honest diagnostics, clear pricing and dependable turnaround for domestic, '
        'import and commercial vehicles.",'
        '"address":{"@type":"PostalAddress","streetAddress":"%(street)s","addressLocality":"%(city)s",'
        '"addressRegion":"%(region)s","postalCode":"%(zip)s","addressCountry":"US"},'
        '"geo":{"@type":"GeoCoordinates","latitude":%(lat)s,"longitude":%(lng)s},'
        '"sameAs":[%(profiles)s],'
        '"hasMap":"%(map)s",'
        '"openingHoursSpecification":[%(hours)s],'
        '"areaServed":[%(areas)s],'
        '"currenciesAccepted":"USD",'
        '"hasOfferCatalog":{"@type":"OfferCatalog","name":"Auto, diesel and fleet repair services",'
        '"itemListElement":[%(services)s]}}'
        % {"base": SITE["base_url"], "name": SITE["name"], "phone": SITE["phone_link"],
           "email": SITE["email"], "street": SITE["street"], "city": SITE["city"],
           "region": SITE["region"], "zip": SITE["zip"], "lat": SITE["lat"], "lng": SITE["lng"],
           "map": MAPS_LISTING, "hours": hours, "areas": areas, "services": services,
           "profiles": ",".join(jstr(u) for u in PROFILES)}
    )


def breadcrumb_schema(trail):
    items = ",".join(
        '{"@type":"ListItem","position":%d,"name":"%s","item":"%s%s"}' % (i + 1, esc(n), SITE["base_url"], u)
        for i, (n, u) in enumerate(trail)
    )
    return '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[%s]}' % items


def faq_schema(faqs):
    items = ",".join(
        '{"@type":"Question","name":%s,"acceptedAnswer":{"@type":"Answer","text":%s}}'
        % (jstr(q), jstr(a)) for q, a in faqs
    )
    return '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[%s]}' % items


def jstr(text):
    """JSON string literal, safe inside a <script> block."""
    out = text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return '"%s"' % out.replace("</", "<\\/")


def crumbs_html(trail):
    lis = []
    for i, (name, url) in enumerate(trail):
        if i == len(trail) - 1:
            lis.append('<li aria-current="page">%s</li>' % esc(name))
        else:
            lis.append('<li><a href="%s">%s</a></li>' % (url, esc(name)))
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>%s</ol></nav>' % "".join(lis)


def brand(on_dark=False):
    """Logo lockup. Uses SITE["logo"] when the shop supplies one, otherwise the
    placeholder monogram."""
    logo = SITE.get("logo")
    if logo:
        src = (SITE.get("logo_dark_bg") or logo) if on_dark else logo
        # The mark is dark line-art on a transparent ground, so on the dark
        # footer it sits on a light chip unless a reversed version is supplied.
        chip = on_dark and not SITE.get("logo_dark_bg")
        if SITE.get("logo_lockup") == "full":
            return ('<a class="brand" href="/">'
                    '<img class="brand-logo%s" src="%s" alt="%s" height="46">'
                    '</a>' % (" brand-logo--chip" if chip else "", src, esc(SITE["name"])))
        return """<a class="brand" href="/">
      <img class="brand-badge%s" src="%s" alt="" width="46" height="46">
      <span class="brand-text">
        <span class="brand-name">Phil's Auto &amp; Fleet Repair</span>
        <span class="brand-sub">Lodi, California</span>
      </span>
    </a>""" % (" brand-badge--chip" if chip else "", src)
    return """<a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">PA</span>
      <span class="brand-text">
        <span class="brand-name">Phil's Auto &amp; Fleet Repair</span>
        <span class="brand-sub">Lodi, California</span>
      </span>
    </a>"""


ES_NAV = [
    ("Servicios", "#servicios"),
    ("Por qué nosotros", "#por-que"),
    ("El taller", "#taller"),
    ("Cotización", "#cotizacion"),
    ("English", "/"),
]


def header_html(active=None, es=False):
    links = []
    for label, url in (ES_NAV if es else NAV):
        cur = ' aria-current="page"' if active == url else ""
        links.append('<a href="%s"%s>%s</a>' % (url, cur, esc(label)))
    hours_label = "Lunes a sábado, 8:00 AM – 5:00 PM" if es else "Mon–Sat 8:00 AM – 5:00 PM"
    cta_label = "Cotización" if es else "Get a Quote"
    call_label = "Llame al taller" if es else "Call the shop"
    cta_href = "#cotizacion" if es else "/contact/#quote"
    return """<div class="topbar">
  <div class="wrap">
    <span>%(pin)s %(addr)s</span>
    <span class="dot" aria-hidden="true">•</span>
    <span>%(clock)s %(hours_label)s</span>
    <span class="dot" aria-hidden="true">•</span>
    <a href="tel:%(tel)s" data-loc="topbar">%(phone)s</a>
  </div>
</div>
<header class="site-header">
  <div class="wrap header-inner">
    %(brand)s
    <nav class="nav" id="primary-nav" aria-label="Main">%(links)s</nav>
    <div class="header-cta">
      <a class="header-phone" href="tel:%(tel)s" data-loc="header">
        <span>%(call_label)s</span><strong>%(phone)s</strong>
      </a>
      <a class="btn btn-accent btn-sm" href="%(cta_href)s">%(cta_label)s</a>
    </div>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Menu">
      <svg viewBox="0 0 24 24" aria-hidden="true">%(menu)s</svg>
    </button>
  </div>
</header>""" % {"brand": brand(), "pin": icon("pin"), "clock": icon("clock"), "addr": esc(FULL_ADDRESS),
                "tel": SITE["phone_link"], "phone": SITE["phone_display"],
                "links": "".join(links), "menu": ICONS["menu"],
                "hours_label": hours_label, "cta_label": cta_label,
                "call_label": call_label, "cta_href": cta_href}


def footer_html(es=False):
    svc = "".join('<li><a href="/services/%s/">%s</a></li>' % (s["slug"], esc(s["nav"]))
                  for s in SERVICES)
    t = {
        "blurb": ("Taller local de autos, diésel y flotas en Lodi — una alternativa justa a la "
                  "agencia, para quienes quieren la verdad sobre su vehículo."),
        "services": "Servicios", "shop": "El taller", "visit": "Visítenos o llame",
        "call": "Llame al taller", "callbar": ("Llamar", "Cómo llegar", "Cotización"),
        "rights": "Todos los derechos reservados.", "privacy": "Privacidad",
        "tagline": "Taller mecánico en Lodi, CA", "english": "See this page in English",
    } if es else {
        "blurb": ("Locally owned auto, diesel and fleet repair in Lodi — a value-driven alternative to "
                  "the dealership, for drivers and businesses that need the truth about their vehicles."),
        "services": "Services", "shop": "Shop", "visit": "Visit or Call",
        "call": "Call the shop", "callbar": ("Call", "Directions", "Get a Quote"),
        "rights": "All rights reserved.", "privacy": "Privacy",
        "tagline": "Auto repair in Lodi, CA", "english": "",
    }
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        %(brand)s
        <p>%(blurb)s</p>
      </div>
      <div>
        <h4>%(services)s</h4>
        <ul>%(svc)s</ul>
      </div>
      <div>
        <h4>%(shop)s</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/services/">All Services</a></li>
          <li><a href="/about/">About Phil's</a></li>
          <li><a href="/reviews/">Reviews</a></li>
          <li><a href="/service-areas/">Service Areas</a></li>
          <li><a href="/contact/">Contact &amp; Directions</a></li>
          <li><a href="/advice/">Advice &amp; Guides</a></li>
          <li><a href="/es/" hreflang="es" lang="es">Español</a></li>
        </ul>
      </div>
      <div>
        <h4>%(visit)s</h4>
        <ul>
          <li><a href="%(map)s" rel="noopener">%(street)s<br>%(city)s, %(region)s %(zip)s</a></li>
          <li><a href="tel:%(tel)s" data-loc="footer">%(phone)s</a></li>
          <li><a href="mailto:%(email)s">%(email)s</a></li>
          <li>%(hours)s</li>
        </ul>
        <p style="margin-top:16px"><a class="btn btn-accent btn-sm" href="tel:%(tel)s" data-loc="footer-btn">%(picon)s<span>%(call)s</span></a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span data-year>2026</span> %(name)s. %(rights)s</span>
      <span><a href="/privacy/">%(privacy)s</a> · <a href="/sitemap.xml">Sitemap</a> · %(tagline)s</span>
    </div>
  </div>
</footer>
<div class="callbar" aria-label="Quick actions">
  <a class="primary" href="tel:%(tel)s" data-loc="callbar">%(picon)s<span>%(cb1)s</span></a>
  <a href="%(map)s" rel="noopener">%(micon)s<span>%(cb2)s</span></a>
  <a href="%(cta_href)s">%(cicon)s<span>%(cb3)s</span></a>
</div>""" % {"brand": brand(on_dark=True), "svc": svc, "map": MAPS_DIRECTIONS, "street": esc(SITE["street"]),
             "city": SITE["city"], "region": SITE["region"], "zip": SITE["zip"],
             "tel": SITE["phone_link"], "phone": SITE["phone_display"],
             "hours": esc(SITE["hours_human"]), "name": esc(SITE["name"]),
             "email": SITE["email"],
             "picon": icon("phone"), "micon": icon("map"), "cicon": icon("chat"),
             "cb1": t["callbar"][0], "cb2": t["callbar"][1], "cb3": t["callbar"][2],
             "cta_href": "#cotizacion" if es else "/contact/#quote",
             "blurb": t["blurb"], "services": t["services"], "shop": t["shop"],
             "visit": t["visit"], "call": t["call"], "rights": t["rights"],
             "privacy": t["privacy"], "tagline": t["tagline"]}


def render(path, title, description, body, schemas=None, active=None, noindex=False,
           lang="en", alternates=None):
    """Write one page. `path` is a URL path like '/services/brakes/' ('/' = home)."""
    canonical = SITE["base_url"] + path
    schemas = schemas or []
    schema_html = "".join('\n<script type="application/ld+json">%s</script>' % s for s in schemas)
    alt_links = "".join(
        '\n<link rel="alternate" hreflang="%s" href="%s%s">' % (code, SITE["base_url"], url)
        for code, url in (alternates or []))
    doc = """<!DOCTYPE html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
%(robots)s<meta name="theme-color" content="#0a0a1f">
<meta property="og:type" content="website">
<meta property="og:site_name" content="%(name)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(base)s/assets/img/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Phil&#39;s Auto and Fleet Repair - honest auto, diesel and fleet repair in Lodi, California">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="geo.region" content="US-CA">
<meta name="geo.placename" content="Lodi, California">
<meta name="geo.position" content="%(lat)s;%(lng)s">
<meta name="ICBM" content="%(lat)s, %(lng)s">
<link rel="icon" href="%(favicon)s" type="%(favicon_type)s">
<link rel="apple-touch-icon" href="%(favicon)s">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/motion.css">%(walkcss)s%(alts)s%(schema)s
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
%(header)s
<main id="main">
%(body)s
</main>
%(footer)s
<script src="/assets/js/site.js" defer></script>
<script src="/assets/js/motion.js" defer></script>%(walkjs)s
</body>
</html>
""" % {"title": esc(title), "desc": esc(description), "canonical": canonical,
       "robots": '<meta name="robots" content="noindex,follow">\n' if noindex else "",
       "name": esc(SITE["name"]), "base": SITE["base_url"],
       "favicon": SITE.get("favicon") or "/assets/img/favicon.svg",
       "favicon_type": "image/svg+xml" if (SITE.get("favicon") or ".svg").endswith(".svg") else "image/png",
       "lat": SITE["lat"], "lng": SITE["lng"], "schema": schema_html,
       "header": header_html(active, es=(lang == "es")), "body": body,
       "footer": footer_html(es=(lang == "es")),
       "lang": lang, "alts": alt_links,
       "walkcss": ('\n<link rel="stylesheet" href="/assets/css/walkthrough.css">'
                   if WALKTHROUGH else ""),
       "walkjs": ('\n<script src="/assets/js/walkthrough.js" defer></script>'
                  if WALKTHROUGH else "")}

    if RELATIVE:
        depth = 0 if path == "/" else path.strip("/").count("/") + 1
        prefix = "./" if depth == 0 else "../" * depth
        doc = re.sub(r'(href|src)="/(?!/)', r'\1="%s' % prefix, doc)

    rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
    dest = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(doc)
    return dest


# --------------------------------------------------------------------------
# Reusable content blocks
# --------------------------------------------------------------------------
def quote_form(form_id="quote", heading="Get a free quote", sub=None, service_default=None):
    sub = sub or ("Tell us what's going on and we'll get back to you with next steps. "
                  "Need an answer now? Call %s." % SITE["phone_display"])
    opts = ['<option value="">What do you need?</option>']
    for s in SERVICES:
        sel = " selected" if service_default == s["slug"] else ""
        opts.append('<option value="%s"%s>%s</option>' % (esc(s["nav"]), sel, esc(s["nav"])))
    opts.append('<option value="Not sure — please diagnose">Not sure — please diagnose</option>')
    return """<form class="quote-card" id="%(id)s" data-quote-form action="%(action)s" method="post" data-mailto="%(email)s">
  <h2>%(heading)s</h2>
  <p class="sub">%(sub)s</p>
  <div class="field">
    <label for="%(id)s-name">Your name</label>
    <input id="%(id)s-name" name="name" type="text" autocomplete="name" required>
  </div>
  <div class="field">
    <label for="%(id)s-phone">Phone</label>
    <input id="%(id)s-phone" name="phone" type="tel" autocomplete="tel" required>
  </div>
  <div class="field">
    <label for="%(id)s-vehicle">Vehicle (year, make, model)</label>
    <input id="%(id)s-vehicle" name="vehicle" type="text" placeholder="2016 Ram 2500 diesel">
  </div>
  <div class="field">
    <label for="%(id)s-service">Service needed</label>
    <select id="%(id)s-service" name="service">%(opts)s</select>
  </div>
  <div class="field">
    <label for="%(id)s-when">When could you bring it in?</label>
    <select id="%(id)s-when" name="when">
      <option value="">Whenever you have room</option>
      <option>Today if possible — it's not drivable</option>
      <option>This week</option>
      <option>Next week</option>
      <option>Just want an estimate for now</option>
    </select>
  </div>
  <div class="field">
    <label for="%(id)s-message">What's happening with it?</label>
    <textarea id="%(id)s-message" name="message" placeholder="Noises, warning lights, when it started, anything another shop already told you."></textarea>
  </div>
  <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
  <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
  <input type="hidden" name="_subject" value="Quote request from philsautofleet.com">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_captcha" value="false">
  <button class="btn btn-accent" type="submit" style="width:100%%">Request my quote</button>
  <p class="form-status" role="status" aria-live="polite"></p>
  <p class="form-note">No obligation. We'll never sell your information. Prefer to talk it through?
    <a href="tel:%(tel)s" data-loc="form-note">Call %(phone)s</a>.</p>
</form>""" % {"id": form_id, "action": FORM_ENDPOINT, "email": SITE["email"], "heading": esc(heading),
              "sub": esc(sub), "opts": "".join(opts), "tel": SITE["phone_link"],
              "phone": SITE["phone_display"]}


def cta_band(heading="Ready to get a straight answer about your vehicle?",
             text=None, section=True):
    text = text or ("Call the shop and talk to someone who works on cars for a living. "
                    "We're open Monday through Saturday, 8:00 AM to 5:00 PM.")
    inner = """<div class="cta-band">
  <div>
    <h2>%s</h2>
    <p>%s</p>
  </div>
  <div class="btn-row">
    %s
    <a class="btn btn-ghost" href="/contact/#quote">Request a quote</a>
  </div>
</div>""" % (esc(heading), esc(text), tel_btn("btn btn-accent", "cta-band"))
    if not section:
        return inner
    return '<section><div class="wrap">%s</div></section>' % inner


def stat_band(es=False):
    """Overlapping card that lifts the four strongest trust signals out of the
    hero and into the eye-line of someone deciding whether to call."""
    stats = [
        ("star", "%s de 5" % SITE["rating"], "%s reseñas de Google" % SITE["review_count"]),
        ("shield", "Primero el diagnóstico", "Probamos antes de cambiar piezas"),
        ("truck", "Autos · Diésel · Flotas", "Un taller para todo lo que maneja"),
        ("clock", "Abierto seis días", "Lunes a sábado, 8 AM – 5 PM"),
    ] if es else [
        ("star", "%s out of 5" % SITE["rating"], "%s Google reviews" % SITE["review_count"]),
        ("shield", "Diagnosis first", "We test before we replace parts"),
        ("truck", "Auto · Diesel · Fleet", "One shop for every vehicle you run"),
        ("clock", "Open six days", "Mon–Sat, 8:00 AM – 5:00 PM"),
    ]
    cells = "".join(
        '<div class="stat"><span class="stat-ico">%s</span><div><b>%s</b><span>%s</span></div></div>'
        % (icon(ic), t, sub) for ic, t, sub in stats
    )
    return ('<div class="statband"><div class="wrap"><div class="statband-inner">%s</div></div></div>'
            % cells)


def listed_on():
    sources = ["Google", "Yelp", "Nextdoor", "Carfax", "MapQuest"]
    items = "".join('<span class="src">%s</span>' % x for x in sources)
    return ('<div class="listed"><div class="wrap">'
            '<span class="label">Rated &amp; reviewed on</span>%s</div></div>' % items)


def angle_divider(fill="#ffffff"):
    """Slanted transition out of a dark block into the section below."""
    return ('<div class="angle-bottom" aria-hidden="true">'
            '<svg viewBox="0 0 1440 80" preserveAspectRatio="none">'
            '<path d="M0 80 1440 0v80z" fill="%s"/></svg></div>' % fill)


def photo_slot(caption, badge="Inside the shop", src=None, alt=None):
    """Styled image frame. Ships with a hand-drawn SVG so the page looks
    finished on day one — swap the <img> src for a real photo of the shop."""
    src = src or "/assets/img/shop-scene.svg"
    alt = alt or "Illustration of a pickup truck raised on a lift inside a service bay"
    dims = 'width="1284" height="1711"' if src.endswith(".jpg") else 'width="720" height="460"'
    return """<figure class="photo">
  <span class="photo-badge">%s%s</span>
  <img src="%s" %s loading="lazy" alt="%s">
  <figcaption>%s</figcaption>
</figure>""" % (icon("camera"), esc(badge), src, dims, esc(alt), esc(caption))


def faq_block(faqs, heading="Frequently asked questions", intro=None):
    items = "".join(
        '<details><summary>%s</summary><div class="answer"><p>%s</p></div></details>'
        % (esc(q), esc(a)) for q, a in faqs
    )
    intro_html = '<p>%s</p>' % esc(intro) if intro else ""
    return """<section class="bg-alt"><div class="wrap">
  <div class="sec-head"><span class="eyebrow">Questions</span><h2>%s</h2>%s</div>
  <div class="faq">%s</div>
</div></section>""" % (esc(heading), intro_html, items)


def service_cards(slugs=None, limit=None):
    items = [SERVICE_BY_SLUG[s] for s in slugs] if slugs else SERVICES
    if limit:
        items = items[:limit]
    return "".join(
        """<a class="card" href="/services/%s/">
  <span class="card-ico">%s</span>
  <h3>%s</h3>
  <p>%s</p>
  <span class="more">Learn more %s</span>
</a>""" % (s["slug"], icon(s["icon"]), esc(s["nav"]), esc(s["blurb"]), icon("arrow"))
        for s in items
    )


# Verified, attributed customer feedback only. Add new entries here as the
# shop collects real reviews — never invent them.
REVIEWS = [
    {"quote": "I highly recommend Phil's Auto and Fleet Repair. I called on a Saturday morning for "
              "an appointment for an alignment on my BMW X3. They took me in right away, completed "
              "the work in the said time, gave me a report and my suv drives smoothly.",
     "name": "Tracey P.", "source": "Yelp", "url": ""},
    {"quote": "Phil and his shop do the best work! My ford fusion kept having the service advance "
              "track light come on randomly. I was leaving for a trip in 4 days and needed it fixed "
              "desperately. I called Phil and he worked me into his schedule that day and put more "
              "effort in than any other shop I have been to. I was back on the road that same day!",
     "name": "Hannah K.", "source": "Yelp", "url": ""},
    {"quote": "Replies back pretty quick and in a reasonable time. Their prices are fair and not "
              "too overly expensive like going to some dealership that cost you an arm and a leg. "
              "Thank you Phil's Auto and Fleet Repair for your time, quote and services.",
     "name": "Michael D.", "source": "Yelp", "url": ""},
    {"quote": "GREAT SERVICE! Above and beyond expectations!! Completed service on schedule!! "
              "I will be bringing my cars here from now on!",
     "name": "Verified customer", "source": "MapQuest", "url": ""},
]

REVIEW_THEMES = [
    ("gauge", "They find what others missed",
     "The most common thread in public reviews: vehicles that were misdiagnosed elsewhere getting "
     "sorted out here."),
    ("dollar", "No pressure, no upsell",
     "Customers repeatedly describe getting an objective service plan instead of a list of add-ons "
     "they didn't ask for."),
    ("clock", "Work finished when promised",
     "Turnaround that matches what was quoted comes up again and again — the reason fleet customers "
     "stay."),
]


def review_cards():
    cards = []
    for r in REVIEWS:
        cite = ('<cite><strong>%s</strong>via %s</cite>' % (esc(r["name"]), esc(r["source"])))
        cards.append('<div class="review">%s<blockquote>&ldquo;%s&rdquo;</blockquote>%s</div>'
                     % (stars(), esc(r["quote"]), cite))
    return "".join(cards)


def rating_line(light=False):
    cls = "rating-text" if light else "rating-text"
    return ('<div class="rating">%s<span class="%s"><strong>%s out of 5</strong> from %s Google '
            'reviews · Rated on Yelp and Nextdoor too</span></div>'
            % (stars(), cls, SITE["rating"], SITE["review_count"]))


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------
HOME_FAQS = [
    ("Where is Phil's Auto and Fleet Repair located?",
     "We're at 103 E Elm St, Lodi, CA 95240, just off downtown Lodi and minutes from Highway 99. "
     "Call (209) 647-4953 for directions or to check on space in the schedule."),
    ("What are your hours?",
     "We're open Monday through Saturday, 8:00 AM to 5:00 PM, and closed Sunday."),
    ("Do you work on diesel trucks and fleet vehicles?",
     "Yes. Diesel service and fleet maintenance are a core part of the shop — pickups, work trucks, "
     "vans and mixed gas/diesel fleets, alongside everyday cars and SUVs."),
    ("Do you charge for a diagnosis?",
     "Diagnostic time is real work — testing, measuring and verifying instead of swapping parts and "
     "hoping. Call us and we'll tell you exactly what the diagnosis costs before you come in, and "
     "what it covers."),
    ("Will you tell me what can wait?",
     "Yes. We separate what's unsafe from what's worth watching from what's fine. You decide what "
     "gets done — we won't do work you didn't approve."),
    ("Can I get a second opinion on another shop's quote?",
     "Absolutely, and people do it often. Bring the estimate. We'll test the vehicle ourselves and "
     "tell you honestly whether the recommended work is warranted."),
    ("What areas do you serve?",
     "Lodi first, plus Stockton, Galt, Acampo, Woodbridge, Lockeford, Victor, Thornton, Clements and "
     "the surrounding San Joaquin County area."),
]


# Photographs of the shop, in the order someone actually arrives. Each frame
# carries its own caption, so the sequence reads as a walk-in rather than a
# gallery. Supplied by the owner from the business's own Google listing.
WALKTHROUGH_FRAMES = [
    ("/media/aerial.jpg", "01", "103 E Elm St, Lodi",
     "Just east of downtown, minutes off Highway 99. The long building with the "
     "parking out front — that's the shop.",
     "Aerial view of the shop building and its parking lot on E Elm Street"),
    ("/media/signage.jpg", "02", "Pull up to the bay",
     "Roll-up door open most of the day. The sign on the wall has the number on "
     "it if you'd rather call before you come in.",
     "The open bay door with the Phil's Auto and Fleet Repair sign beside it"),
    ("/media/01-front.jpg", "03", "The office door is right there",
     "No appointment desk maze, no service-writer counter between you and the "
     "people working on your vehicle.",
     "The office door at Phil's Auto and Fleet Repair"),
    ("/media/bronco.jpg", "04", "Inside, on any given day",
     "Lifts down both sides, whatever's booked in that morning. Classics get the "
     "same treatment as work trucks.",
     "A restored Ford Bronco parked inside the shop, cars up on lifts behind it"),
    ("/media/03-engine.jpg", "05", "Torn down because the tests said so",
     "Not because a trouble code said maybe. This is what diagnosis before parts "
     "actually looks like.",
     "An engine bay stripped down during a repair"),
    ("/media/04-fleet.jpg", "06", "Work vans and trucks",
     "Fleet maintenance on a schedule, so failures land on your calendar instead "
     "of on a job site.",
     "A cargo van being serviced with parts laid out on the shop floor"),
    ("/media/05-diesel.jpg", "07", "Diesel is everyday work here",
     "Pickups and work trucks — engine, fuel system, emissions and driveline.",
     "A diesel pickup up on the shop floor during driveline work"),
]

ARRIVAL_STEPS = [
    ("01", "103 E Elm St, Lodi",
     "Just east of downtown, a couple of minutes off Highway 99. If you've driven "
     "past the Elm Street tracks, you've driven past us."),
    ("02", "Pull straight in",
     "Park in front, come through the office door. No appointment desk maze, no "
     "service-writer counter between you and the people working on your vehicle."),
    ("03", "Two things happen first",
     "We listen to what the vehicle is doing, and we look at it ourselves. Nothing "
     "gets quoted off a code read alone."),
    ("04", "Then you decide",
     "You get what we found, what it costs, and what can safely wait — before a "
     "wrench touches the vehicle."),
]


def arrival_section():
    """Scroll-driven approach to the shop.

    Three sources, in order of what the shop has supplied:
      1. a walk-in video, scrubbed frame by frame as you scroll
      2. the Street View panorama
      3. an address panel, so the section is never a dead frame
    """
    video = SITE.get("walkthrough_video")
    webm = SITE.get("walkthrough_video_webm")
    poster = SITE.get("walkthrough_poster")
    embed = SITE.get("streetview_embed")
    photos = WALKTHROUGH_FRAMES if SITE.get("use_photo_walkthrough") else []

    if video or webm:
        sources = ""
        if webm:
            sources += '<source src="%s" type="video/webm">' % webm
        if video:
            sources += '<source src="%s" type="video/mp4">' % video
        stage_media = """<video data-scrub class="arrival-video" muted playsinline
        preload="auto" disablepictureinpicture %s
        data-in="%s" data-out="%s" style="object-position:%s"
        aria-label="Walking into %s">%s</video>""" % (
            ('poster="%s"' % poster) if poster else "",
            SITE.get("walkthrough_in", 0) or 0,
            SITE.get("walkthrough_out", 0) or 0,
            SITE.get("walkthrough_focus", "50% 50%"),
            esc(SITE["name"]),
            sources,
        )
    elif photos:
        # Cross-faded stills with a slow push on each — the arrival read without
        # a film crew. The first frame is eager so the section paints instantly.
        stage_media = "".join(
            '<img class="arrival-frame%s" src="%s" alt="%s" %s width="1284" height="1711">'
            % (" is-first" if i == 0 else "", src, esc(alt),
               'fetchpriority="high"' if i == 0 else 'loading="lazy"')
            for i, (src, _no, _t, _b, alt) in enumerate(photos)
        )
    elif embed:
        stage_media = (
            '<iframe src="%s" title="Street View of %s" loading="lazy" '
            'referrerpolicy="no-referrer-when-downgrade" '
            'allow="accelerometer; gyroscope"></iframe>' % (embed, esc(FULL_ADDRESS))
        )
    else:
        stage_media = """<!-- Supply SITE["walkthrough_video"], photographs in
     WALKTHROUGH_FRAMES, or SITE["streetview_embed"] — see the README. -->
      <div class="arrival-fallback">
        <div>
          <span class="addr">%s</span>
          <p class="hint">Two bays on E Elm Street, minutes off Highway 99.</p>
          <p style="margin-top:18px"><a class="btn btn-accent" href="%s" rel="noopener">Get directions</a></p>
        </div>
      </div>""" % (esc(FULL_ADDRESS), MAPS_DIRECTIONS)

    steps = ([(n, t, b) for _s, n, t, b, _a in photos] if photos and not (video or webm)
             else ARRIVAL_STEPS)
    caps = "".join(
        """<figure class="arrival-caption">
      <span class="step-no">%s — Arriving</span>
      <h2>%s</h2>
      <p>%s</p>
    </figure>""" % (no, esc(title), esc(body))
        for no, title, body in steps
    )

    frame_count = len(photos) if (photos and not (video or webm)) else len(ARRIVAL_STEPS)
    return """<section class="arrival" style="--frames:%d" aria-label="Arriving at the shop">
  <div class="arrival-stage">
    %s
    <div class="arrival-hud"><span class="dot"></span>Lodi, California · 103 E Elm St</div>
    %s
    <span class="arrival-scroll">Scroll</span>
  </div>
</section>""" % (frame_count, stage_media, caps)


def build_home():
    body = (arrival_section() if WALKTHROUGH else "") + f"""<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Locally owned · Lodi, California</span>
        <h1>Honest auto, diesel &amp; fleet repair in <em>Lodi, California</em></h1>
        {rating_line()}
        <p>A value-driven alternative to the dealership. We diagnose the problem properly,
        explain it in plain language, and quote it before we touch a wrench — so you never
        pay for parts your vehicle didn't need.</p>
        <div class="btn-row">
          {tel_btn("btn btn-accent", "hero")}
          <a class="btn btn-ghost" href="#quote-form">Get a free quote</a>
        </div>
        <ul class="hero-points">
          <li>{icon("check-circle")}<span>Domestic, import, diesel and commercial fleet vehicles</span></li>
          <li>{icon("check-circle")}<span>Known for fixing what other shops misdiagnosed</span></li>
          <li>{icon("check-circle")}<span>No upsells — you approve every repair before it happens</span></li>
          <li>{icon("check-circle")}<span>Open Monday through Saturday, 8:00 AM – 5:00 PM</span></li>
        </ul>
      </div>
      <div id="quote-form">
        {quote_form("home-quote")}
      </div>
    </div>
  </div>
</section>

{stat_band()}

<section>
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">What we fix</span>
      <h2>Everything from an oil change to a diesel that won't start</h2>
      <p>One shop for your car, your truck and your whole fleet — with the same diagnosis-first
      approach on every one of them.</p>
    </div>
    <div class="grid g3">{service_cards()}</div>
    <p class="center" style="margin-top:30px"><a class="btn btn-outline" href="/services/">See all services {icon("arrow")}</a></p>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="split center-y">
      <div>
        <span class="eyebrow">Why drivers switch to us</span>
        <h2>The dealership isn't your only option</h2>
        <p>Dealership service departments are built around volume and menu pricing. That works fine
        until you have a problem that doesn't fit the menu — and then you're paying for parts that
        were replaced because they were on a list, not because they failed.</p>
        <p>{esc(SITE["promise"])} {esc(SITE["warranty_text"])}</p>
        <ul class="checklist">
          <li>{icon("check")}<span><strong>You talk to the people who saw your vehicle</strong> — not a service writer relaying a summary.</span></li>
          <li>{icon("check")}<span><strong>We test before we replace</strong>, which is why a second opinion here often costs less than the first quote.</span></li>
          <li>{icon("check")}<span><strong>Nothing happens without your approval</strong>, including anything we find mid-repair.</span></li>
        </ul>
        <div class="btn-row" style="margin-top:26px">
          {tel_btn("btn btn-dark", "why-us")}
          <a class="btn btn-outline" href="/about/">More about the shop</a>
        </div>
      </div>
      <div class="table-scroll">
        <table class="compare">
          <caption class="sr-only">Comparison of Phil's Auto and Fleet Repair with typical dealership service</caption>
          <thead>
            <tr><th scope="col">What matters</th><th scope="col">Phil's Auto &amp; Fleet</th><th scope="col">Typical dealership</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Who explains the repair</th><td class="yes">The shop working on it</td><td>A service advisor</td></tr>
            <tr><th scope="row">Approach to unclear faults</th><td class="yes">Diagnose, then quote</td><td>Replace by likelihood</td></tr>
            <tr><th scope="row">Recommended extras</th><td class="yes">Only what we can show you</td><td>Menu-driven upsells</td></tr>
            <tr><th scope="row">Diesel &amp; fleet work</th><td class="yes">Everyday work here</td><td>Often a separate department</td></tr>
            <tr><th scope="row">Second opinions</th><td class="yes">Welcome — bring the estimate</td><td>Rarely offered</td></tr>
            <tr><th scope="row">Saturday service</th><td class="yes">Open 8 AM – 5 PM</td><td>Limited or closed</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">How it works</span>
      <h2>Three steps, no surprises</h2>
      <p>The same process whether it's an oil change or an engine that three shops couldn't sort out.</p>
    </div>
    <div class="steps">
      <div class="step">
        <h3>Tell us what it's doing</h3>
        <p>Call the shop or send the form. Describe the noise, the light or the symptom — including
        anything another shop already told you.</p>
      </div>
      <div class="step">
        <h3>We diagnose it properly</h3>
        <p>We test and verify until we can point at the actual failure, then explain what we found
        and what it costs to fix.</p>
      </div>
      <div class="step">
        <h3>You decide what gets fixed</h3>
        <p>Urgent, worth watching, or fine for now — you get the whole picture and the final call is
        always yours.</p>
      </div>
    </div>
  </div>
</section>

<section class="bg-dark">
  <div class="wrap">
    <div class="split center-y">
      <div>
        <span class="eyebrow">For business</span>
        <h2>Fleet maintenance built around uptime</h2>
        <p>A van in a service bay is a route that didn't run. We keep small and mid-size fleets on a
        preventive maintenance schedule so failures land on your calendar instead of on a job site —
        gas and diesel, per-vehicle records, one point of contact.</p>
        <ul class="checklist">
          <li>{icon("check")}<span>Scheduled PM by mileage or hours</span></li>
          <li>{icon("check")}<span>Diesel and gas units serviced under one roof</span></li>
          <li>{icon("check")}<span>Service history per vehicle so you can plan replacements</span></li>
          <li>{icon("check")}<span>We call before extra work, not after</span></li>
        </ul>
        <div class="btn-row" style="margin-top:28px">
          <a class="btn btn-accent" href="/services/fleet-services/">Fleet services {icon("arrow")}</a>
          <a class="btn btn-ghost" href="tel:{SITE["phone_link"]}" data-loc="fleet">Talk to us about your fleet</a>
        </div>
      </div>
      <div>
        {photo_slot("Work trucks, vans and mixed fleets — serviced on a schedule that fits your routes.",
                    "In the bay", "/media/04-fleet.jpg",
                    "A cargo van being serviced with parts laid out on the shop floor")}
      </div>
    </div>
  </div>
</section>

{listed_on()}

<section>
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">Reputation</span>
      <h2>Rated {SITE["rating"]} out of 5 across {SITE["review_count"]} Google reviews</h2>
      <p>Customers in Lodi consistently mention the same three things — and none of them are
      about price alone.</p>
    </div>
    <div class="grid g4">{review_cards()}</div>
    <div class="review-links">
      <a class="btn btn-outline" href="{MAPS_LISTING}" rel="noopener">Read Google reviews</a>
      <a class="btn btn-outline" href="{YELP_URL}" rel="noopener">Read Yelp reviews</a>
      <a class="btn btn-outline" href="/reviews/">Why customers stay {icon("arrow")}</a>
    </div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="split">
      <div>
        <span class="eyebrow">Find us</span>
        <h2>Downtown Lodi, minutes from Highway 99</h2>
        <p>We're at <strong>{esc(FULL_ADDRESS)}</strong>. Drivers come to us from across San Joaquin
        County — Stockton, Galt, Acampo, Woodbridge, Lockeford and Victor included.</p>
        <table class="hours">
          <caption class="sr-only">Business hours</caption>
          <tbody>
            {"".join(f"<tr><th scope='row'>{d}</th><td>{h}</td></tr>" for d, h in SITE["hours_rows"])}
          </tbody>
        </table>
        <div class="btn-row" style="margin-top:26px">
          {tel_btn("btn btn-accent", "map")}
          <a class="btn btn-outline" href="{MAPS_DIRECTIONS}" rel="noopener">Get directions</a>
        </div>
      </div>
      <div>
        <iframe class="map-frame" src="{MAPS_EMBED}" title="Map showing Phil's Auto and Fleet Repair at {esc(FULL_ADDRESS)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <p class="map-note"><a href="{MAPS_LISTING}" rel="noopener">Open {esc(FULL_ADDRESS)} in Google Maps {icon("arrow")}</a></p>
        <p class="map-note"><a href="{MAPS_LISTING}" rel="noopener">Open {esc(FULL_ADDRESS)} in Google Maps {icon("arrow")}</a></p>
      </div>
    </div>
  </div>
</section>

{faq_block(HOME_FAQS)}

{cta_band()}"""

    render("/",
           seo_title("Lodi Auto Repair & Fleet Service"),
           "Honest auto, diesel and fleet repair in Lodi, CA. Rated 4.4 stars by 83 Google "
           "reviewers. Diagnosis before parts, no upsells. Call (209) 647-4953.",
           body,
           schemas=[business_schema(), faq_schema(HOME_FAQS), website_schema()],
           active="/", alternates=[("en", "/"), ("es", "/es/"), ("x-default", "/")])
    PAGES.append(("/", "1.0", "weekly"))


def website_schema():
    return ('{"@context":"https://schema.org","@type":"WebSite","name":%s,"url":"%s/",'
            '"publisher":{"@id":"%s/#business"}}'
            % (jstr(SITE["name"]), SITE["base_url"], SITE["base_url"]))


def service_schema(s):
    return ('{"@context":"https://schema.org","@type":"Service","name":%s,"serviceType":%s,'
            '"description":%s,"url":"%s/services/%s/",'
            '"provider":{"@id":"%s/#business"},'
            '"areaServed":[%s]}'
            % (jstr(s["h1"]), jstr(s["nav"]), jstr(s["meta"]), SITE["base_url"], s["slug"],
               SITE["base_url"],
               ",".join('{"@type":"City","name":"%s"}' % a for a in SITE["areas"])))


def build_service(s):
    path = "/services/%s/" % s["slug"]
    trail = [("Home", "/"), ("Services", "/services/"), (s["nav"], path)]
    related = [x for x in SERVICES if x["slug"] != s["slug"]][:6]
    related_html = "".join('<a class="tag" href="/services/%s/">%s</a>' % (r["slug"], esc(r["nav"]))
                           for r in related)
    intro_html = "".join("<p>%s</p>" % esc(p) for p in s["intro"])
    includes = "".join(f'<li>{icon("check")}<span>{esc(i)}</span></li>' for i in s["includes"])
    signs = "".join(f"<li>{esc(x)}</li>" for x in s["signs"])

    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>{esc(s["h1"])}</h1>
    {rating_line()}
    <p>{esc(s["blurb"])}</p>
    <div class="btn-row">
      {tel_btn("btn btn-accent", "service-head")}
      <a class="btn btn-ghost" href="#quote">Get a quote</a>
    </div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="split">
      <div>
        {intro_html}
        <h2>What this service covers</h2>
        <ul class="checklist">{includes}</ul>
        <h2 style="margin-top:1.8em">Signs it's time to call us</h2>
        <ul>{signs}</ul>
        <p>If any of these sound like your vehicle, call <a href="tel:{SITE["phone_link"]}"
        data-loc="service-body">{SITE["phone_display"]}</a>. We'll tell you what we think it is,
        what it takes to know for sure, and what that costs — before you commit to anything.</p>
        <h2 style="margin-top:1.8em">Serving Lodi and the surrounding area</h2>
        <p>Phil's Auto and Fleet Repair is at {esc(FULL_ADDRESS)}, minutes from downtown Lodi and
        Highway 99. We handle {esc(s["nav"].lower())} for drivers and businesses across
        {esc(", ".join(SITE["areas"][:-1]))} and {esc(SITE["areas"][-1])}.</p>
      </div>
      <div>
        <div id="quote">{quote_form(s["slug"] + "-quote", "Get a quote for " + s["nav"].lower(), service_default=s["slug"])}</div>
        <div class="panel" style="margin-top:22px">
          <h3>Shop details</h3>
          <p style="margin-bottom:.6em"><strong>{esc(SITE["name"])}</strong><br>
          {esc(SITE["street"])}<br>{SITE["city"]}, {SITE["region"]} {SITE["zip"]}</p>
          <p style="margin-bottom:.6em"><a href="tel:{SITE["phone_link"]}" data-loc="service-panel">{SITE["phone_display"]}</a></p>
          <p style="margin-bottom:0">{esc(SITE["hours_human"])}<br>Closed Sunday</p>
        </div>
      </div>
    </div>
  </div>
</section>

{faq_block(s["faqs"], "%s — questions we get asked" % s["nav"])}

<section>
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">Also at our shop</span><h2>Other services</h2></div>
    <div class="tag-row">{related_html}<a class="tag" href="/services/">All services</a></div>
  </div>
</section>

{cta_band("Need %s in Lodi?" % s["nav"].lower(),
          "Call the shop and talk it through with someone who does this work every day.")}"""

    render(path,
           seo_title(s["title"]),
           s["meta"],
           body,
           schemas=[business_schema(), service_schema(s), breadcrumb_schema(trail),
                    faq_schema(s["faqs"])])
    PAGES.append((path, "0.9", "monthly"))


def build_services_index():
    trail = [("Home", "/"), ("Services", "/services/")]
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Auto, diesel and fleet services in Lodi, CA</h1>
    <p>One shop for the whole vehicle — and for every vehicle you run. Every job starts the same
    way: find out what's actually wrong, then quote the repair.</p>
    <div class="btn-row">{tel_btn("btn btn-accent", "services-head")}
    <a class="btn btn-ghost" href="/contact/#quote">Request a quote</a></div>
  </div>
  {angle_divider()}
</div>

{stat_band()}

<section>
  <div class="wrap">
    <div class="grid g3">{service_cards()}</div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap narrow">
    <h2>Don't see what you need?</h2>
    <p>This list covers the work that comes through the shop most often, but it isn't everything we
    do. If your vehicle has a problem that isn't on this page — or you don't know what to call it —
    describe it to us and we'll tell you honestly whether it's work we can take on.</p>
    <p>We service domestic and import cars, trucks, SUVs and vans, diesel pickups and work trucks,
    and mixed commercial fleets.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "services-body")}
    <a class="btn btn-outline" href="/contact/">Contact the shop</a></div>
  </div>
</section>

{cta_band()}"""
    render("/services/",
           seo_title("Auto, Diesel & Fleet Services in Lodi, CA"),
           "Complete list of services at Phil's Auto and Fleet Repair in Lodi, CA — repair, "
           "diagnostics, brakes, diesel, fleet maintenance and more. (209) 647-4953.",
           body,
           schemas=[business_schema(), breadcrumb_schema(trail)],
           active="/services/")
    PAGES.append(("/services/", "0.9", "monthly"))


def build_about():
    trail = [("Home", "/"), ("About", "/about/")]
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>About Phil's Auto and Fleet Repair</h1>
    <p>A locally owned repair shop in Lodi, California, built around one idea: tell people the truth
    about their vehicles.</p>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="split">
      <div>
        <h2>A dealership alternative for Lodi drivers</h2>
        <p>Phil's Auto and Fleet Repair is {esc(SITE["founded_note"])} from a shop at
        {esc(FULL_ADDRESS)}. We work on domestic and import vehicles, diesel trucks and commercial
        fleets — everything from a routine oil change to a drivability fault three other shops
        couldn't pin down.</p>
        <p>What we're known for locally isn't a slogan. Customers on Google, Yelp and neighborhood
        boards keep describing the same experience: a vehicle that was misdiagnosed elsewhere,
        finally diagnosed correctly here, without a list of extra services attached to the bill.</p>
        <h2 style="margin-top:1.6em">How we work</h2>
        <ul class="checklist">
          <li>{icon("check")}<span><strong>Diagnose first.</strong> A trouble code is a starting point, not an answer. We test until we can point at the failure.</span></li>
          <li>{icon("check")}<span><strong>Explain it plainly.</strong> You should understand what failed and why before you spend money on it.</span></li>
          <li>{icon("check")}<span><strong>Quote before we start.</strong> Nothing gets repaired without your approval — including anything we find along the way.</span></li>
          <li>{icon("check")}<span><strong>Separate urgent from optional.</strong> We'll tell you what can safely wait. That's not lost revenue; that's why you come back.</span></li>
          <li>{icon("check")}<span><strong>Respect your time.</strong> Realistic turnaround estimates, and a call if anything changes.</span></li>
        </ul>
      </div>
      <div class="panel panel-accent">
        <h3>The shop at a glance</h3>
        <table class="hours">
          <tbody>
            <tr><th scope="row">Location</th><td>{esc(FULL_ADDRESS)}</td></tr>
            <tr><th scope="row">Phone</th><td><a href="tel:{SITE["phone_link"]}" data-loc="about">{SITE["phone_display"]}</a></td></tr>
            <tr><th scope="row">Hours</th><td>Mon–Sat, 8 AM – 5 PM</td></tr>
            <tr><th scope="row">Rating</th><td>{SITE["rating"]} / 5 ({SITE["review_count"]} Google reviews)</td></tr>
            <tr><th scope="row">Vehicles</th><td>Domestic, import, diesel, fleet</td></tr>
            <tr><th scope="row">Business type</th><td>Locally owned small business</td></tr>
          </tbody>
        </table>
        <p style="margin:22px 0 0">{tel_btn("btn btn-accent", "about-panel")}</p>
        <div style="margin-top:26px">
          {photo_slot("103 E Elm St — the shop where every one of these vehicles gets diagnosed before it gets quoted.",
                      "Our shop", "/media/01-front.jpg",
                      "The office door at Phil's Auto and Fleet Repair on E Elm Street")}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="sec-head center"><span class="eyebrow">Who we serve</span>
      <h2>Daily drivers, work trucks and everything between</h2></div>
    <div class="grid g3">
      <div class="card"><span class="card-ico">{icon("user")}</span><h3>Families and commuters</h3>
        <p>Maintenance, repairs and honest advice on whether a car is worth keeping — for the vehicle
        that gets your family where it's going.</p></div>
      <div class="card"><span class="card-ico">{icon("truck")}</span><h3>Diesel owners</h3>
        <p>Fuel systems, emissions faults, hard starts and power loss on trucks that have to work
        tomorrow morning.</p></div>
      <div class="card"><span class="card-ico">{icon("gears")}</span><h3>Business fleets</h3>
        <p>Preventive maintenance schedules and fast turnaround for vans and trucks where downtime
        costs real money.</p></div>
    </div>
  </div>
</section>

{cta_band("Come see how a straight answer feels.",
          "We're on E Elm St in Lodi, open Monday through Saturday. Call ahead and we'll make room for you.")}"""
    render("/about/",
           seo_title("About Our Lodi Auto Repair Shop"),
           "Phil's Auto and Fleet Repair is a locally owned auto, diesel and fleet repair shop in "
           "Lodi, CA — a value-driven alternative to the dealership. (209) 647-4953.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/about/")
    PAGES.append(("/about/", "0.7", "yearly"))


def build_reviews():
    trail = [("Home", "/"), ("Reviews", "/reviews/")]
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Reviews of Phil's Auto and Fleet Repair</h1>
    <p>Rated {SITE["rating"]} out of 5 across {SITE["review_count"]} Google reviews, with more on
    Yelp and Nextdoor. Here's what customers in Lodi keep saying.</p>
    <div class="btn-row">
      <a class="btn btn-accent" href="{MAPS_LISTING}" rel="noopener">Read reviews on Google</a>
      <a class="btn btn-ghost" href="{YELP_URL}" rel="noopener">Read reviews on Yelp</a>
    </div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">In their own words</span>
      <h2>What customers say</h2>
      <p>A rating is a number. What people actually wrote is more useful.</p></div>
    <div class="grid g4">{review_cards()}</div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap narrow">
    <h2>Why misdiagnosis comes up so often</h2>
    <p>A large share of the reviews mentioning us describe the same story: a vehicle that had already
    been to another shop, sometimes more than one, with parts already replaced and the original
    symptom still there.</p>
    <p>That happens when a shop treats a trouble code as a diagnosis. The code tells you which
    circuit reported a fault — not which component caused it. Replacing the most likely part is
    faster than testing, and when it works, nobody notices. When it doesn't, the customer pays for
    the guess.</p>
    <p>We test instead. It takes longer up front and it's the reason people drive past closer shops
    to get here.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "reviews-body")}
    <a class="btn btn-outline" href="/services/car-diagnostics/">How we diagnose {icon("arrow")}</a></div>
  </div>
</section>

<section>
  <div class="wrap narrow center">
    <h2>Been in recently?</h2>
    <p>Reviews from real customers are how neighbors in Lodi find an honest shop. If we did right by
    you, a few sentences on Google or Yelp genuinely helps — and if we didn't, call the shop first
    and give us the chance to fix it.</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn btn-accent" href="{MAPS_LISTING}" rel="noopener">Leave a Google review</a>
      {tel_btn("btn btn-outline", "reviews-cta", "Call the shop")}
    </div>
  </div>
</section>

{cta_band()}"""
    render("/reviews/",
           seo_title("Auto Repair Reviews, Lodi CA"),
           "See why Phil's Auto and Fleet Repair is rated 4.4 stars by 83 Google reviewers in "
           "Lodi, CA — honest diagnostics, no upsells, work done on schedule.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/reviews/")
    PAGES.append(("/reviews/", "0.7", "monthly"))


def build_contact():
    trail = [("Home", "/"), ("Contact", "/contact/")]
    hours_rows = "".join(f"<tr><th scope='row'>{d}</th><td>{h}</td></tr>" for d, h in SITE["hours_rows"])
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Contact Phil's Auto and Fleet Repair</h1>
    <p>Call the shop, send a quote request, or stop by — we're on E Elm St in Lodi, open six days
    a week.</p>
    <div class="btn-row">
      {tel_btn("btn btn-accent", "contact-head")}
      <a class="btn btn-ghost" href="{MAPS_DIRECTIONS}" rel="noopener">Get directions</a>
    </div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="split">
      <div>
        <h2>Shop information</h2>
        <p><strong>{esc(SITE["name"])}</strong><br>
        {esc(SITE["street"])}<br>{SITE["city"]}, {SITE["region_long"]} {SITE["zip"]}</p>
        <p><strong>Phone:</strong> <a href="tel:{SITE["phone_link"]}" data-loc="contact-body">{SITE["phone_display"]}</a><br>
        <strong>Email:</strong> <a href="mailto:{SITE["email"]}">{SITE["email"]}</a></p>
        <h3>Hours</h3>
        <table class="hours"><caption class="sr-only">Business hours</caption><tbody>{hours_rows}</tbody></table>
        <h3 style="margin-top:1.6em">Getting here</h3>
        <p>We're just east of downtown Lodi on E Elm St, a short drive from Highway 99 and Cherokee
        Lane. If you're coming from Stockton, Galt or Acampo, allow a few extra minutes during
        weekday morning traffic.</p>
        <h3 style="margin-top:1.4em">Before you call, it helps to have</h3>
        <ul>
          <li>Year, make, model and engine (especially for diesel vehicles)</li>
          <li>What the vehicle is doing, and when it started</li>
          <li>Any warning lights that are on</li>
          <li>What another shop has already replaced or told you, if anything</li>
        </ul>
        <div class="btn-row">{tel_btn("btn btn-dark", "contact-mid")}</div>
      </div>
      <div>
        <div id="quote">{quote_form("contact-quote", "Request a quote")}</div>
      </div>
    </div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="sec-head"><h2>Find the shop</h2></div>
    <iframe class="map-frame" src="{MAPS_EMBED}" title="Map showing Phil's Auto and Fleet Repair at {esc(FULL_ADDRESS)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
</section>

{cta_band("Not sure what's wrong? That's fine.",
          "Describe the symptom. We'll tell you what it takes to find out for certain and what that costs.")}"""
    render("/contact/",
           seo_title("Contact & Directions, Lodi CA"),
           "Call (209) 647-4953 or visit Phil's Auto and Fleet Repair at 103 E Elm St, Lodi, CA "
           "95240. Open Monday to Saturday, 8 AM to 5 PM.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/contact/")
    PAGES.append(("/contact/", "0.8", "yearly"))


AREA_NOTES = {
    "Lodi": "Our home city — downtown, the east side, Kettleman Lane and everywhere between.",
    "Stockton": "A short run down Highway 99 for drivers who want a shop that isn't a chain.",
    "Galt": "North of us on 99, and a regular stop for fleet and diesel customers.",
    "Acampo": "Minutes away, including vineyard and agricultural vehicles.",
    "Woodbridge": "Just west of Lodi — daily drivers and work trucks alike.",
    "Lockeford": "East on Highway 12, well worth the drive for a proper diagnosis.",
    "Victor": "Close by, and familiar territory for our diesel customers.",
    "Thornton": "Delta-area drivers and farm fleets we've come to know.",
    "Clements": "Rural miles are hard on vehicles; we service them accordingly.",
    "Elk Grove": "Further north, but customers make the trip for second opinions.",
}


def build_service_areas():
    trail = [("Home", "/"), ("Service Areas", "/service-areas/")]
    cards = "".join(
        f"""<div class="card"><span class="card-ico">{icon("pin")}</span>
  <h3>{esc(a)}, CA</h3><p>{esc(AREA_NOTES.get(a, "Auto, diesel and fleet repair for drivers in " + a + "."))}</p></div>"""
        for a in SITE["areas"])
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Areas we serve around Lodi, California</h1>
    <p>Based in Lodi, trusted across San Joaquin County — for cars, diesel trucks and business
    fleets.</p>
    <div class="btn-row">{tel_btn("btn btn-accent", "areas-head")}
    <a class="btn btn-ghost" href="/contact/#quote">Request a quote</a></div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="sec-head"><p class="lede">Our shop is at {esc(FULL_ADDRESS)} — minutes from
    Highway 99 and Highway 12. Customers regularly drive in from these communities, and fleet
    customers operate throughout the region.</p></div>
    <div class="grid g3">{cards}</div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap narrow">
    <h2>Worth the drive for a real diagnosis</h2>
    <p>Plenty of our customers pass closer shops to get here, usually after paying for a repair
    somewhere else that didn't fix the problem. If that's where you are right now, bring the
    estimate and the paperwork — we'll start from the symptom and test our way to the actual cause.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "areas-body")}
    <a class="btn btn-outline" href="/services/">See all services</a></div>
  </div>
</section>

{cta_band()}"""
    render("/service-areas/",
           seo_title("Auto Repair Near Lodi & Stockton, CA"),
           "Phil's Auto and Fleet Repair serves Lodi, Stockton, Galt, Acampo, Woodbridge, "
           "Lockeford and San Joaquin County. Call (209) 647-4953.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)])
    PAGES.append(("/service-areas/", "0.6", "yearly"))


def build_privacy():
    trail = [("Home", "/"), ("Privacy", "/privacy/")]
    body = f"""<div class="page-head"><div class="wrap">{crumbs_html(trail)}
  <h1>Privacy policy</h1><p>How we handle the information you send us through this website.</p></div></div>
<section><div class="wrap narrow">
  <p><strong>What we collect.</strong> If you submit the quote form, we receive the name, phone
  number, vehicle details and description you provide. The site does not require an account and we
  do not ask for payment details online.</p>
  <p><strong>How we use it.</strong> Only to respond to your request and to service your vehicle.
  We do not sell, rent or trade your information.</p>
  <p><strong>Analytics.</strong> This site may use standard web analytics to understand how many
  people visit and which pages they use. That data is aggregated and is not used to identify you
  personally.</p>
  <p><strong>Third-party services.</strong> Quote requests are delivered to our inbox by FormSubmit,
  a form-forwarding service, which processes the details you submit in order to send them to us.
  Map and review links on this site lead to Google, Yelp and similar services, which apply their
  own privacy policies once you leave our site.</p>
  <p><strong>Your choices.</strong> Ask us to delete the information you sent and we will —
  call {SITE["phone_display"]} or email <a href="mailto:{SITE["email"]}">{SITE["email"]}</a>.</p>
  <p><strong>Contact.</strong> {esc(SITE["name"])}, {esc(FULL_ADDRESS)},
  <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a>.</p>
  {angle_divider()}
</div></section>"""
    render("/privacy/", seo_title("Privacy Policy"),
           "How Phil's Auto and Fleet Repair in Lodi, CA collects and uses information submitted "
           "through this website.", body, schemas=[breadcrumb_schema(trail)])
    PAGES.append(("/privacy/", "0.2", "yearly"))


def build_thanks():
    body = f"""<div class="page-head"><div class="wrap">
  <h1>Thanks — we've got your request</h1>
  <p>We'll get back to you as soon as we can during shop hours ({esc(SITE["hours_human"])}).</p>
  <div class="btn-row">{tel_btn("btn btn-accent", "thanks")}
  <a class="btn btn-ghost" href="/">Back to home</a></div></div></div>
<section><div class="wrap narrow">
  <h2>What happens next</h2>
  <ol>
    <li>We read your request and check the details against what your vehicle is doing.</li>
    <li>We call you back to confirm the symptom and what diagnosis will involve.</li>
    <li>We schedule you in and give you a realistic estimate of time and cost.</li>
  </ol>
  <p>If it's urgent — an overheating engine, a truck that's down, brakes that don't feel right —
  don't wait on the callback. Call <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a>.</p>
  {angle_divider()}
</div></section>"""
    render("/thank-you/", seo_title("Thank You"),
           "Your request has been sent to Phil's Auto and Fleet Repair in Lodi, CA.",
           body, noindex=True)


def build_404():
    body = f"""<div class="page-head"><div class="wrap">
  <h1>That page isn't here</h1>
  <p>The link may be old or mistyped. The shop is still exactly where it's always been.</p>
  <div class="btn-row">{tel_btn("btn btn-accent", "404")}
  <a class="btn btn-ghost" href="/services/">Browse services</a></div></div></div>
<section><div class="wrap">
  <div class="sec-head"><h2>Popular pages</h2></div>
  <div class="grid g3">{service_cards(["auto-repair", "car-diagnostics", "diesel-repair",
                                        "fleet-services", "brake-repair", "oil-change-maintenance"])}</div>
  {angle_divider()}
</div></section>"""
    render("/404/", seo_title("Page Not Found"),
           "That page could not be found. Browse our auto, diesel and fleet repair services in "
           "Lodi, CA, or call the shop at (209) 647-4953.", body, noindex=True)
    # Most static hosts look for /404.html at the root.
    with open(os.path.join(OUT, "404", "index.html"), encoding="utf-8") as fh:
        page = fh.read()
    if RELATIVE:
        page = page.replace('="../', '="./')
    with open(os.path.join(OUT, "404.html"), "w", encoding="utf-8") as fh:
        fh.write(page)


# --------------------------------------------------------------------------
# Advice guides. Real answers to what people actually type into Google before
# they call a shop — the depth a template site never has.
# --------------------------------------------------------------------------
GUIDES = [
    {
        "slug": "check-engine-light",
        "nav": "What your check engine light means",
        "title": "Check Engine Light: What It Means, Lodi CA",
        "meta": ("What a check engine light actually means, when it is safe to keep driving, "
                 "and why a free code read is not a diagnosis. From a Lodi repair shop."),
        "blurb": "Steady or flashing, what it means, and what it costs to find out for certain.",
        "icon": "gauge",
        "sections": [
            ("Steady light vs flashing light", "p",
             ["There is one distinction worth knowing before anything else. A <strong>steady</strong> "
              "check engine light means the computer has recorded a fault and wants it looked at "
              "soon. A <strong>flashing</strong> check engine light means an active misfire is "
              "dumping raw fuel into your exhaust, and a catalytic converter can be destroyed in "
              "minutes that way — a repair that often runs into four figures.",
              "If your light is flashing, stop driving and call us. If it is steady, drive gently "
              "and get it looked at in the next few days."]),
            ("Why the free code read isn't a diagnosis", "p",
             ["Any parts store will scan your car for free, and that is genuinely useful — it tells "
              "you a code, say P0171. What it does not tell you is which part failed.",
              "P0171 means the engine is running lean on bank 1. That can be a vacuum leak, a dirty "
              "mass airflow sensor, a weak fuel pump, a leaking injector, a failing oxygen sensor "
              "or an exhaust leak ahead of the sensor. The code names the symptom the computer "
              "noticed. Diagnosis is the work of proving which of those causes is yours.",
              "This is where most of the money gets wasted in car repair. Replacing the cheapest "
              "likely part and hoping is faster than testing, and when it works nobody notices. "
              "When it doesn't, you've paid for a part you didn't need and still have the problem."]),
            ("What actually happens during a diagnosis", "ul",
             ["Pull the codes and the freeze-frame data, which records what the engine was doing "
              "the moment the fault set.",
              "Read live sensor data with the engine running, and compare it against what the "
              "manufacturer says those values should be.",
              "Test the suspect circuit or component directly — pressure, voltage, resistance, "
              "smoke-test for leaks, whatever the fault calls for.",
              "Verify the repair by clearing the code and confirming the fault does not return "
              "under the conditions that set it."]),
            ("Codes we see most often around Lodi", "ul",
             ["<strong>P0420 / P0430</strong> — catalyst efficiency below threshold. Often blamed on "
              "the converter when the real cause is an upstream oxygen sensor or an exhaust leak.",
              "<strong>P0171 / P0174</strong> — running lean. Vacuum leaks are common on higher-mileage "
              "vehicles in this valley heat, which hardens rubber intake components.",
              "<strong>P0300 series</strong> — misfires. Coils, plugs, injectors or a mechanical fault; "
              "the cylinder number in the code narrows it, the testing confirms it.",
              "<strong>P0455</strong> — large evaporative leak. Frequently a loose or failed fuel cap, "
              "which is the cheapest fix in this entire article."]),
        ],
        "takeaway": ("Flashing light: stop driving, call us. Steady light: get it read properly "
                     "before a small fault becomes an expensive one. We will tell you what the "
                     "diagnosis costs before you commit to it."),
    },
    {
        "slug": "second-opinion",
        "nav": "Getting a second opinion on a repair quote",
        "title": "Second Opinion on a Car Repair Quote, Lodi CA",
        "meta": ("How to sanity-check a repair estimate before you pay it: what to ask, what to "
                 "bring, and when a second opinion is worth the trip. Lodi, CA."),
        "blurb": "How to sanity-check an estimate before you spend the money.",
        "icon": "shield",
        "sections": [
            ("When a second opinion is worth it", "p",
             ["Not every quote needs one. If the repair is straightforward, the price is in a "
              "normal range and you trust the shop, get it done.",
              "It is worth a second look when the number is large enough to matter, when the "
              "explanation didn't make sense to you, when a shop recommends replacing several "
              "parts to fix one symptom, or when work has already been done and the original "
              "problem is still there."]),
            ("What to bring with you", "ul",
             ["The written estimate, with part names and labor hours if it lists them.",
              "Any paperwork from work already performed on this problem.",
              "The specific symptom in your own words — what it does, when it started, whether it "
              "happens cold, hot, at speed or at idle.",
              "The codes, if anyone has read them for you."]),
            ("Questions worth asking any shop", "ul",
             ["<strong>How do you know that's the failed part?</strong> A good answer describes a "
              "test. A weak answer describes a guess.",
              "<strong>What happens if we replace it and the symptom stays?</strong> Shops that test "
              "before replacing can answer this comfortably.",
              "<strong>Which of these items are safety, and which can wait?</strong> Any honest shop "
              "will separate the list for you.",
              "<strong>Can you show me?</strong> Worn brake pads, a leaking gasket and a cracked belt "
              "are all things you can be walked out to see."]),
            ("What we do with a second opinion", "p",
             ["We start from your symptom, not from the previous shop's conclusion, because "
              "inheriting an assumption is how a misdiagnosis gets repeated. We test, we tell you "
              "what we find, and we tell you plainly when the first quote was right — that happens, "
              "and it is a perfectly good outcome. You leave knowing the number was fair."]),
        ],
        "takeaway": ("Bring the estimate and the paperwork. We will test the vehicle ourselves and "
                     "give you a straight answer, including when the other shop was right."),
    },
    {
        "slug": "central-valley-heat",
        "nav": "What Central Valley heat does to your vehicle",
        "title": "Summer Car Care for Lodi & the Central Valley",
        "meta": ("Triple-digit Lodi summers are hard on batteries, coolant, tires and AC. What to "
                 "check before the heat arrives, from a local repair shop."),
        "blurb": "Triple-digit summers are hard on batteries, cooling systems, tires and AC.",
        "icon": "snow",
        "sections": [
            ("Heat kills batteries — it just bills you in winter", "p",
             ["Most people blame cold mornings for a dead battery, but the damage is usually done in "
              "summer. Heat accelerates the chemical wear inside the battery and evaporates "
              "electrolyte; the first cold snap simply exposes a battery that summer already "
              "finished off.",
              "A battery and charging test takes minutes and is worth doing before a Lodi summer, "
              "not after it."]),
            ("Cooling systems have no margin at 105 degrees", "p",
             ["A cooling system that copes fine in spring can be marginal in August. A slightly weak "
              "water pump, a thermostat sticking a little, a radiator with a decade of debris in "
              "the fins, coolant that has lost its corrosion inhibitors — none of it shows up until "
              "the day it is 105 degrees and you're climbing a grade with the AC on.",
              "Overheating is also the fastest way to turn a modest repair into a head gasket or an "
              "engine. The temperature gauge climbing is a reason to pull over, not a reason to "
              "hurry home."]),
            ("Tires and hot asphalt", "p",
             ["Pressure rises as tires heat, but starting underinflated is what causes trouble: an "
              "underinflated tire flexes more, builds more heat, and heat is what makes a worn tire "
              "fail on the highway. Check pressures when the tires are cold and set them to the "
              "sticker in the door jamb, not to the number on the tire sidewall.",
              "Worth a look at tread depth and sidewall cracking at the same time. Valley sun is "
              "hard on rubber."]),
            ("Air conditioning is a safety system here", "p",
             ["In this valley, AC is not a comfort item — it is what makes a car usable in July with "
              "kids or older passengers in it. If yours is cooling less than it did last year, it "
              "is losing refrigerant, and refrigerant only leaves a sealed system one way.",
              "Getting the leak found in spring costs less than an emergency in July, and far less "
              "than the compressor that eventually fails from running low on the oil that travels "
              "with the refrigerant."]),
        ],
        "takeaway": ("A battery test, a cooling system check, correct tire pressures and an AC that "
                     "still blows cold — that is a short list, and it is the difference between "
                     "summer being uneventful and being expensive."),
    },
    {
        "slug": "diesel-warning-lights",
        "nav": "Diesel warning lights, explained",
        "title": "Diesel Warning Lights Explained — Lodi, CA",
        "meta": ("DPF, regen, glow plug and derate warnings on a diesel truck: what each one means "
                 "and how urgent it is. Diesel repair in Lodi, California."),
        "blurb": "DPF, regen, glow plug and derate warnings — what each one is telling you.",
        "icon": "truck",
        "sections": [
            ("The DPF light and what regeneration is", "p",
             ["A diesel particulate filter traps soot. Periodically the truck burns that soot off at "
              "high temperature — that is a regeneration, or regen. The DPF light usually means the "
              "filter is loading up and a regen is needed or was interrupted.",
              "Short trips are the usual culprit: the exhaust never gets hot enough or stays hot "
              "long enough to complete a regen. Repeated interrupted regens are what turn a "
              "warning light into a plugged filter and a real bill."]),
            ("Derate and limp mode", "p",
             ["A derate is the truck deliberately limiting power to protect itself or to force an "
              "emissions problem to be dealt with. It is not a suggestion — power will keep "
              "stepping down on a schedule until the fault is addressed.",
              "If your truck is in a derate, say so when you call. A truck that cannot do its job "
              "gets treated differently than a maintenance appointment."]),
            ("Glow plug and hard starting", "p",
             ["Glow plugs warm the combustion chamber so a cold diesel will light off. A glow plug "
              "light that stays on, long cranking on cold mornings, or white smoke at startup all "
              "point at that system — or at the fuel side.",
              "Hard starting is worth diagnosing early. It rarely improves on its own and it is "
              "usually cheaper before the batteries and starter take the abuse of extended cranking."]),
            ("Fuel quality and water in the fuel", "p",
             ["A water-in-fuel light is one to take seriously and immediately. Modern high-pressure "
              "fuel systems are precise and unforgiving; water and contamination damage injectors "
              "and pumps quickly, and those are the expensive parts on a diesel.",
              "Draining the separator on schedule and changing filters at the correct interval is "
              "some of the cheapest insurance available on a work truck."]),
        ],
        "takeaway": ("Diesel warning lights escalate. A DPF light dealt with this week is "
                     "maintenance; the same light ignored for a month is a plugged filter and a "
                     "truck that will not work."),
    },
]


def guide_schema(g, path):
    return ('{"@context":"https://schema.org","@type":"Article","headline":%s,'
            '"description":%s,"inLanguage":"en-US",'
            '"datePublished":"%s","dateModified":"%s",'
            '"author":{"@id":"%s/#business"},"publisher":{"@id":"%s/#business"},'
            '"mainEntityOfPage":{"@type":"WebPage","@id":"%s%s"}}'
            % (jstr(g["title"]), jstr(g["meta"]), date.today().isoformat(),
               date.today().isoformat(), SITE["base_url"], SITE["base_url"],
               SITE["base_url"], path))


def build_guide(g):
    path = "/advice/%s/" % g["slug"]
    trail = [("Home", "/"), ("Advice", "/advice/"), (g["nav"], path)]
    blocks = []
    for heading, kind, items in g["sections"]:
        body_items = ("<ul>%s</ul>" % "".join("<li>%s</li>" % x for x in items) if kind == "ul"
                      else "".join("<p>%s</p>" % x for x in items))
        blocks.append("<h2>%s</h2>%s" % (esc(heading), body_items))
    others = [x for x in GUIDES if x["slug"] != g["slug"]]
    related = "".join('<a class="tag" href="/advice/%s/">%s</a>' % (o["slug"], esc(o["nav"]))
                      for o in others)

    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>{esc(g["nav"])}</h1>
    <p>{esc(g["blurb"])}</p>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap narrow">
    {"".join(blocks)}
    <div class="panel panel-accent" style="margin-top:2em">
      <h3>The short version</h3>
      <p style="margin-bottom:1.2em">{esc(g["takeaway"])}</p>
      <div class="btn-row">
        {tel_btn("btn btn-accent", "guide")}
        <a class="btn btn-ghost" href="/contact/#quote">Ask us about it</a>
      </div>
    </div>
    <p style="margin-top:2em;color:var(--slate);font-size:.9rem">Written by the team at
      {esc(SITE["name"])}, {esc(FULL_ADDRESS)}. General guidance, not a substitute for having
      your own vehicle looked at — every car tells its own story.</p>
    <h2 style="margin-top:1.6em">More advice</h2>
    <div class="tag-row">{related}<a class="tag" href="/advice/">All guides</a></div>
  </div>
</section>

{cta_band("Rather just ask someone?",
          "Call the shop and describe what your vehicle is doing. We will tell you what we think it is and what it takes to know for sure.")}"""

    render(path, seo_title(g["title"]), g["meta"], body,
           schemas=[business_schema(), guide_schema(g, path), breadcrumb_schema(trail)],
           active="/advice/")
    PAGES.append((path, "0.6", "yearly"))


def build_advice_index():
    trail = [("Home", "/"), ("Advice", "/advice/")]
    cards = "".join(
        f"""<a class="card" href="/advice/{g["slug"]}/">
  <span class="card-ico">{icon(g["icon"])}</span>
  <h3>{esc(g["nav"])}</h3>
  <p>{esc(g["blurb"])}</p>
  <span class="more">Read it {icon("arrow")}</span>
</a>""" for g in GUIDES)
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Straight answers about your vehicle</h1>
    <p>The questions we get asked at the counter, written down — so you can decide what to do
    before you spend anything.</p>
    <div class="btn-row">{tel_btn("btn btn-accent", "advice-head")}
    <a class="btn btn-ghost" href="/contact/#quote">Ask a question</a></div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="grid g2">{cards}</div>
  </div>
</section>

{cta_band()}"""
    render("/advice/", seo_title("Car Repair Advice — Lodi, CA"),
           "Plain-English guides from a Lodi repair shop: check engine lights, second opinions, "
           "summer heat and diesel warning lights. Call (209) 647-4953.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/advice/")
    PAGES.append(("/advice/", "0.6", "monthly"))


# --------------------------------------------------------------------------
# Deployment files: manifest, caching/security headers, and the redirect map
# that carries the old site's rankings over to the new URLs.
# --------------------------------------------------------------------------
# Old paths -> new equivalents. These are the URL shapes the current site uses;
# check them against the live site (or Search Console's page report) and add any
# that are missing before launch. A 301 passes ranking on; a 404 throws it away.
OLD_URL_MAP = [
    ("/auto-repair", "/services/auto-repair/"),
    ("/auto-repair-lodi", "/services/auto-repair/"),
    ("/diesel-repair", "/services/diesel-repair/"),
    ("/diesel-repair-lodi", "/services/diesel-repair/"),
    ("/tire-repair", "/services/tire-repair/"),
    ("/tires", "/services/tire-repair/"),
    ("/car-diagnostics", "/services/car-diagnostics/"),
    ("/car-diagnostics-lodi", "/services/car-diagnostics/"),
    ("/brake-repair", "/services/brake-repair/"),
    ("/brakes", "/services/brake-repair/"),
    ("/engine-repair", "/services/engine-repair/"),
    ("/transmission", "/services/transmission-repair/"),
    ("/transmission-repair", "/services/transmission-repair/"),
    ("/oil-change", "/services/oil-change-maintenance/"),
    ("/fleet", "/services/fleet-services/"),
    ("/fleet-services", "/services/fleet-services/"),
    ("/ac-repair", "/services/ac-heating-repair/"),
    ("/electrical", "/services/electrical-repair/"),
    ("/about-us", "/about/"),
    ("/contact-us", "/contact/"),
    ("/reviews", "/reviews/"),
    ("/testimonials", "/reviews/"),
]


def build_deploy_files():
    if SITE.get("custom_domain"):
        with open(os.path.join(OUT, "CNAME"), "w", encoding="utf-8") as fh:
            fh.write(SITE["custom_domain"] + "\n")

    with open(os.path.join(OUT, "site.webmanifest"), "w", encoding="utf-8") as fh:
        fh.write("""{
  "name": "%s",
  "short_name": "Phil's Auto",
  "description": "Honest auto, diesel and fleet repair in Lodi, California.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0a0a1f",
  "icons": [
    { "src": "%s", "sizes": "80x80", "type": "image/png", "purpose": "any" }
  ]
}
""" % (SITE["name"], SITE.get("logo") or "/assets/img/favicon.svg"))

    # Netlify / Cloudflare Pages
    lines = ["# Old site URLs -> new pages. Keeps the rankings the current site has earned.",
             "# Verify these against the live site before launch; add any that are missing."]
    for old, new in OLD_URL_MAP:
        lines.append("%-26s %-38s 301!" % (old, new))
    lines += ["",
              "# Trailing-slash variants",
              ] + ["%-26s %-38s 301!" % (old + "/", new) for old, new in OLD_URL_MAP]
    with open(os.path.join(OUT, "_redirects"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    with open(os.path.join(OUT, "_headers"), "w", encoding="utf-8") as fh:
        fh.write("""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  X-Frame-Options: SAMEORIGIN

# Fingerprint-free assets, so revalidate daily but serve instantly meanwhile
/assets/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/*.html
  Cache-Control: public, max-age=0, must-revalidate
""")

    # Apache / cPanel hosts
    rules = "\n".join("Redirect 301 %s %s" % (old, new) for old, new in OLD_URL_MAP)
    with open(os.path.join(OUT, ".htaccess"), "w", encoding="utf-8") as fh:
        fh.write("""# Phil's Auto and Fleet Repair — Apache configuration
# Only needed on a traditional host (cPanel). Netlify and Cloudflare Pages use
# the _redirects and _headers files instead.

RewriteEngine On

# One canonical hostname: https://philsautofleet.com
RewriteCond %%{HTTPS} off
RewriteRule ^(.*)$ https://%%{HTTP_HOST}/$1 [R=301,L]
RewriteCond %%{HTTP_HOST} ^www\\.philsautofleet\\.com [NC]
RewriteRule ^(.*)$ https://philsautofleet.com/$1 [R=301,L]

# Old page URLs -> new equivalents
%s

ErrorDocument 404 /404.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 week"
  ExpiresByType application/javascript "access plus 1 week"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
""" % rules)


# --------------------------------------------------------------------------
# Spanish landing page. Roughly two in five people in Lodi speak Spanish at
# home; almost no independent shop in the area publishes in it.
# --------------------------------------------------------------------------
def build_spanish():
    servicios = [
        ("wrench", "Reparación general", "Vehículos nacionales, importados y de flota."),
        ("gauge", "Diagnóstico y luz de motor", "Encontramos la causa en vez de adivinar."),
        ("disc", "Frenos", "Pastillas, discos, mordazas y fallas de ABS."),
        ("engine", "Motor", "Fallas de encendido, fugas, sobrecalentamiento y distribución."),
        ("gears", "Transmisión", "Diagnóstico y reparación, automática y manual."),
        ("truck", "Diésel y flotas", "Camionetas de trabajo y flotas comerciales."),
        ("drop", "Cambio de aceite", "Servicio programado con inspección de verdad."),
        ("tire", "Llantas", "Reparación de ponchaduras, rotación y balanceo."),
        ("bolt", "Eléctrico y baterías", "No arranca, alternador, marcha y corrientes parásitas."),
    ]
    cards = "".join(
        f'<div class="card"><span class="card-ico">{icon(ic)}</span><h3>{esc(t)}</h3>'
        f'<p style="margin-bottom:0">{esc(d)}</p></div>' for ic, t, d in servicios)

    body = f"""<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Negocio local · Lodi, California</span>
        <h1>Taller honesto de autos, diésel y flotas en <em>Lodi</em></h1>
        <div class="rating">{stars()}<span class="rating-text"><strong>4.4 de 5</strong> en 83
          reseñas de Google</span></div>
        <p>Una alternativa justa a la agencia. Diagnosticamos el problema de verdad, se lo
        explicamos en palabras claras y le damos el precio antes de tocar el vehículo — para que
        nunca pague por piezas que su carro no necesitaba.</p>
        <div class="btn-row">
          {tel_btn("btn btn-accent", "es-hero", "Llame al " + SITE["phone_display"])}
          <a class="btn btn-ghost" href="#cotizacion">Pedir cotización</a>
        </div>
        <ul class="hero-points">
          <li>{icon("check-circle")}<span>Autos, camionetas, diésel y flotas comerciales</span></li>
          <li>{icon("check-circle")}<span>Reparamos fallas que otros talleres no encontraron</span></li>
          <li>{icon("check-circle")}<span>Sin ventas de más — usted autoriza cada reparación</span></li>
          <li>{icon("check-circle")}<span>Abierto de lunes a sábado, 8:00 AM a 5:00 PM</span></li>
        </ul>
      </div>
      <div id="cotizacion">
        <form class="quote-card" data-quote-form action="{FORM_ENDPOINT}" method="post" data-mailto="{SITE["email"]}">
          <h2>Pida su cotización</h2>
          <p class="sub">Cuéntenos qué está pasando y le respondemos con los siguientes pasos.
          ¿Prefiere hablar? Llame al {SITE["phone_display"]}.</p>
          <div class="field"><label for="es-nombre">Su nombre</label>
            <input id="es-nombre" name="name" type="text" autocomplete="name" required></div>
          <div class="field"><label for="es-tel">Teléfono</label>
            <input id="es-tel" name="phone" type="tel" autocomplete="tel" required></div>
          <div class="field"><label for="es-vehiculo">Vehículo (año, marca, modelo)</label>
            <input id="es-vehiculo" name="vehicle" type="text" placeholder="2016 Ram 2500 diésel"></div>
          <div class="field"><label for="es-mensaje">¿Qué está haciendo el vehículo?</label>
            <textarea id="es-mensaje" name="message" placeholder="Ruidos, luces del tablero, cuándo empezó, y qué le dijeron en otro taller."></textarea></div>
          <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="_subject" value="Cotización desde philsautofleet.com">
          <input type="hidden" name="_template" value="table">
          <input type="hidden" name="_captcha" value="false">
          <button class="btn btn-accent" type="submit" style="width:100%">Enviar solicitud</button>
          <p class="form-status" role="status" aria-live="polite"></p>
          <p class="form-note">Sin compromiso. Nunca vendemos su información.</p>
        </form>
      </div>
    </div>
  </div>
</section>

{stat_band(es=True)}

<section id="servicios">
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">Servicios</span>
      <h2>Todo, desde un cambio de aceite hasta un diésel que no arranca</h2>
      <p>Un solo taller para su carro, su troca y toda su flota — con el mismo método:
      primero diagnosticar, después cotizar.</p>
    </div>
    <div class="grid g3">{cards}</div>
  </div>
</section>

<section class="bg-alt" id="por-que">
  <div class="wrap">
    <div class="split center-y">
      <div>
        <span class="eyebrow">Por qué la gente cambia de taller</span>
        <h2>La agencia no es su única opción</h2>
        <p>En la agencia el trabajo se organiza por volumen y por menú de precios. Eso funciona
        hasta que su problema no cabe en el menú — y entonces termina pagando piezas que se
        cambiaron porque estaban en una lista, no porque hubieran fallado.</p>
        <ul class="checklist">
          <li>{icon("check")}<span><strong>Habla con quien revisó su vehículo</strong>, no con un intermediario.</span></li>
          <li>{icon("check")}<span><strong>Probamos antes de cambiar piezas</strong>, por eso una segunda opinión aquí suele costar menos que la primera cotización.</span></li>
          <li>{icon("check")}<span><strong>Nada se repara sin su autorización</strong>, incluyendo lo que encontremos durante el trabajo.</span></li>
          <li>{icon("check")}<span><strong>Le decimos qué puede esperar</strong> y qué es cuestión de seguridad.</span></li>
        </ul>
        <div class="btn-row" style="margin-top:26px">
          {tel_btn("btn btn-dark", "es-body", "Llame al " + SITE["phone_display"])}
          <a class="btn btn-outline" href="/">See this page in English</a>
        </div>
      </div>
      <div class="panel panel-accent" id="taller">
        <h3>El taller</h3>
        <table class="hours"><tbody>
          <tr><th scope="row">Dirección</th><td>{esc(FULL_ADDRESS)}</td></tr>
          <tr><th scope="row">Teléfono</th><td><a href="tel:{SITE["phone_link"]}" data-loc="es-panel">{SITE["phone_display"]}</a></td></tr>
          <tr><th scope="row">Correo</th><td><a href="mailto:{SITE["email"]}">{SITE["email"]}</a></td></tr>
          <tr><th scope="row">Horario</th><td>Lunes a sábado, 8 AM – 5 PM</td></tr>
          <tr><th scope="row">Domingo</th><td>Cerrado</td></tr>
        </tbody></table>
        <p style="margin:22px 0 0">
          <a class="btn btn-accent" href="{MAPS_DIRECTIONS}" rel="noopener" style="width:100%">Cómo llegar</a></p>
      </div>
    </div>
  </div>
</section>

{cta_band("¿Quiere una respuesta clara sobre su vehículo?",
          "Llame al taller y hable con alguien que repara carros todos los días. Abierto de lunes a sábado, de 8:00 AM a 5:00 PM.")}"""

    render("/es/", "Taller Mecánico en Lodi, CA | Phil's Auto",
           "Taller de reparación de autos, diésel y flotas en Lodi, California. Diagnóstico "
           "honesto, precio antes de reparar, sin ventas de más. Llame al (209) 647-4953.",
           body, schemas=[business_schema()], lang="es",
           alternates=[("en", "/"), ("es", "/es/"), ("x-default", "/")])
    PAGES.append(("/es/", "0.7", "monthly"))


def build_sitemap():
    today = date.today().isoformat()
    urls = "".join(
        "\n  <url><loc>%s%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq>"
        "<priority>%s</priority></url>" % (SITE["base_url"], p, today, cf, pr)
        for p, pr, cf in PAGES
    )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">%s\n</urlset>\n' % urls)
    with open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(xml)

    robots = ("User-agent: *\nAllow: /\n\n"
              "Sitemap: %s/sitemap.xml\n" % SITE["base_url"])
    with open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8") as fh:
        fh.write(robots)


def clean():
    """Remove previously generated HTML. Hand-maintained directories stay."""
    KEEP = {"assets", "media"}
    for entry in os.listdir(OUT):
        if entry in KEEP:
            continue
        target = os.path.join(OUT, entry)
        if os.path.isdir(target):
            shutil.rmtree(target)
        elif entry.endswith((".html", ".xml", ".txt", ".webmanifest")) or entry in ("_redirects", "_headers", ".htaccess", "CNAME"):
            os.remove(target)


def main():
    os.makedirs(OUT, exist_ok=True)
    clean()
    build_home()
    build_services_index()
    for s in SERVICES:
        build_service(s)
    build_about()
    build_reviews()
    build_service_areas()
    build_contact()
    build_spanish()
    build_advice_index()
    for g in GUIDES:
        build_guide(g)
    build_privacy()
    build_thanks()
    build_404()
    build_sitemap()
    build_deploy_files()
    print("Built %d pages into %s" % (len(PAGES) + 2, OUT))
    for p, _, _ in PAGES:
        print("  %s" % p)


if __name__ == "__main__":
    main()
