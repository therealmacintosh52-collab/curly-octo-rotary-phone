"""Single source of truth for the facts every page, schema block and text file repeats.
Mirrors strategy/ENTITY-PLAN.md. Change a value here and rebuild; nothing else types its own copy."""
from datetime import date

NAME = "916 Dent & Detail"
TAGLINE = "Precision · Care · Perfection."
HERO_LINES = ("Dents gone.", "Paint glowing.", "We come to you.")

# Phone: owner-supplied from the business card. PHONE_CONFIRMED stays False until the owner has checked the
# digits and that the number receives texts with photos (TO-CONFIRM #1). While False, every page carries
# <meta name="phone-status" content="unconfirmed"> and tools/lint.py --production fails.
PHONE_DISPLAY = "(916) 868-2447"
PHONE_E164 = "+19168682447"
PHONE_SCHEMA = "+1-916-868-2447"
PHONE_CONFIRMED = False

INSTAGRAM_HANDLE = "@916dentanddetail"
INSTAGRAM_URL = "https://www.instagram.com/916dentanddetail/"   # owner-provided, not verified live (TO-CONFIRM #13)
REVIEW_URL = None        # set when the owner supplies the Google review link; adds the footer link

HERO_IS_REAL_JOB = False  # owner flips to True only if the footage is a real job and they approve (TO-CONFIRM #4)

# canonical order (ENTITY-PLAN section 1). kind: city = incorporated, place = community
PLACES = [
    ("Sacramento", "city"), ("Elk Grove", "city"), ("Roseville", "city"), ("Folsom", "city"),
    ("Rancho Cordova", "city"), ("Citrus Heights", "city"), ("West Sacramento", "city"), ("Davis", "city"),
    ("Rocklin", "city"), ("Lincoln", "city"), ("El Dorado Hills", "place"), ("Granite Bay", "place"),
    ("Carmichael", "place"), ("Natomas", "place"),
]
PLACE_NAMES = [p[0] for p in PLACES]
PLACES_STRING = ", ".join(PLACE_NAMES[:-1]) + " and " + PLACE_NAMES[-1]
CITY_PAGES = {"Sacramento": "/service-area/sacramento/", "Elk Grove": "/service-area/elk-grove/",
              "Roseville": "/service-area/roseville/", "Folsom": "/service-area/folsom/"}

DESC_SHORT = ("Mobile paintless dent repair and auto detailing that come to you in Sacramento, Elk Grove, "
              "Roseville, Folsom and nearby cities. Send a photo for a price.")
DESC_MEDIUM = ("916 Dent & Detail is a mobile service for paintless dent repair and auto detailing in the Sacramento "
               "area. Two owner-technicians and a crew come to your home, workplace or lot. Send photos of your dent "
               "to get a price.")
DESC_LONG = ("916 Dent & Detail is a mobile service in the Sacramento area. We remove dents without paint or a body "
             "shop where the metal and paint allow it, and we tell you plainly when a dent is not a candidate. We also "
             "detail cars inside and out, including paint deep-clean, swirl and scratch removal, ceramic coating, "
             "interior cleaning and hail damage repair when it happens. Two owner-technicians and a crew come to your "
             "home, workplace or lot in " + PLACES_STRING + ". Dealerships, fleets, rental lots and body shops are "
             "served too. Text photos of your dent to get a price.")

SCHEMA_TYPE = "AutomotiveBusiness"   # verified on schema.org (parent of AutoBodyShop, AutoRepair, AutoWash...)

BUILD_DATE = date.today().isoformat()
GUIDE_REVIEWED_ISO = "2026-10-18"
GUIDE_REVIEWED_LABEL = "October 2026"

SERVICES = [  # (url, plain name, real term, one line)
    ("/paintless-dent-repair/", "Dent Removal (no paint, no body shop)", "Paintless dent repair",
     "Dents pushed out from behind the panel, with no filler and no repaint, when the paint is intact."),
    ("/hail-damage-repair/", "Hail Fix", "Hail damage repair",
     "For the occasional valley hail storm: what can be fixed without paint and what to do first."),
    ("/mobile-detailing/", "Paint Deep-Clean", "Mobile detailing and paint decontamination",
     "Stuck-on grime, sap and water spots lifted from the paint at your driveway or lot."),
    ("/paint-correction/", "Swirl & Scratch Erase", "Paint correction",
     "Machine polishing for swirls and light scratches. Deep scratches are a different job."),
    ("/ceramic-coating/", "Gloss Shield", "Ceramic coating",
     "A coating over corrected paint, explained without durability promises."),
    ("/interior-detailing/", "Interior Reset", "Interior detailing",
     "Pet hair, spills, odor and the dust in the seams."),
]
