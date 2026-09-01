#!/usr/bin/env python3
"""
Static site generator for Automotive Solutions by Single (Elk Grove, CA).

Run:  python3 build.py                 -> ./public with root-absolute links
      python3 build.py --relative      -> ./public with relative links
      python3 build.py --relative --out /tmp/site

Absolute links are correct for a deploy at the root of a domain. The
--relative build works anywhere else: a subfolder, a staging URL, or the
zip a customer opens locally by double-clicking index.html.

Everything the shop needs to edit day to day lives in the SITE, SERVICES,
REVIEWS and GUIDES structures below. Change it here, re-run the script, and
every page, the sitemap and the structured data stay in sync.

The hand-maintained assets/ folder (CSS, JS, logo, illustration) is copied
into the output on every build, so an --out build is complete on its own.
"""

import html
import os
import re
import shutil
import sys
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS_SRC = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "public")

RELATIVE = "--relative" in sys.argv
if "--out" in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])

# ==========================================================================
# BUSINESS FACTS — single source of truth.
#
# Keep these identical to the Google Business Profile, Yelp, NAPA's
# directory and every other citation. Name/address/phone consistency across
# the web is a direct local-ranking factor.
#
# Anything marked CONFIRM is taken from a public source rather than from the
# owner, and is listed in README.md under "Confirm before launch".
# ==========================================================================
SITE = {
    "name": "Automotive Solutions by Single",
    "short": "Automotive Solutions",
    "legal_note": "Automotive Solutions by Single",
    "base_url": "https://www.automotivesolutionsbysingle.com",
    "phone_display": "(916) 686-5277",
    "phone_link": "+19166865277",

    # ---- ONE-LINE SWAP -----------------------------------------------
    # Put the shop's real inbox here and the quote form goes live. The form
    # posts to FormSubmit, which needs no account: the first submission
    # triggers a one-time confirmation email to this address. Click the link
    # in it once and every later submission arrives directly.
    # Until this is a real address the form tells visitors to call instead.
    "email": "REPLACE-ME@example.com",   # CONFIRM: shop's real email address
    # ------------------------------------------------------------------

    "street": "9253 Elk Grove Blvd",
    "city": "Elk Grove",
    "region": "CA",
    "region_long": "California",
    "zip": "95624",
    "county": "Sacramento County",
    "lat": "38.4094",     # CONFIRM: geocoded from the street address
    "lng": "-121.3558",

    "hours_human": "Monday – Friday, 9:00 AM – 6:00 PM",
    "hours_short": "Mon–Fri 9:00 AM – 6:00 PM",
    "hours_rows": [
        ("Monday", "9:00 AM – 6:00 PM"),
        ("Tuesday", "9:00 AM – 6:00 PM"),
        ("Wednesday", "9:00 AM – 6:00 PM"),
        ("Thursday", "9:00 AM – 6:00 PM"),
        ("Friday", "9:00 AM – 6:00 PM"),
        ("Saturday", "Closed"),
        ("Sunday", "Closed"),
    ],
    "hours_schema": [
        {"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
         "opens": "09:00", "closes": "18:00"},
    ],

    # Shown on-page with a link to the source. Deliberately NOT published as
    # aggregateRating in JSON-LD — self-serving review markup is against
    # Google's guidelines and can cost you the rich result entirely.
    "rating": "4.5",
    "review_count": "55",
    "rating_source": "Google",

    "areas": ["Elk Grove", "Laguna", "Sacramento", "Wilton", "Galt", "Florin",
              "Vineyard", "Sheldon", "Franklin", "Rancho Cordova"],

    # ---- Verified claims (sourced; see README.md) ----------------------
    "founded_year": "2001",
    "owners": "Mike and Valerie Single",
    "napa": True,
    "ase": True,
    "warranty_months": "24",
    "warranty_miles": "24,000",

    # ---- Branding ------------------------------------------------------
    # The real logo, cropped from the file the owner supplied. It is a full
    # wordmark, so it stands alone rather than sitting beside a text lockup.
    "logo": "/assets/img/logo.png",
    "logo_dark_bg": "",          # no reversed version supplied -> white chip
    "logo_lockup": "full",
    "favicon": "/assets/img/favicon.svg",
    "custom_domain": "",         # only needed for GitHub Pages + custom domain
}

FULL_ADDRESS = "{street}, {city}, {region} {zip}".format(**SITE)

SITE["promise"] = ("You get the diagnosis, the price and the reasoning before any work starts — "
                   "then you decide what gets fixed.")
SITE["warranty_text"] = (
    "As a NAPA AutoCare Center, qualifying repairs are covered by the NAPA Peace of Mind "
    "Warranty — %s months or %s miles on parts and labor, honored at NAPA AutoCare Centers "
    "nationwide, not just here." % (SITE["warranty_months"], SITE["warranty_miles"]))

MAPS_DIRECTIONS = ("https://www.google.com/maps/dir/?api=1&destination="
                   "9253+Elk+Grove+Blvd%2C+Elk+Grove%2C+CA+95624")
# CONFIRM: replace with the exact share link from the Google Business Profile
# dashboard once you have it — a search URL works, a profile link is better.
MAPS_LISTING = ("https://www.google.com/maps/search/?api=1&query="
                "Automotive+Solutions+9253+Elk+Grove+Blvd+Elk+Grove+CA+95624")
MAPS_EMBED = ("https://maps.google.com/maps?q=9253%20Elk%20Grove%20Blvd%2C%20Elk%20Grove%2C%20CA%2095624"
              "&t=&z=15&ie=UTF8&iwloc=&output=embed")

YELP_URL = "https://www.yelp.com/biz/automotive-solutions-elk-grove"
NAPA_URL = "https://www.napaonline.com/en/autocare/?facilityId=1326381"
BBB_URL = "https://www.bbb.org/us/ca/elk-grove/profile/auto-repair/auto-solutions-by-single-1156-33010667"

# Profiles that already carry reviews and citations for this shop. Declaring
# them as sameAs tells search engines these are all one business, which
# consolidates authority that is currently split across them.
PROFILES = [
    MAPS_LISTING,
    YELP_URL,
    NAPA_URL,
    BBB_URL,
    "https://nextdoor.com/pages/automotive-solutions-by-single-elk-grove-ca/",
    "https://www.surecritic.com/reviews/automotive-solutions-by-single",
    "https://www.customerlobby.com/reviews/1418/automotive-solutions-by-single",
    "https://www.yellowpages.com/elk-grove-ca/mip/automotive-solutions-by-single-10168101",
]

# Where quote requests go. FormSubmit needs no account and no API key: it
# emails SITE["email"] a one-time confirmation link on the first submission.
# Swapping in Formspree, Basin or a custom handler later means changing only
# this line — the markup does not change.
FORM_ENDPOINT = "https://formsubmit.co/ajax/%s" % SITE["email"]

# True until a real inbox is filled in above. While it is True the quote form
# tells visitors to call instead of pretending to send, and the placeholder is
# kept out of the structured data rather than published as fact.
EMAIL_IS_PLACEHOLDER = ("REPLACE-ME" in SITE["email"]) or SITE["email"].endswith("example.com")

# ==========================================================================
# Inline SVG icons — no icon font, no network request
# ==========================================================================
ICONS = {
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.8a2 2 0 0 1 1.7 2z"/>',
    "pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    "map": '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5 11 15l4.5-5"/>',
    "wrench": '<path d="M14.6 6.3a1 1 0 0 0 0 1.4l1.7 1.7a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    "gauge": '<path d="M12 21a9 9 0 1 1 9-9"/><path d="m12 12 5-3"/><circle cx="12" cy="12" r="1.5"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "disc": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    "drop": '<path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3z"/>',
    "tire": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    "engine": '<path d="M8.5 3h7v5.5l-1.5 2.2V15h-4v-4.3L8.5 8.5z"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M8.5 6h7"/>',
    "gears": '<circle cx="10" cy="10" r="4"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4"/><circle cx="17.5" cy="17.5" r="3"/>',
    "shield": '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.6C7.4 20.3 4 17 4 12V6z"/><path d="M9 12l2 2 4-4"/>',
    "snow": '<path d="M12 2v20M4 7l16 10M20 7 4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    "spring": '<path d="M6 4h12M6 20h12"/><path d="M7 7h10l-10 3h10l-10 3h10"/>',
    "belt": '<circle cx="7.5" cy="9" r="4"/><circle cx="17" cy="15" r="3"/><path d="M9.5 5.5 19 12.5M5.5 12.5 15 17.5"/>',
    "fuel": '<path d="M4 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16"/><path d="M3 21h11"/><path d="M13 10h3a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/><path d="M5 8h7"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    "camera": '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    "chat": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5A8 8 0 1 1 21 12z"/>',
    "arrow": '<path d="M5 12h13M13 6l6 6-6 6"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    "dollar": '<path d="M12 2v20"/><path d="M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.7 7 7s2.5 3.2 5 3.9 5 1.6 5 4-2.2 3.6-5 3.6-5-1.2-5-3.1"/>',
    "family": '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15 20c0-2.4 1.4-4 3.5-4S22 17.6 22 20"/>',
    "badge": '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-2.6L17 22l-1.5-8"/>',
}


def icon(name, cls="icon"):
    return ('<svg class="%s" viewBox="0 0 24 24" aria-hidden="true">%s</svg>'
            % (cls, ICONS.get(name, ICONS["check"])))


def esc(text):
    return html.escape(str(text), quote=False)


def seo_title(base):
    """Titles must stay at or under 60 characters or Google truncates them.
    Append the brand only while it still fits."""
    for suffix in (" | %s" % SITE["short"], " | Elk Grove", ""):
        candidate = base + suffix
        if len(candidate) <= 60:
            return candidate
    return base[:60]


def stars(n=5):
    return '<span class="stars" aria-hidden="true">%s</span>' % ("★" * n)


def jstr(text):
    """JSON string literal that is safe inside a <script> block."""
    out = str(text).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return '"%s"' % out.replace("</", "<\\/")


# ==========================================================================
# SERVICES — each becomes an indexed landing page at /services/<slug>/
# targeting "<service> in Elk Grove", with its own Service + FAQPage schema.
#
# Every service listed here is one the shop publishes on its Google Business
# Profile or its own site. Nothing has been added speculatively.
# ==========================================================================
PHONE = SITE["phone_display"]

SERVICES = [
    {
        "slug": "auto-repair",
        "nav": "Auto Repair",
        "icon": "wrench",
        "title": "Auto Repair Shop in Elk Grove, CA",
        "h1": "Auto Repair in Elk Grove, CA",
        "meta": ("Full-service auto repair in Elk Grove, CA for domestic and import vehicles. "
                 "ASE certified techs, NAPA AutoCare warranty. Call (916) 686-5277."),
        "blurb": "Domestic and import cars, trucks, SUVs and vans — diagnosed properly, repaired once.",
        "intro": [
            "The hard part of a car problem usually isn't the repair. It's finding a shop that "
            "tells you what is actually wrong instead of what is easiest to sell. Automotive "
            "Solutions has been answering that question for Elk Grove drivers since 2001.",
            "We work on all makes and models, domestic and import. Our technicians are ASE "
            "certified, we use current diagnostic equipment and quality parts, and as a NAPA "
            "AutoCare Center our qualifying repairs carry a warranty that follows you out of town."
        ],
        "includes": [
            "Computerized diagnostics and drivability troubleshooting",
            "Engine repair, replacement and major overhaul",
            "Transmission service, repair and replacement",
            "Brake systems — pads, rotors, calipers, hydraulics and ABS faults",
            "Suspension and steering, including shocks and struts",
            "Air conditioning and heating service",
            "Electrical faults, batteries, alternators and starters",
            "Timing belts, belts, hoses and cooling systems",
            "Fuel injection service and tune-ups",
            "Factory-scheduled maintenance and oil changes",
        ],
        "signs": [
            "A warning light you have been driving with for weeks",
            "A noise, vibration or smell that started recently and has not gone away",
            "A dealership quote that feels far higher than the problem sounds",
            "Another shop replaced a part and the symptom is still there",
            "The car is due for major-mileage service and you want an honest scope",
            "You just bought a used car and want a baseline inspection",
        ],
        "faqs": [
            ("Do you work on both domestic and import vehicles?",
             "Yes. We provide repairs, service and maintenance on all makes and models of domestic "
             "and import cars, trucks, SUVs and vans. If you are not sure whether we cover your "
             "vehicle, call %s and just ask." % PHONE),
            ("Are your technicians certified?",
             "Yes. Our technicians are ASE certified — tested and certified by the National "
             "Institute for Automotive Service Excellence — and ASE certification is a requirement "
             "of the NAPA AutoCare program we belong to."),
            ("Will you tell me the price before you start?",
             "Always. We diagnose first, then walk you through what we found, what it costs and "
             "what can safely wait. Nothing gets repaired until you approve it."),
            ("Do I need an appointment?",
             "Appointments help us get you in and out faster, but call us — we will tell you "
             "honestly how the schedule looks that day."),
        ],
    },
    {
        "slug": "brake-repair",
        "nav": "Brake Repair",
        "icon": "disc",
        "title": "Brake Repair & Service in Elk Grove, CA",
        "h1": "Brake Repair in Elk Grove, CA",
        "meta": ("Brake pads, rotors, calipers and ABS diagnosis in Elk Grove, CA. We measure "
                 "and show you the numbers. Call (916) 686-5277."),
        "blurb": "Pads, rotors, calipers, hydraulics and ABS faults — measured, not guessed at.",
        "intro": [
            "Brakes are the one system where a wrong call has immediate consequences, so we "
            "measure rather than estimate. Pad thickness, rotor condition and thickness variation, "
            "hydraulic components, fluid condition — and then we tell you the numbers we got.",
            "If your pads have life left, that is what we will tell you. Being told your brakes "
            "are fine is a perfectly good outcome of a brake inspection, and it is the reason "
            "people come back to us when they are not fine."
        ],
        "includes": [
            "Brake pad and rotor replacement — front, rear or all four corners",
            "Rotor measurement, resurfacing or replacement as required",
            "Caliper, wheel cylinder and brake hose service",
            "Master cylinder and hydraulic system diagnosis",
            "Brake fluid exchange and moisture testing",
            "ABS warning light diagnosis and wheel-speed sensor testing",
            "Parking brake adjustment and repair",
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
             "It depends far more on how and where you drive than on mileage. Stop-and-go miles "
             "on Elk Grove Boulevard wear pads much faster than freeway miles on Highway 99. We "
             "measure yours and tell you the remaining life in millimeters, not guesses."),
            ("Do I have to replace the rotors with the pads?",
             "Not always. If your rotors are above minimum thickness and within runout spec they "
             "can often stay. We measure them and show you the reading."),
            ("Is brake work covered by a warranty?",
             "Qualifying repairs at a NAPA AutoCare Center carry the NAPA Peace of Mind Warranty "
             "— 24 months or 24,000 miles on parts and labor, honored nationwide. Ask us to "
             "confirm the coverage that applies to your repair before we begin."),
        ],
    },
    {
        "slug": "engine-repair",
        "nav": "Engine Repair",
        "icon": "engine",
        "title": "Engine Repair & Replacement, Elk Grove CA",
        "h1": "Engine Repair and Replacement in Elk Grove, CA",
        "meta": ("Engine repair, major overhaul and engine replacement in Elk Grove, CA. "
                 "Honest diagnosis before any quote. Call (916) 686-5277."),
        "blurb": "Misfires, leaks, overheating, major overhaul and full engine replacement.",
        "intro": [
            "Engine work gets expensive when it is diagnosed by assumption. Before we quote, we "
            "establish what is actually failing — compression, ignition, fuel, cooling or "
            "mechanical — and we tell you what the repair is worth relative to the vehicle.",
            "Engine replacement and major overhaul are both everyday work here. So is telling "
            "somebody the money is better spent elsewhere. You will get that conversation either "
            "way, before anything is taken apart."
        ],
        "includes": [
            "Misfire, rough-idle and low-power diagnosis",
            "Compression and cylinder leak-down testing",
            "Major overhaul and internal engine work",
            "Engine replacement when it is the right economic call",
            "Head gasket and cooling-system repair",
            "Oil leak diagnosis and gasket or seal replacement",
            "Overheating diagnosis — water pumps, thermostats, radiators, fans",
            "Belts, hoses, tensioners and pulleys",
        ],
        "signs": [
            "Ticking, knocking or tapping that changes with engine speed",
            "Temperature gauge climbing, or coolant disappearing",
            "Blue, white or black smoke from the exhaust",
            "Oil spots on the driveway or a burning-oil smell",
            "The engine shakes at idle, or the check engine light is flashing",
            "Power loss on hills or when the vehicle is loaded",
        ],
        "faqs": [
            ("Is it worth repairing the engine or should I replace the car?",
             "That depends on the failure, the condition of the rest of the vehicle and what a "
             "replacement would cost you. We will give you the real numbers and an honest opinion "
             "— including when the answer is not to spend it on this one."),
            ("My car is overheating. Can I drive it in?",
             "Please do not. Overheating turns a hose or thermostat repair into a head gasket or a "
             "new engine in a matter of minutes. Shut it off and call %s." % PHONE),
            ("Do you do engine replacement?",
             "Yes. Engine replacement and transmission replacement are both regular work here, and "
             "we will tell you up front how the cost compares with repairing what you have."),
        ],
    },
    {
        "slug": "transmission-repair",
        "nav": "Transmission",
        "icon": "gears",
        "title": "Transmission Repair, Elk Grove CA",
        "h1": "Transmission Repair and Replacement in Elk Grove, CA",
        "meta": ("Transmission service, repair and replacement in Elk Grove, CA for automatic "
                 "and manual vehicles. Diagnosis first. Call (916) 686-5277."),
        "blurb": "Automatic and manual transmission diagnosis, service, repair and replacement.",
        "intro": [
            "Not every shifting complaint is a transmission rebuild. Low fluid, a failing solenoid, "
            "a bad sensor, a worn mount or an engine misfire can all feel identical from the "
            "driver's seat — and they are separated by thousands of dollars.",
            "So we diagnose before we quote. If it turns out you do need a replacement, we will "
            "tell you plainly and price it before anything comes apart."
        ],
        "includes": [
            "Transmission diagnosis with scan-tool and road-test verification",
            "Fluid and filter service to manufacturer specification",
            "Solenoid, sensor and valve-body related repairs",
            "Transmission replacement",
            "Clutch service for manual transmissions",
            "Axle, CV joint and driveline repair",
            "Transmission cooler and leak repair",
        ],
        "signs": [
            "Slipping — the engine revs but the vehicle does not accelerate",
            "Hard, delayed or clunking shifts",
            "The vehicle hesitates before engaging drive or reverse",
            "Red or brown fluid on the ground under the middle of the car",
            "A whine or hum that changes with road speed",
            "Check engine light with a transmission-related code",
        ],
        "faqs": [
            ("How often should transmission fluid be changed?",
             "It varies widely by vehicle and by how you use it — towing and heavy loads shorten "
             "the interval considerably. Tell us your vehicle and how you drive and we will give "
             "you the correct interval for it rather than a generic one."),
            ("Do I need a whole new transmission?",
             "Often, no. We diagnose the specific failure first. Plenty of transmission complaints "
             "turn out to be a sensor, a solenoid, fluid condition or even an engine misfire."),
            ("Do you replace transmissions?",
             "Yes. Transmission replacement is regular work here, and you will have the price "
             "before we begin."),
        ],
    },
    {
        "slug": "ac-repair",
        "nav": "AC & Heating",
        "icon": "snow",
        "title": "Car AC Repair in Elk Grove, CA",
        "h1": "Car Air Conditioning and Heating Repair in Elk Grove, CA",
        "meta": ("Auto AC repair in Elk Grove, CA. We find the leak instead of just recharging "
                 "it and sending you back into the heat. Call (916) 686-5277."),
        "blurb": "Air conditioning and heater diagnosis, leak detection and repair — before summer.",
        "intro": [
            "In a Sacramento Valley summer, air conditioning is not a luxury. And a system that is "
            "low on refrigerant is low for a reason: refrigerant is not consumed, it leaks. A "
            "recharge without finding the leak is a repair with an expiry date.",
            "We test the system, find where it is losing charge, and tell you what the actual "
            "repair costs. Same approach in winter — a heater complaint is usually a cooling "
            "system problem wearing a disguise."
        ],
        "includes": [
            "AC performance testing and full system diagnosis",
            "Refrigerant leak detection and repair",
            "Compressor, condenser and evaporator service",
            "Evacuate and recharge to manufacturer specification",
            "Blower motor, blend door and climate control faults",
            "Heater core and heating-system diagnosis",
            "Cabin air filter replacement",
        ],
        "signs": [
            "Air blows cool but never cold, especially sitting at a light",
            "AC works for a few weeks after a recharge, then fades again",
            "A musty or sour smell from the vents",
            "Loud clicking or squealing when the AC switches on",
            "The heater blows cold, or only warms up on the freeway",
            "Windows fog up and will not clear",
        ],
        "faqs": [
            ("Can you just top up the refrigerant?",
             "We can, but if the system is low then it is leaking, and you will be back. We would "
             "rather find the leak and tell you what it costs to fix properly."),
            ("How much does AC repair cost?",
             "It ranges from an inexpensive seal or hose to a compressor replacement. The "
             "diagnosis tells us which one you are facing, and you get the number before we start."),
            ("When is the best time to get AC looked at?",
             "Spring. Every shop in Elk Grove is busiest with AC the first week it hits triple "
             "digits — getting it checked before then is faster and usually cheaper."),
        ],
    },
    {
        "slug": "car-diagnostics",
        "nav": "Check Engine & Diagnostics",
        "icon": "gauge",
        "title": "Check Engine Light Diagnostics, Elk Grove",
        "h1": "Car Diagnostics in Elk Grove — Finding the Real Problem",
        "meta": ("Check engine light on? Computerized diagnostics in Elk Grove, CA. We find the "
                 "actual cause instead of guessing at parts. Call (916) 686-5277."),
        "blurb": "Warning lights, drivability faults and second opinions — tested, not assumed.",
        "intro": [
            "A trouble code tells you which circuit reported a problem. It does not tell you which "
            "part failed. That gap is why drivers end up paying for a sensor, a coil and a "
            "catalytic converter for one fault that turned out to be a vacuum leak.",
            "Our diagnostic process starts with the code, then verifies it with live data, testing "
            "and inspection until we can point at the actual failure — using up-to-date diagnostic "
            "equipment and technicians who know how to read it."
        ],
        "includes": [
            "Full OBD-II code scan with freeze-frame and live data review",
            "Drivability diagnosis — misfires, hesitation, stalling, rough idle",
            "Electrical and parasitic draw testing",
            "Emissions-related fault diagnosis and smog-failure follow-up",
            "Noise, vibration and harshness road-test diagnosis",
            "Second opinions on another shop's diagnosis or a dealer estimate",
            "A plain-language explanation of what failed and why",
        ],
        "signs": [
            "Check engine light — steady or flashing",
            "The car cranks longer than it used to, or stalls at idle",
            "Hesitation, surging or a loss of power under acceleration",
            "Fuel economy dropped noticeably with no change in your driving",
            "A burning, sweet or fuel smell you cannot place",
            "A parts-store code read gave you a number but no answer",
        ],
        "faqs": [
            ("A parts store read my code for free. Why pay for a diagnosis?",
             "A free code read gives you a number. A diagnosis tells you which component actually "
             "failed and why — so you replace one correct part instead of three likely ones."),
            ("Can I keep driving with the check engine light on?",
             "A flashing light means stop driving and call us: raw fuel can destroy a catalytic "
             "converter in minutes. A steady light usually means drive gently and get it looked at "
             "soon — small faults get expensive when they are ignored."),
            ("Another shop already replaced parts and it is still not fixed. Can you help?",
             "Yes, and it is a common reason people call. We start over from the symptom and test "
             "our way to the cause instead of inheriting the previous assumption."),
        ],
    },
    {
        "slug": "electrical-repair",
        "nav": "Electrical & Batteries",
        "icon": "bolt",
        "title": "Auto Electrical Repair, Elk Grove CA",
        "h1": "Auto Electrical Repair in Elk Grove, CA",
        "meta": ("Auto electrical diagnosis in Elk Grove, CA — batteries, alternators, starters, "
                 "no-start and parasitic draw testing. Call (916) 686-5277."),
        "blurb": "No-starts, dead batteries, alternators, starters and electrical gremlins traced properly.",
        "intro": [
            "Electrical faults are where guesswork gets expensive fastest. A no-start can be a "
            "battery, a cable, a starter, a relay, a security system or a bad ground — and every "
            "one of them looks identical from the driver's seat.",
            "We test the circuit instead of replacing parts in order of price. That is how you end "
            "up paying for the one component that actually failed."
        ],
        "includes": [
            "Battery, starter and alternator testing and replacement",
            "No-start and intermittent-start diagnosis",
            "Parasitic draw testing for batteries that die overnight",
            "Charging system and voltage drop testing",
            "Wiring, connector, ground and fuse repair",
            "Lighting, power window, door lock and accessory faults",
            "Warning lights traced to an electrical cause",
        ],
        "signs": [
            "The car is dead in the morning but fine after a jump",
            "Clicking when you turn the key, or a slow lazy crank",
            "Battery or charging warning light on the dash",
            "Headlights dim at idle and brighten when you rev",
            "Power windows, locks or accessories working intermittently",
            "You already replaced the battery and it happened again",
        ],
        "faqs": [
            ("My battery is new and the car died again. What now?",
             "That usually points at the charging system or a parasitic draw — something staying "
             "awake after you lock the car. Both are testable, and we test them."),
            ("How do I know if it is the battery or the alternator?",
             "Both leave you stranded and the symptoms overlap. A proper test of the battery, "
             "starter draw and charging output tells you in minutes which one it is."),
            ("Do you fix wiring problems, not just replace parts?",
             "Yes. Wiring, grounds, connectors and fuses are traced and repaired — that is often "
             "the actual fault behind a part that keeps failing."),
        ],
    },
    {
        "slug": "suspension-steering",
        "nav": "Shocks, Struts & Suspension",
        "icon": "spring",
        "title": "Shocks, Struts & Suspension, Elk Grove CA",
        "h1": "Suspension and Steering Repair in Elk Grove, CA",
        "meta": ("Shocks, struts, ball joints and steering repair in Elk Grove, CA. We diagnose "
                 "the clunk, pull or wander properly. Call (916) 686-5277."),
        "blurb": "Shocks, struts, ball joints, bushings and steering — for a car that tracks straight again.",
        "intro": [
            "Worn suspension rarely announces itself. It shows up as a car that wanders on the "
            "freeway, a clunk over a railroad crossing, or tires that wore out thousands of miles "
            "early — and it quietly increases how far you need to stop.",
            "We inspect the whole corner rather than replacing the part that is easiest to reach, "
            "then show you what is actually worn and what it is costing you in tires and stopping "
            "distance."
        ],
        "includes": [
            "Shock and strut inspection and replacement",
            "Ball joint, tie rod and control arm service",
            "Bushing, sway bar and link replacement",
            "Steering rack, pump and linkage diagnosis",
            "Wheel bearing and hub service",
            "Alignment-related wear diagnosis",
        ],
        "signs": [
            "A clunk or rattle over bumps and dips",
            "The vehicle wanders, or you are always correcting the wheel",
            "It pulls to one side on a flat road",
            "The front end dives hard when braking, or the ride feels floaty",
            "Uneven or cupped tire wear",
            "Steering feels loose, heavy or notchy",
        ],
        "faqs": [
            ("How do I know if my struts are worn?",
             "Bounce, nose dive under braking, cupped tire wear and a floaty feel at speed are the "
             "common signs. A proper inspection confirms it in minutes."),
            ("Do I need an alignment after suspension work?",
             "Usually yes — replacing steering or suspension components changes the geometry, and "
             "skipping alignment will chew up your new tires. We will tell you when it is needed."),
            ("Is a clunk urgent?",
             "It depends entirely on which component is loose. Some are noise; some are safety "
             "items. Call us and we will look at it rather than guess over the phone."),
        ],
    },
    {
        "slug": "timing-belts",
        "nav": "Timing Belts",
        "icon": "belt",
        "title": "Timing Belt Replacement, Elk Grove CA",
        "h1": "Timing Belt Replacement in Elk Grove, CA",
        "meta": ("Timing belt and timing chain service in Elk Grove, CA — done with the water "
                 "pump and tensioners so you pay the labor once. Call (916) 686-5277."),
        "blurb": "Timing belts and chains, done with the parts that should be replaced at the same time.",
        "intro": [
            "A timing belt is the cheapest expensive job on your car. Replaced on schedule it is a "
            "planned maintenance item. Snapped on an interference engine, it can bend valves and "
            "turn into an engine rebuild in a single second.",
            "Timing belts are listed work at this shop and have been for years. We do them with "
            "the water pump, tensioner and idlers where the design calls for it — because those "
            "parts sit behind the same cover, and doing them separately means paying that labor "
            "twice."
        ],
        "includes": [
            "Timing belt replacement to manufacturer interval",
            "Water pump, tensioner and idler pulley replacement at the same time",
            "Timing chain, guide and tensioner service",
            "Cam and crank seal replacement while access is open",
            "Drive belt, pulley and accessory inspection",
            "Timing-related fault diagnosis after a no-start",
        ],
        "signs": [
            "You are at or past the mileage in the maintenance schedule",
            "You bought the car used with no record of the belt being done",
            "A rattle, slap or whine from the front of the engine",
            "The engine cranks but will not start",
            "Rough running or a timing-related trouble code",
            "Coolant seeping from behind the timing cover",
        ],
        "faqs": [
            ("When does a timing belt need replacing?",
             "It is a mileage-based service and the interval is set by your manufacturer — it "
             "varies a lot between vehicles. Tell us your year, make and model and we will look up "
             "the interval that applies to yours."),
            ("Should the water pump be replaced at the same time?",
             "On most belt-driven engines, yes. The pump sits behind the same cover, so replacing "
             "it later means paying for the same labor a second time."),
            ("Does my car have a belt or a chain?",
             "It depends on the engine, and some vehicles use both. Call %s with your year, make "
             "and model and we will tell you which one you have and whether it is a service item."
             % PHONE),
        ],
    },
    {
        "slug": "fuel-injection",
        "nav": "Fuel Injection & Tune-Ups",
        "icon": "fuel",
        "title": "Fuel Injection Service & Tune-Ups, Elk Grove",
        "h1": "Fuel Injection Service and Tune-Ups in Elk Grove, CA",
        "meta": ("Fuel injection service and tune-ups in Elk Grove, CA — rough idle, hesitation "
                 "and poor fuel economy diagnosed properly. Call (916) 686-5277."),
        "blurb": "Fuel system service and tune-ups for rough idle, hesitation and lost fuel economy.",
        "intro": [
            "A modern tune-up is not a set of points and a timing light. It is spark, fuel, air "
            "and the sensors that meter them — and the reason to do one is a symptom or a service "
            "interval, not a season.",
            "If your car hesitates, idles rough or is drinking more fuel than it used to, we test "
            "the fuel system rather than selling a generic package. Sometimes the answer is a "
            "cleaning service. Sometimes it is one failed injector or a leaking intake gasket."
        ],
        "includes": [
            "Fuel injection service and injector cleaning",
            "Injector testing and replacement",
            "Fuel pump, filter and pressure testing",
            "Spark plug, coil and ignition system service",
            "Air and fuel filter replacement",
            "Sensor diagnosis — oxygen, mass airflow and related faults",
            "Scheduled tune-up service to manufacturer specification",
        ],
        "signs": [
            "Rough idle, or an idle that hunts up and down",
            "Hesitation or a stumble when you accelerate",
            "Fuel economy has dropped with no change in your driving",
            "Hard starting, especially when the engine is warm",
            "A misfire code or a flashing check engine light",
            "The engine surges at a steady freeway speed",
        ],
        "faqs": [
            ("Do I still need tune-ups on a modern car?",
             "Modern intervals are much longer, but spark plugs, filters and fuel system service "
             "are still maintenance items. We go by your manufacturer's schedule and by what the "
             "vehicle is actually doing."),
            ("Will a fuel injection service fix my rough idle?",
             "Sometimes. It also might be a vacuum leak, an ignition fault, a failed sensor or one "
             "bad injector. We diagnose it first so you are not paying for a service that was "
             "never going to help."),
            ("My car failed smog. Can you help?",
             "Yes — emissions-related fault diagnosis and repair is regular work here. Bring the "
             "failure report with you, it tells us where to start."),
        ],
    },
    {
        "slug": "belts-and-hoses",
        "nav": "Belts, Hoses & Cooling",
        "icon": "gears",
        "title": "Belts, Hoses & Cooling System, Elk Grove",
        "h1": "Belts, Hoses and Cooling System Service in Elk Grove, CA",
        "meta": ("Belt, hose, radiator and cooling system service in Elk Grove, CA. The cheapest "
                 "way to avoid an overheated engine. Call (916) 686-5277."),
        "blurb": "Belts, hoses, radiators, water pumps and thermostats — checked before summer, not after.",
        "intro": [
            "Belts and hoses are the least glamorous parts on the car and among the most "
            "consequential. A ten-dollar hose that lets go on Highway 99 in July can cost you a "
            "head gasket before you reach the shoulder.",
            "Valley heat is hard on rubber. We inspect belts and hoses as a matter of course, and "
            "we will tell you honestly whether something is worn, aging or still fine — with the "
            "reasoning, so it is your call."
        ],
        "includes": [
            "Serpentine and accessory drive belt replacement",
            "Radiator, heater and coolant hose replacement",
            "Tensioner, idler and pulley service",
            "Radiator, water pump and thermostat replacement",
            "Cooling system pressure testing and leak detection",
            "Coolant flush and refill to specification",
            "Overheating diagnosis, including fans and fan clutches",
        ],
        "signs": [
            "Squealing or chirping from the engine bay, especially on startup",
            "Temperature gauge climbing in traffic or on a hot day",
            "Sweet smell, or green, orange or pink puddles under the car",
            "Coolant level that keeps dropping with no visible leak",
            "Visible cracks, glazing or missing ribs on a belt",
            "The heater blows cold when the engine is warm",
        ],
        "faqs": [
            ("How often should belts and hoses be replaced?",
             "There is no single number — it depends on the material, the vehicle and how hot it "
             "gets where you drive. We inspect condition rather than going by age alone, and we "
             "show you what we found."),
            ("My car is overheating. Is that a hose?",
             "It might be a hose, a thermostat, a water pump, a radiator, a fan or a head gasket. "
             "Stop driving it — overheating is what turns a small repair into a large one — and "
             "call %s." % PHONE),
            ("Do you flush cooling systems?",
             "Yes, to the coolant type and interval your vehicle calls for. Mixing the wrong "
             "coolant causes its own problems, so we use what the manufacturer specifies."),
        ],
    },
    {
        "slug": "oil-change-maintenance",
        "nav": "Oil Change & Maintenance",
        "icon": "drop",
        "title": "Oil Change & Car Maintenance, Elk Grove CA",
        "h1": "Oil Changes and Scheduled Maintenance in Elk Grove, CA",
        "meta": ("Oil changes and factory-scheduled maintenance in Elk Grove, CA — with a real "
                 "inspection and no upsell games. Call (916) 686-5277."),
        "blurb": "Oil, filters, fluids and factory-scheduled service — with a real inspection attached.",
        "intro": [
            "An oil change is the cheapest chance anyone gets to catch an expensive problem early. "
            "We use it that way: the oil and filter get done properly, and the vehicle actually "
            "gets looked over while it is on the lift.",
            "If we find something, we will show you and tell you whether it is urgent, worth "
            "watching or fine for now. What you will not get is a color-coded list of services "
            "you did not need."
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
            "You are past the interval on the sticker and unsure what is due",
            "You just bought a used car and want a baseline service",
            "You want one shop keeping records instead of five quick-lube receipts",
            "You are about to drive somewhere far and want it checked first",
        ],
        "faqs": [
            ("How often should I change my oil?",
             "Follow your manufacturer's interval and adjust for how you actually drive — short "
             "trips, valley heat and dust all shorten it. Tell us your vehicle and your driving "
             "and we will give you a straight answer for your car."),
            ("Do you use synthetic oil?",
             "Yes — conventional, blend and full synthetic. We use what your engine calls for and "
             "will explain the difference if you are deciding."),
            ("Will you try to sell me extra services?",
             "No. We tell you what we found and what is urgent. What gets done is your call."),
        ],
    },
    {
        "slug": "wheel-balancing",
        "nav": "Wheel Balance & Tires",
        "icon": "tire",
        "title": "Wheel Balancing & Tire Service, Elk Grove",
        "h1": "Wheel Balancing and Tire Service in Elk Grove, CA",
        "meta": ("Wheel balancing, rotation and tire service in Elk Grove, CA. We find the cause "
                 "of the vibration, not just the symptom. Call (916) 686-5277."),
        "blurb": "Wheel balancing, rotation and tire care — plus the wear diagnosis behind it.",
        "intro": [
            "A vibration at freeway speed is usually a balance problem. Usually — but not always. "
            "It can also be a bent wheel, a separated tire, a worn hub bearing or a suspension "
            "component that is letting the wheel move where it should not.",
            "So we balance the wheels and then look at why they went out. Tires are the only part "
            "of the car that touches the road, and the wear pattern on them is one of the most "
            "honest diagnostic reports you can read."
        ],
        "includes": [
            "Wheel balancing, front, rear or all four",
            "Tire rotation on schedule",
            "Tread depth and wear-pattern inspection",
            "Vibration diagnosis — wheels, tires, hubs and driveline",
            "Wear diagnosis, identifying the suspension or alignment cause",
            "Valve stems, pressure setting and load-appropriate inflation",
        ],
        "signs": [
            "Vibration in the steering wheel or seat at freeway speed",
            "Uneven wear — one edge, the center, or scalloped patches",
            "A tire that keeps going low",
            "The vehicle pulls to one side on a flat road",
            "A hum or roar that changes with road speed",
            "It has been a long time since the tires were rotated",
        ],
        "faqs": [
            ("How often should tires be rotated and balanced?",
             "Most vehicles do well rotated at every oil change. Balancing is worth checking "
             "whenever a vibration appears or a tire is removed. We check wear patterns each time "
             "so the rotation is actually solving something."),
            ("My car still vibrates after a balance somewhere else. Why?",
             "Because balancing fixes an imbalance, and not every vibration is one. A bent wheel, "
             "a tire with a separated belt, a worn hub bearing or a suspension fault will all "
             "survive a perfect balance. We look for those."),
            ("Can uneven tire wear be fixed?",
             "The wear cannot be undone, but the cause can be. Uneven wear is a symptom — usually "
             "alignment, suspension wear or long-term underinflation — and worth fixing before you "
             "buy the next set."),
        ],
    },
]

SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}


# ==========================================================================
# Reviews
#
# RULE: verbatim text, attributed to the person and the platform it was left
# on. Nothing here is written by us. Do not add an entry you cannot point at.
#
# To add a review: copy the text exactly as the customer wrote it, put their
# display name in "name", the platform in "source", and re-run build.py.
# ==========================================================================
REVIEWS = [
    {
        "quote": "They are super friendly and fast and the best price I found !",
        "name": "Google reviewer",   # CONFIRM: add the reviewer's first name from the profile
        "source": "Google",
        "url": MAPS_LISTING,
    },
]

# What the shop is known for, stated as description rather than as quotes we
# do not have. Each line is drawn from the shop's own published material.
REVIEW_THEMES = [
    ("family", "Family owned since 2001",
     "The same family business Elk Grove drivers have been coming to for more than two decades."),
    ("badge", "ASE certified technicians",
     "Tested and certified by the National Institute for Automotive Service Excellence."),
    ("shield", "NAPA AutoCare warranty",
     "Qualifying repairs carry 24 months / 24,000 miles on parts and labor, honored nationwide."),
]


# ==========================================================================
# Layout
# ==========================================================================
NAV = [
    ("Services", "/services/"),
    ("About", "/about/"),
    ("Reviews", "/reviews/"),
    ("Advice", "/advice/"),
    ("Areas", "/service-areas/"),
    ("Contact", "/contact/"),
]

ES_NAV = [
    ("Servicios", "#servicios"),
    ("Por qué nosotros", "#por-que"),
    ("El taller", "#taller"),
    ("Cotización", "#cotizacion"),
    ("English", "/"),
]

PAGES = []  # (url_path, priority, changefreq) collected for sitemap.xml


def tel_btn(cls="btn btn-accent", loc="page", label=None):
    label = label or "Call %s" % SITE["phone_display"]
    return ('<a class="%s" href="tel:%s" data-loc="%s">%s<span>%s</span></a>'
            % (cls, SITE["phone_link"], loc, icon("phone"), esc(label)))


# ==========================================================================
# Structured data
# ==========================================================================
def business_schema():
    """AutoRepair, the correct LocalBusiness subtype for this shop.

    aggregateRating is deliberately absent: Google's guidelines disallow
    self-serving review markup, and publishing it risks the whole rich
    result. The rating is shown on-page with a link to its source instead."""
    hours = ",".join(
        '{"@type":"OpeningHoursSpecification","dayOfWeek":[%s],"opens":"%s","closes":"%s"}'
        % (",".join('"%s"' % d for d in h["days"]), h["opens"], h["closes"])
        for h in SITE["hours_schema"]
    )
    areas = ",".join(
        '{"@type":"City","name":%s,"address":{"@type":"PostalAddress","addressRegion":"CA","addressCountry":"US"}}'
        % jstr(a) for a in SITE["areas"]
    )
    services = ",".join(
        '{"@type":"Offer","itemOffered":{"@type":"Service","name":%s,"url":"%s/services/%s/"}}'
        % (jstr(s["nav"]), SITE["base_url"], s["slug"])
        for s in SERVICES
    )
    return (
        '{"@context":"https://schema.org","@type":"AutoRepair",'
        '"@id":"%(base)s/#business",'
        '"name":%(name)s,'
        '"alternateName":"Automotive Solutions",'
        '"url":"%(base)s/",'
        '"telephone":"%(phone)s",'
        '%(email)s'
        '"image":"%(base)s/assets/img/og-cover.png",'
        '"logo":"%(base)s/assets/img/logo.png",'
        '"priceRange":"$$",'
        '"foundingDate":"%(founded)s",'
        '"description":%(desc)s,'
        '"address":{"@type":"PostalAddress","streetAddress":%(street)s,"addressLocality":%(city)s,'
        '"addressRegion":"%(region)s","postalCode":"%(zip)s","addressCountry":"US"},'
        '"geo":{"@type":"GeoCoordinates","latitude":%(lat)s,"longitude":%(lng)s},'
        '"sameAs":[%(profiles)s],'
        '"hasMap":"%(map)s",'
        '"openingHoursSpecification":[%(hours)s],'
        '"areaServed":[%(areas)s],'
        '"currenciesAccepted":"USD",'
        '"knowsLanguage":["en","es"],'
        '"hasOfferCatalog":{"@type":"OfferCatalog","name":"Auto repair and maintenance services",'
        '"itemListElement":[%(services)s]}}'
        % {"base": SITE["base_url"], "name": jstr(SITE["name"]), "phone": SITE["phone_link"],
           "email": "" if EMAIL_IS_PLACEHOLDER else '"email":%s,' % jstr(SITE["email"]),
           "street": jstr(SITE["street"]), "city": jstr(SITE["city"]),
           "region": SITE["region"], "zip": SITE["zip"], "lat": SITE["lat"], "lng": SITE["lng"],
           "founded": SITE["founded_year"], "map": MAPS_LISTING, "hours": hours, "areas": areas,
           "services": services,
           "desc": jstr("Family owned auto repair shop in Elk Grove, California, serving drivers "
                        "since 2001. ASE certified technicians and a NAPA AutoCare Center, "
                        "providing repair, service and maintenance on all makes and models of "
                        "domestic and import vehicles."),
           "profiles": ",".join(jstr(u) for u in PROFILES)}
    )


def website_schema():
    return ('{"@context":"https://schema.org","@type":"WebSite","name":%s,"url":"%s/",'
            '"inLanguage":"en-US","publisher":{"@id":"%s/#business"}}'
            % (jstr(SITE["name"]), SITE["base_url"], SITE["base_url"]))


def service_schema(s):
    return ('{"@context":"https://schema.org","@type":"Service","name":%s,"serviceType":%s,'
            '"description":%s,"url":"%s/services/%s/",'
            '"provider":{"@id":"%s/#business"},'
            '"areaServed":[%s]}'
            % (jstr(s["h1"]), jstr(s["nav"]), jstr(s["meta"]), SITE["base_url"], s["slug"],
               SITE["base_url"],
               ",".join('{"@type":"City","name":%s}' % jstr(a) for a in SITE["areas"])))


def breadcrumb_schema(trail):
    items = ",".join(
        '{"@type":"ListItem","position":%d,"name":%s,"item":"%s%s"}'
        % (i + 1, jstr(n), SITE["base_url"], u)
        for i, (n, u) in enumerate(trail)
    )
    return '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[%s]}' % items


def faq_schema(faqs):
    items = ",".join(
        '{"@type":"Question","name":%s,"acceptedAnswer":{"@type":"Answer","text":%s}}'
        % (jstr(q), jstr(a)) for q, a in faqs
    )
    return '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[%s]}' % items


def guide_schema(g, path):
    today = date.today().isoformat()
    return ('{"@context":"https://schema.org","@type":"Article","headline":%s,'
            '"description":%s,"inLanguage":"en-US",'
            '"datePublished":"%s","dateModified":"%s",'
            '"author":{"@id":"%s/#business"},"publisher":{"@id":"%s/#business"},'
            '"mainEntityOfPage":{"@type":"WebPage","@id":"%s%s"}}'
            % (jstr(g["title"]), jstr(g["meta"]), today, today,
               SITE["base_url"], SITE["base_url"], SITE["base_url"], path))


# ==========================================================================
# Chrome: brand lockup, header, footer, page shell
# ==========================================================================
def crumbs_html(trail):
    lis = []
    for i, (name, url) in enumerate(trail):
        if i == len(trail) - 1:
            lis.append('<li aria-current="page">%s</li>' % esc(name))
        else:
            lis.append('<li><a href="%s">%s</a></li>' % (url, esc(name)))
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>%s</ol></nav>' % "".join(lis)


def brand(on_dark=False):
    """Logo lockup. The supplied logo is a full wordmark on a white ground,
    so on dark backgrounds it sits on a white chip rather than disappearing."""
    logo = SITE.get("logo")
    if not logo:
        return ('<a class="brand" href="/"><span class="brand-mark" aria-hidden="true">AS</span>'
                '<span class="brand-text"><span class="brand-name">%s</span>'
                '<span class="brand-sub">Elk Grove, California</span></span></a>'
                % esc(SITE["short"]))
    src = (SITE.get("logo_dark_bg") or logo) if on_dark else logo
    chip = on_dark and not SITE.get("logo_dark_bg")
    if SITE.get("logo_lockup") == "full":
        return ('<a class="brand" href="/">'
                '<img class="brand-logo%s" src="%s" alt="%s" width="648" height="223">'
                '</a>' % (" brand-logo--chip" if chip else "", src, esc(SITE["name"])))
    return ('<a class="brand" href="/">'
            '<img class="brand-badge%s" src="%s" alt="" width="46" height="46">'
            '<span class="brand-text"><span class="brand-name">%s</span>'
            '<span class="brand-sub">Elk Grove, California</span></span></a>'
            % (" brand-badge--chip" if chip else "", src, esc(SITE["short"])))


def header_html(active=None, es=False):
    links = []
    for label, url in (ES_NAV if es else NAV):
        cur = ' aria-current="page"' if active == url else ""
        links.append('<a href="%s"%s>%s</a>' % (url, cur, esc(label)))
    hours_label = "Lunes a viernes, 9:00 AM – 6:00 PM" if es else SITE["hours_short"]
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
</header>""" % {"brand": brand(), "pin": icon("pin"), "clock": icon("clock"),
                "addr": esc(FULL_ADDRESS), "tel": SITE["phone_link"],
                "phone": SITE["phone_display"], "links": "".join(links), "menu": ICONS["menu"],
                "hours_label": esc(hours_label), "cta_label": cta_label,
                "call_label": call_label, "cta_href": cta_href}


def footer_html(es=False):
    svc = "".join('<li><a href="/services/%s/">%s</a></li>' % (s["slug"], esc(s["nav"]))
                  for s in SERVICES)
    if es:
        t = {"blurb": ("Taller familiar de reparación de autos en Elk Grove desde 2001. Técnicos "
                       "certificados ASE y centro NAPA AutoCare, para autos nacionales e importados."),
             "services": "Servicios", "shop": "El taller", "visit": "Visítenos o llame",
             "call": "Llame al taller", "callbar": ("Llamar", "Cómo llegar", "Cotización"),
             "rights": "Todos los derechos reservados.", "privacy": "Privacidad",
             "tagline": "Taller mecánico en Elk Grove, CA"}
        shop_links = [("Inicio (English)", "/"), ("Servicios", "/services/"),
                      ("El taller", "/about/"), ("Reseñas", "/reviews/"),
                      ("Zonas que servimos", "/service-areas/"), ("Contacto", "/contact/")]
    else:
        t = {"blurb": ("Family owned auto repair in Elk Grove since 2001. ASE certified "
                       "technicians and a NAPA AutoCare Center, serving all makes and models of "
                       "domestic and import vehicles."),
             "services": "Services", "shop": "Shop", "visit": "Visit or Call",
             "call": "Call the shop", "callbar": ("Call", "Directions", "Get a Quote"),
             "rights": "All rights reserved.", "privacy": "Privacy",
             "tagline": "Auto repair in Elk Grove, CA"}
        shop_links = [("Home", "/"), ("All Services", "/services/"), ("About the Shop", "/about/"),
                      ("Reviews", "/reviews/"), ("Service Areas", "/service-areas/"),
                      ("Contact &amp; Directions", "/contact/"), ("Advice &amp; Guides", "/advice/")]
    shop_html = "".join('<li><a href="%s">%s</a></li>' % (u, n) for n, u in shop_links)
    shop_html += '<li><a href="/es/" hreflang="es" lang="es">Español</a></li>'

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
        <ul>%(shop_html)s</ul>
      </div>
      <div>
        <h4>%(visit)s</h4>
        <ul>
          <li><a href="%(map)s" rel="noopener" data-loc="footer-map">%(street)s<br>%(city)s, %(region)s %(zip)s</a></li>
          <li><a href="tel:%(tel)s" data-loc="footer">%(phone)s</a></li>
          <li>%(hours)s</li>
          <li>Saturday &amp; Sunday: closed</li>
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
  <a href="%(mapdir)s" rel="noopener" data-loc="callbar">%(micon)s<span>%(cb2)s</span></a>
  <a href="%(cta_href)s">%(cicon)s<span>%(cb3)s</span></a>
</div>""" % {"brand": brand(on_dark=True), "svc": svc, "shop_html": shop_html,
             "map": MAPS_LISTING, "mapdir": MAPS_DIRECTIONS, "street": esc(SITE["street"]),
             "city": SITE["city"], "region": SITE["region"], "zip": SITE["zip"],
             "tel": SITE["phone_link"], "phone": SITE["phone_display"],
             "hours": esc(SITE["hours_human"]), "name": esc(SITE["name"]),
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
    og_locale = "es_US" if lang == "es" else "en_US"
    doc = """<!DOCTYPE html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
%(robots)s<meta name="theme-color" content="#060a2e">
<meta property="og:type" content="website">
<meta property="og:site_name" content="%(name)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(base)s/assets/img/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Automotive Solutions by Single - family owned auto repair in Elk Grove, California">
<meta property="og:locale" content="%(og_locale)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(base)s/assets/img/og-cover.png">
<meta name="geo.region" content="US-CA">
<meta name="geo.placename" content="Elk Grove, California">
<meta name="geo.position" content="%(lat)s;%(lng)s">
<meta name="ICBM" content="%(lat)s, %(lng)s">
<link rel="icon" href="%(favicon)s" type="%(favicon_type)s">
<link rel="apple-touch-icon" href="/assets/img/logo.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/assets/css/site.css">%(alts)s%(schema)s
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
%(header)s
<main id="main">
%(body)s
</main>
%(footer)s
<script src="/assets/js/site.js" defer></script>
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
       "lang": lang, "alts": alt_links, "og_locale": og_locale}

    if RELATIVE:
        # Root-relative links only resolve at the root of a domain. Rewriting
        # them to relative paths lets the same folder work in a subdirectory,
        # on a staging URL, or opened straight from the zip.
        depth = 0 if path == "/" else path.strip("/").count("/") + 1
        prefix = "./" if depth == 0 else "../" * depth
        doc = re.sub(r'(href|src)="/(?!/)', r'\1="%s' % prefix, doc)

    rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
    dest = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(doc)
    return dest


# ==========================================================================
# Reusable content blocks
# ==========================================================================
def quote_form(form_id="quote", heading="Get a free quote", sub=None, service_default=None):
    sub = sub or ("Tell us what is going on and we will get back to you with next steps. "
                  "Need an answer now? Call %s." % SITE["phone_display"])
    opts = ['<option value="">What do you need?</option>']
    for s in SERVICES:
        sel = " selected" if service_default == s["slug"] else ""
        opts.append('<option value="%s"%s>%s</option>' % (esc(s["nav"]), sel, esc(s["nav"])))
    opts.append('<option value="Not sure - please diagnose">Not sure — please diagnose</option>')
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
    <input id="%(id)s-vehicle" name="vehicle" type="text" placeholder="2015 Honda Accord">
  </div>
  <div class="field">
    <label for="%(id)s-service">Service needed</label>
    <select id="%(id)s-service" name="service">%(opts)s</select>
  </div>
  <div class="field">
    <label for="%(id)s-when">When could you bring it in?</label>
    <select id="%(id)s-when" name="when">
      <option value="">Whenever you have room</option>
      <option>Today if possible - it is not drivable</option>
      <option>This week</option>
      <option>Next week</option>
      <option>Just want an estimate for now</option>
    </select>
  </div>
  <div class="field">
    <label for="%(id)s-message">What is it doing?</label>
    <textarea id="%(id)s-message" name="message" placeholder="Noises, warning lights, when it started, and anything another shop has already told you."></textarea>
  </div>
  <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
  <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
  <input type="hidden" name="_subject" value="Quote request from automotivesolutionsbysingle.com">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_captcha" value="false">
  <button class="btn btn-accent" type="submit" style="width:100%%">Request my quote</button>
  <p class="form-status" role="status" aria-live="polite"></p>
  <p class="form-note">No obligation. We will never sell your information. Prefer to talk it through?
    <a href="tel:%(tel)s" data-loc="form-note">Call %(phone)s</a>.</p>
</form>""" % {"id": form_id, "action": FORM_ENDPOINT, "email": SITE["email"],
              "heading": esc(heading), "sub": esc(sub), "opts": "".join(opts),
              "tel": SITE["phone_link"], "phone": SITE["phone_display"]}


def cta_band(heading="Ready for a straight answer about your vehicle?", text=None, section=True):
    text = text or ("Call the shop and talk to someone who works on cars for a living. "
                    "We are open Monday through Friday, 9:00 AM to 6:00 PM.")
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
    """Card that deliberately overlaps the section edge above it, lifting the
    four strongest trust signals into the eye-line of someone deciding."""
    if es:
        stats = [
            ("star", "%s de 5" % SITE["rating"], "%s reseñas en Google" % SITE["review_count"]),
            ("family", "Familia desde 2001", "Negocio familiar en Elk Grove"),
            ("badge", "Técnicos ASE", "Certificados por el instituto ASE"),
            ("shield", "Garantía NAPA", "24 meses / 24,000 millas, a nivel nacional"),
        ]
    else:
        stats = [
            ("star", "%s out of 5" % SITE["rating"], "%s Google reviews" % SITE["review_count"]),
            ("family", "Family owned since 2001", "The same shop, the same people"),
            ("badge", "ASE certified technicians", "Tested and certified, not self-declared"),
            ("shield", "NAPA AutoCare warranty", "24 months / 24,000 miles, nationwide"),
        ]
    cells = "".join(
        '<div class="stat"><span class="stat-ico">%s</span><div><b>%s</b><span>%s</span></div></div>'
        % (icon(ic), esc(t), esc(sub)) for ic, t, sub in stats
    )
    return ('<div class="statband"><div class="wrap"><div class="statband-inner">%s</div></div></div>'
            % cells)


def listed_on():
    sources = [("Google", MAPS_LISTING), ("Yelp", YELP_URL), ("NAPA AutoCare", NAPA_URL),
               ("BBB", BBB_URL),
               ("Nextdoor", "https://nextdoor.com/pages/automotive-solutions-by-single-elk-grove-ca/")]
    items = "".join('<a class="src" href="%s" rel="noopener">%s</a>' % (u, esc(n))
                    for n, u in sources)
    return ('<div class="listed"><div class="wrap">'
            '<span class="label">Listed &amp; reviewed on</span>%s</div></div>' % items)


def angle_divider(fill="#ffffff"):
    """Slanted transition out of a dark block into the section below."""
    return ('<div class="angle-bottom" aria-hidden="true">'
            '<svg viewBox="0 0 1440 80" preserveAspectRatio="none">'
            '<path d="M0 80 1440 0v80z" fill="%s"/></svg></div>' % fill)


def photo_slot(caption, badge="Inside the shop", alt=None):
    """Styled frame that ships with the hand-drawn SVG so the page looks
    finished on day one. The caption sits under the image, never over it."""
    alt = alt or ("Illustration of a car raised on a two-post lift inside a service bay, with a "
                  "technician inspecting the underside")
    return """<!-- PHOTO SLOT — swap in a real photo of the shop.
     Put the file in assets/img/ (e.g. assets/img/shop-front.jpg), then replace
     the <img> line below with:
       <img src="/assets/img/shop-front.jpg" alt="Describe what is in the photo"
            width="1200" height="750" loading="lazy">
     Aim for roughly 16:10 and at least 1200px wide. Leave the <figure>,
     the badge and the <figcaption> exactly as they are. -->
<figure class="photo">
  <span class="photo-badge">%s%s</span>
  <img src="/assets/img/shop-scene.svg" width="720" height="450" alt="%s">
  <figcaption>%s</figcaption>
</figure>""" % (icon("camera"), esc(badge), esc(alt), esc(caption))


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


def review_cards():
    cards = []
    for r in REVIEWS:
        cite = '<cite><strong>%s</strong>via %s</cite>' % (esc(r["name"]), esc(r["source"]))
        cards.append('<div class="review">%s<blockquote>&ldquo;%s&rdquo;</blockquote>%s</div>'
                     % (stars(), esc(r["quote"]), cite))
    for ic, title, text in REVIEW_THEMES:
        cards.append('<div class="review review--theme"><span class="card-ico">%s</span>'
                     '<h3>%s</h3><p style="color:var(--slate);font-size:.96rem;margin-bottom:0">%s</p></div>'
                     % (icon(ic), esc(title), esc(text)))
    return "".join(cards)


def rating_line(light=False):
    cls = "rating rating--light" if light else "rating"
    return ('<div class="%s">%s<span class="rating-text"><strong>%s out of 5</strong> from %s '
            '<a href="%s" rel="noopener" data-loc="rating">Google reviews</a></span></div>'
            % (cls, stars(), SITE["rating"], SITE["review_count"], MAPS_LISTING))


# ==========================================================================
# Pages
# ==========================================================================
HOME_FAQS = [
    ("Where is Automotive Solutions located?",
     "We are at 9253 Elk Grove Blvd, Elk Grove, CA 95624, in Old Town Elk Grove just east of "
     "Highway 99. Call (916) 686-5277 for directions or to check the schedule."),
    ("What are your hours?",
     "We are open Monday through Friday, 9:00 AM to 6:00 PM, and closed Saturday and Sunday."),
    ("How long have you been in business?",
     "Automotive Solutions has been serving Elk Grove drivers since 2001 as a family owned and "
     "operated shop."),
    ("Are your technicians certified?",
     "Yes. Our technicians are ASE certified — tested and certified by the National Institute for "
     "Automotive Service Excellence — and we are a NAPA AutoCare Center."),
    ("Is there a warranty on your work?",
     "Qualifying repairs at a NAPA AutoCare Center are covered by the NAPA Peace of Mind Warranty: "
     "24 months or 24,000 miles on parts and labor, honored at NAPA AutoCare Centers nationwide. "
     "Ask us to confirm the coverage that applies to your repair before we start."),
    ("Do you work on import vehicles?",
     "Yes. We provide repair, service and maintenance on all makes and models of domestic and "
     "import vehicles."),
    ("Will servicing my car here void the factory warranty?",
     "No. Under the federal Magnuson-Moss Warranty Act, a manufacturer cannot void your warranty "
     "simply because an independent shop did the maintenance — as long as the work is done "
     "correctly and to specification. Keep your receipts and you are covered."),
    ("Do you charge for a diagnosis?",
     "Diagnostic time is real work — testing and verifying rather than swapping parts and hoping. "
     "Call us and we will tell you what the diagnosis costs and what it covers before you come in."),
    ("What areas do you serve?",
     "Elk Grove first, plus Laguna, Sacramento, Wilton, Galt, Florin, Vineyard, Sheldon, Franklin "
     "and the surrounding south Sacramento County area."),
]


def build_home():
    body = f"""<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Family owned since 2001 · Elk Grove, California</span>
        <h1>Honest auto repair in <em>Elk Grove, California</em></h1>
        {rating_line()}
        <p>The same family shop Elk Grove has trusted for more than twenty years. ASE certified
        technicians, a NAPA AutoCare warranty that travels with you, and a straight answer about
        what your car actually needs — before any work starts.</p>
        <div class="btn-row">
          {tel_btn("btn btn-accent", "hero")}
          <a class="btn btn-ghost" href="#quote-form">Get a free quote</a>
        </div>
        <ul class="hero-points">
          <li>{icon("check-circle")}<span>All makes and models — domestic and import</span></li>
          <li>{icon("check-circle")}<span>ASE certified technicians and current diagnostic equipment</span></li>
          <li>{icon("check-circle")}<span>NAPA AutoCare: 24 months / 24,000 miles, honored nationwide</span></li>
          <li>{icon("check-circle")}<span>Open Monday through Friday, 9:00 AM – 6:00 PM</span></li>
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
      <h2>Complete auto services, under one roof</h2>
      <p>Engines, transmissions, brakes and air conditioning through to timing belts, wheel
      balancing and an oil change — with the same approach on every one of them: find out what is
      actually wrong, then quote it.</p>
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
        <h2>The auto mall isn't your only option</h2>
        <p>Elk Grove has one of the largest dealership clusters in the region, and a dealership
        service department is built around volume and menu pricing. That works fine until your
        problem does not fit the menu — and then you are paying for parts that were replaced
        because they were on a list, not because they failed.</p>
        <p>{esc(SITE["promise"])} {esc(SITE["warranty_text"])}</p>
        <ul class="checklist">
          <li>{icon("check")}<span><strong>You talk to the people who saw your vehicle</strong> — not a service writer relaying a summary.</span></li>
          <li>{icon("check")}<span><strong>We test before we replace</strong>, which is why a second opinion here often costs less than the first quote.</span></li>
          <li>{icon("check")}<span><strong>Nothing happens without your approval</strong>, including anything we find mid-repair.</span></li>
          <li>{icon("check")}<span><strong>Your factory warranty stays intact.</strong> Federal law protects your right to use an independent shop.</span></li>
        </ul>
        <div class="btn-row" style="margin-top:26px">
          {tel_btn("btn btn-dark", "why-us")}
          <a class="btn btn-outline" href="/about/">More about the shop</a>
        </div>
      </div>
      <div>
        {photo_slot("The bay on Elk Grove Blvd. Same shop, same family, since 2001.",
                    "The shop")}
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">Side by side</span>
      <h2>Us, the dealership, and the chain down the road</h2>
      <p>The three places an Elk Grove driver usually chooses between — and the differences that
      actually show up on the invoice.</p>
    </div>
    <div class="table-scroll">
      <table class="compare">
        <caption class="sr-only">How Automotive Solutions compares with a dealership service department and a national chain</caption>
        <thead>
          <tr><th scope="col">What matters</th><th scope="col">Automotive Solutions</th><th scope="col">Dealer service dept.</th><th scope="col">National chain</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Who explains the repair</th><td class="yes">The shop working on it</td><td>A service advisor</td><td>A counter clerk</td></tr>
          <tr><th scope="row">Approach to an unclear fault</th><td class="yes">Diagnose, then quote</td><td>Replace by likelihood</td><td>Often referred out</td></tr>
          <tr><th scope="row">Recommended extras</th><td class="yes">Only what we can show you</td><td>Menu-driven upsells</td><td>Package-driven upsells</td></tr>
          <tr><th scope="row">Warranty on repairs</th><td class="yes">24 months / 24,000 miles, nationwide</td><td>Varies by dealer</td><td>Varies by location</td></tr>
          <tr><th scope="row">Who you deal with next time</th><td class="yes">The same family</td><td>Whoever is on the rota</td><td>Whoever is on shift</td></tr>
          <tr><th scope="row">Second opinions</th><td class="yes">Welcome — bring the estimate</td><td>Rarely offered</td><td>Rarely offered</td></tr>
          <tr><th scope="row">Big-ticket honesty</th><td class="yes">We will tell you not to spend it</td><td>Rarely in their interest</td><td>Usually referred out</td></tr>
        </tbody>
      </table>
    </div>
    <p class="center" style="margin-top:28px">{tel_btn("btn btn-accent", "compare")}</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center">
      <span class="eyebrow">How it works</span>
      <h2>Three steps, no surprises</h2>
      <p>The same process whether it is an oil change or an engine that another shop could not sort out.</p>
    </div>
    <div class="steps">
      <div class="step">
        <h3>Tell us what it's doing</h3>
        <p>Call the shop or send the form. Describe the noise, the light or the symptom — including
        anything another shop has already told you.</p>
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
        <span class="eyebrow">What sets the shop apart</span>
        <h2>A NAPA AutoCare Center, not a franchise counter</h2>
        <p>NAPA AutoCare is a network of independent shops that meet a shared standard: ASE
        certified technicians, quality parts, and a written warranty that other member shops honor.
        You get the accountability of a national program from a business that is still owned by the
        family whose name is on the sign.</p>
        <ul class="checklist">
          <li>{icon("check")}<span>24 months / 24,000 miles on parts and labor for qualifying repairs</span></li>
          <li>{icon("check")}<span>Honored at NAPA AutoCare Centers nationwide, not only here</span></li>
          <li>{icon("check")}<span>ASE certified technicians and up-to-date diagnostic equipment</span></li>
          <li>{icon("check")}<span>Owned and operated by the Single family since 2001</span></li>
        </ul>
        <div class="btn-row" style="margin-top:28px">
          <a class="btn btn-accent" href="/about/">About the shop {icon("arrow")}</a>
          <a class="btn btn-ghost" href="{NAPA_URL}" rel="noopener">See our NAPA listing</a>
        </div>
      </div>
      <div>
        {photo_slot("Every vehicle gets diagnosed before it gets quoted — that is the whole method.", "In the bay")}
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
      <p>Read them where they were left. We link straight to the sources rather than asking you to
      take our word for it.</p>
    </div>
    <div class="grid g4">{review_cards()}</div>
    <div class="review-links">
      <a class="btn btn-outline" href="{MAPS_LISTING}" rel="noopener" data-loc="reviews-google">Read Google reviews</a>
      <a class="btn btn-outline" href="{YELP_URL}" rel="noopener">Read Yelp reviews</a>
      <a class="btn btn-outline" href="/reviews/">All review sources {icon("arrow")}</a>
    </div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="split">
      <div>
        <span class="eyebrow">Find us</span>
        <h2>Old Town Elk Grove, just off Highway 99</h2>
        <p>We are at <strong>{esc(FULL_ADDRESS)}</strong>. Drivers come to us from across south
        Sacramento County — Laguna, Vineyard, Sheldon, Wilton, Galt and south Sacramento included.</p>
        <table class="hours">
          <caption class="sr-only">Business hours</caption>
          <tbody>
            {"".join(f"<tr><th scope='row'>{d}</th><td{' class=' + chr(34) + 'closed' + chr(34) if h == 'Closed' else ''}>{h}</td></tr>" for d, h in SITE["hours_rows"])}
          </tbody>
        </table>
        <div class="btn-row" style="margin-top:26px">
          {tel_btn("btn btn-accent", "map")}
          <a class="btn btn-outline" href="{MAPS_DIRECTIONS}" rel="noopener" data-loc="home-directions">Get directions</a>
        </div>
      </div>
      <div>
        <iframe class="map-frame" src="{MAPS_EMBED}" title="Map showing Automotive Solutions at {esc(FULL_ADDRESS)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <p class="map-note"><a href="{MAPS_LISTING}" rel="noopener" data-loc="home-map-link">Open {esc(FULL_ADDRESS)} in Google Maps {icon("arrow")}</a></p>
      </div>
    </div>
  </div>
</section>

{faq_block(HOME_FAQS)}

{cta_band()}"""

    render("/",
           "Auto Repair in Elk Grove, CA | Automotive Solutions",
           "Family owned auto repair in Elk Grove, CA since 2001. ASE certified technicians, "
           "NAPA AutoCare warranty, all makes and models. Call (916) 686-5277.",
           body,
           schemas=[business_schema(), faq_schema(HOME_FAQS), website_schema()],
           active="/", alternates=[("en", "/"), ("es", "/es/"), ("x-default", "/")])
    PAGES.append(("/", "1.0", "weekly"))


def build_service(s):
    path = "/services/%s/" % s["slug"]
    trail = [("Home", "/"), ("Services", "/services/"), (s["nav"], path)]
    related = [x for x in SERVICES if x["slug"] != s["slug"]][:7]
    related_html = "".join('<a class="tag" href="/services/%s/">%s</a>' % (r["slug"], esc(r["nav"]))
                           for r in related)
    intro_html = "".join("<p>%s</p>" % esc(p) for p in s["intro"])
    includes = "".join(f'<li>{icon("check")}<span>{esc(i)}</span></li>' for i in s["includes"])
    signs = "".join(f"<li>{esc(x)}</li>" for x in s["signs"])
    hours_rows = "".join(
        f"<tr><th scope='row'>{d}</th><td>{h}</td></tr>" for d, h in SITE["hours_rows"][:1])

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
        data-loc="service-body">{SITE["phone_display"]}</a>. We will tell you what we think it is,
        what it takes to know for certain, and what that costs — before you commit to anything.</p>
        <h2 style="margin-top:1.8em">Serving Elk Grove and south Sacramento County</h2>
        <p>Automotive Solutions is at {esc(FULL_ADDRESS)}, in Old Town Elk Grove just east of
        Highway 99. We handle {esc(s["nav"].lower())} for drivers across
        {esc(", ".join(SITE["areas"][:-1]))} and {esc(SITE["areas"][-1])}.</p>
      </div>
      <div>
        <div id="quote">{quote_form(s["slug"] + "-quote", "Get a quote for " + s["nav"].lower(), service_default=s["slug"])}</div>
        <div class="panel" style="margin-top:22px">
          <h3>Shop details</h3>
          <p style="margin-bottom:.6em"><strong>{esc(SITE["name"])}</strong><br>
          {esc(SITE["street"])}<br>{SITE["city"]}, {SITE["region"]} {SITE["zip"]}</p>
          <p style="margin-bottom:.6em"><a href="tel:{SITE["phone_link"]}" data-loc="service-panel">{SITE["phone_display"]}</a></p>
          <p style="margin-bottom:.6em">{esc(SITE["hours_human"])}<br>Closed Saturday and Sunday</p>
          <p style="margin-bottom:0"><a href="{MAPS_DIRECTIONS}" rel="noopener" data-loc="service-panel-map">Get directions {icon("arrow")}</a></p>
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

{cta_band("Need %s in Elk Grove?" % s["nav"].lower(),
          "Call the shop and talk it through with someone who does this work every day.")}"""

    render(path, seo_title(s["title"]), s["meta"], body,
           schemas=[business_schema(), service_schema(s), breadcrumb_schema(trail),
                    faq_schema(s["faqs"])],
           active="/services/")
    PAGES.append((path, "0.9", "monthly"))


def build_services_index():
    trail = [("Home", "/"), ("Services", "/services/")]
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Auto repair services in Elk Grove, CA</h1>
    <p>Complete auto services for domestic and import vehicles. Every job starts the same way:
    find out what is actually wrong, then quote the repair.</p>
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
    <p>This list covers the work that comes through the shop most often, but it is not everything
    we do. If your vehicle has a problem that is not on this page — or you do not know what to call
    it — describe it to us and we will tell you honestly whether it is work we can take on.</p>
    <p>We provide expert repairs, service and maintenance on all makes and models of domestic and
    import cars, trucks, SUVs and vans.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "services-body")}
    <a class="btn btn-outline" href="/contact/">Contact the shop</a></div>
  </div>
</section>

{cta_band()}"""
    render("/services/",
           seo_title("Auto Repair Services in Elk Grove, CA"),
           "Every service at Automotive Solutions in Elk Grove, CA — brakes, engines, "
           "transmissions, AC, diagnostics, timing belts and more. (916) 686-5277.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/services/")
    PAGES.append(("/services/", "0.9", "monthly"))


def build_about():
    trail = [("Home", "/"), ("About", "/about/")]
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>About Automotive Solutions by Single</h1>
    <p>A family owned repair shop in Elk Grove, California, doing the same thing since 2001:
    telling people the truth about their vehicles.</p>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="split">
      <div>
        <h2>Twenty-plus years on Elk Grove Boulevard</h2>
        <p>Automotive Solutions by Single is a family owned and operated shop at
        {esc(FULL_ADDRESS)}, serving Elk Grove drivers since {SITE["founded_year"]}. It is run by
        {esc(SITE["owners"])}, and in more than two decades it has repaired thousands of vehicles
        for people who live and work in this town.</p>
        <p>We provide expert repairs, service and maintenance on all makes and models of domestic
        and import vehicles. Our technicians are ASE certified, and we use up-to-date diagnostic
        equipment and quality parts on every job that comes through the bay.</p>
        <h2 style="margin-top:1.6em">How we work</h2>
        <ul class="checklist">
          <li>{icon("check")}<span><strong>Diagnose first.</strong> A trouble code is a starting point, not an answer. We test until we can point at the failure.</span></li>
          <li>{icon("check")}<span><strong>Explain it plainly.</strong> You should understand what failed and why before you spend money on it.</span></li>
          <li>{icon("check")}<span><strong>Quote before we start.</strong> Nothing gets repaired without your approval — including anything we find along the way.</span></li>
          <li>{icon("check")}<span><strong>Separate urgent from optional.</strong> We will tell you what can safely wait. That is not lost revenue; that is why people come back.</span></li>
          <li>{icon("check")}<span><strong>Back it in writing.</strong> Qualifying repairs carry the NAPA Peace of Mind Warranty — {SITE["warranty_months"]} months or {SITE["warranty_miles"]} miles, nationwide.</span></li>
        </ul>
        <h2 style="margin-top:1.6em">What being a NAPA AutoCare Center means</h2>
        <p>NAPA AutoCare is a network of independent repair shops that agree to a common standard.
        Member shops employ ASE certified technicians, use quality parts, and honor each other's
        warranty work. In practice that means if something we repaired gives you trouble while you
        are out of town, another member shop can look after it under the same coverage.</p>
        <p>It also means an independent business does not have to ask you to take its word for
        anything. You can look us up in NAPA's own directory, on the Better Business Bureau, and on
        Google and Yelp — all of them are linked from this site.</p>
      </div>
      <div class="panel panel-accent">
        <h3>The shop at a glance</h3>
        <table class="hours">
          <caption class="sr-only">Key facts about Automotive Solutions</caption>
          <tbody>
            <tr><th scope="row">Location</th><td>{esc(FULL_ADDRESS)}</td></tr>
            <tr><th scope="row">Phone</th><td><a href="tel:{SITE["phone_link"]}" data-loc="about">{SITE["phone_display"]}</a></td></tr>
            <tr><th scope="row">Hours</th><td>Mon–Fri, 9 AM – 6 PM</td></tr>
            <tr><th scope="row">Serving Elk Grove since</th><td>{SITE["founded_year"]}</td></tr>
            <tr><th scope="row">Ownership</th><td>Family owned and operated</td></tr>
            <tr><th scope="row">Technicians</th><td>ASE certified</td></tr>
            <tr><th scope="row">Network</th><td>NAPA AutoCare Center</td></tr>
            <tr><th scope="row">Warranty</th><td>{SITE["warranty_months"]} mo / {SITE["warranty_miles"]} mi, nationwide</td></tr>
            <tr><th scope="row">Vehicles</th><td>All makes and models, domestic and import</td></tr>
            <tr><th scope="row">Rating</th><td>{SITE["rating"]} / 5 ({SITE["review_count"]} Google reviews)</td></tr>
          </tbody>
        </table>
        <p style="margin:22px 0 0">{tel_btn("btn btn-accent", "about-panel")}</p>
        <div style="margin-top:26px">
          {photo_slot("9253 Elk Grove Blvd — where every vehicle gets diagnosed before it gets quoted.", "Our shop")}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="sec-head center"><span class="eyebrow">Who we serve</span>
      <h2>Daily drivers, families and long-term keepers</h2></div>
    <div class="grid g3">
      <div class="card"><span class="card-ico">{icon("family")}</span><h3>Families and commuters</h3>
        <p style="margin-bottom:0">Maintenance, repairs and honest advice on whether a car is worth
        keeping — for the vehicle that gets your family where it is going.</p></div>
      <div class="card"><span class="card-ico">{icon("gauge")}</span><h3>Second opinions</h3>
        <p style="margin-bottom:0">Bring the estimate. We start from the symptom and test our way to
        the cause rather than inheriting somebody else's assumption.</p></div>
      <div class="card"><span class="card-ico">{icon("engine")}</span><h3>Big-ticket decisions</h3>
        <p style="margin-bottom:0">Engine and transmission replacement, major overhaul — and a
        straight answer about whether the repair is worth it on your vehicle.</p></div>
    </div>
  </div>
</section>

{cta_band("Come see how a straight answer feels.",
          "We are on Elk Grove Blvd, open Monday through Friday. Call ahead and we will make room for you.")}"""
    render("/about/",
           seo_title("About Our Elk Grove Auto Repair Shop"),
           "Automotive Solutions by Single is a family owned auto repair shop in Elk Grove, CA, "
           "serving drivers since 2001. ASE certified, NAPA AutoCare. (916) 686-5277.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/about/")
    PAGES.append(("/about/", "0.7", "yearly"))


def build_reviews():
    trail = [("Home", "/"), ("Reviews", "/reviews/")]
    sources = [
        ("Google", MAPS_LISTING, "%s out of 5 from %s reviews" % (SITE["rating"], SITE["review_count"])),
        ("Yelp", YELP_URL, "Reviews from Elk Grove customers"),
        ("Better Business Bureau", BBB_URL, "BBB business profile and complaint history"),
        ("NAPA AutoCare", NAPA_URL, "Our listing in NAPA's own shop directory"),
        ("Nextdoor", "https://nextdoor.com/pages/automotive-solutions-by-single-elk-grove-ca/",
         "Recommendations from Elk Grove neighbors"),
        ("SureCritic", "https://www.surecritic.com/reviews/automotive-solutions-by-single",
         "Verified customer reviews"),
        ("Customer Lobby", "https://www.customerlobby.com/reviews/1418/automotive-solutions-by-single",
         "Customer reviews and ratings"),
    ]
    source_cards = "".join(
        f"""<a class="card" href="{u}" rel="noopener"><span class="card-ico">{icon("star")}</span>
  <h3>{esc(n)}</h3><p>{esc(d)}</p><span class="more">Read them {icon("arrow")}</span></a>"""
        for n, u, d in sources)

    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Reviews of Automotive Solutions</h1>
    <p>Rated {SITE["rating"]} out of 5 across {SITE["review_count"]} Google reviews, with more on
    Yelp, Nextdoor and the BBB. Every source is linked below so you can read them yourself.</p>
    <div class="btn-row">
      <a class="btn btn-accent" href="{MAPS_LISTING}" rel="noopener" data-loc="reviews-head">Read reviews on Google</a>
      <a class="btn btn-ghost" href="{YELP_URL}" rel="noopener">Read reviews on Yelp</a>
    </div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">In their own words</span>
      <h2>What customers say</h2>
      <p>Quoted exactly as it was written, with the platform it was left on. We do not write these
      and we do not edit them.</p></div>
    <div class="grid g4">{review_cards()}</div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">Where to look</span>
      <h2>Read the reviews at the source</h2>
      <p>We would rather point you at the originals than reprint the flattering parts. Here is
      everywhere this shop is listed and reviewed.</p></div>
    <div class="grid g3">{source_cards}</div>
  </div>
</section>

<section>
  <div class="wrap narrow">
    <h2>Why we don't put a star rating in our page code</h2>
    <p>Plenty of small business websites publish their own star rating as structured data so a
    rating shows up in Google's search results. Google's guidelines say not to: a business marking
    up its own reviews is self-serving, and sites that do it risk losing the rich result
    altogether.</p>
    <p>So the rating on this site is stated in plain text and linked to the platform that
    calculated it. If you want to know what people think of this shop, the honest place to look is
    Google and Yelp, not our own HTML.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "reviews-body")}
    <a class="btn btn-outline" href="{MAPS_LISTING}" rel="noopener">Check the rating yourself {icon("arrow")}</a></div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap narrow center">
    <h2>Been in recently?</h2>
    <p>Reviews from real customers are how neighbors in Elk Grove find an honest shop. If we did
    right by you, a few sentences on Google genuinely helps — and if we did not, call the shop
    first and give us the chance to put it right.</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn btn-accent" href="{MAPS_LISTING}" rel="noopener" data-loc="leave-review">Leave a Google review</a>
      {tel_btn("btn btn-outline", "reviews-cta", "Call the shop")}
    </div>
  </div>
</section>

{cta_band()}"""
    render("/reviews/",
           seo_title("Reviews — Elk Grove Auto Repair"),
           "Automotive Solutions in Elk Grove, CA is rated 4.5 out of 5 across 55 Google reviews. "
           "Read them on Google, Yelp, Nextdoor and the BBB.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/reviews/")
    PAGES.append(("/reviews/", "0.7", "monthly"))


def build_contact():
    trail = [("Home", "/"), ("Contact", "/contact/")]
    hours_rows = "".join(
        f"<tr><th scope='row'>{d}</th><td{' class=' + chr(34) + 'closed' + chr(34) if h == 'Closed' else ''}>{h}</td></tr>"
        for d, h in SITE["hours_rows"])
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Contact Automotive Solutions</h1>
    <p>Call the shop, send a quote request, or stop by — we are on Elk Grove Blvd in Old Town,
    open Monday through Friday.</p>
    <div class="btn-row">
      {tel_btn("btn btn-accent", "contact-head")}
      <a class="btn btn-ghost" href="{MAPS_DIRECTIONS}" rel="noopener" data-loc="contact-head">Get directions</a>
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
        <p><strong>Phone:</strong> <a href="tel:{SITE["phone_link"]}" data-loc="contact-body">{SITE["phone_display"]}</a></p>
        <h3>Hours</h3>
        <table class="hours"><caption class="sr-only">Business hours</caption><tbody>{hours_rows}</tbody></table>
        <h3 style="margin-top:1.6em">Getting here</h3>
        <p>We are in Old Town Elk Grove on Elk Grove Boulevard, a few minutes east of Highway 99
        and close to Elk Grove-Florin Road. If you are coming from Laguna, Vineyard or south
        Sacramento, allow a little extra time during the weekday afternoon rush.</p>
        <h3 style="margin-top:1.4em">Before you call, it helps to have</h3>
        <ul>
          <li>Year, make and model of the vehicle</li>
          <li>What it is doing, and roughly when it started</li>
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
    <iframe class="map-frame" src="{MAPS_EMBED}" title="Map showing Automotive Solutions at {esc(FULL_ADDRESS)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <p class="map-note"><a href="{MAPS_DIRECTIONS}" rel="noopener" data-loc="contact-map">Get driving directions to {esc(FULL_ADDRESS)} {icon("arrow")}</a></p>
  </div>
</section>

{cta_band("Not sure what's wrong? That's fine.",
          "Describe the symptom. We will tell you what it takes to find out for certain and what that costs.")}"""
    render("/contact/",
           seo_title("Contact & Directions — Elk Grove, CA"),
           "Call (916) 686-5277 or visit Automotive Solutions at 9253 Elk Grove Blvd, Elk Grove, "
           "CA 95624. Open Monday to Friday, 9 AM to 6 PM.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/contact/")
    PAGES.append(("/contact/", "0.8", "yearly"))


AREA_NOTES = {
    "Elk Grove": "Our home town — Old Town, Laguna, Sheldon and everywhere in between.",
    "Laguna": "Minutes west of the shop, and a regular short trip for our customers.",
    "Sacramento": "South Sacramento drivers come down Highway 99 rather than fight dealer pricing.",
    "Wilton": "East of town on Grant Line Road, rural miles and the wear that comes with them.",
    "Galt": "South on 99, close enough that a proper diagnosis is worth the drive.",
    "Florin": "Just north of Elk Grove, an easy run on Elk Grove-Florin Road.",
    "Vineyard": "Neighboring community to the north-east, a few minutes away.",
    "Sheldon": "On the east side of Elk Grove, familiar territory for the shop.",
    "Franklin": "South-west of town, including the rural stretches out toward the delta.",
    "Rancho Cordova": "Further north, but customers make the trip for second opinions.",
}


def build_service_areas():
    trail = [("Home", "/"), ("Service Areas", "/service-areas/")]
    cards = "".join(
        f"""<div class="card"><span class="card-ico">{icon("pin")}</span>
  <h3>{esc(a)}, CA</h3><p style="margin-bottom:0">{esc(AREA_NOTES.get(a, "Auto repair for drivers in " + a + "."))}</p></div>"""
        for a in SITE["areas"])
    body = f"""<div class="page-head">
  <div class="wrap">
    {crumbs_html(trail)}
    <h1>Areas we serve around Elk Grove, California</h1>
    <p>Based in Old Town Elk Grove, trusted across south Sacramento County since 2001.</p>
    <div class="btn-row">{tel_btn("btn btn-accent", "areas-head")}
    <a class="btn btn-ghost" href="/contact/#quote">Request a quote</a></div>
  </div>
  {angle_divider()}
</div>

<section>
  <div class="wrap">
    <div class="sec-head"><p class="lede">Our shop is at {esc(FULL_ADDRESS)} — a few minutes east
    of Highway 99, close to Elk Grove-Florin Road. Customers regularly drive in from these
    communities.</p></div>
    <div class="grid g3">{cards}</div>
  </div>
</section>

<section class="bg-alt">
  <div class="wrap narrow">
    <h2>Worth the drive for a real diagnosis</h2>
    <p>Plenty of our customers pass closer shops to get here, usually after paying for a repair
    somewhere else that did not fix the problem. If that is where you are right now, bring the
    estimate and the paperwork — we will start from the symptom and test our way to the actual
    cause.</p>
    <p>And because we are a NAPA AutoCare Center, the warranty on qualifying repairs is honored at
    member shops nationwide. That matters more than it sounds if you drive for work or spend time
    away from home.</p>
    <div class="btn-row">{tel_btn("btn btn-dark", "areas-body")}
    <a class="btn btn-outline" href="/services/">See all services</a></div>
  </div>
</section>

{cta_band()}"""
    render("/service-areas/",
           seo_title("Auto Repair Near Elk Grove & Laguna, CA"),
           "Automotive Solutions serves Elk Grove, Laguna, south Sacramento, Wilton, Galt, Florin "
           "and Vineyard from 9253 Elk Grove Blvd. Call (916) 686-5277.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/service-areas/")
    PAGES.append(("/service-areas/", "0.6", "yearly"))


def build_privacy():
    trail = [("Home", "/"), ("Privacy", "/privacy/")]
    body = f"""<div class="page-head"><div class="wrap">{crumbs_html(trail)}
  <h1>Privacy policy</h1><p>How we handle the information you send us through this website.</p></div>
  {angle_divider()}
</div>
<section><div class="wrap narrow">
  <p><strong>What we collect.</strong> If you submit the quote form, we receive the name, phone
  number, vehicle details and description you provide. The site does not require an account and we
  do not ask for payment details online.</p>
  <p><strong>How we use it.</strong> Only to respond to your request and to service your vehicle.
  We do not sell, rent or trade your information.</p>
  <p><strong>Analytics.</strong> This site may use standard web analytics to understand how many
  people visit and which pages they use. That data is aggregated and is not used to identify you
  personally. No advertising or tracking pixels are loaded by this site as built.</p>
  <p><strong>Third-party services.</strong> Quote requests are delivered to our inbox by
  FormSubmit, a form-forwarding service, which processes the details you submit in order to send
  them to us. The map on the contact page is embedded from Google Maps, and review links lead to
  Google, Yelp, Nextdoor and the Better Business Bureau — each applies its own privacy policy once
  you leave our site.</p>
  <p><strong>Your choices.</strong> Ask us to delete the information you sent and we will — call
  <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a> or tell us next time you are in.</p>
  <p><strong>Contact.</strong> {esc(SITE["name"])}, {esc(FULL_ADDRESS)},
  <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a>.</p>
</div></section>"""
    render("/privacy/", seo_title("Privacy Policy"),
           "How Automotive Solutions in Elk Grove, CA collects and uses information submitted "
           "through this website. No tracking pixels, no data sold.",
           body, schemas=[breadcrumb_schema(trail)])
    PAGES.append(("/privacy/", "0.2", "yearly"))


def build_thanks():
    body = f"""<div class="page-head"><div class="wrap">
  <h1>Thanks — we've got your request</h1>
  <p>We will get back to you as soon as we can during shop hours ({esc(SITE["hours_human"])}).</p>
  <div class="btn-row">{tel_btn("btn btn-accent", "thanks")}
  <a class="btn btn-ghost" href="/">Back to home</a></div></div>
  {angle_divider()}
</div>
<section><div class="wrap narrow">
  <h2>What happens next</h2>
  <ol>
    <li>We read your request and check the details against what your vehicle is doing.</li>
    <li>We call you back to confirm the symptom and what a diagnosis would involve.</li>
    <li>We schedule you in and give you a realistic estimate of time and cost.</li>
  </ol>
  <p>If it is urgent — an overheating engine, brakes that do not feel right, a car that will not
  start — do not wait on the callback. Call
  <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a>.</p>
</div></section>"""
    render("/thank-you/", seo_title("Thank You"),
           "Your request has been sent to Automotive Solutions in Elk Grove, CA. We will call you "
           "back during shop hours.", body, noindex=True)


def build_404():
    body = f"""<div class="page-head"><div class="wrap">
  <h1>That page isn't here</h1>
  <p>The link may be old or mistyped. The shop is still exactly where it has always been.</p>
  <div class="btn-row">{tel_btn("btn btn-accent", "404")}
  <a class="btn btn-ghost" href="/services/">Browse services</a></div></div>
  {angle_divider()}
</div>
<section><div class="wrap">
  <div class="sec-head"><h2>Popular pages</h2></div>
  <div class="grid g3">{service_cards(["auto-repair", "brake-repair", "engine-repair",
                                        "transmission-repair", "ac-repair", "car-diagnostics"])}</div>
</div></section>"""
    render("/404/", seo_title("Page Not Found"),
           "That page could not be found. Browse auto repair services in Elk Grove, CA, or call "
           "the shop at (916) 686-5277.", body, noindex=True)
    # Most static hosts look for /404.html at the root.
    with open(os.path.join(OUT, "404", "index.html"), encoding="utf-8") as fh:
        page = fh.read()
    if RELATIVE:
        page = page.replace('="../', '="./')
    with open(os.path.join(OUT, "404.html"), "w", encoding="utf-8") as fh:
        fh.write(page)


# ==========================================================================
# Advice guides — real answers to what people search before they are ready
# to call a shop. Each section is explicitly marked "p" (prose paragraphs)
# or "ul" (a bullet list) so nothing is ever rendered as the wrong one.
# ==========================================================================
GUIDES = [
    {
        "slug": "independent-shop-warranty",
        "nav": "Does using an independent shop void my warranty?",
        "title": "Does an Independent Shop Void My Warranty?",
        "meta": ("No — federal law protects your right to use an independent repair shop without "
                 "voiding the factory warranty. What you do need to keep, explained."),
        "blurb": "The short answer is no, and there is a federal law that says so. Here is how it works.",
        "icon": "shield",
        "takeaway": "Using an independent shop does not void your factory warranty. Keep your "
                    "receipts, have the work done to specification, and you are protected.",
        "sections": [
            ("The law that settles it", "p", [
                "The <strong>Magnuson-Moss Warranty Act</strong> is a US federal law dating from "
                "1975. Among other things, it stops a manufacturer from conditioning your warranty "
                "on using their dealership or their branded parts — unless they provide those parts "
                "and that service free of charge.",
                "In plain terms: a carmaker cannot tell you that an oil change at an independent "
                "shop voids your powertrain warranty. If a dealer implies otherwise, they are "
                "describing a preference, not a rule.",
            ]),
            ("What the manufacturer can still do", "p", [
                "The protection is not unlimited, and it is worth understanding the edge. A "
                "manufacturer can deny a specific warranty claim if they can show that the "
                "aftermarket part or the outside repair actually caused the failure they are being "
                "asked to pay for.",
                "That is a much narrower thing than voiding the warranty. It is claim-specific, and "
                "the burden of showing the connection is on them, not on you.",
            ]),
            ("What you should keep", "ul", [
                "Receipts and invoices for every service, showing the date and mileage",
                "A record of what was done and which parts were used",
                "Proof that the maintenance was performed at the interval the manufacturer specifies",
                "The maintenance schedule from your owner's manual, so you know what those "
                "intervals actually are",
            ]),
            ("How this works at our shop", "p", [
                "We service vehicles that are still under factory warranty regularly. The work is "
                "done to manufacturer specification with quality parts, and you get an invoice that "
                "states what was done and when — which is exactly the documentation you would need "
                "if a claim were ever questioned.",
                "On top of that, qualifying repairs here carry the NAPA Peace of Mind Warranty: 24 "
                "months or 24,000 miles on parts and labor, honored at NAPA AutoCare Centers "
                "nationwide. That is coverage in addition to whatever the manufacturer still owes "
                "you, not instead of it.",
            ]),
            ("What about a recall or a warranty repair itself?", "p", [
                "Those are different. If a repair is covered under the factory warranty, or the "
                "vehicle is subject to a recall or a manufacturer service campaign, the dealership "
                "does that work at no cost to you and you should let them. We will tell you when "
                "that is the case — sending you to the dealer for free work is better for you than "
                "charging you for it here.",
            ]),
        ],
    },
    {
        "slug": "check-engine-light",
        "nav": "What your check engine light actually means",
        "title": "Check Engine Light: What It Means",
        "meta": ("What a check engine light actually means, when it is safe to keep driving, and "
                 "why a free code read is not a diagnosis. From an Elk Grove repair shop."),
        "blurb": "Steady or flashing, what the difference means, and what it costs to find out for certain.",
        "icon": "gauge",
        "takeaway": "A flashing light means stop driving. A steady light means get it diagnosed "
                    "soon. Either way, a code is a clue, not an answer.",
        "sections": [
            ("Steady light versus flashing light", "p", [
                "There is one distinction worth knowing before anything else. A <strong>steady</strong> "
                "check engine light means the car has recorded a fault it wants looked at. You can "
                "usually keep driving gently and get it seen in the next few days.",
                "A <strong>flashing</strong> check engine light means an active misfire is dumping "
                "unburned fuel into the exhaust. That can destroy a catalytic converter in minutes "
                "— a cheap repair turning into an expensive one while you drive. Pull over "
                "somewhere safe and call a shop.",
            ]),
            ("Why a free code read is not a diagnosis", "p", [
                "A parts store will happily read your codes for free, and it is a genuinely useful "
                "starting point. But a code identifies which circuit reported a problem, not which "
                "component failed.",
                "The classic example is P0171, 'system too lean'. That code can be caused by a "
                "vacuum leak, a dirty mass airflow sensor, a weak fuel pump, a clogged filter, a "
                "leaking injector or a failing oxygen sensor. Replacing parts in order of price "
                "until the light goes out is a strategy — it is just an expensive one.",
            ]),
            ("What a real diagnosis involves", "ul", [
                "Reading the codes with freeze-frame data, which captures the conditions when the "
                "fault occurred",
                "Watching live sensor data while the engine runs, to see what is actually happening",
                "Testing the suspect components directly rather than inferring from the code",
                "Checking for related faults that a single code would not reveal",
                "A road test where the symptom only appears while driving",
            ]),
            ("Common causes, roughly in order of how often we see them", "ul", [
                "A loose or failed fuel cap — genuinely common, and genuinely cheap",
                "Oxygen sensor faults, often reported after a different underlying problem",
                "Ignition faults — coils, plugs, wires — showing up as misfire codes",
                "Vacuum leaks from aged hoses and gaskets, which valley heat accelerates",
                "Mass airflow sensor contamination",
                "Catalytic converter efficiency codes, usually the consequence of something else",
                "Evaporative emissions leaks, which frequently cause a smog failure",
            ]),
            ("When it is worth paying for diagnostic time", "p", [
                "If the light is on and the car drives normally, diagnostic time is what stops you "
                "buying three parts to fix one problem. It is the cheapest part of the repair, and "
                "it is the part that determines whether the rest of your money is well spent.",
                "Call us at (916) 686-5277 and we will tell you what a diagnosis costs and what it "
                "covers before you bring the car in.",
            ]),
        ],
    },
    {
        "slug": "car-ac-not-cold",
        "nav": "Why your AC stops being cold in a valley summer",
        "title": "Car AC Not Blowing Cold: What It Means",
        "meta": ("Why car air conditioning fades in Sacramento Valley heat, why a recharge alone "
                 "does not last, and what a proper AC diagnosis involves."),
        "blurb": "Refrigerant is not consumed. If the system is low, it is leaking — and here is what that means.",
        "icon": "snow",
        "takeaway": "A system that is low on refrigerant has a leak. A recharge without finding it "
                    "buys you weeks, not seasons.",
        "sections": [
            ("The thing nobody explains at the counter", "p", [
                "Air conditioning is a sealed system. Refrigerant is not a consumable like oil or "
                "fuel — it circulates and it is not used up. So if your system is low, that "
                "refrigerant went somewhere, and the only place it can go is out.",
                "This is why a recharge on its own is a temporary measure. The system will lose "
                "charge again at whatever rate it was losing it before, and you will be back in the "
                "same place — often just as the weather turns hot.",
            ]),
            ("Why Elk Grove summers are hard on AC", "p", [
                "Sacramento Valley summers regularly run well above 100°F, and an air conditioning "
                "system works hardest exactly when the ambient temperature is highest. A system "
                "that is marginal in April is often a system that fails in July.",
                "Heat also ages the rubber and the seals that hold the refrigerant in. That is a "
                "large part of why AC leaks tend to develop in older vehicles here faster than they "
                "do in milder climates.",
            ]),
            ("What the symptom usually tells us", "ul", [
                "<strong>Cool but never cold, worst at idle</strong> — often low charge or a "
                "condenser airflow problem",
                "<strong>Cold for a few weeks after a recharge, then fading</strong> — a leak, "
                "essentially always",
                "<strong>Loud clicking or a squeal when the AC switches on</strong> — compressor "
                "clutch or belt",
                "<strong>Musty or sour smell from the vents</strong> — usually the evaporator or a "
                "cabin filter, not the refrigerant circuit at all",
                "<strong>Blows cold on one side only</strong> — often a blend door or actuator, "
                "which is a control fault rather than a refrigerant one",
                "<strong>No air at all</strong> — blower motor or resistor, again not a refrigerant "
                "problem",
            ]),
            ("What a proper AC diagnosis involves", "ul", [
                "Measuring high and low side pressures with the system running",
                "Checking vent temperature against ambient, which tells you how the system is "
                "actually performing",
                "Leak detection — dye, an electronic sniffer, or both, depending on the system",
                "Inspecting the compressor, condenser, lines and seals for the physical evidence",
                "Confirming that the cooling fans and airflow across the condenser are doing their job",
            ]),
            ("The best time to deal with it", "p", [
                "Spring. Every shop in Elk Grove is at its busiest for AC work during the first "
                "genuinely hot week of the year, and that is the worst time to discover you need a "
                "compressor. If the AC was not quite right last summer, it will not have healed "
                "over the winter.",
            ]),
        ],
    },
    {
        "slug": "timing-belt-or-chain",
        "nav": "Timing belt or chain — and when it has to be done",
        "title": "Timing Belt or Chain: When To Replace It",
        "meta": ("The difference between a timing belt and a timing chain, why the water pump goes "
                 "in at the same time, and what happens if a belt lets go."),
        "blurb": "The cheapest expensive job on your car — if it is done before it fails rather than after.",
        "icon": "belt",
        "takeaway": "If your engine uses a belt, it is a scheduled service with a mileage number. "
                    "Doing it on time is maintenance; doing it late can be an engine.",
        "sections": [
            ("What the timing component actually does", "p", [
                "Your engine's valves have to open and close in exact time with the pistons moving "
                "up and down. A timing belt or chain is what keeps those two halves synchronised.",
                "A belt is rubber-based with fibre reinforcement, runs quietly, and wears out on a "
                "schedule. A chain is metal, is generally designed to last the life of the engine, "
                "and depends on oil pressure and tensioners to stay properly tight.",
            ]),
            ("Interference versus non-interference — the expensive distinction", "p", [
                "In an <strong>interference</strong> engine, the valves and the pistons occupy the "
                "same space at different moments. If the belt breaks, timing is lost instantly, the "
                "pistons strike the open valves, and you are looking at bent valves and possibly "
                "worse. In a <strong>non-interference</strong> engine the same failure leaves you "
                "stranded but does not usually destroy anything.",
                "Most modern engines are interference designs. Which one you have determines "
                "whether a snapped belt is a tow truck or a rebuild — and it is worth knowing for "
                "your specific vehicle rather than guessing.",
            ]),
            ("Why the water pump goes in at the same time", "p", [
                "On many belt-driven engines the water pump is driven by the timing belt and sits "
                "behind the same covers. Getting to it is most of the labor of the job.",
                "Replacing a perfectly good water pump feels wasteful right up until it fails 18 "
                "months later and you pay that same labor a second time. The same reasoning applies "
                "to tensioners and idler pulleys, which is why a proper timing belt job is a kit, "
                "not just a belt.",
            ]),
            ("Signs a chain is in trouble", "ul", [
                "A rattle or slap from the front of the engine, worst on a cold start",
                "A timing-related trouble code, often correlating cam and crank position",
                "Rough running or a loss of power that came on gradually",
                "A history of missed oil changes — chain tensioners run on oil pressure, and dirty "
                "oil is how chains fail early",
            ]),
            ("How to find out where you stand", "p", [
                "Tell us your year, make and model and we will tell you whether your engine uses a "
                "belt or a chain, what the manufacturer's replacement interval is, and whether it "
                "is an interference design.",
                "If you bought the car used and there is no record of the belt ever being changed, "
                "that is worth resolving. An unknown history on an interference engine is a risk "
                "with a known price, and the belt is much cheaper than the alternative.",
            ]),
        ],
    },
    {
        "slug": "repair-or-replace",
        "nav": "Is this repair worth it on a car this old?",
        "title": "Repair It or Replace It? How To Decide",
        "meta": ("A practical way to decide whether a big repair is worth doing on an older car, "
                 "from a shop that will tell you when the answer is no."),
        "blurb": "A framework for the moment when the quote is large and the car is not new.",
        "icon": "dollar",
        "takeaway": "Compare the repair against a year of payments on a replacement, not against "
                    "the car's resale value. The right question is cost per month of reliable use.",
        "sections": [
            ("The comparison most people make, and why it misleads", "p", [
                "The instinct is to compare the repair bill against what the car is worth. A "
                "$2,000 repair on a car worth $4,000 sounds obviously bad on that arithmetic.",
                "But you are not choosing between the repair and the cash. You are choosing between "
                "the repair and whatever it costs to put a different vehicle on your driveway — "
                "which includes a down payment, tax, registration, insurance changes and, usually, "
                "monthly payments.",
            ]),
            ("A better question: cost per month of reliable use", "p", [
                "Take the repair cost and divide it by the number of months you would realistically "
                "keep driving the car afterwards. A $2,000 repair that buys two more good years is "
                "about $83 a month. Compare that with a car payment.",
                "This only works if the estimate of remaining life is honest, which is the part a "
                "shop has to help with. That means an assessment of the rest of the vehicle — not "
                "just the thing that broke.",
            ]),
            ("What actually goes into that judgement", "ul", [
                "The condition of the other major systems: engine, transmission, brakes, suspension",
                "Rust and structural condition, which is far less of an issue here than in a "
                "snow-belt state",
                "Maintenance history — a car that has been looked after tends to keep behaving",
                "Whether this failure is a one-off or a symptom of general wear",
                "How the vehicle is used: a 20-mile commute is very different from occasional errands",
                "What a comparable replacement genuinely costs right now, not what it cost in 2019",
            ]),
            ("When we tell people not to spend it", "p", [
                "There are cars we advise against repairing. When the transmission is going and the "
                "engine has a knock, or the estimate is a fraction of a much larger list of things "
                "the vehicle needs, spending the money is throwing good after bad — and we would "
                "rather say so than take the job.",
                "That conversation costs us a repair order and it is why people come back years "
                "later. If you are facing a decision like this, bring the car in and we will give "
                "you the real picture, including the parts you will not enjoy hearing.",
            ]),
            ("Before you decide", "ul", [
                "Get the diagnosis in writing, with the specific failure named",
                "Ask what else the vehicle needs in the next twelve months",
                "Ask what the repair is warrantied for — at a NAPA AutoCare Center qualifying "
                "repairs carry 24 months / 24,000 miles nationwide",
                "Get a second opinion if the number is large and the explanation was thin",
            ]),
        ],
    },
]


def build_guide(g):
    path = "/advice/%s/" % g["slug"]
    trail = [("Home", "/"), ("Advice", "/advice/"), (g["nav"], path)]
    blocks = []
    for heading, kind, items in g["sections"]:
        # Explicitly marked prose or list — never inferred from item count.
        if kind == "ul":
            body_items = "<ul>%s</ul>" % "".join("<li>%s</li>" % x for x in items)
        else:
            body_items = "".join("<p>%s</p>" % x for x in items)
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
      {esc(SITE["name"])}, {esc(FULL_ADDRESS)}. General guidance, not a substitute for having your
      own vehicle looked at — every car tells its own story.</p>
    <h2 style="margin-top:1.6em">More advice</h2>
    <div class="tag-row">{related}<a class="tag" href="/advice/">All guides</a></div>
  </div>
</section>

{cta_band("Rather just ask someone?",
          "Call the shop and describe what your vehicle is doing. We will tell you what we think it is and what it takes to know for certain.")}"""

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
    render("/advice/", seo_title("Car Repair Advice — Elk Grove, CA"),
           "Plain-English guides from an Elk Grove repair shop: warranties, check engine lights, "
           "AC in valley heat, timing belts and repair-or-replace decisions.",
           body, schemas=[business_schema(), breadcrumb_schema(trail)], active="/advice/")
    PAGES.append(("/advice/", "0.6", "monthly"))


# ==========================================================================
# Spanish landing page — fully localised: header, nav, form, footer and all,
# with hreflang wired to the English home page in both directions.
# ==========================================================================
def build_spanish():
    servicios = [
        ("wrench", "Reparación general", "Autos nacionales e importados, todas las marcas."),
        ("disc", "Frenos", "Pastillas, discos, mordazas y fallas de ABS."),
        ("engine", "Motor", "Fallas de encendido, fugas, sobrecalentamiento y cambio de motor."),
        ("gears", "Transmisión", "Diagnóstico, reparación y cambio de transmisión."),
        ("snow", "Aire acondicionado", "Buscamos la fuga en vez de solo recargar el sistema."),
        ("gauge", "Diagnóstico y luz de motor", "Encontramos la causa en vez de adivinar."),
        ("bolt", "Eléctrico y baterías", "No arranca, alternador, marcha y corrientes parásitas."),
        ("spring", "Amortiguadores y suspensión", "Ruidos, vibración y dirección floja."),
        ("belt", "Banda de distribución", "Con la bomba de agua y los tensores a la vez."),
        ("fuel", "Inyección y afinación", "Marcha irregular, jaloneo y bajo rendimiento."),
        ("drop", "Cambio de aceite", "Servicio programado con inspección de verdad."),
        ("tire", "Balanceo de llantas", "Balanceo, rotación y diagnóstico de vibración."),
    ]
    cards = "".join(
        f'<div class="card"><span class="card-ico">{icon(ic)}</span><h3>{esc(t)}</h3>'
        f'<p style="margin-bottom:0">{esc(d)}</p></div>' for ic, t, d in servicios)

    faqs_es = [
        ("¿Trabajan con autos importados?",
         "Sí. Damos servicio, reparación y mantenimiento a todas las marcas y modelos, nacionales "
         "e importados."),
        ("¿Sus técnicos están certificados?",
         "Sí. Nuestros técnicos están certificados por ASE (National Institute for Automotive "
         "Service Excellence) y el taller es un centro NAPA AutoCare."),
        ("¿Tienen garantía?",
         "Las reparaciones que califican están cubiertas por la garantía NAPA Peace of Mind: 24 "
         "meses o 24,000 millas en partes y mano de obra, válida en centros NAPA AutoCare de todo "
         "el país. Pregúntenos qué cobertura aplica a su reparación antes de empezar."),
        ("¿Llevar mi carro a un taller independiente cancela la garantía de fábrica?",
         "No. La ley federal Magnuson-Moss protege su derecho a usar un taller independiente sin "
         "perder la garantía de fábrica, siempre que el trabajo se haga correctamente. Guarde sus "
         "recibos."),
        ("¿Cuál es su horario?",
         "Abrimos de lunes a viernes, de 9:00 AM a 6:00 PM. Cerrado sábado y domingo."),
    ]
    faq_items = "".join(
        '<details><summary>%s</summary><div class="answer"><p>%s</p></div></details>'
        % (esc(q), esc(a)) for q, a in faqs_es)

    body = f"""<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Negocio familiar desde 2001 · Elk Grove, California</span>
        <h1>Taller mecánico honesto en <em>Elk Grove</em></h1>
        <div class="rating">{stars()}<span class="rating-text"><strong>{SITE["rating"]} de 5</strong>
          en {SITE["review_count"]} <a href="{MAPS_LISTING}" rel="noopener" data-loc="es-rating">reseñas de Google</a></span></div>
        <p>El mismo taller familiar en el que Elk Grove confía desde hace más de veinte años.
        Técnicos certificados ASE, garantía NAPA que lo acompaña a donde vaya, y una respuesta
        clara sobre lo que su carro realmente necesita — antes de empezar cualquier trabajo.</p>
        <div class="btn-row">
          {tel_btn("btn btn-accent", "es-hero", "Llame al " + SITE["phone_display"])}
          <a class="btn btn-ghost" href="#cotizacion">Pedir cotización</a>
        </div>
        <ul class="hero-points">
          <li>{icon("check-circle")}<span>Todas las marcas y modelos, nacionales e importados</span></li>
          <li>{icon("check-circle")}<span>Técnicos certificados ASE y equipo de diagnóstico actual</span></li>
          <li>{icon("check-circle")}<span>Garantía NAPA: 24 meses / 24,000 millas, a nivel nacional</span></li>
          <li>{icon("check-circle")}<span>Abierto de lunes a viernes, 9:00 AM – 6:00 PM</span></li>
        </ul>
      </div>
      <div id="cotizacion">
        <form class="quote-card" id="es-quote" data-quote-form action="{FORM_ENDPOINT}" method="post" data-mailto="{SITE["email"]}">
          <h2>Pida su cotización</h2>
          <p class="sub">Cuéntenos qué está pasando y le respondemos con los siguientes pasos.
          ¿Prefiere hablar? Llame al {SITE["phone_display"]}.</p>
          <div class="field"><label for="es-nombre">Su nombre</label>
            <input id="es-nombre" name="name" type="text" autocomplete="name" required></div>
          <div class="field"><label for="es-tel">Teléfono</label>
            <input id="es-tel" name="phone" type="tel" autocomplete="tel" required></div>
          <div class="field"><label for="es-vehiculo">Vehículo (año, marca, modelo)</label>
            <input id="es-vehiculo" name="vehicle" type="text" placeholder="2015 Honda Accord"></div>
          <div class="field"><label for="es-servicio">¿Qué servicio necesita?</label>
            <select id="es-servicio" name="service">
              <option value="">Seleccione un servicio</option>
              {"".join('<option>%s</option>' % esc(t) for _, t, _ in servicios)}
              <option>No estoy seguro — necesito diagnóstico</option>
            </select></div>
          <div class="field"><label for="es-mensaje">¿Qué está haciendo el vehículo?</label>
            <textarea id="es-mensaje" name="message" placeholder="Ruidos, luces del tablero, cuándo empezó, y qué le dijeron en otro taller."></textarea></div>
          <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="_subject" value="Cotizacion desde automotivesolutionsbysingle.com">
          <input type="hidden" name="_template" value="table">
          <input type="hidden" name="_captcha" value="false">
          <button class="btn btn-accent" type="submit" style="width:100%">Enviar solicitud</button>
          <p class="form-status" role="status" aria-live="polite"></p>
          <p class="form-note">Sin compromiso. Nunca vendemos su información.
            <a href="tel:{SITE["phone_link"]}" data-loc="es-form-note">Llame al {SITE["phone_display"]}</a>.</p>
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
      <h2>Servicio completo para su vehículo</h2>
      <p>Motores, transmisiones, frenos y aire acondicionado, hasta bandas de distribución,
      balanceo y cambio de aceite — con el mismo método en todos: primero diagnosticar,
      después cotizar.</p>
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
        <p>Y no, llevar su carro a un taller independiente no cancela la garantía de fábrica: la
        ley federal Magnuson-Moss protege ese derecho. Guarde sus recibos y está cubierto.</p>
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
        <table class="hours"><caption class="sr-only">Datos del taller</caption><tbody>
          <tr><th scope="row">Dirección</th><td>{esc(FULL_ADDRESS)}</td></tr>
          <tr><th scope="row">Teléfono</th><td><a href="tel:{SITE["phone_link"]}" data-loc="es-panel">{SITE["phone_display"]}</a></td></tr>
          <tr><th scope="row">Horario</th><td>Lunes a viernes, 9 AM – 6 PM</td></tr>
          <tr><th scope="row">Sábado y domingo</th><td>Cerrado</td></tr>
          <tr><th scope="row">En Elk Grove desde</th><td>2001</td></tr>
          <tr><th scope="row">Técnicos</th><td>Certificados ASE</td></tr>
          <tr><th scope="row">Red</th><td>Centro NAPA AutoCare</td></tr>
          <tr><th scope="row">Garantía</th><td>24 meses / 24,000 millas</td></tr>
        </tbody></table>
        <p style="margin:22px 0 0">
          <a class="btn btn-accent" href="{MAPS_DIRECTIONS}" rel="noopener" data-loc="es-directions" style="width:100%">Cómo llegar</a></p>
        <div style="margin-top:26px">
          {photo_slot("Cada vehículo se diagnostica antes de cotizarse — ese es todo el método.", "En el taller")}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="bg-alt"><div class="wrap">
  <div class="sec-head"><span class="eyebrow">Preguntas</span><h2>Preguntas frecuentes</h2></div>
  <div class="faq">{faq_items}</div>
</div></section>

{cta_band("¿Quiere una respuesta clara sobre su vehículo?",
          "Llame al taller y hable con alguien que repara carros todos los días. Abierto de lunes a viernes, de 9:00 AM a 6:00 PM.")}"""

    render("/es/", "Taller Mecánico en Elk Grove, CA | Automotive Solutions",
           "Taller familiar de reparación de autos en Elk Grove, California desde 2001. Técnicos "
           "ASE, garantía NAPA de 24 meses. Llame al (916) 686-5277.",
           body, schemas=[business_schema(), faq_schema(faqs_es)], lang="es",
           alternates=[("en", "/"), ("es", "/es/"), ("x-default", "/")])
    PAGES.append(("/es/", "0.7", "monthly"))


# ==========================================================================
# Deployment files
#
# OLD_URL_MAP carries the current site's rankings across to the new pages.
# The paths marked (confirmed) were found indexed on the live site; the rest
# are the shapes template sites of this type normally use.
#
# VERIFY THESE AGAINST THE LIVE SITE BEFORE LAUNCH. A 301 passes ranking on;
# a 404 throws it away. Search Console's Pages report, or a crawl of the old
# site, will give you the definitive list.
# ==========================================================================
OLD_URL_MAP = [
    ("/aboutus", "/about/"),                 # confirmed indexed on the live site
    ("/about-us", "/about/"),
    ("/contactus", "/contact/"),
    ("/contact-us", "/contact/"),
    ("/services", "/services/"),             # confirmed indexed on the live site
    ("/auto-repair", "/services/auto-repair/"),
    ("/auto-repair-elk-grove", "/services/auto-repair/"),
    ("/brakes", "/services/brake-repair/"),
    ("/brake-repair", "/services/brake-repair/"),
    ("/engine-repair", "/services/engine-repair/"),
    ("/engine-replacement", "/services/engine-repair/"),
    ("/transmission", "/services/transmission-repair/"),
    ("/transmission-repair", "/services/transmission-repair/"),
    ("/transmission-replacement", "/services/transmission-repair/"),
    ("/air-conditioning", "/services/ac-repair/"),
    ("/ac-repair", "/services/ac-repair/"),
    ("/diagnostics", "/services/car-diagnostics/"),
    ("/drivability", "/services/car-diagnostics/"),
    ("/check-engine-light", "/services/car-diagnostics/"),
    ("/electrical", "/services/electrical-repair/"),
    ("/suspension", "/services/suspension-steering/"),
    ("/shocks-struts", "/services/suspension-steering/"),
    ("/timing-belts", "/services/timing-belts/"),
    ("/timing-belt", "/services/timing-belts/"),
    ("/fuel-injection", "/services/fuel-injection/"),
    ("/tune-ups", "/services/fuel-injection/"),
    ("/belts-hoses", "/services/belts-and-hoses/"),
    ("/oil-change", "/services/oil-change-maintenance/"),
    ("/oil-changes", "/services/oil-change-maintenance/"),
    ("/wheel-balance", "/services/wheel-balancing/"),
    ("/major-overhaul", "/services/engine-repair/"),
    ("/testimonials", "/reviews/"),
    ("/reviews", "/reviews/"),
    ("/coupons", "/contact/"),
    ("/appointment", "/contact/#quote"),
    ("/appointments", "/contact/#quote"),
    ("/index.html", "/"),
    ("/home", "/"),
]


def build_deploy_files():
    if SITE.get("custom_domain"):
        with open(os.path.join(OUT, "CNAME"), "w", encoding="utf-8") as fh:
            fh.write(SITE["custom_domain"] + "\n")

    with open(os.path.join(OUT, "site.webmanifest"), "w", encoding="utf-8") as fh:
        fh.write("""{
  "name": "%s",
  "short_name": "Automotive Solutions",
  "description": "Family owned auto repair in Elk Grove, California since 2001.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#060a2e",
  "icons": [
    { "src": "/assets/img/logo.png", "sizes": "1080x371", "type": "image/png", "purpose": "any" }
  ]
}
""" % SITE["name"])

    # ---- Netlify / Cloudflare Pages ------------------------------------
    lines = ["# Old site URLs -> new pages. Keeps the rankings the current site has earned.",
             "# VERIFY these against the live site before launch, and add any that are missing.",
             "# A 301 passes ranking on to the new URL; a 404 throws it away.",
             ""]
    for old, new in OLD_URL_MAP:
        lines.append("%-30s %-40s 301!" % (old, new))
    lines += ["", "# Trailing-slash variants of the same paths"]
    lines += ["%-30s %-40s 301!" % (old + "/", new) for old, new in OLD_URL_MAP
              if not old.endswith(".html")]
    with open(os.path.join(OUT, "_redirects"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    with open(os.path.join(OUT, "_headers"), "w", encoding="utf-8") as fh:
        fh.write("""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  X-Frame-Options: SAMEORIGIN

# Assets have no fingerprint in the filename, so revalidate daily while
# still serving instantly from cache in the meantime.
/assets/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/*.html
  Cache-Control: public, max-age=0, must-revalidate
""")

    # ---- Apache / cPanel ------------------------------------------------
    rules = "\n".join("Redirect 301 %s %s" % (old, new) for old, new in OLD_URL_MAP)
    with open(os.path.join(OUT, ".htaccess"), "w", encoding="utf-8") as fh:
        fh.write("""# Automotive Solutions by Single - Apache configuration
#
# This file is only needed on a traditional host (cPanel, most shared hosting).
# Netlify and Cloudflare Pages read _redirects and _headers instead and ignore
# this file entirely - leaving it in place is harmless.
#
# IMPORTANT: this filename starts with a dot, which means most file managers
# and FTP clients hide it by default. In cPanel File Manager you must turn on
# "Show Hidden Files (dotfiles)" or it will silently not be uploaded.

RewriteEngine On

# --- Force HTTPS ----------------------------------------------------------
RewriteCond %%{HTTPS} off
RewriteRule ^(.*)$ https://%%{HTTP_HOST}/$1 [R=301,L]

# --- One canonical hostname ----------------------------------------------
# The current site resolves at www., so www is the canonical host here. If you
# would rather serve the bare domain, swap the two rules below AND change
# SITE["base_url"] in build.py to match, then rebuild.
RewriteCond %%{HTTP_HOST} ^automotivesolutionsbysingle\\.com [NC]
RewriteRule ^(.*)$ https://www.automotivesolutionsbysingle.com/$1 [R=301,L]

# --- Old page URLs -> new equivalents ------------------------------------
# VERIFY this list against the live site before launch.
%s

ErrorDocument 404 /404.html

# --- Compression and caching ---------------------------------------------
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/json
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 week"
  ExpiresByType application/javascript "access plus 1 week"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
  ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>

# --- Security headers -----------------------------------------------------
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header set X-Frame-Options "SAMEORIGIN"
</IfModule>
""" % rules)


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

    with open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8") as fh:
        fh.write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE["base_url"])


def copy_assets():
    """Copy the hand-maintained assets/ folder into the output.

    Doing this on every build is what makes `--out somewhere-else` produce a
    complete, self-contained site rather than HTML with no stylesheet."""
    dest = os.path.join(OUT, "assets")
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    shutil.copytree(ASSETS_SRC, dest)


def clean():
    """Remove previously generated output, including assets (they are copied
    back in from assets/ on every build)."""
    if not os.path.isdir(OUT):
        return
    for entry in os.listdir(OUT):
        target = os.path.join(OUT, entry)
        if os.path.isdir(target):
            shutil.rmtree(target)
        elif (entry.endswith((".html", ".xml", ".txt", ".webmanifest"))
              or entry in ("_redirects", "_headers", ".htaccess", "CNAME")):
            os.remove(target)


def main():
    os.makedirs(OUT, exist_ok=True)
    clean()
    copy_assets()

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

    # Fail loudly rather than shipping a site with no stylesheet.
    for required in ("assets/css/site.css", "assets/js/site.js", "assets/img/logo.png",
                     "assets/img/shop-scene.svg", ".htaccess", "_redirects", "sitemap.xml"):
        path = os.path.join(OUT, required)
        assert os.path.exists(path) and os.path.getsize(path) > 0, "MISSING FROM BUILD: " + required

    mode = "relative" if RELATIVE else "root-absolute"
    print("Built %d indexed pages (+ thank-you and 404) into %s [%s links]"
          % (len(PAGES), OUT, mode))
    for p, _, _ in PAGES:
        print("  %s" % p)


if __name__ == "__main__":
    main()
