import pages_home, pages_services, pages_guides, pages_places, pages_misc

FACTORIES = [
    pages_home.home,
    pages_services.pdr, pages_services.hail, pages_services.detailing, pages_services.correction,
    pages_services.coating, pages_services.interior,
    pages_misc.photo_quote, pages_misc.dealers,
    pages_guides.index, pages_guides.price, pages_guides.fixable, pages_guides.vs_body_shop, pages_guides.claim,
    pages_places.hub, pages_places.sacramento, pages_places.elk_grove, pages_places.roseville, pages_places.folsom,
    pages_misc.about, pages_misc.contact, pages_misc.faq, pages_misc.privacy, pages_misc.terms, pages_misc.not_found,
]
