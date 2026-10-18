import config as C
from lib import *   # noqa
from pages_services import photo_card

START_FORM = '<!--FORM-UNCONNECTED--><div class="notice" role="note"><strong>This form isn\'t connected yet.</strong> Nothing you type here is sent. Please use Text or Call instead.</div><!--/FORM-UNCONNECTED-->'
FALLBACK = "That did not send. Nothing was lost on your side. Please text or call %s instead, or try again." % C.PHONE_DISPLAY


def field(fid, label, kind="text", req=False, hint="", auto="", extra=""):
    r = ' required aria-required="true"' if req else ""
    a = ' autocomplete="%s"' % auto if auto else ""
    h = '<span class="hint">%s</span>' % hint if hint else ""
    d = ' aria-describedby="%s-e"' % fid if req else ""
    err = '<p class="err" id="%s-e">%s</p>' % (fid, "Please fill this in." if kind != "tel" else "Please enter a phone number with area code.")
    return '<div><label for="%s">%s%s</label><input type="%s" id="%s" name="%s"%s%s%s%s>%s</div>' % (fid, label, h, kind, fid, fid, r, a, d, extra, err if req else "")


def select(fid, label, opts, req=True):
    o = '<option value="">Choose one</option>' + "".join('<option value="%s">%s</option>' % (v, esc(t)) for v, t in opts)
    r = ' required aria-required="true"' if req else ""
    return '<div><label for="%s">%s</label><select id="%s" name="%s"%s aria-describedby="%s-e">%s</select><p class="err" id="%s-e">Please choose one.</p></div>' % (fid, label, fid, fid, r, fid, o, fid)


CITY_OPTS = [(n.lower().replace(" ", "-"), n) for n in C.PLACE_NAMES] + [("other", "Somewhere else nearby")]


def quote_form():
    return ('<div class="form-wrap">' + START_FORM +
            '<div class="summary" role="alert"></div>'
            '<form class="form" data-quote action="{{FORM_ENDPOINT}}" method="post" enctype="multipart/form-data" data-fallback="%s">' % esc(FALLBACK) +
            field("name", "Your name", "text", True, auto="name") + field("phone", "Phone", "tel", True, "We reply by text or call", "tel") +
            select("need", "What do you need?", [("dent", "Dent removal"), ("hail", "Hail damage"), ("detail", "Detailing or interior"), ("coating", "Coating or paint correction"), ("notsure", "Not sure"), ("dealer", "Dealer or fleet")]) +
            field("vehicle", "Vehicle", "text", True, "Year, make and model") +
            select("city", "City", CITY_OPTS) +
            '<p class="fine">We do not need your address yet.</p>'
            '<div><label for="photos">Photos<span class="hint">Two to four, using the angles above. Optional, but we can only give a price from photos.</span></label><input type="file" id="photos" name="photos" accept="image/*" multiple><p class="fine file-msg" aria-live="polite"></p></div>'
            '<div><label for="notes">Notes<span class="hint">How it happened, or whether the paint looks cracked (up to 500 characters)</span></label><textarea id="notes" name="notes" maxlength="500"></textarea></div>'
            '<div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></div>'
            '<div class="chk"><input type="checkbox" id="consent" name="consent" value="yes"><label for="consent">By submitting this form you agree that 916 Dent &amp; Detail may text you about your quote. Message and data rates may apply. Reply STOP to opt out, HELP for help. This is optional.</label></div>'
            '<button type="submit" class="btn btn-gold" disabled aria-disabled="true" data-unconnected data-event="form_submit_attempt">Send photos</button>'
            '<p class="fine">We use what you send only to answer your quote. See the <a href="/privacy/">privacy policy</a>.</p></form>'
            '<div class="ok" role="status"><p><strong>Thanks. We got your details.</strong></p><p>We look at what you sent and reply by text or call. If you would rather not wait, text your photos to %s.</p>%s</div></div>' % (C.PHONE_DISPLAY, b_text("Text photos")))


def dealer_form():
    return ('<div class="form-wrap">' + START_FORM +
            '<div class="summary" role="alert"></div>'
            '<form class="form" data-quote action="{{FORM_ENDPOINT}}" method="post" enctype="multipart/form-data" data-fallback="%s">' % esc(FALLBACK) +
            field("name", "Your name", "text", True, auto="name") + field("phone", "Phone", "tel", True, "", "tel") + field("company", "Company", "text", True, auto="organization") +
            select("type", "Type of business", [("dealer", "Dealership"), ("fleet", "Fleet"), ("rental", "Rental lot"), ("body", "Body shop"), ("other", "Other")]) +
            field("count", "About how many vehicles?", "text", True) +
            select("city", "City", CITY_OPTS) +
            select("need", "What do you need?", [("dents", "Dents"), ("detail", "Detailing"), ("both", "Both")]) +
            '<div><label for="notes">Notes<span class="hint">Up to 500 characters</span></label><textarea id="notes" name="notes" maxlength="500"></textarea></div>'
            '<div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></div>'
            '<div class="chk"><input type="checkbox" id="consent" name="consent" value="yes"><label for="consent">By submitting this form you agree that 916 Dent &amp; Detail may text you about your request. Message and data rates may apply. Reply STOP to opt out, HELP for help. This is optional.</label></div>'
            '<button type="submit" class="btn btn-gold" disabled aria-disabled="true" data-unconnected data-event="dealer_intake_submit">Send request</button>'
            '<p class="fine">We use what you send only to answer your request. See the <a href="/privacy/">privacy policy</a>.</p></form>'
            '<div class="ok" role="status"><p><strong>Thanks. We got your request.</strong></p><p>We reply by text or call. You can also call %s.</p></div></div>' % C.PHONE_DISPLAY)


def shots():
    items = [(1, "The whole panel", "From about six feet back, so we can see where the dent sits."), (2, "The dent, straight on", "Close enough to fill most of the frame. Put a coin or your hand beside it for scale."),
             (3, "The dent at a low angle", "Light across the dent, from the side. Dents show up in the reflections."), (4, "The paint at the dent", "A close-up of the edge if the paint looks cracked, chipped or white.")]
    return '<ol class="shots">%s</ol>' % "".join('<li>%s<div><strong>%d. %s</strong>%s</div></li>' % (shot_svg(n), n, esc(t), esc(d)) for n, t, d in items)


def photo_quote():
    b = [
        plate("Step one", "Which photos should I send?", '<p class="prose">Four photos are ideal. Two will do. Send what you have and we ask for more if we need it.</p>' + shots(), pid="shots"),
        plate("Step two", "How do I send them?", '<p class="prose">Text is the simplest. The button opens your messaging app with a short message ready; add your photos and press send. Prefer to talk? Call. Not a texter? Use the form below.</p><div class="actions">%s%s</div>' % (b_text("Text photos", "btn-gold"), b_call()), g=True, pid="send"),
        plate("Step three", "What should I tell you?", '<ul class="prose"><li>The vehicle: year, make and model</li><li>The city it will be in. We do not need a street address yet.</li><li>What happened, if you know, and whether the paint looks cracked</li><li>What you want done: the dent, a detail, or both</li></ul>', pid="tell"),
        plate("Or use the form", "Prefer a form?", '<p class="prose">Fill in what you can. Photos are optional here, but we can only give a price from photos.</p>' + quote_form(), g=True, pid="form"),
        plate("After you send", "What will you tell me?", '<ul class="prose"><li>Whether the dent looks like a paintless repair job</li><li>What is likely to drive the price on your car</li><li>What the next step is</li></ul><p class="prose">We do not put a price on this page, because a price needs your photos. Sometimes the answer is that a dent is not a PDR job, and we say so. Read [what paintless repair can and cannot fix](/guides/can-this-dent-be-fixed-without-paint/).</p>'.replace("[what paintless repair can and cannot fix](/guides/can-this-dent-be-fixed-without-paint/)", '<a href="/guides/can-this-dent-be-fixed-without-paint/">what paintless repair can and cannot fix</a>'), pid="after"),
        plate("Fine print", "Is my information safe with you?", '<p class="prose">We use your photos and details only to answer your quote. Photos can show license plates and surroundings, so crop them if you want. The [privacy policy](/privacy/) lists exactly what is collected.</p>'.replace("[privacy policy](/privacy/)", '<a href="/privacy/">privacy policy</a>'), g=True, pid="fine"),
        end_cta("Ready when you are", "Text two to four photos, or call. We tell you what we can do.", "quote-text"),
    ]
    return dict(path="/photo-quote/", type="plain", form=True, title="Get a Dent Repair Price From a Photo | 916 Dent & Detail",
                desc="Text two to four photos of your dent and 916 Dent & Detail tells you if it looks like a paintless repair job and what drives the price on your car.",
                h1="Get a price from a photo", kicker="Photo quote",
                answer="Text two to four photos of your dent to %s, or use the form below. We look at them and tell you whether it looks like a paintless repair job, what drives the price on your car and what happens next. Sometimes the answer is that a dent isn't a PDR job, and we say so." % C.PHONE_DISPLAY,
                crumbs=[("Get a price from a photo", "/photo-quote/")], blocks=b, actions='<div class="actions">%s%s</div>' % (b_text("Text photos", "btn-gold"), b_call()), og_sub="Get a price from a photo")


def dealers():
    b = [
        plate("Who", "Which businesses do you work with?", table("Business types", ["Business", "Typical need", "How to start"], [
            ["Dealerships", "Dings and dents on frontline or recon vehicles", "Call or text with the count and the lot"],
            ["Fleets", "Dents from daily use, and cleaning between assignments", "Send a vehicle list or photos"],
            ["Rental lots", "Dings and interiors between rentals", "Call or text with the count and the lot"],
            ["Body shops", "Panels better left unpainted", "Call to talk through the work"],
        ])),
        plate("Process", "How does a lot visit work?", steps([
            ("Tell us what you have", "How many vehicles, where they are, and what they need: dents, detailing or both."),
            ("We look at photos", "Send a vehicle list or photos of the worst ones. We tell you which look like paintless jobs."),
            ("We quote per vehicle", "A price for each vehicle after looking at photos, plus anything that could change it on inspection."),
            ("We come to the lot", "We confirm the visit with whoever manages the lot, including any gate or access you need."),
        ]), g=True),
        plate("What we need", "What should I have ready when I call?", '<ul class="prose"><li>Number of vehicles and the city they are in</li><li>What they need: dents, detailing, both</li><li>Any gate, badge or manager approval needed to get onto the lot</li><li>A contact person on site</li></ul>'),
        plate("Detailing too", "Can you detail as well as remove dents?", md("""
Yes. We do [mobile detailing](/mobile-detailing/) and [interior detailing](/interior-detailing/) as well as [paintless dent repair](/paintless-dent-repair/), and [hail damage repair](/hail-damage-repair/) when hail hits a lot. Tell us the mix and we quote it together.""") , g=True),
        plate("Intake", "Prefer to send a request?", '<p class="prose">Fill in what you know. We reply by text or call.</p>' + dealer_form(), pid="intake"),
        faq_block([
            ("Do you quote per vehicle or per dent?", "Per vehicle, after we look at photos."),
            ("Can you work at an auction lot or an off-site lot?", "Tell us where. We confirm the visit with whoever manages the lot."),
            ("How do I get invoiced?", "Ask when you call. We agree billing details in advance."),
        ], "Questions from dealers and fleets", g=True),
        sources([("Sacramento Metropolitan AQMD, participating dealerships", "https://www.airquality.org/SacCleanCars4All/Pages/Participating-Dealerships.aspx")], "Local dealer lists, for example") if False else "",
        related("Next pages", [("/paintless-dent-repair/", "Paintless dent repair", "The method and its limits."), ("/hail-damage-repair/", "Hail damage repair", "Many vehicles at once."), ("/service-area/", "Service area", "The places we come to.")]),
        end_cta("Dents on your lot? We come to the lot.", "Call or text with the number of vehicles and where they are. We quote per vehicle after looking at photos.", "b2b"),
    ]
    return dict(path="/dealers-and-fleets/", type="plain", form=True, title="Dealership & Fleet Dent Repair | 916 Dent & Detail",
                desc="Dent repair and detailing on your lot for dealerships, fleets, rental lots and body shops in the Sacramento area. Call or text to start.",
                h1="Dent repair on your lot: dealerships, fleets, rental lots and body shops", kicker="Dealers & fleets",
                answer="We come to the lot. Dealerships, fleet managers, rental lots and body shops can have paintless dent repair and detailing done where the vehicles sit. Tell us how many vehicles, where they are and what they need, and we quote per vehicle after looking at photos. Call or text to start.",
                crumbs=[("Dealers & fleets", "/dealers-and-fleets/")], blocks=b, actions=actions("b2b"), og_sub="Dealers, fleets, rental lots and body shops")


def about():
    b = [
        plate("What we do", "What does 916 Dent & Detail do?", md("""
We remove dents without paint or a body shop where the metal and paint allow it, and we detail cars inside and out. That covers [paintless dent repair](/paintless-dent-repair/), [hail damage repair](/hail-damage-repair/), [mobile detailing](/mobile-detailing/) with paint deep-clean, [paint correction](/paint-correction/), [ceramic coating](/ceramic-coating/) and [interior detailing](/interior-detailing/).""")),
        plate("How we work", "What can I expect when I contact you?", '<ul class="prose"><li>You send photos first, so we can look before anyone drives anywhere.</li><li>We tell you plainly when a dent is not a paintless repair job.</li><li>We come to you: your home, workplace or lot, in the [places we serve](/service-area/).</li><li>We serve individual drivers and businesses, including [dealerships, fleets, rental lots and body shops](/dealers-and-fleets/).</li></ul>'.replace("[places we serve](/service-area/)", '<a href="/service-area/">places we serve</a>').replace("[dealerships, fleets, rental lots and body shops](/dealers-and-fleets/)", '<a href="/dealers-and-fleets/">dealerships, fleets, rental lots and body shops</a>'), g=True),
        plate("Our name", "Why 916?", md("""
916 is the area code for Sacramento. The tagline is **Precision · Care · Perfection.** and it is what we aim at on every car, which is also why we tell you when a dent is not a candidate rather than promise what the metal will not do.""")),
        end_cta("Send a photo", "Text two to four photos. We tell you what we can do.", "quote-text"),
    ]
    return dict(path="/about/", type="about", title="About Us | 916 Dent & Detail",
                desc="916 Dent & Detail is a mobile paintless dent repair and detailing service for the Sacramento area, run by two owner-technicians and a crew.",
                h1="Two owner-technicians, a crew, and service that comes to you", kicker="About",
                answer="916 Dent & Detail is a mobile paintless dent repair and auto detailing service for the Sacramento area. Two owner-technicians with deep experience run it with a crew. We serve drivers and businesses, from individual cars to dealerships, fleets, rental lots and body shops. We come to you, and we tell you when a dent isn't a candidate.",
                crumbs=[("About", "/about/")], blocks=b)


def contact():
    b = [
        plate("Ways to reach us", "How do I contact 916 Dent & Detail?", '<ul class="rows"><li><a href="%s" data-event="call_click"><span class="n" aria-hidden="true"></span><span><strong>Call %s</strong><span class="d">Talk it through</span></span>%s</a></li><li><a href="%s" data-event="text_click"><span class="n" aria-hidden="true"></span><span><strong>Text %s</strong><span class="d">Send photos of the dent or the car</span></span>%s</a></li><li><a href="/photo-quote/"><span class="n" aria-hidden="true"></span><span><strong>Get a price from a photo</strong><span class="d">The shot list, plus a form if you would rather not text</span></span>%s</a></li><li><a href="%s" rel="noopener" data-event="ig_click"><span class="n" aria-hidden="true"></span><span><strong>Instagram %s</strong><span class="d">Follow along</span></span>%s</a></li></ul>'
              % (tel_href(), C.PHONE_DISPLAY, ICON["arrow"], sms_href(), C.PHONE_DISPLAY, ICON["arrow"], ICON["arrow"], C.INSTAGRAM_URL, esc(C.INSTAGRAM_HANDLE), ICON["arrow"])),
        plate("Where", "Where are you based, and where do you work?", md("""
There is no storefront and no street address; this is a mobile service, and we come to you. We work in %s. See the [service area](/service-area/).""" % C.PLACES_STRING), g=True),
        plate("Access", "What if I have trouble using this website?", md("""
Call or text %s and we will help another way. Tell us what got in the way so we can fix it.""" % C.PHONE_DISPLAY)),
        end_cta("Send a photo", "Two to four photos is plenty. We tell you what we can do.", "quote-text"),
    ]
    return dict(path="/contact/", type="contact", title="Call or Text 916 Dent & Detail | Sacramento",
                desc="Call or text 916 Dent & Detail for mobile dent repair and detailing in the Sacramento area. No storefront: we come to you. Photos welcome by text.",
                h1="Call or text 916 Dent & Detail", kicker="Contact",
                answer="The simplest way to reach us is to text photos of your dent or car to %s, or to call the same number. There is no storefront and no street address; we come to you. Tell us your city, the vehicle and what you need, and we reply by text or phone." % C.PHONE_DISPLAY,
                crumbs=[("Contact", "/contact/")], blocks=b, actions='<div class="actions">%s%s</div>' % (b_call("btn-gold"), b_text("Text photos")))


def faq():
    b = [
        faq_block([
            ("How does the photo quote work?", "You text two to four photos, or use the form. We look at them and tell you whether it looks like a paintless repair job, what drives the price on your car and what happens next. See [get a price from a photo](/photo-quote/)."),
            ("What should I photograph?", "The whole panel, the dent straight on, the dent from a low angle with light across it, and a close-up of the paint. The [photo guide](/photo-quote/) shows each shot."),
            ("Where do you work?", "At your home, workplace or lot in %s. See the [service area](/service-area/)." % C.PLACES_STRING),
            ("Do you have a shop I can visit?", "No. It is a mobile service with no storefront, and we do not publish a street address."),
            ("Do I need to be there?", "Tell us when you text. We confirm the details of the visit when we agree a time."),
            ("What should I have ready?", "The vehicle's year, make and model, the city it will be in, and photos. You do not need to give an address for a first answer."),
            ("Can I book online?", "Not yet. Send photos, and we agree a time with you by text or phone."),
            ("How do I pay?", "We confirm payment details when we agree the job."),
            ("Do you work with businesses?", "Yes: dealerships, fleets, rental lots and body shops. See [dealers and fleets](/dealers-and-fleets/)."),
            ("Will you text me marketing messages?", "The optional consent on our forms covers texts about your quote. See the [privacy policy](/privacy/)."),
            ("Will every dent come out?", "No. See [can this dent be fixed without paint](/guides/can-this-dent-be-fixed-without-paint/)."),
        ], "Everything before the first photo", "FAQ"),
        end_cta(),
    ]
    return dict(path="/faq/", type="plain", title="Dent Repair & Detailing FAQ | 916 Dent & Detail",
                desc="Quick answers on how the photo quote works, where 916 Dent & Detail comes to you, what to have ready and how to reach us.",
                h1="Questions we get before the first photo", kicker="FAQ",
                answer="These are the questions we get before the first photo: how the photo price works, where we go, what to have ready and how to reach us. Longer answers about dents, coating or detailing sit on their own pages, and each answer below links to the right one.",
                crumbs=[("FAQ", "/faq/")], blocks=b)


def privacy():
    b = [
        plate("What we collect", "What information does this site collect?", table("Information and why", ["What", "Why"], [
            ["The details you type into a form: name, phone, vehicle, city, notes, your texting-consent choice", "To answer your quote and arrange the work"],
            ["Photos you upload or text us, which can show license plates and surroundings", "To look at the dent or car and give you a price"],
            ["Texts and calls you make to our number", "To answer you. Your carrier and phone keep their own records"],
            ["Technical logs kept by the web host and the form service, such as IP address and time", "To run the site and prevent abuse"],
        ]) + '<p class="prose">This site sets no tracking cookies and loads no third-party scripts, fonts or trackers.</p>'),
        plate("Use", "How do you use it, and who else sees it?", md("""
We use what you send only to answer your quote and do the work. The form is received by a form service that the owners will name here once it is chosen; it processes your submission for us. We do not sell your information. Photos are used for quotes only.""") , g=True),
        plate("Texting", "What about text messages?", md("""
The consent box on our forms is optional and unchecked by default, and you can still get a quote without it. If you agree, we may text you about your quote. Message and data rates may apply. Reply STOP to opt out and HELP for help. If you text us first, we reply to answer you. The wording of this consent is under review by the owner's attorney.""")),
        plate("Keeping it", "How long do you keep it, and what are my choices?", md("""
We keep photos and messages only as long as needed to answer your quote and handle the job. The owners will add a fixed retention period here after attorney review. To ask what we hold, to correct it or to have it deleted, call or text %s.""" % C.PHONE_DISPLAY), g=True),
        plate("Other", "Children, changes and contact", md("""
This site is not directed at children. If this policy changes, the date below changes. Questions or accessibility trouble: call or text %s. Updated %s.

**This policy is a draft for review by the owner's attorney.**""" % (C.PHONE_DISPLAY, C.GUIDE_REVIEWED_LABEL))),
    ]
    return dict(path="/privacy/", type="plain", title="Privacy Policy | 916 Dent & Detail",
                desc="What 916 Dent & Detail collects when you send a photo or use a form, how it is used, and how to ask us about it. Draft for attorney review.",
                h1="Privacy policy", kicker="Legal",
                answer="This site collects only what you choose to send us: the details and photos in the photo-quote form, and the texts and calls you make to our number. We use them to answer your quote and do the work. The site has no tracking cookies or third-party scripts. This draft is for review by the owner's attorney.",
                crumbs=[("Privacy", "/privacy/")], blocks=b, actions="")


def terms():
    b = [
        plate("Estimates", "Are prices and times I am given final?", md("""
No. A price or time we give from photos is an estimate, not a quote, until we have looked at the vehicle. If the work turns out different from the photos, we say so before we start. Paintless dent repair cannot fix every dent, and detailing results depend on the condition of the paint and interior.""")),
        plate("Using the site", "What are the rules for using this website?", md("""
The information on this site is general and may change. It is not legal, insurance or mechanical advice. The words, drawings and layout belong to 916 Dent & Detail; the illustrations are labelled as illustrations and are not customer vehicles. Do not misuse the forms or try to disrupt the site. Links to other sites are provided for information, and we do not control them.""") , g=True),
        plate("Work", "What terms apply to the work itself?", md("""
Any written terms for a job are given to you in writing before the work starts. This site does not publish coverage or refund terms, so please ask if you need them before you book.""")),
        plate("Law", "Which law applies?", md("""
California law applies to the use of this site. This draft is for review by the owner's attorney, who may change it. Questions: call or text %s. Updated %s.""" % (C.PHONE_DISPLAY, C.GUIDE_REVIEWED_LABEL)), g=True),
    ]
    return dict(path="/terms/", type="plain", title="Terms of Use | 916 Dent & Detail",
                desc="Terms for using the 916 Dent & Detail website: estimates versus quotes, what the site covers and which law applies. Draft for attorney review.",
                h1="Terms of use", kicker="Legal",
                answer="These terms cover your use of this website. Prices and times we give from photos are estimates until we have looked at the vehicle, and results depend on the vehicle's condition. This draft is for review by the owner's attorney and will be updated when the business's own written terms are confirmed.",
                crumbs=[("Terms", "/terms/")], blocks=b, actions="")


def not_found():
    b = [plate("", None, '<p class="prose">The link may be old or mistyped. Try one of these:</p><div class="actions"><a class="btn btn-gold" href="/">Home</a>%s%s</div>' % (b_quote("Get a price from a photo", ""), b_call()))]
    return dict(path="/404.html", type="404", noindex=True, title="Page Not Found | 916 Dent & Detail",
                desc="That page isn't here. Go to the home page, get a price from a photo, or call 916 Dent & Detail.",
                h1="That page isn't here", kicker="Not found",
                answer="We could not find that page. The home page has everything we do, and the photo quote is the quickest way to find out what we can do for your car.".replace("quickest", "simplest"),
                crumbs=[], blocks=b, actions="", og="home")
