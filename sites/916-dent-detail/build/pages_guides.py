import config as C
from lib import *   # noqa
from pages_services import photo_card


def guide(path, title, desc, h1, answer, blocks, og_sub="Guide"):
    return dict(path=path, type="guide", title=title, desc=desc, h1=h1, kicker="Guide", answer=answer,
                crumbs=[("Guides", "/guides/"), (plain(h1).rstrip("?").split(":")[0][:48], path)], blocks=blocks, og_sub=og_sub)


def index():
    items = [
        ("/guides/what-affects-dent-repair-price/", "What changes the price of a dent repair", "Size, depth, sharpness, count, panel, access and paint. There are no numbers here because a price needs a photo."),
        ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed without paint?", "Often, if it is shallow-to-moderate, rounded and the paint is unbroken. Six checks to run on yours."),
        ("/guides/pdr-vs-body-shop/", "PDR or a body shop?", "PDR for intact paint and rounded dents; a body shop for cracked paint, creases and structural damage."),
        ("/guides/should-i-file-a-claim-for-a-small-dent/", "Should you file a claim for a small dent?", "Compare the repair price with your deductible first; a claim may pay nothing if the repair costs less."),
    ]
    li = "".join('<li><a class="t" href="%s">%s</a><p class="prose">%s</p></li>' % (u, esc(t), esc(d)) for u, t, d in items)
    b = [plate("", "The four guides", '<ul class="guide-list">%s</ul>' % li), end_cta()]
    return dict(path="/guides/", type="collection", title="Dent & Detail Guides | 916 Dent & Detail",
                desc="Plain answers on dent repair price, whether a dent can be fixed without paint, PDR versus a body shop, and insurance claims for small dents.",
                h1="Guides: dents, detailing and what things really cost", kicker="Guides",
                answer="These four guides answer the questions people ask before they send a photo: what changes a dent repair price, whether a dent can be fixed without paint, paintless repair versus a body shop, and whether a small dent is worth an insurance claim. Each one ends with the next step: send a photo.",
                crumbs=[("Guides", "/guides/")], blocks=b)


def price():
    b = [
        plate("The drivers", "How much does paintless dent repair cost in Sacramento?", md("""
We cannot give an honest number without a photo, and nobody can who has not seen the dent. Two dents that look the same in a description can be a very different amount of work. These are the things that decide it:""") + table("What changes the price of a dent repair", ["What changes it", "Why it matters", "What helps us see it"], [
            ["Size and depth", "A larger or deeper dent takes more passes to bring back", "A straight-on photo with something for scale, such as a coin or your hand"],
            ["Sharpness", "A rounded dent is the easy case. A crease takes far longer or is not a PDR job", "A low-angle photo with light across the dent"],
            ["Number of dents and panels", "Each dent adds work, and a panel covered in overlapping dents is a different job from a single ding", "One photo of each panel"],
            ["Panel material", "Aluminum behaves differently from steel and can take more care", "Make and model, and which panel"],
            ["Access", "Braced areas, roof rails and panel edges are harder to reach from behind", "A wide shot of the whole panel"],
            ["Paint condition", "Cracked or chipped paint can rule PDR out", "A close-up of the dent&rsquo;s edge".replace("&rsquo;", "’")],
        ])),
        plate("Why no price list", "Why don't you publish prices?", md("""
Because a published price per dent would be an average of very different jobs, and the average would be wrong for almost everyone. Prices you see online for dent repair are usually that kind of average. We would rather look at your dent and tell you what it will take.""") , g=True),
        plate("What you get", "What does a price from a photo include?", md("""
We tell you whether the dent looks like a PDR candidate, a price for your car, and what could change it once we see the paint in person. A photo price is an estimate, not a quote, until the vehicle has been looked at. If the dent turns out to be harder than the photos showed, we say so before we start.""")),
        plate("How to", "How do I get an accurate price quickly?", steps([
            ("Take four photos", "The whole panel, the dent straight on, the dent from a low angle with light across it, and a close-up of the paint at the dent. The [photo guide](/photo-quote/) has the drawings."),
            ("Tell us the car and the city", "Year, make, model and the city the car will be in. You do not need to give an address."),
            ("Send them", "Text them to %s or use the [photo quote form](/photo-quote/)." % C.PHONE_DISPLAY),
        ]), g=True),
        plate("B2B", "What about dealerships and fleets?", md("""
Dealers, fleets, rental lots and body shops are quoted per vehicle after we look at photos. Tell us how many vehicles and where they are. See [dealers and fleets](/dealers-and-fleets/).""")),
        faq_block([
            ("Will you give me a price by text?", "Yes. Send photos and we tell you what we can do and what it will cost for your car, along with anything that could change the price on inspection."),
            ("Is hail priced differently?", "Hail is priced per vehicle after we see the dents, because count and panels decide it. See [hail damage repair](/hail-damage-repair/)."),
            ("Is a paintless repair always cheaper than a body shop?", "Not always. It often is when a dent qualifies, because it skips sanding, filling and painting. When it does not qualify, a body shop is the right answer. See [PDR or body shop](/guides/pdr-vs-body-shop/)."),
        ], "Questions about price", g=True),
        photo_card("Four photos, your car and the city. We tell you the price and what could change it."),
        related("Next pages", [("/paintless-dent-repair/", "Paintless dent repair", "How the method works."), ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed without paint?", "Six checks."), ("/guides/pdr-vs-body-shop/", "PDR or body shop", "How to choose.")]),
        end_cta(),
    ]
    return guide("/guides/what-affects-dent-repair-price/", "What Affects Dent Repair Price | 916 Dent & Detail",
                 "What really changes the price of a dent repair: size, depth, sharpness, panels, material, access and paint. No made-up numbers, just a photo-based price.",
                 "What changes the price of a dent repair",
                 "A dent repair price is driven by the size, depth and sharpness of the dent, how many dents and panels are involved, the panel material, how reachable the spot is and the condition of the paint. We don't publish a price list, because a number without a photo is a guess. Send photos and we price your car.", b)


def fixable():
    b = [
        plate("Self-check", "How do I tell if my dent can be fixed without paint?", '<p class="prose">Run these six checks. You are looking for the pattern, not a perfect score.</p>' + steps([
            ("Is the paint cracked, chipped or flaking in the dent?", "If yes, paintless repair is probably not the right tool. Moving metal under broken paint can lift or crack more of it."),
            ("Is the dent round and shallow, like a shallow bowl, or is it a line or fold?", "Round and shallow is the easy case. A sharp line or fold is a crease, which often needs other repair."),
            ("Do you see white, crazed or stretched-looking marks in the paint?", "That suggests the metal has stretched. It can limit how far a dent comes out."),
            ("Where is it?", "The flat middle of a door or fender is easiest. Panel edges, body lines and braced areas are harder, and some are not PDR jobs."),
            ("What is the panel made of?", "Steel is more forgiving. Aluminum can be judged case by case. If you do not know, tell us the make, model and year."),
            ("How large is it, and how many are there?", "Size matters, but shape and paint matter more. A big, soft dent can be easier than a small, sharp one."),
        ])),
        plate("The shapes", "What do fixable and not-fixable dents look like?", '<div class="cc"><div>%s<h3>Shallow and round</h3><p>The paint is intact and the metal has a smooth dip. This is the usual PDR candidate.</p></div><div>%s<h3>Sharp crease</h3><p>The metal is folded into a line. Often not a PDR job.</p></div></div><div class="cc"><div>%s<h3>Stretched or cracked</h3><p>The paint or metal has been pulled past its limit. Usually needs conventional repair.</p></div><div><h3>Ask us</h3><p>Panel edges, aluminum, braced areas and dents with a scratch through them. These depend on the details, so send a photo.</p></div></div>' % (dent_svg("shallow"), dent_svg("crease"), dent_svg("stretch")), g=True),
        plate("If not", "What if my dent isn't a paintless repair job?", md("""
Then we say so after looking at your photos, and the next stop is a body shop. That is a normal answer, not a failure of the method: paintless repair keeps the original paint, and it can only do that when the paint and the metal allow it. Structural damage and anything near airbag sensors belongs in a body shop. For the comparison, read [PDR or body shop](/guides/pdr-vs-body-shop/).""")),
        faq_block([
            ("Can a dent on a door edge be fixed?", "Sometimes. Edges are harder to reach and the metal is stiffer there. It depends on the dent and the paint, so send a close photo."),
            ("What about a dent with a scratch in it?", "Paintless repair can address the dent. A scratch that goes through the paint is a separate paint repair. If the scratch is only in the clear coat, [paint correction](/paint-correction/) may help."),
            ("Is a bigger dent harder to fix?", "Not necessarily. A large, soft, rounded dent can be easier than a small sharp one. Shape and paint decide more than size."),
        ], "Questions about fixable dents", g=True),
        sources([("CARSTAR Sacramento, paintless dent repair page (limits)", "https://www.carstar.com/locations/ca/sacramento-15427/paintless-dent-repair")], "Where the general limits come from"),
        photo_card("Take the four photos from the guide and send them. We tell you which group your dent is in."),
        related("Next pages", [("/paintless-dent-repair/", "Paintless dent repair", "The method and the limits."), ("/guides/what-affects-dent-repair-price/", "What changes the price", "The drivers, with no numbers."), ("/hail-damage-repair/", "Hail damage repair", "Many dents at once.")]),
        end_cta(),
    ]
    return guide("/guides/can-this-dent-be-fixed-without-paint/", "Can This Dent Be Fixed Without Paint? | 916 Dent & Detail",
                 "A plain self-check for dents: six questions that show whether paintless repair is likely, plus what to do when it isn't. Then send a photo.",
                 "Can this dent be fixed without paint? A plain self-check",
                 "Many dents can be fixed without paint when they are shallow-to-moderate, rounded and the paint is unbroken. Sharp creases, stretched or cracked paint, and some edges usually can't. Run the six checks below on your dent, then send a photo and we tell you which side it is on.", b)


def vs_body_shop():
    b = [
        plate("Side by side", "What is the difference between PDR and a body shop?", table("Paintless dent repair compared with body shop repair", ["Question", "Paintless dent repair", "Body shop"], [
            ["Does the car keep its original paint?", "Yes, when it qualifies", "Usually the panel is sanded, filled and repainted"],
            ["Cracked or chipped paint", "Not a PDR job", "Yes"],
            ["Sharp creases", "Often not a PDR job", "Yes"],
            ["Structural or airbag-area damage", "No", "Yes"],
            ["Where the work happens", "Where the car is parked, with 916 Dent & Detail", "At the shop"],
            ["Color matching", "Not needed", "Needed for any repainted panel"],
        ]) + '<p class="prose">Each one has a job it does well. The mistake is using one for the other&rsquo;s job.</p>'.replace("&rsquo;", "’")),
        plate("Choosing", "When should I choose paintless dent repair?", md("""
When the dent is shallow-to-moderate, round or soft, and the paint is intact. In that case PDR keeps your original finish and skips the steps where body work adds time: sanding, filling, priming and painting. It also comes to you, so the car does not have to go anywhere.""") , g=True),
        plate("Choosing", "When should I choose a body shop?", md("""
When the paint is cracked or chipped, the metal is creased or torn, the panel edge or braced area cannot be reached, or the damage is structural. A body shop can refinish a panel, which PDR cannot do. We say so when that is the right answer, and we do not push PDR where it will not work.""")),
        plate("Value", "Does it matter for resale or trade-in?", md("""
It can. Appraisers price in what they expect repairs to cost, and a repainted panel can be noticed. Keeping original paint where you can is one reason people choose PDR. It is not a promise about any particular trade-in offer, so ask whoever is buying the car.""") + sources([("Chase, how much does it cost to fix a dent in a car", "https://www.chase.com/personal/auto/education/maintenance/how-much-to-fix-a-dent-in-a-car")]), g=True),
        plate("Location", "Is mobile dent repair as good as shop repair?", md("""
For a dent that qualifies, the technician and the dent matter more than the address. The method is the same wherever it is done. What changes is the setting: light and space. If your spot is dim or cramped, tell us and we say whether the job works there.""")),
        faq_block([
            ("Can I use both?", "Yes. A car with a dent and a deep scratch may get PDR for the dent and body shop paint for the scratch. We tell you which parts are which."),
            ("Who decides which one I need?", "You do, with better information. Send photos and we tell you what we see, including when the answer is a body shop."),
        ], "Questions about choosing", g=True),
        photo_card("Send a photo and we tell you whether the dent looks like a PDR job or a body shop job."),
        related("Next pages", [("/paintless-dent-repair/", "Paintless dent repair", "The method and limits."), ("/guides/can-this-dent-be-fixed-without-paint/", "Can this dent be fixed without paint?", "Six checks."), ("/guides/should-i-file-a-claim-for-a-small-dent/", "Small dent and insurance", "Deductible against cost.")]),
        end_cta(),
    ]
    return guide("/guides/pdr-vs-body-shop/", "PDR vs Body Shop for Dents | 916 Dent & Detail",
                 "Paintless dent repair or a body shop? A plain comparison of what each does well, where each fails, and how to choose for your dent.",
                 "Paintless dent repair or body shop: how to choose",
                 "Choose paintless dent repair when the dent is shallow-to-moderate and the paint is intact: it keeps your original paint and skips sanding, filling and repainting. Choose a body shop for cracked paint, sharp creases and structural damage. We say which fits from photos, and we don't push PDR where it won't work.", b)


def claim():
    b = [
        plate("Decide", "How do I decide whether to file a claim for a small dent?", '<p class="prose">This is general information, not advice about your policy.</p>' + steps([
            ("Get a repair price", "Send photos and we tell you what a repair would cost for your car, so you are comparing a real number."),
            ("Find your deductible and coverage type", "Your policy shows your deductible, and whether you carry collision, comprehensive or both."),
            ("Compare the two", "If the repair costs less than your deductible, a claim may pay nothing."),
            ("Ask your insurer about rates", "Guides disagree on whether a claim changes your premium. It depends on the insurer and the claim, so ask directly."),
            ("Decide", "Paying for a small repair yourself is a reasonable choice, and so is filing when the damage is larger."),
        ])),
        plate("Coverage", "What does comprehensive coverage usually cover?", table("Damage and the coverage that usually applies", ["Damage", "Usually covered by"], [
            ["Hail", "Comprehensive. Liability-only policies generally do not cover it"],
            ["Falling objects and flood", "Comprehensive, according to the California Department of Insurance"],
            ["A dent from another car's door or a hit in a lot", "Depends on your policy and whether the other driver is known. Ask your insurer"],
        ]) + sources([("Insuranceopedia, does car insurance cover hail damage", "https://www.insuranceopedia.com/auto-insurance/does-car-insurance-cover-hail-damage"), ("California Department of Insurance, coverage for automobile damage", "https://www.insurance.ca.gov/0400-news/0102-alerts/2023/Insurance-Coverage-for-Automobile-Damage.cfm")]), g=True),
        plate("Our part", "What do you give me for a claim?", md("""
We give you a written estimate and photos your insurer can use. The claim itself is between you and your insurer. For California questions about coverage or a claim dispute, the Department of Insurance consumer line is 800-927-4357.""")),
        plate("Lease", "What about a lease return?", md("""
A lease company can bill for damage beyond normal wear. Check your lease for its wear standard, and get a repair price before turn-in so you can compare it with any charge. Send a photo and we tell you what a repair would take.""", ), g=True),
        faq_block([
            ("Does filing a claim raise my rates?", "It depends on your insurer, the type of claim and your history. Guides disagree, so we do not say either way. Ask your insurer."),
            ("Do you deal with my insurance company?", "The claim is between you and your insurer. We give you a written estimate and photos your insurer can use."),
            ("Can paintless repair be part of a claim?", "That is a question for your insurer. Ask them whether they accept a paintless repair estimate."),
        ], "Questions about claims"),
        photo_card("Get a repair price first. Send photos and we tell you what the repair would cost."),
        related("Next pages", [("/hail-damage-repair/", "Hail damage repair", "Many dents at once."), ("/guides/what-affects-dent-repair-price/", "What changes the price", "The drivers."), ("/guides/pdr-vs-body-shop/", "PDR or body shop", "How to choose.")]),
        end_cta(),
    ]
    return guide("/guides/should-i-file-a-claim-for-a-small-dent/", "Insurance Claim for a Small Dent? | 916 Dent & Detail",
                 "Is a small dent worth an insurance claim? Compare repair price and deductible, know which coverage applies, and get the estimate and photos you need.",
                 "Should you file an insurance claim for a small dent?",
                 "Compare the repair price with your deductible before you file: if the repair costs less than the deductible, a claim may pay nothing. Comprehensive coverage usually applies to hail and other non-collision damage. We give you a written estimate and photos your insurer can use; what your policy covers is a question for your insurer.", b)
