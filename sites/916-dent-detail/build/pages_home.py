import config as C
from lib import *   # noqa

INTRO = ("916 Dent & Detail is a mobile service in the Sacramento area. We remove dents without paint or a body shop where the "
         "metal and paint allow it, detail cars inside and out, and come to your home, workplace or lot. Text two to four photos "
         "of the dent and we tell you what we can do.")


def home():
    places = "".join(
        '<li>%s</li>' % ('<a href="%s">%s<span>Page</span></a>' % (C.CITY_PAGES[n], esc(n)) if n in C.CITY_PAGES else esc(n))
        for n in C.PLACE_NAMES)
    blocks = [
        plate("In short", None, '<p class="lead prose">%s</p>' % inline(INTRO), pid="intro"),
        plate("", "Send a photo. We come to you.", steps([
            ("Send a photo", "Text two to four photos of the dent or the car. Not sure how to shoot them? The [photo guide](/photo-quote/) shows four simple angles."),
            ("We come to you", "Your home, workplace or lot, in one of the [places we serve](/service-area/). We look at your photos first and talk through the work and the price before anyone drives out."),
            ("Drive away fixed", "When the dent is a candidate for paintless repair, you keep your original paint. When it isn't, we say so before any work starts."),
        ]) + actions("quote-text"), rail="How it works", num="01", pid="how"),
        plate("", "Will paintless repair work on my dent?", '<p class="prose">&ldquo;Dents gone&rdquo; is true for many dents, not all of them. Paintless dent repair (PDR) pushes the metal back from behind the panel. It works when the paint is intact and the dent is shallow-to-moderate and rounded. Sharp creases, stretched metal and cracked paint are different jobs.</p>'
              '<div class="cc"><div>%s<h3>Often fixable without paint</h3><ul><li>Shallow-to-moderate, rounded dents</li><li>Paint intact, with no cracks or chips in the dent</li><li>Door dings and parking-lot dents on most panels</li><li>Many hail dents, panel by panel</li></ul></div>'
              '<div>%s<h3>Usually not a PDR job</h3><ul><li>Sharp creases and folded metal</li><li>White stress marks or cracked, chipped paint</li><li>Some panel edges and braced areas</li><li>Structural damage, which belongs in a body shop</li></ul></div></div>'
              '<p class="prose">Not sure which side yours is on? Our [plain self-check](/guides/can-this-dent-be-fixed-without-paint/) walks through it, or send a photo and we will tell you.</p>' % (dent_svg("shallow"), dent_svg("crease")),
              g=True, rail="Honest limits", num="02", pid="limits"),
        plate("", "What can we do for your car?", rows(C.SERVICES), rail="Services", num="03", pid="services"),
        plate("", "What is Gloss Shield?",
              '<div class="gl-wrap"><div><p class="prose lead">Gloss Shield is our name for ceramic coating: a protective layer applied over paint that has been cleaned and, where needed, polished first. It adds gloss and makes washing easier. It does not make paint immune to scratches or replace care.</p>'
              '<p class="prose">Coating seals in whatever is under it, so prep decides the result. <a href="/ceramic-coating/">Read how it works and what to ask any coating installer</a>.</p></div>'
              '<figure class="gloss"><picture><source type="image/avif" srcset="%s"><img src="%s" width="640" height="800" loading="lazy" decoding="async" alt="Illustration of water beading on glossy dark car paint"></picture>'
              '<figcaption>Illustration. Not a customer vehicle.</figcaption></figure></div>' % (A["beading_avif"], A["beading_webp"]),
              rail="Gloss Shield", num="04", pid="gloss"),
        plate("", "Dents on your lot? We come to the lot.",
              '<p class="prose lead">Dealerships, fleet managers, rental lots and body shops are customers too. Tell us how many vehicles and where they sit, and we quote per vehicle after looking at photos.</p>'
              '<div class="actions">%s%s<a class="btn" href="/dealers-and-fleets/">Dealers &amp; fleets</a></div>' % (b_call("btn-gold"), b_text("Text us")),
              g=True, rail="Dealers & fleets", num="05", pid="b2b"),
        plate("", "Where do we work?",
              '<p class="prose">We serve %s. Four of these have their own page.</p><ul class="places">%s</ul><p class="prose"><a href="/service-area/">See the full service area</a></p>' % (esc(C.PLACES_STRING), places),
              rail="Where we work", num="06", pid="where"),
        plate("", "Questions people ask before they send a photo",
              '<div class="note prose"><p><strong>What changes the price of a dent repair?</strong> Size, depth and sharpness of the dent, how many dents and panels, the panel material, how easy the spot is to reach, and the condition of the paint. That is why a price starts with a photo, not a guess.</p></div>'
              + rows([("/guides/what-affects-dent-repair-price/", "What changes the price of a dent repair", "Guide", "The drivers, with no made-up numbers."),
                      ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed without paint?", "Guide", "A plain self-check before you text."),
                      ("/guides/pdr-vs-body-shop/", "Paintless dent repair or body shop?", "Guide", "How to choose between the two."),
                      ("/guides/should-i-file-a-claim-for-a-small-dent/", "Should you file a claim for a small dent?", "Guide", "Deductible against repair cost.")]),
              g=True, rail="Guides", num="07", pid="guides"),
        plate("Next step", None, '<p class="big">Send a photo.</p><p class="prose">Two to four photos is plenty. We look, and we tell you what we can do.</p>' + actions("quote-text"), pid="close"),
    ]
    return dict(path="/", type="home", title="Mobile Dent Repair Sacramento | 916 Dent & Detail", desc=C.DESC_SHORT, crumbs=[], blocks=blocks,
                answer=INTRO, og="home", h1="Dents gone. Paint glowing. We come to you.")
