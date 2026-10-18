import config as C
from lib import *   # noqa


def photo_card(text, h="Send a photo and we will tell you"):
    return plate("", None, '<div class="card"><h2>%s</h2><p class="prose">%s</p>%s</div>' % (h, inline(text), actions()), pid="photo-card-" + str(abs(hash(text)) % 999))


def svc(path, title, desc, h1, kicker, answer, name, term, blocks, og_sub=None):
    return dict(path=path, type="service", title=title, desc=desc, h1=h1, kicker=kicker, answer=answer,
                crumbs=[(term[0].upper() + term[1:], path)], service={"name": name, "term": term}, blocks=blocks,
                og_sub=og_sub or "Mobile dent repair & detailing, Sacramento")


# ------------------------------------------------------------------ PDR
def pdr():
    b = [
        plate("The method", "What is paintless dent repair, and how does it work?", md("""
Paintless dent repair (PDR) removes a dent by working the metal back into shape from behind the panel, or from around it, in many small pushes. The technician reads the dent by how reflections bend across the surface and keeps going until the reflections run straight again. Nothing is sanded, filled or painted, so the car keeps its original paint.

That is also why PDR has rules. It needs paint that is still intact, and metal that has not been folded or stretched too far. When a dent meets those conditions, PDR is usually the quieter, less invasive repair. When it doesn't, the honest answer is a body shop.""")),
        plate("Process", "What happens when you book a dent repair with us?", steps([
            ("You send photos", "Two to four photos: the whole panel, the dent straight on, the dent at a low angle with light across it, and a close-up if the paint looks cracked. The [photo guide](/photo-quote/) shows each shot."),
            ("We look and answer", "We tell you whether the dent looks like a PDR candidate, what is likely to drive the price on your car, and what happens next. If it is not a PDR job, we say so here, before anyone drives out."),
            ("We come to you", "Your home, workplace or lot, in one of the [places we serve](/service-area/). Tell us where the car will be parked so we can confirm the spot works."),
            ("You check the panel", "Before we leave, you look at the finished panel with us. If the dent turned out harder than the photos showed, we tell you that too."),
        ]), g=True),
        plate("Door dings", "Can you fix a door ding or a parking-lot dent without repainting?", md("""
Often, yes. A door ding or parking-lot dent is the most common job for paintless repair: a small to medium dent, usually rounded, in paint that has not cracked. Dings on the flat part of a door or fender tend to be reachable. Dings on a panel edge, on a braced area or right on a body line are harder, and some of those are not PDR jobs.

If the paint has a crack, a chip or a white, crazed look inside the dent, tell us when you text. That is the detail that most often changes the answer.""")),
        plate("Limits", "What can't paintless dent repair fix?", '<div class="prose"><p>PDR is not a cure for every dent. These are the cases where it usually is not the right tool:</p></div>'
              '<div class="cc"><div>%s<h3>Sharp crease</h3><p>Metal folded into a line does not push back to a smooth surface. Many creases need conventional repair.</p></div>'
              '<div>%s<h3>Stretched or cracked paint</h3><p>White stress marks, cracks or chips mean the paint has already failed. Moving the metal can make that worse.</p></div></div>'
              '<ul class="prose"><li>Some panel edges, braced areas and spots with no access from behind</li><li>Aluminum panels, which can take more care and are judged case by case</li><li>Structural damage and areas near airbag sensors, which belong in a body shop</li></ul>'
              '<p class="prose">Our [plain self-check](/guides/can-this-dent-be-fixed-without-paint/) goes through these one by one. We tell you after photos, or in person, if yours is not a PDR job.</p>' % (dent_svg("crease"), dent_svg("stretch")), g=True),
        plate("Price", "What changes the price of paintless dent repair?", md("""
Dent size, depth and sharpness, how many dents are on the panel, which panels they are on, what the panel is made of, how easy the spot is to reach, and the condition of the paint. There is no honest way to price that from a description, which is why we start from photos. The [full list of price drivers](/guides/what-affects-dent-repair-price/) has no numbers because a number without a photo would be a guess.""")),
        photo_card("Shallow, round and in intact paint is the best case. Send photos of yours and we tell you which side it is on."),
        plate("Hail", "Is hail damage different?", md("""
Hail leaves many dents at once, often shallow and round, which is PDR-friendly shape but a bigger job. We cover it on its own page: [hail damage repair](/hail-damage-repair/).""")),
        faq_block([
            ("Will paintless dent repair damage my paint?", "The method does not sand, fill or repaint, so paint that is intact stays original. Paint that is already cracked, chipped or brittle can crack further when the metal is moved, which is why we ask for a close-up photo before we say yes."),
            ("How long does it take?", "We do not quote a time without seeing the dent, because it depends on how large it is, how many there are and where they sit. Send photos and we give you a plan for your car."),
            ("Do I need a garage or shade?", "Tell us where the car will be when you text: driveway, office lot, garage. We confirm whether the spot works for the job."),
            ("Do you work on aluminum panels?", "Panel material changes both the work and the price. Tell us the make, model and which panel, and we say whether we take it."),
            ("Is it cheaper than a body shop?", "When a dent is a PDR candidate it skips the sanding, filling and painting steps where body work adds time and cost. That is a general pattern, not a promise: photos decide. See [paintless dent repair or body shop](/guides/pdr-vs-body-shop/)."),
        ], "Questions about dent removal"),
        sources([("CARSTAR Sacramento, paintless dent repair page (limits and process)", "https://www.carstar.com/locations/ca/sacramento-15427/paintless-dent-repair")], "Where the general limits come from"),
        related("Next pages", [("/hail-damage-repair/", "Hail damage repair", "When hail hits, panel by panel."), ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed without paint?", "A plain self-check."), ("/mobile-detailing/", "Mobile detailing", "Finish the car after the dent is gone.")]),
        end_cta(),
    ]
    return svc("/paintless-dent-repair/", "Paintless Dent Repair Sacramento | 916 Dent & Detail",
               "Paintless dent repair that comes to you in Sacramento: no filler and no repaint when paint is intact. See what PDR can and can't fix, then send a photo.",
               "Paintless dent repair that comes to you, no paint and no body shop", "Dent Removal (no paint, no body shop)",
               "Paintless dent repair, or PDR, removes a dent by working the metal back into shape from behind the panel, so the original paint stays. It suits shallow-to-moderate dents where the paint is intact. We come to your home, workplace or lot, and we tell you from photos whether yours qualifies.",
               "Dent Removal (no paint, no body shop)", "paintless dent repair", b)


# ------------------------------------------------------------------ HAIL
def hail():
    b = [
        plate("Local history", "Has hail actually hit Sacramento?", md("""
Yes, but not every year. Valley hail is occasional, not annual, so we treat hail repair as something we do when it happens, not as a seasonal sales pitch. Two events are documented well enough to name:""") + table("Documented Sacramento-area hail events", ["Date", "What was reported", "Source"], [
            ["February 26, 2018", "A storm left hail and ice accumulations of up to about 3 inches in parts of Sacramento and stranded vehicles. Neither report counts dented cars.", "[ABC10](https://www.abc10.com/article/news/local/see-it-to-believe-it-sacramentos-hail-storm/103-523551977)"],
            ["March 11, 2023", "The National Weather Service warned of quarter-size hail south and east of the city and said damage to vehicles was expected.", "[NWS warning text](https://tgftp.cp.ncep.noaa.gov/data/watches_warnings/thunderstorm/ca/cac077.txt)"],
        ]) + '<p class="prose">We are not claiming those storms dented a particular number of cars. We are saying that hail can reach this area, and that when it does, photos of every panel are the first step.</p>'),
        plate("First steps", "What should I do first after hail hits my car?", steps([
            ("Get the car out of further weather", "Under cover if you can. More hail on dented panels only adds to the list."),
            ("Photograph every panel", "Hood, roof, trunk and each side, from a few feet back and then close. Add a low-angle shot with light across the panel; dents show up in the reflections."),
            ("Check your coverage", "Hail is normally a comprehensive-coverage matter. Liability-only policies generally do not cover it. The California Department of Insurance consumer line is 800-927-4357."),
            ("Send us the photos", "We tell you which panels look fixable without paint and which do not. We give you a written estimate and photos your insurer can use."),
        ]), g=True),
        plate("Can PDR do it?", "Can paintless dent repair fix hail damage?", md("""
Often it can, panel by panel. Hail dents tend to be shallow and rounded with the paint intact, the shape PDR handles best. What changes is the amount of work: forty small dents across a hood and roof is a different job from one door ding, and it is priced and scheduled differently.

Some panels are better in a body shop: those with cracked or chipped paint, creased metal, very dense overlapping dents, or edges and braced areas we cannot reach. We would rather tell you that from photos than find out after we arrive. The [self-check guide](/guides/can-this-dent-be-fixed-without-paint/) explains each limit, and the main [paintless dent repair page](/paintless-dent-repair/) explains the method.""")),
        plate("Insurance", "Does insurance cover hail damage, and should I file?", md("""
This is general information, not advice about your policy. Hail damage is typically covered under comprehensive coverage, and you pay your deductible. If the repair costs less than the deductible, a claim may not pay anything. Guides disagree on whether a claim affects your rate, so ask your insurer directly.

The claim itself is between you and your insurer. We give you a written estimate and photos your insurer can use. For the longer version, read [should you file a claim for a small dent](/guides/should-i-file-a-claim-for-a-small-dent/).""") + sources([("Insuranceopedia, does car insurance cover hail damage", "https://www.insuranceopedia.com/auto-insurance/does-car-insurance-cover-hail-damage"), ("California Department of Insurance, coverage for automobile damage", "https://www.insurance.ca.gov/0400-news/0102-alerts/2023/Insurance-Coverage-for-Automobile-Damage.cfm")], "Sources"), g=True),
        photo_card("Send photos of every damaged panel. We tell you what looks fixable without paint."),
        faq_block([
            ("How long does hail repair take?", "It depends on how many dents there are and on which panels, so we do not quote a time before seeing photos. After we look, we give you a plan for your car."),
            ("Do you deal with the insurance company for me?", "The claim is between you and your insurer. We give you a written estimate and photos your insurer can use."),
            ("Is hail common in Sacramento?", "Valley hail is occasional, not annual. Two events are documented in the table above; neither source counts dented cars."),
            ("Will every hail dent come out?", "No. Shallow, rounded dents in intact paint are the best case. Cracked paint, creases and unreachable areas may need other repair, and we tell you which is which."),
        ], "Questions about hail damage"),
        related("Next pages", [("/paintless-dent-repair/", "Paintless dent repair", "How the method works."), ("/guides/should-i-file-a-claim-for-a-small-dent/", "Small dent and insurance", "Deductible against repair cost."), ("/service-area/", "Service area", "The places we come to.")]),
        end_cta(),
    ]
    return svc("/hail-damage-repair/", "Hail Damage Repair Sacramento | 916 Dent & Detail",
               "Hail dents on your car? See what paintless repair can fix panel by panel, what Sacramento hail has actually done, and what to photograph first.",
               "Hail damage on your car: what can be fixed without paint, and what to do first", "Hail Fix",
               "Hail dents are often shallow and round, the shape paintless dent repair handles best, panel by panel, when the paint isn't cracked. Valley hail is occasional, not annual. Send photos of every damaged panel and we tell you which ones look fixable without paint and which need a body shop.",
               "Hail Fix", "hail damage repair", b)


# ------------------------------------------------------------------ DETAILING HUB
def detailing():
    b = [
        plate("Scope", "What does a mobile detail include?", '<p class="prose">That depends on the car and what you want. These are the jobs we do, each with its own page:</p>' + table("Detailing services", ["Service", "What it is for", "Read more"], [
            ["Paint Deep-Clean", "Lifting bonded grime, sap and water spots that washing leaves behind", "Below, on this page"],
            ["Swirl & Scratch Erase", "Swirl marks and light scratches in the clear coat", "[paint correction](/paint-correction/)"],
            ["Gloss Shield", "A protective layer over corrected paint", "[ceramic coating](/ceramic-coating/)"],
            ["Interior Reset", "Pet hair, spills, odor and dust in the seams", "[interior detailing](/interior-detailing/)"],
        ]) + '<p class="prose">Ask about additional services for protection and maintenance. Send a photo of the car and say what you want, and we tell you what makes sense.</p>'),
        plate("Paint Deep-Clean", "What is Paint Deep-Clean (paint decontamination)?", md("""
A wash removes loose dirt. It does not remove what has bonded to the paint: iron particles from brake dust, road tar, tree sap, overspray and mineral water spots. Decontamination is the step that deals with those. Done before polishing or coating, it gives the next step a clean surface.

A quick way to check your own car: put your hand in a thin plastic bag and glide it over clean, dry paint. If it feels gritty instead of smooth, something is bonded to the surface.

### Tree sap and water spots
Fresh sap is easier to lift than sap that has baked on through a hot stretch, and mineral spots are easier before they etch. If you see either, tell us when you text and send a close photo. Some etched spots will have to be polished out instead, which is [paint correction](/paint-correction/).""") , g=True),
        plate("Your part", "What do I need to provide for a mobile detail?", md("""
It depends on the job, so tell us where the car will be parked and whether the spot has an outdoor tap, an outlet and some shade. We confirm what your job needs before we book it, and we explain how we handle water on your job.

Water is a real question for any mobile cleaning in this area. Sacramento County says businesses may not let wash water of any kind, even soapy water, run into storm drains, and Sacramento, Elk Grove, Folsom, Citrus Heights and Rancho Cordova each have their own stormwater rules. Dent removal uses no water at all. See the county's [stormwater program page](https://emd.saccounty.gov/us/en/faqs/stormwater-program.html).""")),
        plate("Choosing", "Is mobile detailing as good as a shop?", md("""
For most cleaning and light correction work, location is not the deciding factor; the technician and the prep are. The honest differences:""") + table("Mobile and shop detailing", ["", "Mobile (at your place)", "Shop"], [
            ["Convenience", "The car stays where you are", "You drop off and collect"],
            ["Conditions", "Sun, wind and dust depend on your spot", "A controlled space"],
            ["Best fit", "Cleaning, deep-clean, interiors, light correction", "Heavier correction and coating when your spot is exposed"],
        ], True) + '<p class="prose">If your spot is exposed or windy, say so. We tell you whether the job works there or needs a better time or place.</p>', g=True),
        faq_block([
            ("How long does a mobile detail take?", "It depends on the car, its condition and what you want done, so we do not quote a time in advance. Send a photo and the goal and we give you a plan."),
            ("Can you detail my car before I sell it?", "Yes, and it helps presentation. It does not hide dents or deep scratches, so a dent check first can matter more. Start with [dent removal](/paintless-dent-repair/) if there are dings."),
            ("Do you detail fleets and dealership cars?", "We work with dealerships, fleets, rental lots and body shops. See [dealers and fleets](/dealers-and-fleets/)."),
        ], "Questions about mobile detailing"),
        photo_card("Send a photo of the car and tell us the goal: cleaner, glossier, ready to sell. We say what we recommend.", "Send a photo of the car"),
        related("Next pages", [("/paint-correction/", "Paint correction", "Swirls and light scratches."), ("/ceramic-coating/", "Ceramic coating", "What it does and does not do."), ("/interior-detailing/", "Interior detailing", "Pet hair, spills and odor.")]),
        sources([("Sacramento County, stormwater program FAQ", "https://emd.saccounty.gov/us/en/faqs/stormwater-program.html")]),
        end_cta("Send a photo of the car", "Tell us what you want it to look like and where it is parked. We say what we recommend and what it involves.", "quote"),
    ]
    return svc("/mobile-detailing/", "Mobile Car Detailing Sacramento | 916 Dent & Detail",
               "Mobile car detailing that comes to your driveway or lot in Sacramento: paint deep-clean, polishing, coating and interiors. Send a photo of the car.",
               "Mobile car detailing that comes to your driveway or parking lot", "Auto detailing",
               "Mobile detailing means we clean and finish your car where it is parked instead of in a shop. We detail inside and out, including paint deep-clean, swirl and scratch removal, ceramic coating and interior cleaning. Send a photo of the car and your goal, and we tell you what makes sense.",
               "Mobile auto detailing", "mobile auto detailing and paint decontamination", b)


# ------------------------------------------------------------------ PAINT CORRECTION
def correction():
    b = [
        plate("The problem", "What are swirl marks, and why do dark cars show them?", md("""
Swirl marks are thousands of fine scratches in the clear coat, usually from washing and drying, that scatter light into a haze of tiny circles. You see them most in direct sun or under shop lights, and most on black and other dark paint, because a dark surface has nothing to hide them. Light scratches work the same way: they are cuts in the clear coat, not in the colour underneath.""")),
        plate("What it does", "What does paint correction actually do?", md("""
Correction uses machine polishing to take off a very thin layer of clear coat so the surface is level again. That is different from a filler or glaze, which hides defects for a while. Leveling removes the edge of the scratch, so it stops catching the light.

Because the clear coat on a car has a finite thickness, correction is a decision, not a routine. We look at the paint first, and we aim to remove as little as the job needs. A light correction improves gloss and swirls. A heavier correction goes after deeper marks and takes more time and more clear coat.""", ), g=True),
        plate("Limits", "What can paint correction fix, and what can't it?", table("Paint defects and what to expect", ["What you see", "What correction can do"], [
            ["Fine swirl marks", "Usually improved a lot; the main job for correction"],
            ["Light scratches in the clear coat", "Often improved or removed, depending on depth"],
            ["A scratch your fingernail catches in", "May be reduced but not erased; it may be through the clear coat"],
            ["Peeling or cloudy clear coat", "Not a polishing job; that paint has failed and needs refinishing"],
            ["Rock chips", "Not fixed by polishing"],
            ["Dents", "Not fixed by polishing; see [paintless dent repair](/paintless-dent-repair/)"],
        ]) + '<p class="prose">&ldquo;Showroom finish&rdquo; is the aim, not a promise. Results depend on the paint&rsquo;s condition, and we tell you what to expect from your photos before we start.</p>'),
        plate("Check your paint", "How can I check my own paint before I ask?", md("""
Park in direct sun or hold a bright phone light at a low angle across a clean panel. Take a photo of the worst area with the light raking across it, and one wider shot of the whole panel. Run a fingernail across the worst scratch: if it catches, say so when you text. The [photo guide](/photo-quote/) shows the angles."""), g=True),
        plate("Order of work", "Do I need paint correction before ceramic coating?", md("""
If you want swirls and scratches gone, yes: a coating seals in whatever is under it. If you only want a coating over paint in good shape, a thorough deep-clean may be enough. That decision is made from your paint, and the [ceramic coating page](/ceramic-coating/) explains the order of work.""")),
        plate("Price", "What affects the time and price of paint correction?", md("""
Vehicle size, the depth and spread of the defects, how hard or soft the paint is, how many stages the job needs, and how much clear coat you can afford to lose. We give a price from photos and confirm it when we see the paint.""", ), g=True),
        faq_block([
            ("Will polishing remove my clear coat?", "Polishing takes off a very thin layer. Clear coat has a limited thickness, which is why we look at your paint first and do not promise to remove every mark."),
            ("Can paint correction fix a dent or a chip?", "No. Dents are a separate repair, see [dent removal](/paintless-dent-repair/). Rock chips need touch-up or paint, not polish."),
            ("Do I have to be there?", "Tell us when you text where the car will be and whether you will be around. We confirm the details when we book."),
        ], "Questions about paint correction"),
        photo_card("Take one photo in sunlight of the worst area and one of the whole panel. We tell you what correction can do for it."),
        related("Next pages", [("/ceramic-coating/", "Ceramic coating", "What goes over corrected paint."), ("/mobile-detailing/", "Mobile detailing", "Deep-clean and the rest of the detailing set."), ("/paintless-dent-repair/", "Paintless dent repair", "For dents, not scratches.")]),
        end_cta("Send a photo of the paint", "One sunlit close-up and one wide shot. We tell you what correction can do and what it cannot.", "quote"),
    ]
    return svc("/paint-correction/", "Paint Correction Sacramento | 916 Dent & Detail",
               "Swirl marks and light scratches explained plainly: what paint correction fixes, what it can't, and how to check your paint before you send a photo.",
               "Swirl and scratch removal: paint correction explained plainly", "Swirl & Scratch Erase",
               "Paint correction is machine polishing that levels the thin clear coat so swirl marks and light scratches stop catching the light. It removes defects rather than hiding them, and it has limits: a scratch your fingernail catches in may be too deep. Send a photo in sunlight and we tell you what to expect.",
               "Swirl & Scratch Erase", "paint correction", b)


# ------------------------------------------------------------------ CERAMIC
def coating():
    b = [
        plate("What it is", "What is a ceramic coating, and what does it do?", md("""
A ceramic coating is a liquid applied to clean paint that cures into a thin, hard, glossy layer. It makes water bead and dirt slide off more easily, so washing is quicker, and it adds depth to the gloss. It is a layer on top of the clear coat, not a replacement for it.

What it does not do: it does not stop scratches or stone chips, it does not fix dents, and it does not make a car maintenance-free. It also seals in whatever is underneath, which is why preparation matters more than the product name.""")),
        plate("Prep", "Do I need paint correction before ceramic coating?", md("""
If you want swirls and scratches gone, yes. A coating locks in the paint exactly as it is, defects included, so any polishing happens first, after a [paint deep-clean](/mobile-detailing/) that removes what bonded to the surface. If your paint is already in good shape, a thorough deep-clean may be all it needs. We decide that from photos and confirm it when we see the paint. The polishing step is explained on the [paint correction page](/paint-correction/).""", ), g=True),
        plate("Durability", "How long does ceramic coating last?", md("""
There is no honest single number. How long a coating lasts depends on the product, how well the paint was prepared, how the car is parked, how it is washed, and how much sun it sees. Be wary of any duration promised without written terms that say what is and is not covered.

Sacramento is a sun-heavy place: the city typically logs about 23 days at or above 100&deg;F in a normal year, and 2024 set a record with its 45th such day on September 24. A coating does not block heat. Ask for the manufacturer&rsquo;s data sheet rather than a promise.""".replace("&deg;", "°")) + sources([("CBS Sacramento, record triple-digit days in 2024", "https://www.cbsnews.com/sacramento/news/sacrament-new-record-for-most-triple-digit-heats-days-in-year-2024")])),
        plate("Compare", "Ceramic coating or wax?", table("Wax and ceramic coating", ["", "Wax", "Ceramic coating"], [
            ["Layer", "Soft and thin", "Harder, bonded to the paint"],
            ["Reapplication", "Often", "Much less often, depending on product and care"],
            ["Prep needed", "Light", "Thorough: deep-clean and any polishing first"],
            ["Cost and time", "Lower", "Higher, because of the prep"],
        ], True) + '<p class="prose">Neither stops scratches or dents. For dents, see [dent removal](/paintless-dent-repair/).</p>', g=True),
        plate("Checklist", "What should I ask any ceramic coating installer?", '<ul class="prose"><li>Which product, from which manufacturer, and where is its data sheet?</li><li>What preparation is included, and how much polishing?</li><li>What are the cure and care instructions, and when can the car be washed?</li><li>What do the written terms cover, and what do they leave out?</li><li>Will the work be done somewhere shaded, and how is dust handled?</li></ul><p class="prose">We are glad to answer these for our own work. Ask about coating and protection options when you send a photo, and we tell you the product and the care it needs before you book.</p>'),
        faq_block([
            ("Is Gloss Shield a special product?", "Gloss Shield is our plain-language name for ceramic coating. Ask us which product we would use on your car and what care it needs, and we tell you before you book."),
            ("Can you coat a car that has swirls or scratches?", "We can, but the coating will lock them in. Most people correct first. See [paint correction](/paint-correction/)."),
            ("Does a coating protect against dents or hail?", "No. It is a thin layer on the paint. Dents are repaired separately, see [dent removal](/paintless-dent-repair/) and [hail damage repair](/hail-damage-repair/)."),
            ("How soon can I wash the car after coating?", "Cure and wash rules are specific to the product. We give you the written care instructions for the product used on your car."),
        ], "Questions about ceramic coating", g=True),
        photo_card("Send a photo of the car and say what you want from a coating. We tell you the order of work."),
        related("Next pages", [("/paint-correction/", "Paint correction", "The step before a coating."), ("/mobile-detailing/", "Mobile detailing", "Paint deep-clean and more."), ("/interior-detailing/", "Interior detailing", "The inside of the car.")]),
        end_cta("Send a photo of the car", "Tell us what you want from a coating and where the car is parked. We tell you the order of work and what to expect.", "quote"),
    ]
    return svc("/ceramic-coating/", "Ceramic Coating Sacramento | 916 Dent & Detail",
               "Ceramic coating explained for Sacramento sun: what it does, what it doesn't, why prep comes first and the questions to ask any installer.",
               "Ceramic coating for Sacramento sun: what it does and what it doesn't", "Gloss Shield",
               "A ceramic coating is a liquid layer that bonds to clean paint and cures into a hard, glossy surface that sheds water and dirt more easily. It does not stop scratches or stone chips, and it seals in any defect underneath, so paint prep comes first. Ask any installer which product they use and how it must be cared for.",
               "Gloss Shield", "ceramic coating", b)


# ------------------------------------------------------------------ INTERIOR
def interior():
    b = [
        plate("Scope", "What is included in an interior detail?", md("""
Interior detailing is a deep clean of what you sit on and touch: seats, carpets and mats, door panels, the dash and console, vents, cupholders and the seams where crumbs and sand collect. It is slower than a quick vacuum because it works into the places a vacuum doesn't reach.""") + '<ul class="prose"><li>Seats and carpets, fabric or leather</li><li>Door panels, dash, console and trim</li><li>Vents, cupholders and seams</li><li>Mats, and the spots under them</li></ul>'),
        plate("Problems", "Can you get pet hair, spills and odors out?", table("Common interior problems", ["Problem", "What the work involves", "Honest limit"], [
            ["Pet hair", "Working embedded hair out of carpet and fabric weave", "A little may remain deep in the weave"],
            ["Spills and stains", "Lifting what sits in the fabric, treated by fabric type", "Old, dyed or heat-set stains may leave a mark"],
            ["Odor", "Finding the source first, then cleaning it", "Smoke or spoiled milk can sit in foam and padding"],
            ["Sand and crumbs", "Reaching seams, rails and vents", "None; this is the point of a detail"],
        ]) + '<p class="prose">&ldquo;Reset&rdquo; is the goal: back to a clean starting point. We tell you from photos which marks we expect to lift and which may stay.</p>', g=True),
        plate("Before you book", "What should I tell you before the interior detail?", '<ul class="prose"><li>Fabric or leather seats</li><li>What spilled and roughly when</li><li>Pets, smoke, or anything that smells</li><li>Any sign of water getting in, such as damp carpet or a musty smell. That is a different problem from dirt and we will say so.</li><li>Where the car will be, and whether there is an outlet and some shade</li></ul><p class="prose">Take a few photos of the worst areas in daylight. The [photo guide](/photo-quote/) works for interiors too.</p>'),
        plate("Your part", "Should I clean the car out first?", md("""
Please take out personal items, papers and anything valuable, and bag any rubbish. You do not need to vacuum or scrub first; that is the work. Child seats come out or stay as you prefer, and we tell you if one needs to be removed to reach what is under it."""), g=True),
        faq_block([
            ("Can you remove pet hair?", "Most of it, yes. Hair woven into carpet can leave a trace. Send a photo of the worst spot and we say what to expect."),
            ("Can you remove the smell?", "It depends on the cause. If the source is on the surface, cleaning usually helps. If it has soaked into foam or padding, the odor may only be reduced. We say which we expect from your description."),
            ("Do you clean leather?", "Leather and fabric need different care. Tell us what your seats are made of and we say what is right for them."),
            ("Can I add an interior detail to a dent repair visit?", "Ask when you text. We tell you whether the two jobs can be booked together at your spot."),
        ], "Questions about interior detailing"),
        photo_card("Send photos of the worst spots and tell us what happened. We tell you what we can lift.", "Send a photo of the interior"),
        related("Next pages", [("/mobile-detailing/", "Mobile detailing", "Exterior deep-clean and the rest of the set."), ("/paint-correction/", "Paint correction", "Swirls and light scratches outside."), ("/dealers-and-fleets/", "Dealers and fleets", "Interior resets for more than one vehicle.")]),
        end_cta("Send a photo of the interior", "Tell us what happened in the car and where it is parked. We say what we can do.", "quote"),
    ]
    return svc("/interior-detailing/", "Interior Car Detailing Sacramento | 916 Dent & Detail",
               "Interior car detailing for pet hair, spills and odor, with honest limits on what lifts and what may stay. Send a photo of the worst spots.",
               "Interior car detailing: pet hair, spills and the smell that stays", "Interior Reset",
               "Interior detailing is a deep clean of everything you touch and sit on: seats, carpets, door panels, vents and the seams between them. It goes after pet hair, spills and odors, not just surface dust. Tell us what happened in the car and send a photo, and we say what we can do.",
               "Interior Reset", "interior detailing", b)
