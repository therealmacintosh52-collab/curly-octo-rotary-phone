# -*- coding: utf-8 -*-
"""Stark's Hot Chicken -- all business facts, menu data and copy.

Single source of truth. build.py renders it; nothing here is repeated there.

PROVENANCE
----------
Facts marked [SITE] were read out of the live starks-hot-chicken.com markup.
Facts marked [SEARCH] came from third-party listings and are lower confidence.
Facts marked [DRAFT] are written copy that the owner should review.

The menu below is RECONSTRUCTED. The live site renders its menu client-side
from assets/js/menu-data.js, which we do not have -- replace MENU wholesale
when that file is available. Prices are delivery-platform prices and, per the
restaurant's own disclaimer, may differ from pickup.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from _engine import SiteConfig, Hours, Platform, Profile   # noqa: E402

# Canonical host. See README -- the brand currently also operates
# starkshotchicken.com, which splits link equity and the entity. This build
# assumes starks-hot-chicken.com wins and the other 301s to it.
BASE = "https://starks-hot-chicken.com"

DOORDASH = "https://www.doordash.com/store/starks-hot-chicken-los-angeles-1064390/"   # [SITE]
UBEREATS = "https://www.ubereats.com/store/starks-hot-chicken/9AUboh86RMSwK0V9vK-1mg"  # [SITE]
PICKUP = "https://starkshotchicken.com/"                                              # [SITE]

CFG = SiteConfig(
    name="Stark's Hot Chicken",
    short="Stark's",
    # The live site's own <h1> reads "Starks" while everything else reads
    # "Stark's". Rather than leave the two variants competing, both are
    # declared as aliases of one entity.
    brand_aliases=["Starks Hot Chicken", "Stark's", "Starks",
                   "Stark's Hot Chicken Los Angeles"],
    base_url=BASE,
    schema_type="Restaurant",
    additional_types=["LocalBusiness"],
    tagline="Crispy Heat. Big Flavor.",                                   # [SITE]
    description=("Nashville-inspired hot chicken in Koreatown, Los Angeles. "
                 "Fresh chicken fried crispy to order, dunked in one of six "
                 "heat levels and finished with house-made sauces. Pickup and "
                 "delivery on DoorDash and Uber Eats."),
    phone_display="(213) 378-0138",                                       # [SITE]
    phone_link="+12133780138",                                            # [SITE]
    street="207 S Vermont Ave",                                           # [SITE]
    city="Los Angeles",
    region="CA",
    region_long="California",
    zip="90004",                                                          # [SITE]
    country="US",
    lat="34.0722",    # [SEARCH] approximate -- verify against Google Business Profile
    lng="-118.2917",
    neighborhood="Koreatown",
    price_range="$$",
    cuisines=["Hot Chicken", "Southern", "American", "Korean-American",
              "Fried Chicken"],
    hours=[
        # Mon-Thu and Fri-Sat close AFTER midnight. Expressed as a SINGLE spec
        # each with closes < opens, which is Google's current guidance for an
        # overnight window -- not split into 23:59/00:00 pairs.
        Hours(["Monday", "Tuesday", "Wednesday", "Thursday"], "11:00", "00:45"),  # [SITE]
        Hours(["Friday", "Saturday"], "11:00", "01:45"),                          # [SITE]
        Hours(["Sunday"], "11:00", "22:30"),                                      # [SITE]
    ],
    hours_rows=[
        ("Monday - Thursday", "11:00 AM - 12:45 AM"),
        ("Friday - Saturday", "11:00 AM - 1:45 AM"),
        ("Sunday", "11:00 AM - 10:30 PM"),
    ],
    platforms=[
        Platform("DoorDash", DOORDASH, "OrderAction",
                 delivery="http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"),
        Platform("Uber Eats", UBEREATS, "OrderAction",
                 delivery="http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"),
        Platform("Pickup", PICKUP, "OrderAction",
                 delivery="http://purl.org/goodrelations/v1#DeliveryModePickUp"),
    ],
    profiles=[
        Profile("DoorDash", DOORDASH),
        Profile("Uber Eats", UBEREATS),
        Profile("Yelp", "https://www.yelp.com/biz/starks-hot-chicken-los-angeles"),
        Profile("Facebook", "https://www.facebook.com/starkshc/"),
        Profile("Grubhub", "https://www.grubhub.com/restaurant/"
                           "starks-hot-chicken-207-s-vermont-ave-los-angeles/2262674"),
        Profile("Apple Maps", "https://maps.apple.com/place?place-id=I4EFEB9ECBF41FF9F"),
        Profile("The Infatuation",
                "https://www.theinfatuation.com/los-angeles/reviews/starks-hot-chicken"),
    ],
    areas=["Los Angeles", "Koreatown", "East Hollywood", "Silver Lake",
           "Echo Park", "Westlake", "Hancock Park", "Larchmont",
           "Downtown Los Angeles", "Mid-Wilshire"],
    # OFF. The live site prints "4.7 / 3,000+ ratings across platforms" as
    # decorative text with no attribution and no markup. Marking that up on our
    # own business node would be self-serving review markup. Instead the
    # platform listings carry it via sameAs, and the on-page claim is
    # attributed. Turn this on only with a verifiable single source.
    self_rating_markup=False,
    theme={
        "theme_color": "#0B0B0D",
        "background": "#0B0B0D",
    },
    logo="/assets/img/logo.png",
    favicon="/assets/img/favicon.svg",
    og_image="/assets/img/og-cover.png",
    og_image_alt=("Stark's Hot Chicken - Nashville-inspired hot chicken on "
                  "Vermont Avenue in Koreatown, Los Angeles"),
    locale="en_US",
    locales=[("en", "/"), ("es", "/es/"), ("ko", "/ko/"), ("x-default", "/")],
    custom_domain="",
)

# --------------------------------------------------------------------------
# Heat levels                                                          [SITE]
# --------------------------------------------------------------------------
HEAT = [
    {"name": "Original", "sub": "No Spice", "scoville": "0",
     "note": "No heat at all. The seasoning and the crust, nothing more.",
     "who": "Kids, anyone who wants the crunch without the burn, and a safe "
            "first order if you are ordering for a group."},
    {"name": "Mild", "sub": "A whisper", "scoville": "~1,000",
     "note": "Warmth on the finish. You will notice it; you will not reach for water.",
     "who": "People who say they do not like spicy food but usually finish the plate."},
    {"name": "Medium", "sub": "The crowd favorite", "scoville": "~5,000",
     "note": "Real heat that still lets you taste the chicken. This is the one "
             "most people order twice.",
     "who": "The default. If you are unsure, order Medium."},
    {"name": "Hot", "sub": "Nashville proper", "scoville": "~15,000",
     "note": "Where the cayenne stops being a background note. Sweat is on the table.",
     "who": "Regular hot-sauce drinkers. Roughly a jalapeno-and-a-half."},
    {"name": "Extra Hot", "sub": "Commitment", "scoville": "~50,000",
     "note": "Sustained burn that builds across the sandwich rather than spiking.",
     "who": "People who finish Hot and want more. Order a side of slaw."},
    {"name": "Stark Hot", "sub": "You have to earn it", "scoville": "100,000+",
     "note": "The top of the board. Gloves-on heat that keeps going after the "
             "last bite.",
     "who": "Chili-heads only. Not a dare to take on an empty stomach."},
]

# --------------------------------------------------------------------------
# MENU -- RECONSTRUCTED. Replace from assets/js/menu-data.js when available.
# Prices are DoorDash/Uber Eats delivery prices.          [SITE] + [SEARCH]
# --------------------------------------------------------------------------
MENU_DISCLAIMER = ("Menu, prices and descriptions as listed on the official "
                   "Stark's Hot Chicken DoorDash and Uber Eats stores. Prices "
                   "may differ between delivery and pickup.")   # [SITE]

MENU = [
    {
        "slug": "sandos",
        "name": "Sandos",
        "blurb": ("The signature. Hot chicken on a pillowy brioche bun with "
                  "briney slaw, pickles and comeback sauce."),
        "items": [
            {"name": "The Stark Sando", "price": "12.99",
             "desc": "Jumbo hot chicken breast on brioche with slaw, pickles and "
                     "comeback sauce. Pick your heat level.",
             "image": "/assets/img/menu/stark-sando.png"},
            {"name": "Double Stark Sando", "price": "16.99",
             "desc": "Two hot chicken breasts, double slaw, double pickles, one bun.",
             "image": "/assets/img/menu/double-sando.png"},
            {"name": "Korean Sweet Pop Sando", "price": "13.99",
             "desc": "Hot chicken glazed in sweet-and-spicy gochujang, with slaw "
                     "and pickles on brioche.",
             "image": "/assets/img/menu/korean-sweet-pop-chicken.png"},
            {"name": "Sando Slider", "price": "7.99",
             "desc": "The Stark Sando, smaller. Good for adding a second heat level.",
             "image": ""},
        ],
    },
    {
        "slug": "tenders",
        "name": "Jumbo Tenders",
        "blurb": "Hand-breaded jumbo tenders, fried to order and dunked in your heat.",
        "items": [
            {"name": "3 Jumbo Tenders", "price": "11.99",
             "desc": "Three jumbo tenders with pickles, Texas toast and one sauce.",
             "image": "/assets/img/menu/tenders-3.png"},
            {"name": "5 Jumbo Tenders", "price": "16.99",
             "desc": "Five jumbo tenders with pickles, Texas toast and two sauces.",
             "image": ""},
            {"name": "Tender Plate", "price": "18.99",
             "desc": "Four tenders, seasoned fries, slaw and two sauces.", "image": ""},
        ],
    },
    {
        "slug": "wings",
        "name": "Wings",
        "blurb": "Crispy wings, same six heat levels, sauced or dry.",
        "items": [
            {"name": "6 Wings", "price": "10.99",
             "desc": "Six wings in your heat level with ranch or comeback sauce.",
             "image": "/assets/img/menu/wings.png"},
            {"name": "12 Wings", "price": "19.99",
             "desc": "Twelve wings, two heat levels if you want them split.", "image": ""},
            {"name": "24 Wings", "price": "37.99",
             "desc": "Party count. Split across up to four heat levels.", "image": ""},
        ],
    },
    {
        "slug": "popcorn-chicken",
        "name": "Popcorn Chicken",
        "blurb": "Bite-size, tossed in sauce, built for sharing.",
        "items": [
            {"name": "Korean Sweet Pop Chicken", "price": "13.99",
             "desc": "Popcorn chicken and rice cakes tossed in sweet-spicy "
                     "gochujang glaze, with sesame and scallion.",
             "image": "/assets/img/menu/korean-sweet-pop-chicken.png"},
            {"name": "Popcorn Chicken", "price": "10.99",
             "desc": "Bite-size hot chicken in your heat level with one sauce.",
             "image": ""},
        ],
    },
    {
        "slug": "loaded-fries",
        "name": "Loaded Fries",
        "blurb": "The sleeper hits. Fries as a whole meal.",
        "items": [
            {"name": "Sloppy Cheeto Fries", "price": "13.99",
             "desc": "Seasoned fries under chopped hot chicken, melted cheese "
                     "sauce and crushed Hot Cheetos.",
             "image": "/assets/img/menu/sloppy-cheeto-fries.png"},
            {"name": "Sloppy Fries", "price": "12.99",
             "desc": "Seasoned fries, chopped hot chicken, cheese sauce and "
                     "comeback drizzle.", "image": ""},
        ],
    },
    {
        "slug": "sides",
        "name": "Sides",
        "blurb": "What balances the fire.",
        "items": [
            {"name": "Spicy Mac & Cheese", "price": "6.99",
             "desc": "Creamy mac with smoked paprika and a kick.",
             "image": "/assets/img/menu/mac.png"},
            {"name": "Seasoned Fries", "price": "4.99",
             "desc": "Crinkle-cut, tossed in house seasoning.", "image": ""},
            {"name": "Coleslaw", "price": "3.99",
             "desc": "Briney, cold and sharp. Order it with anything above Medium.",
             "image": ""},
            {"name": "Pickles", "price": "1.99", "desc": "House pickle chips.",
             "image": ""},
            {"name": "Texas Toast", "price": "2.49", "desc": "Buttered and griddled.",
             "image": ""},
        ],
    },
    {
        "slug": "combos",
        "name": "Combos",
        "blurb": "Sando or tenders, a side and a drink.",
        "items": [
            {"name": "Combo 1", "price": "19.99",
             "desc": "Two sandos, seasoned fries and a drink.",
             "image": "/assets/img/menu/combo-1.png"},
            {"name": "Combo 2", "price": "17.99",
             "desc": "Sando, three tenders, fries and a drink.", "image": ""},
            {"name": "Combo 3", "price": "18.99",
             "desc": "Sando, tender, loaded fries and a drink.",
             "image": "/assets/img/menu/combo-3.png"},
            {"name": "Combo 4", "price": "16.99",
             "desc": "Three tenders, fries, slaw and a drink.", "image": ""},
        ],
    },
    {
        "slug": "drinks",
        "name": "Drinks",
        "blurb": "Cold things, for obvious reasons.",
        "items": [
            {"name": "Fountain Drink", "price": "2.99", "desc": "", "image": ""},
            {"name": "Bottled Water", "price": "1.99", "desc": "", "image": ""},
            {"name": "Horchata", "price": "4.49",
             "desc": "The best answer to Extra Hot.", "image": ""},
        ],
    },
]

GALLERY = [
    ("/assets/img/gallery/signature-sando.png", "The Signature Sando",
     "Stark's signature hot chicken sando with slaw, pickles and comeback sauce"),
    ("/assets/img/gallery/storefront.png", "Vermont Ave",
     "Stark's Hot Chicken storefront on Vermont Avenue at dusk"),
    ("/assets/img/menu/korean-sweet-pop-chicken.png", "Korean Sweet Pop",
     "Korean Sweet Pop Chicken glazed in sweet and spicy gochujang sauce"),
    ("/assets/img/menu/combo-1.png", "Combo 1", "Combo 1 - two sandos with fries"),
    ("/assets/img/gallery/entrance.png", "Door 207",
     "The front doors of Stark's Hot Chicken with the neon open sign"),
    ("/assets/img/menu/sloppy-cheeto-fries.png", "Sloppy Cheeto Fries",
     "Sloppy Cheeto Fries with chopped hot chicken, cheese sauce and crushed Hot Cheetos"),
    ("/assets/img/menu/combo-3.png", "Sando + Tender", "Combo 3 - sando and tender with fries"),
    ("/assets/img/gallery/interior.png", "The Glow",
     "The glowing Stark's sign and chicken mascot inside the restaurant"),
    ("/assets/img/menu/wings.png", "Wings", "Chicken wings available in all six heat levels"),
]
