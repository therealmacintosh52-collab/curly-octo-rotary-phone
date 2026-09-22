"""SiteConfig — the contract every site fills in.

This is the single source of truth for one business. Everything the engine
emits (head, schema, sitemap, deploy files, llms.txt, audit) reads from here,
so a fact stated once here is stated identically everywhere. That is the whole
point: NAP consistency is an entity-ranking signal, and the cheapest way to
guarantee it is to make divergence impossible to express.
"""

from .html import minutes, human_time


class Hours(object):
    """One opening window.

    `closes` earlier than `opens` means the window runs past midnight. Google's
    current guidance is to express that as a SINGLE OpeningHoursSpecification
    with closes < opens, NOT as a 23:59 / 00:00 pair — the split form is older
    advice that still circulates widely. We keep one spec and let consumers
    apply the documented overnight rule.
    """

    def __init__(self, days, opens, closes):
        self.days = list(days)
        self.opens = opens
        self.closes = closes

    @property
    def overnight(self):
        return minutes(self.closes) < minutes(self.opens)

    @property
    def human(self):
        return "%s - %s" % (human_time(self.opens), human_time(self.closes))

    def schema(self):
        return {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": self.days,
            "opens": self.opens,
            "closes": self.closes,
        }


class Platform(object):
    """An off-site ordering / booking destination, e.g. DoorDash.

    `action` maps to a schema.org Action subtype for potentialAction.
    """

    def __init__(self, name, url, action="OrderAction", delivery=None, note=""):
        self.name = name
        self.url = url
        self.action = action
        self.delivery = delivery       # e.g. "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"
        self.note = note


class Profile(object):
    """A third-party listing that proves the business exists. Feeds sameAs."""

    def __init__(self, name, url, rating=None, review_count=None):
        self.name = name
        self.url = url
        self.rating = rating
        self.review_count = review_count


class SiteConfig(object):
    def __init__(self, **kw):
        # --- identity -----------------------------------------------------
        self.name = kw["name"]
        self.short = kw.get("short") or kw["name"]
        # Name variants people and crawlers actually use. These become
        # alternateName so an apostrophe or spacing difference does not split
        # the entity across two half-strength records.
        self.brand_aliases = kw.get("brand_aliases") or []
        self.base_url = kw["base_url"].rstrip("/")
        self.schema_type = kw.get("schema_type", "LocalBusiness")
        self.additional_types = kw.get("additional_types") or []
        self.description = kw.get("description", "")
        self.tagline = kw.get("tagline", "")

        # --- contact / NAP ------------------------------------------------
        self.phone_display = kw.get("phone_display", "")
        self.phone_link = kw.get("phone_link", "")
        self.email = kw.get("email", "")
        self.street = kw.get("street", "")
        self.city = kw.get("city", "")
        self.region = kw.get("region", "")
        self.region_long = kw.get("region_long", "")
        self.zip = kw.get("zip", "")
        self.country = kw.get("country", "US")
        self.lat = kw.get("lat", "")
        self.lng = kw.get("lng", "")
        self.neighborhood = kw.get("neighborhood", "")

        # --- hours ---------------------------------------------------------
        self.hours = kw.get("hours") or []          # [Hours, ...]
        self.hours_rows = kw.get("hours_rows") or []  # [(label, text), ...] for display

        # --- commerce -------------------------------------------------------
        self.price_range = kw.get("price_range", "")
        self.currency = kw.get("currency", "USD")
        self.platforms = kw.get("platforms") or []   # [Platform, ...]
        self.profiles = kw.get("profiles") or []     # [Profile, ...]
        self.areas = kw.get("areas") or []
        self.cuisines = kw.get("cuisines") or []

        # --- ratings ---------------------------------------------------------
        # Deliberately OFF by default. First-party aggregateRating markup on
        # your own business node is self-serving review markup, which Google
        # discourages and which is a common manual-action trigger. Third-party
        # ratings are instead surfaced through Profile.rating + sameAs so the
        # crawler resolves them from the platform that owns them.
        self.self_rating_markup = kw.get("self_rating_markup", False)
        self.rating = kw.get("rating", "")
        self.review_count = kw.get("review_count", "")

        # --- presentation ------------------------------------------------------
        self.theme = kw.get("theme") or {}
        self.logo = kw.get("logo", "")
        self.favicon = kw.get("favicon", "")
        self.og_image = kw.get("og_image", "/assets/img/og-cover.png")
        self.og_image_alt = kw.get("og_image_alt", "")
        self.locale = kw.get("locale", "en_US")
        self.locales = kw.get("locales") or []   # [(lang_code, url_path), ...]

        # --- infra --------------------------------------------------------------
        self.custom_domain = kw.get("custom_domain", "")
        self.form_email = kw.get("form_email", "") or self.email
        self.analytics = kw.get("analytics", "")

    # -- derived ------------------------------------------------------------
    @property
    def full_address(self):
        return "%s, %s, %s %s" % (self.street, self.city, self.region, self.zip)

    @property
    def locality(self):
        return "%s, %s" % (self.city, self.region_long or self.region)

    @property
    def business_id(self):
        return self.base_url + "/#business"

    @property
    def website_id(self):
        return self.base_url + "/#website"

    @property
    def org_id(self):
        return self.base_url + "/#organization"

    def url(self, path):
        return self.base_url + path

    def abs_asset(self, path):
        return self.base_url + path if path.startswith("/") else path

    def hours_schema(self):
        return [h.schema() for h in self.hours]

    def sameas(self):
        return [p.url for p in self.profiles]
