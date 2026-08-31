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
import shutil
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public")

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
    "email": "service@philsautofleet.com",  # TODO: confirm with the shop
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
}

MAPS_DIRECTIONS = ("https://www.google.com/maps/dir/?api=1&destination="
                   + "103+E+Elm+St+Lodi+CA+95240")
MAPS_LISTING = "https://www.google.com/maps/search/?api=1&query=Phil%27s+Auto+and+Fleet+Repair+Lodi+CA"
MAPS_EMBED = ("https://maps.google.com/maps?q=103%20E%20Elm%20St%2C%20Lodi%2C%20CA%2095240"
              "&t=&z=15&ie=UTF8&iwloc=&output=embed")
YELP_URL = "https://www.yelp.com/biz/phils-auto-and-fleet-repair-lodi"

FULL_ADDRESS = "{street}, {city}, {region} {zip}".format(**SITE)

# Set this to your form endpoint (Formspree / Netlify / Basin / your own).
# Until it is set, the form falls back to a prefilled email — see assets/js/site.js.
FORM_ENDPOINT = "REPLACE_WITH_YOUR_FORM_ENDPOINT"

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
]

SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}


# --------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------
NAV = [
    ("Services", "/services/"),
    ("Fleet", "/services/fleet-services/"),
    ("Diesel", "/services/diesel-repair/"),
    ("Reviews", "/reviews/"),
    ("About", "/about/"),
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
        '"image":"%(base)s/assets/img/og-cover.svg",'
        '"priceRange":"$$",'
        '"description":"Locally owned auto repair, diesel and fleet maintenance shop in Lodi, '
        'California. Honest diagnostics, clear pricing and dependable turnaround for domestic, '
        'import and commercial vehicles.",'
        '"address":{"@type":"PostalAddress","streetAddress":"%(street)s","addressLocality":"%(city)s",'
        '"addressRegion":"%(region)s","postalCode":"%(zip)s","addressCountry":"US"},'
        '"geo":{"@type":"GeoCoordinates","latitude":%(lat)s,"longitude":%(lng)s},'
        '"hasMap":"%(map)s",'
        '"openingHoursSpecification":[%(hours)s],'
        '"areaServed":[%(areas)s],'
        '"currenciesAccepted":"USD",'
        '"hasOfferCatalog":{"@type":"OfferCatalog","name":"Auto, diesel and fleet repair services",'
        '"itemListElement":[%(services)s]}}'
        % {"base": SITE["base_url"], "name": SITE["name"], "phone": SITE["phone_link"],
           "email": SITE["email"], "street": SITE["street"], "city": SITE["city"],
           "region": SITE["region"], "zip": SITE["zip"], "lat": SITE["lat"], "lng": SITE["lng"],
           "map": MAPS_LISTING, "hours": hours, "areas": areas, "services": services}
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


def header_html(active=None):
    links = []
    for label, url in NAV:
        cur = ' aria-current="page"' if active == url else ""
        links.append('<a href="%s"%s>%s</a>' % (url, cur, esc(label)))
    return """<div class="topbar">
  <div class="wrap">
    <span>%(pin)s %(addr)s</span>
    <span class="dot" aria-hidden="true">•</span>
    <span>%(clock)s Mon–Sat 8:00 AM – 5:00 PM</span>
    <span class="dot" aria-hidden="true">•</span>
    <a href="tel:%(tel)s" data-loc="topbar">%(phone)s</a>
  </div>
</div>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">PA</span>
      <span class="brand-text">
        <span class="brand-name">Phil's Auto &amp; Fleet Repair</span>
        <span class="brand-sub">Lodi, California</span>
      </span>
    </a>
    <nav class="nav" id="primary-nav" aria-label="Main">%(links)s</nav>
    <div class="header-cta">
      <a class="header-phone" href="tel:%(tel)s" data-loc="header">
        <span>Call the shop</span><strong>%(phone)s</strong>
      </a>
      <a class="btn btn-accent btn-sm" href="/contact/#quote">Get a Quote</a>
    </div>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Menu">
      <svg viewBox="0 0 24 24" aria-hidden="true">%(menu)s</svg>
    </button>
  </div>
</header>""" % {"pin": icon("pin"), "clock": icon("clock"), "addr": esc(FULL_ADDRESS),
                "tel": SITE["phone_link"], "phone": SITE["phone_display"],
                "links": "".join(links), "menu": ICONS["menu"]}


def footer_html():
    svc = "".join('<li><a href="/services/%s/">%s</a></li>' % (s["slug"], esc(s["nav"]))
                  for s in SERVICES)
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/">
          <span class="brand-mark" aria-hidden="true">PA</span>
          <span class="brand-text">
            <span class="brand-name">Phil's Auto &amp; Fleet Repair</span>
            <span class="brand-sub">Lodi, California</span>
          </span>
        </a>
        <p>Locally owned auto, diesel and fleet repair in Lodi — a value-driven alternative to
        the dealership, for drivers and businesses that need the truth about their vehicles.</p>
      </div>
      <div>
        <h4>Services</h4>
        <ul>%(svc)s</ul>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/services/">All Services</a></li>
          <li><a href="/about/">About Phil's</a></li>
          <li><a href="/reviews/">Reviews</a></li>
          <li><a href="/service-areas/">Service Areas</a></li>
          <li><a href="/contact/">Contact &amp; Directions</a></li>
        </ul>
      </div>
      <div>
        <h4>Visit or Call</h4>
        <ul>
          <li><a href="%(map)s" rel="noopener">%(street)s<br>%(city)s, %(region)s %(zip)s</a></li>
          <li><a href="tel:%(tel)s" data-loc="footer">%(phone)s</a></li>
          <li>%(hours)s</li>
        </ul>
        <p style="margin-top:16px"><a class="btn btn-accent btn-sm" href="tel:%(tel)s" data-loc="footer-btn">%(picon)s<span>Call the shop</span></a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span data-year>2026</span> %(name)s. All rights reserved.</span>
      <span><a href="/privacy/">Privacy</a> · <a href="/sitemap.xml">Sitemap</a> · Auto repair in Lodi, CA</span>
    </div>
  </div>
</footer>
<div class="callbar" aria-label="Quick actions">
  <a class="primary" href="tel:%(tel)s" data-loc="callbar">%(picon)s<span>Call</span></a>
  <a href="%(map)s" rel="noopener">%(micon)s<span>Directions</span></a>
  <a href="/contact/#quote">%(cicon)s<span>Get a Quote</span></a>
</div>""" % {"svc": svc, "map": MAPS_DIRECTIONS, "street": esc(SITE["street"]),
             "city": SITE["city"], "region": SITE["region"], "zip": SITE["zip"],
             "tel": SITE["phone_link"], "phone": SITE["phone_display"],
             "hours": esc(SITE["hours_human"]), "name": esc(SITE["name"]),
             "picon": icon("phone"), "micon": icon("map"), "cicon": icon("chat")}


def render(path, title, description, body, schemas=None, active=None, noindex=False):
    """Write one page. `path` is a URL path like '/services/brakes/' ('/' = home)."""
    canonical = SITE["base_url"] + path
    schemas = schemas or []
    schema_html = "".join('\n<script type="application/ld+json">%s</script>' % s for s in schemas)
    doc = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
%(robots)s<meta name="theme-color" content="#0e1720">
<meta property="og:type" content="website">
<meta property="og:site_name" content="%(name)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(base)s/assets/img/og-cover.svg">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="geo.region" content="US-CA">
<meta name="geo.placename" content="Lodi, California">
<meta name="geo.position" content="%(lat)s;%(lng)s">
<meta name="ICBM" content="%(lat)s, %(lng)s">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/favicon.svg">
<link rel="stylesheet" href="/assets/css/site.css">%(schema)s
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
       "lat": SITE["lat"], "lng": SITE["lng"], "schema": schema_html,
       "header": header_html(active), "body": body, "footer": footer_html()}

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
    <label for="%(id)s-message">What's happening with it?</label>
    <textarea id="%(id)s-message" name="message" placeholder="Noises, warning lights, when it started, anything another shop already told you."></textarea>
  </div>
  <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
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


def trust_strip():
    items = [
        ("shield", "Diagnosis before parts", "We find the cause, then quote the fix"),
        ("dollar", "Dealership alternative", "Fair pricing without the dealer counter"),
        ("truck", "Auto, diesel &amp; fleet", "Daily drivers and work trucks under one roof"),
        ("clock", "Open six days a week", "Mon–Sat, 8:00 AM – 5:00 PM"),
    ]
    cells = "".join(
        '<div class="trust-item">%s<div><strong>%s</strong><span>%s</span></div></div>'
        % (icon(ic), t, s) for ic, t, s in items
    )
    return '<div class="trust"><div class="wrap"><div class="trust-grid">%s</div></div></div>' % cells


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
    {"quote": "GREAT SERVICE! Above and beyond expectations!! Completed service on schedule!! "
              "I will be bringing my cars here from now on!",
     "name": "Verified customer review", "source": "MapQuest", "url": ""},
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
    for ic, title, body in REVIEW_THEMES:
        cards.append("""<div class="review">
  <span class="card-ico">%s</span>
  <h3>%s</h3>
  <p style="color:var(--slate);margin:0">%s</p>
</div>""" % (icon(ic), esc(title), esc(body)))
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


def build_home():
    body = f"""<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow" style="color:#ffa76b">Locally owned · Lodi, California</span>
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

{trust_strip()}

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
    <div class="split">
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

<section class="bg-alt">
  <div class="wrap">
    <div class="split" style="align-items:center">
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
        <div class="btn-row" style="margin-top:26px">
          <a class="btn btn-accent" href="/services/fleet-services/">Fleet services {icon("arrow")}</a>
          <a class="btn btn-outline" href="tel:{SITE["phone_link"]}" data-loc="fleet">Talk to us about your fleet</a>
        </div>
      </div>
      <div class="panel">
        <h3>Run two vehicles or twenty?</h3>
        <p>Either way, the questions are the same: what's it going to cost to keep these on the road,
        and when is each one due? We'll help you answer both.</p>
        <p><strong>Common fleet customers:</strong> contractors and trades, delivery and courier
        vans, agricultural and landscaping trucks, service businesses across San Joaquin County.</p>
        <p style="margin-bottom:0"><a class="btn btn-dark" href="/contact/#quote" style="width:100%">Request a fleet consultation</a></p>
      </div>
    </div>
  </div>
</section>

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
           active="/")
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
</div>

{trust_strip()}

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
      <div class="panel">
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
        <p style="margin:20px 0 0">{tel_btn("btn btn-accent", "about-panel")}</p>
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
</div>

<section>
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">The pattern</span>
      <h2>Three things customers mention over and over</h2>
      <p>Ratings are a number. What's more useful is the theme behind them — and across platforms,
      the same three points come up.</p></div>
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
  <p><strong>Third-party services.</strong> Map and review links on this site lead to Google, Yelp
  and similar services, which apply their own privacy policies once you leave our site.</p>
  <p><strong>Your choices.</strong> Ask us to delete the information you sent and we will —
  call {SITE["phone_display"]} or email <a href="mailto:{SITE["email"]}">{SITE["email"]}</a>.</p>
  <p><strong>Contact.</strong> {esc(SITE["name"])}, {esc(FULL_ADDRESS)},
  <a href="tel:{SITE["phone_link"]}">{SITE["phone_display"]}</a>.</p>
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
</div></section>"""
    render("/404/", seo_title("Page Not Found"),
           "That page could not be found. Browse our auto, diesel and fleet repair services in "
           "Lodi, CA, or call the shop at (209) 647-4953.", body, noindex=True)
    # Most static hosts look for /404.html at the root.
    shutil.copyfile(os.path.join(OUT, "404", "index.html"), os.path.join(OUT, "404.html"))


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
    """Remove previously generated HTML, leaving /assets untouched."""
    for entry in os.listdir(OUT):
        if entry == "assets":
            continue
        target = os.path.join(OUT, entry)
        if os.path.isdir(target):
            shutil.rmtree(target)
        elif entry.endswith((".html", ".xml", ".txt")):
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
    build_privacy()
    build_thanks()
    build_404()
    build_sitemap()
    print("Built %d pages into %s" % (len(PAGES) + 2, OUT))
    for p, _, _ in PAGES:
        print("  %s" % p)


if __name__ == "__main__":
    main()
