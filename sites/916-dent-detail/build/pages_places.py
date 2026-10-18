import config as C
from lib import *   # noqa
from pages_services import photo_card

SRC_COUNTY = ("Sacramento County, stormwater program FAQ", "https://emd.saccounty.gov/us/en/faqs/stormwater-program.html")
SRC_HEAT = ("CBS Sacramento, record triple-digit days in 2024", "https://www.cbsnews.com/sacramento/news/sacrament-new-record-for-most-triple-digit-heats-days-in-year-2024")


def city(name, path, title, desc, h1, answer, blocks, sub):
    return dict(path=path, type="city", city=name, title=title, desc=desc, h1=h1, kicker=name, answer=answer,
                crumbs=[("Service area", "/service-area/"), (name, path)], blocks=blocks, og_sub=sub)


def hub():
    items = "".join(
        '<li>%s</li>' % ('<a href="%s">%s<span>Page</span></a>' % (C.CITY_PAGES[n], esc(n)) if n in C.CITY_PAGES else esc(n))
        for n in C.PLACE_NAMES)
    b = [
        plate("The places", "Which cities and communities do you serve?", '<p class="prose">We come to your home, workplace or lot in these places. Natomas, Carmichael, Granite Bay and El Dorado Hills are communities rather than incorporated cities, and we list them because people search for them by name.</p><ul class="places">%s</ul>' % items),
        plate("How we list them", "Why do only four places have their own page?", md("""
Sacramento, Elk Grove, Roseville and Folsom each have a page because we can say something specific about them that we have checked. The other ten are served just the same. We would rather list them plainly than publish ten pages that say the same thing with a different name on top.""") , g=True),
        plate("Travel", "How far will you travel?", md("""
We do not publish distances or drive times. Tell us your city when you send photos, and when we answer we confirm everything about your job, including whether your location changes anything. We do not need a street address to give you a first answer.""")),
        plate("Not listed", "What if my city isn't on the list?", md("""
Ask. Send photos and name the city. If we can reach you, we say so; if we can't, we tell you that straight away.""", ), g=True),
        faq_block([
            ("Do you come to my home, my office or a lot?", "All three. Tell us where the car will be parked, and whether there is shade and room to work around it, and we confirm the spot."),
            ("Do you have a shop I can visit?", "No. It is a mobile service with no storefront, and no street address is published. We come to you."),
            ("Do you work in Davis, Lincoln and Rocklin?", "Yes, they are on the list above, along with the rest. Send photos and your city."),
        ], "Questions about where we work"),
        photo_card("Send photos and name your city. We confirm we can reach you and tell you what we can do."),
        end_cta(),
    ]
    return dict(path="/service-area/", type="collection", title="Service Area: Sacramento & Nearby Cities | 916 Dent & Detail",
                desc="916 Dent & Detail comes to you across the Sacramento area. See the 14 cities and communities we serve and the four with their own pages.",
                h1="Mobile dent repair and detailing across the Sacramento area", kicker="Service area",
                answer="We come to your home, workplace or lot in %s. Four have their own page. We don't publish drive times: tell us your city and we confirm we can reach you." % C.PLACES_STRING,
                crumbs=[("Service area", "/service-area/")], blocks=b)


def sacramento():
    b = [
        plate("At your door", "Do you come to my home or workplace in Sacramento?", md("""
Yes. We come to your home, workplace or lot in Sacramento for dent removal and detailing. What changes from one part of the city to another is not the work, it is where the car sits all day, so tell us whether yours is in a driveway, a carport, a street space or a parking structure, and we confirm that the spot works.""")),
        plate("Downtown", "What about downtown and Old Sacramento?", md("""
The Capitol, Old Sacramento, the Tower Bridge and Sutter's Fort are landmarks of the city's core, and Old Sacramento is a 28-acre National Historic Landmark district. If you work in that part of town, the practical question is where the car is parked during the day. A garage, a surface lot and a street space are different jobs, and some need permission from whoever manages the space. Tell us which yours is and we say how to set it up.""") + sources([("City of Sacramento, points of interest", "https://www.cityofsacramento.org/Visitors/Points-of-Interest")]), g=True),
        plate("Natomas", "Do you serve Natomas?", md("""
Yes. Natomas is the part of Sacramento that lies south of the Sacramento County line and north of Garden Highway and the American River, and it is served by the Natomas Unified School District. Interstate 5 reaches it at the Arena Boulevard exit. A CBS Sacramento report on a spring hailstorm in the region mentions a carport collapsing in Natomas, though the report we found does not show its year. If hail has hit your car there, our [hail damage repair page](/hail-damage-repair/) explains what to photograph first.""") + sources([("Natomas, Sacramento (overview)", "https://en.wikipedia.org/wiki/Natomas%2C_Sacramento%2C_California"), ("CBS Sacramento, hail storm in the region", "https://www.cbsnews.com/sacramento/news/hail-storm-sacramento-region/")])),
        plate("Dealerships", "Are there dealer lots to serve in Sacramento?", md("""
Auburn Boulevard has car dealerships; the Sacramento Metropolitan Air Quality Management District's participating-dealership list includes one at 2500 Auburn Boulevard. If you manage vehicles for a dealership, a fleet or a rental lot here, see [dealers and fleets](/dealers-and-fleets/) for how a lot visit works.""") + sources([("Sacramento Metropolitan AQMD, participating dealerships", "https://www.airquality.org/SacCleanCars4All/Pages/Participating-Dealerships.aspx")]), g=True),
        plate("Conditions", "What do Sacramento's heat and hail mean for my car?", md("""
Sacramento typically logs about 23 days at or above 100°F in a year, and 2024 set a record with its 45th such day on September 24. Long, hot stretches are hard on paint and interiors, which is why people ask about [ceramic coating](/ceramic-coating/) and [interior detailing](/interior-detailing/).

Hail is rarer. A February 26, 2018 storm left accumulations of up to about 3 inches in parts of the city and stranded vehicles. Neither report we read counts dented cars. Valley hail is occasional, not annual.""") + sources([SRC_HEAT, ("ABC10, Sacramento's 2018 hail storm", "https://www.abc10.com/article/news/local/see-it-to-believe-it-sacramentos-hail-storm/103-523551977")])),
        plate("Water rule", "Are there rules about washing cars in Sacramento?", md("""
Yes, and they affect mobile cleaning. Sacramento County says businesses may not let wash water of any kind, even soapy water, run into storm drains. The City of Sacramento publishes a brochure on commercial auto washing that covers detailers. Dent removal uses no water. For detailing, we explain how we handle water on your job before you book.""") + sources([SRC_COUNTY, ("City of Sacramento, commercial auto washing brochure (PDF)", "https://www.cityofsacramento.gov/content/dam/portal/dou/utilities/stormwater/stormwater-quality/documents/CommAutoWashing_English.pdf")]), g=True),
        faq_block([
            ("Which Sacramento neighborhoods do you serve?", "We serve Sacramento as a whole, including Natomas and the downtown core. Name your neighborhood when you send photos."),
            ("Do I need a garage?", "No. Tell us where the car will be and whether there is shade and room to work around it. We confirm whether the spot works."),
        ], "Questions about Sacramento"),
        photo_card("Send photos and tell us where the car is parked in Sacramento. We tell you what we can do."),
        end_cta(),
    ]
    return city("Sacramento", "/service-area/sacramento/", "Dent Repair & Detailing, Sacramento | 916 Dent & Detail",
                "Mobile dent repair and detailing at your door or lot across Sacramento, from the downtown core to Natomas. See local conditions and send a photo.",
                "Dents and detailing, across Sacramento, at your door or your lot",
                "We come to your home, workplace or lot anywhere in Sacramento, from the downtown core to Natomas. The work is the same everywhere; what changes is where your car is parked and what the local heat, hail and wash-water rules mean for it. Tell us the spot and send a photo.", b,
                "Mobile dent repair & detailing, Sacramento")


def elk_grove():
    b = [
        plate("At your door", "Do you come to my home or workplace in Elk Grove?", md("""
Yes. We come to your home, workplace or lot in Elk Grove for dent removal and detailing. Send photos of the dent, tell us where the car is parked, and we tell you what we can do. We do not need your street address for a first answer.""")),
        plate("The Auto Mall", "Do you serve dealerships and the Elk Grove Auto Mall?", md("""
Elk Grove has a dedicated Auto Mall, and dealerships around it including Chevrolet, Toyota, Honda and Chrysler Dodge Jeep Ram stores and a BMW dealer. If you manage inventory at one of them, paintless dent repair and detailing can happen where the vehicles sit. Tell us how many vehicles and what they need, and we quote per vehicle from photos. See [dealers and fleets](/dealers-and-fleets/).""") + sources([("Elk Grove Auto Mall listing (LoopNet)", "https://loopnet.ca/Listing/7101-Elk-Grove-Blvd-Elk-Grove-CA/13208664"), ("Elk Grove dealers (KBB)", "https://www.kbb.com/dealers/honda/elk-grove-ca-95758")]), g=True),
        plate("Shopping centers", "Where do door dings happen in Elk Grove?", md("""
Anywhere a car shares a parking lot. Laguna Promenade and Elk Grove Commons are two of the shopping centers there, and a door ding in a lot like those is the most common reason people look for paintless repair. A ding on the flat of a door or fender with intact paint is often a good candidate. See [paintless dent repair](/paintless-dent-repair/) for the method and its limits.""") + sources([("Elk Grove Auto Mall listing (LoopNet)", "https://loopnet.ca/Listing/7101-Elk-Grove-Blvd-Elk-Grove-CA/13208664")])),
        plate("Water rule", "Does Elk Grove have rules about washing cars?", md("""
Yes. Sacramento County lists Elk Grove among the cities with its own stormwater ordinance, and says businesses may not let wash water of any kind run into storm drains. Dent removal uses no water. For detailing at your driveway or lot, we explain how we handle water before you book. See [mobile detailing](/mobile-detailing/).""") + sources([SRC_COUNTY]), g=True),
        plate("Heat", "What does summer do to a car in Elk Grove?", md("""
We do not have a number for Elk Grove alone. For the Sacramento area as a whole, a typical year brings about 23 days at or above 100°F, and 2024 set a record with its 45th on September 24. That is why many drivers ask about [paint deep-clean](/mobile-detailing/) and [ceramic coating](/ceramic-coating/).""") + sources([SRC_HEAT])),
        faq_block([
            ("Can you come to my business lot in Elk Grove?", "Yes. Tell us how many vehicles and where they are, and whether a gate or a manager needs to approve a visit."),
            ("Do I have to be home?", "Tell us when you text. We confirm the details of the visit when we agree a time."),
        ], "Questions about Elk Grove", g=True),
        photo_card("Send photos and tell us where the car is in Elk Grove. We tell you what we can do."),
        end_cta(),
    ]
    return city("Elk Grove", "/service-area/elk-grove/", "Dent Repair & Detailing in Elk Grove | 916 Dent & Detail",
                "Mobile dent repair and detailing in Elk Grove: shopping-center door dings, dealer lots and driveways. Send a photo and we tell you what we can do.",
                "Dents out and paint glowing in Elk Grove",
                "We come to your home, workplace or lot in Elk Grove. That includes shopping-center door dings, driveways and dealership lots around the Auto Mall. Send photos of the dent and tell us where the car is parked, and we tell you whether paintless repair fits and what happens next.", b,
                "Mobile dent repair & detailing, Elk Grove")


def roseville():
    b = [
        plate("At your door", "Do you come to my home or workplace in Roseville?", md("""
Yes. We come to your home, workplace or lot in Roseville for dent removal and detailing. Send photos, tell us where the car will be, and we tell you what we can do. Lincoln and Rocklin are on the [service area](/service-area/) list as well.""")),
        plate("The Galleria", "Where do door dings happen in Roseville?", md("""
Anywhere cars share a lot, and Roseville has one of the biggest: Westfield Galleria at Roseville, off Highway 65 on Galleria Boulevard, lists about 6,400 parking spaces. A ding from a neighboring car in a lot that size is the everyday case for paintless repair. If the paint is intact and the dent is shallow and rounded, it is often a good candidate. Read the [method and its limits](/paintless-dent-repair/).""") + sources([("Westfield Galleria at Roseville, access and parking", "https://www.westfield.com/united-states/galleriaatroseville/access")]), g=True),
        plate("Automall", "Do you work with dealerships on Automall Drive?", md("""
Roseville has an automall along Automall Drive. If you manage vehicles for a dealership there, or for a fleet or rental lot anywhere in Roseville, we can work on the lot. Tell us how many vehicles and what they need, and we quote per vehicle from photos. See [dealers and fleets](/dealers-and-fleets/).""") + sources([("Roseville Toyota, Automall Drive (DealerRater)", "https://www.dealerrater.com/dealer/Roseville-Toyota-review-17177/")])),
        plate("Hail", "Does hail hit Roseville?", md("""
Sometimes. A CBS Sacramento report on a March hailstorm describes hail in Woodland, Roseville and Citrus Heights; the summary we found does not show the year. Valley hail is occasional, not annual, and we do not claim a number of dented cars for any storm. If hail has hit your car, start with [hail damage repair](/hail-damage-repair/).""") + sources([("CBS Sacramento, hail storm in the region", "https://www.cbsnews.com/sacramento/news/hail-storm-sacramento-region/")]), g=True),
        faq_block([
            ("Do you serve Rocklin and Lincoln too?", "Yes. Both are on the service area list. Send photos and name the city."),
            ("Can you come to a workplace lot in Roseville?", "Yes. Tell us how many vehicles, whether a manager must approve a visit, and where they are parked."),
        ], "Questions about Roseville"),
        photo_card("Send photos and tell us where the car is in Roseville. We tell you what we can do."),
        end_cta(),
    ]
    return city("Roseville", "/service-area/roseville/", "Dent Repair & Detailing in Roseville | 916 Dent & Detail",
                "Mobile dent repair and detailing in Roseville: Galleria-lot door dings, Automall Drive dealer vehicles and hail damage. Send a photo for a price.",
                "Mobile dent repair and detailing in Roseville",
                "We come to your home, workplace or lot in Roseville for paintless dent repair and detailing. That covers the door dings that come with big shopping-center lots, vehicles on Automall Drive and the occasional hail storm. Send photos and tell us where the car is parked, and we tell you what we can do.", b,
                "Mobile dent repair & detailing, Roseville")


def folsom():
    b = [
        plate("At your door", "Do you come to my home or workplace in Folsom?", md("""
Yes. We come to your home, workplace or lot in Folsom for dent removal and detailing. Send photos, tell us where the car will be, and we tell you what we can do.""")),
        plate("Workplace lots", "Can you work at a large campus or office lot in Folsom?", md("""
Often, with the right permission. Intel has a campus in Folsom, off Prairie City Road and Highway 50, and large campuses have their own rules about vendors on site. If you want a dent or a detail done in your workplace lot, ask your facilities or security team first, then tell us the lot, the building and who to ask for. We confirm the visit with you before anyone drives out.""") + sources([("CapRadio, Folsom and the Intel campus", "https://www.capradio.org/articles/2025/08/18/despite-intel-layoffs-folsom-mayor-says-city-will-continue-to-grow-diversify/")]), g=True),
        plate("Auto mall", "Do you serve dealerships in Folsom?", md("""
Folsom has an auto mall along Folsom Boulevard. If you manage vehicles for a dealership, a fleet or a rental lot in Folsom, we can work on the lot. Tell us how many vehicles and what they need, and we quote per vehicle from photos. See [dealers and fleets](/dealers-and-fleets/).""") + sources([("Toyota, Folsom dealers", "https://www.toyota.com/dealers/California/Folsom/dealers")])),
        plate("Water rule", "Does Folsom have rules about washing cars?", md("""
Yes. Sacramento County lists Folsom among the cities with its own stormwater ordinance, and says businesses may not let wash water of any kind run into storm drains. Dent removal uses no water. For detailing at your driveway or lot, we explain how we handle water before you book. See [mobile detailing](/mobile-detailing/).""") + sources([SRC_COUNTY]), g=True),
        plate("Retail", "Where do door dings happen in Folsom?", md("""
Anywhere cars share a lot. Greenback Lane is one of Folsom's retail streets, and a ding from a neighboring car in a shopping-center lot is the everyday case for paintless repair. If the paint is intact and the dent is shallow and rounded, it is often a good candidate. See [paintless dent repair](/paintless-dent-repair/) for the method and its limits.""")),
        faq_block([
            ("Can you come to my office or campus in Folsom?", "Yes, with permission from whoever manages the lot. Tell us the lot, the building and who to ask for."),
            ("Do you serve El Dorado Hills too?", "Yes. It is on the service area list. Send photos and name the city."),
        ], "Questions about Folsom", g=True),
        photo_card("Send photos and tell us where the car is in Folsom. We tell you what we can do."),
        end_cta(),
    ]
    return city("Folsom", "/service-area/folsom/", "Dent Repair & Detailing in Folsom | 916 Dent & Detail",
                "Mobile dent repair and detailing in Folsom: workplace lots, the auto mall and driveways. Send a photo and we tell you what we can do.",
                "Dent repair and detailing for Folsom drivers",
                "We come to your home, workplace or lot in Folsom for paintless dent repair and detailing. That includes campus and office lots, with permission from whoever manages them, and dealership lots along Folsom Boulevard. Send photos and tell us where the car is parked, and we tell you what we can do.", b,
                "Mobile dent repair & detailing, Folsom")
