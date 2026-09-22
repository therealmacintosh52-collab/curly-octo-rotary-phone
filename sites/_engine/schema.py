"""JSON-LD emission as a single linked @graph per page.

The important idea here: one @graph with stable @ids that reference each
other, rather than several disconnected <script> blobs. Disconnected blobs are
individually valid and collectively meaningless -- nothing tells a consumer
that the FAQ, the breadcrumb and the business are the same entity's. Stable
@ids plus mainEntity / isPartOf / about / publisher edges do.

@id conventions, fixed across every site:
    <base>/#organization   the company as an entity
    <base>/#business       the physical place (LocalBusiness subtype)
    <base>/#website        the site
    <url>#webpage          one page
    <url>#menu             a menu (restaurants)
"""

import json


class SchemaGraph(object):
    def __init__(self, cfg):
        self.cfg = cfg
        self.nodes = []

    def add(self, node):
        if node:
            self.nodes.append(node)
        return self

    def json(self):
        return json.dumps(
            {"@context": "https://schema.org", "@graph": self.nodes},
            ensure_ascii=False, separators=(",", ":"))

    # ------------------------------------------------------------------
    # Core entity nodes
    # ------------------------------------------------------------------
    def business(self):
        cfg = self.cfg
        types = [cfg.schema_type] + list(cfg.additional_types)
        node = {
            "@type": types[0] if len(types) == 1 else types,
            "@id": cfg.business_id,
            "name": cfg.name,
            "url": cfg.base_url + "/",
        }
        if cfg.brand_aliases:
            node["alternateName"] = cfg.brand_aliases
        if cfg.description:
            node["description"] = cfg.description
        if cfg.phone_link:
            node["telephone"] = cfg.phone_link
        if cfg.email:
            node["email"] = cfg.email
        if cfg.og_image:
            node["image"] = cfg.abs_asset(cfg.og_image)
        if cfg.logo:
            node["logo"] = cfg.abs_asset(cfg.logo)
        if cfg.price_range:
            node["priceRange"] = cfg.price_range
        if cfg.currency:
            node["currenciesAccepted"] = cfg.currency
        if cfg.street:
            node["address"] = {
                "@type": "PostalAddress",
                "streetAddress": cfg.street,
                "addressLocality": cfg.city,
                "addressRegion": cfg.region,
                "postalCode": cfg.zip,
                "addressCountry": cfg.country,
            }
        if cfg.lat and cfg.lng:
            node["geo"] = {"@type": "GeoCoordinates",
                           "latitude": cfg.lat, "longitude": cfg.lng}
        if cfg.hours:
            node["openingHoursSpecification"] = cfg.hours_schema()
        if cfg.cuisines:
            node["servesCuisine"] = cfg.cuisines
        if cfg.sameas():
            node["sameAs"] = cfg.sameas()
        if cfg.areas:
            node["areaServed"] = [
                {"@type": "City", "name": a,
                 "address": {"@type": "PostalAddress", "addressRegion": cfg.region}}
                for a in cfg.areas]
        if cfg.neighborhood:
            node["containedInPlace"] = {"@type": "Place", "name": cfg.neighborhood}
        # See SiteConfig.self_rating_markup for why this is opt-in.
        if cfg.self_rating_markup and cfg.rating and cfg.review_count:
            node["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": cfg.rating,
                "reviewCount": cfg.review_count,
            }
        actions = [self._action(p) for p in cfg.platforms]
        actions = [a for a in actions if a]
        if actions:
            node["potentialAction"] = actions
        node["parentOrganization"] = {"@id": cfg.org_id}
        return node

    def organization(self):
        cfg = self.cfg
        node = {
            "@type": "Organization",
            "@id": cfg.org_id,
            "name": cfg.name,
            "url": cfg.base_url + "/",
        }
        if cfg.brand_aliases:
            node["alternateName"] = cfg.brand_aliases
        if cfg.logo:
            node["logo"] = cfg.abs_asset(cfg.logo)
        if cfg.sameas():
            node["sameAs"] = cfg.sameas()
        if cfg.phone_link:
            node["contactPoint"] = {
                "@type": "ContactPoint",
                "telephone": cfg.phone_link,
                "contactType": "customer service",
                "areaServed": cfg.country,
                "availableLanguage": [c for c, _ in cfg.locales] or ["en"],
            }
        return node

    def _action(self, platform):
        if not platform.url:
            return None
        action = {
            "@type": platform.action,
            "name": "Order from %s" % platform.name,
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": platform.url,
                "inLanguage": "en-US",
                "actionPlatform": [
                    "http://schema.org/DesktopWebPlatform",
                    "http://schema.org/IOSPlatform",
                    "http://schema.org/AndroidPlatform",
                ],
            },
        }
        if platform.delivery:
            action["deliveryMethod"] = platform.delivery
        return action

    def website(self):
        cfg = self.cfg
        return {
            "@type": "WebSite",
            "@id": cfg.website_id,
            "url": cfg.base_url + "/",
            "name": cfg.name,
            "publisher": {"@id": cfg.org_id},
            "inLanguage": (cfg.locale or "en_US").replace("_", "-"),
        }

    def webpage(self, url, title, description, kind="WebPage",
                primary_image=None, speakable_css=None, published=None, modified=None):
        cfg = self.cfg
        node = {
            "@type": kind,
            "@id": url + "#webpage",
            "url": url,
            "name": title,
            "description": description,
            "isPartOf": {"@id": cfg.website_id},
            "about": {"@id": cfg.business_id},
        }
        if primary_image:
            node["primaryImageOfPage"] = cfg.abs_asset(primary_image)
        if speakable_css:
            node["speakable"] = {
                "@type": "SpeakableSpecification",
                "cssSelector": list(speakable_css),
            }
        if published:
            node["datePublished"] = published
        if modified:
            node["dateModified"] = modified
        return node

    # ------------------------------------------------------------------
    def breadcrumb(self, trail, base_url):
        items = []
        for i, (label, url) in enumerate(trail, start=1):
            item = {"@type": "ListItem", "position": i, "name": label}
            if url:
                item["item"] = base_url + url
            items.append(item)
        node = {"@type": "BreadcrumbList", "itemListElement": items}
        last_url = trail[-1][1] if trail else None
        if last_url:
            node["@id"] = base_url + last_url + "#breadcrumb"
        return node

    def faq(self, faqs, page_url):
        if not faqs:
            return None
        return {
            "@type": "FAQPage",
            "@id": page_url + "#faq",
            "isPartOf": {"@id": page_url + "#webpage"},
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in faqs],
        }

    def reviews(self):
        """Third-party ratings, attributed to the platform that owns them.

        This is the honest alternative to first-party aggregateRating: the
        rating is stated, but it is clearly sourced, and sameAs on the business
        node points at the listing a crawler can verify it against.
        """
        out = []
        for p in self.cfg.profiles:
            if not (p.rating and p.review_count):
                continue
            out.append({
                "@type": "AggregateRating",
                "itemReviewed": {"@id": self.cfg.business_id},
                "ratingValue": str(p.rating),
                "reviewCount": str(p.review_count),
                "bestRating": "5",
                "worstRating": "1",
                "author": {"@type": "Organization", "name": p.name, "url": p.url},
            })
        return out

    # ------------------------------------------------------------------
    # Restaurant-specific
    # ------------------------------------------------------------------
    def menu(self, sections, page_url, name="Menu", disclaimer=""):
        """`sections` is [(section_name, section_desc, [item, ...]), ...].

        Each item is a dict: name, desc, price (str or None), image, diet.
        """
        cfg = self.cfg
        menu_sections = []
        for sec_name, sec_desc, items in sections:
            entries = []
            for it in items:
                node = {"@type": "MenuItem", "name": it["name"]}
                if it.get("desc"):
                    node["description"] = it["desc"]
                if it.get("price"):
                    node["offers"] = {
                        "@type": "Offer",
                        "price": str(it["price"]).lstrip("$"),
                        "priceCurrency": cfg.currency,
                        "availability": "https://schema.org/InStock",
                    }
                if it.get("image"):
                    node["image"] = cfg.abs_asset(it["image"])
                if it.get("diet"):
                    node["suitableForDiet"] = it["diet"]
                entries.append(node)
            section = {"@type": "MenuSection", "name": sec_name,
                       "hasMenuItem": entries}
            if sec_desc:
                section["description"] = sec_desc
            menu_sections.append(section)
        node = {
            "@type": "Menu",
            "@id": cfg.base_url + "/#menu",
            "name": name,
            "url": page_url,
            "inLanguage": "en-US",
            "hasMenuSection": menu_sections,
        }
        if disclaimer:
            node["description"] = disclaimer
        return node

    def service(self, name, description, url, service_type=None):
        cfg = self.cfg
        node = {
            "@type": "Service",
            "@id": url + "#service",
            "name": name,
            "description": description,
            "url": url,
            "serviceType": service_type or name,
            "provider": {"@id": cfg.business_id},
        }
        if cfg.areas:
            node["areaServed"] = [{"@type": "City", "name": a} for a in cfg.areas]
        return node

    def article(self, title, description, url, published, modified, image=None):
        cfg = self.cfg
        node = {
            "@type": "Article",
            "@id": url + "#article",
            "headline": title,
            "description": description,
            "mainEntityOfPage": {"@id": url + "#webpage"},
            "datePublished": published,
            "dateModified": modified,
            "author": {"@id": cfg.org_id},
            "publisher": {"@id": cfg.org_id},
        }
        if image:
            node["image"] = cfg.abs_asset(image)
        return node
