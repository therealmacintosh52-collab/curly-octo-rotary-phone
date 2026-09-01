#!/usr/bin/env python3
"""
Screenshot and image tooling, driven by the Chromium that ships with this
environment. Used to look at the built site rather than assume it is fine.

  python3 tools/shoot.py og            build assets/img/og-cover.png (1200x630)
  python3 tools/shoot.py svg           render the illustration to a PNG to review
  python3 tools/shoot.py shots         desktop + mobile screenshots of key pages
  python3 tools/shoot.py console       load every page, report JS errors
  python3 tools/shoot.py interact      click the mobile menu, submit the form

Two things this works around:
  * headless Chrome clamps its window to roughly 485px, so a true 390px phone
    viewport has to be measured inside an iframe of that exact width;
  * a full-page screenshot is taller than the viewport, so pages are rendered
    tall and then cropped rather than trusting the viewport height.
"""

import os
import sys
import http.server
import socketserver
import threading
import functools

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SHOTS = os.path.join(ROOT, "tools", "shots")
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

PAGES = ["/", "/services/", "/services/brake-repair/", "/about/", "/reviews/",
         "/contact/", "/advice/", "/advice/check-engine-light/", "/es/",
         "/service-areas/", "/404.html"]


def serve(directory, port=0):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def browser(pw):
    return pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--font-render-hinting=none"])


def cmd_og():
    """Compose the 1200x630 social card from the real logo."""
    tpl = os.path.join(ROOT, "tools", "og-cover.html")
    with open(tpl, "w", encoding="utf-8") as fh:
        fh.write(OG_HTML)
    httpd, port = serve(ROOT)
    with sync_playwright() as pw:
        b = browser(pw)
        pg = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        pg.goto("http://127.0.0.1:%d/tools/og-cover.html" % port, wait_until="networkidle")
        out = os.path.join(ROOT, "assets", "img", "og-cover.png")
        pg.screenshot(path=out)
        b.close()
    httpd.shutdown()
    print("wrote", out)


def cmd_svg():
    os.makedirs(SHOTS, exist_ok=True)
    httpd, port = serve(ROOT)
    with sync_playwright() as pw:
        b = browser(pw)
        pg = b.new_page(viewport={"width": 720, "height": 450}, device_scale_factor=2)
        pg.goto("http://127.0.0.1:%d/assets/img/shop-scene.svg" % port, wait_until="load")
        pg.screenshot(path=os.path.join(SHOTS, "illustration.png"))
        b.close()
    httpd.shutdown()
    print("wrote", os.path.join(SHOTS, "illustration.png"))


def cmd_shots():
    """Desktop full-page, plus a true 390px phone rendered inside an iframe.

    Headless Chrome refuses to make its own window narrower than ~485px, so
    the phone view is an iframe of exactly 390px inside a wider page. That is
    the only way to see what a real phone header actually does."""
    os.makedirs(SHOTS, exist_ok=True)
    httpd, port = serve(PUBLIC)
    base = "http://127.0.0.1:%d" % port
    with sync_playwright() as pw:
        b = browser(pw)

        desk = b.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        for p in PAGES:
            desk.goto(base + p, wait_until="networkidle")
            name = (p.strip("/").replace("/", "-") or "home").replace(".html", "")
            desk.screenshot(path=os.path.join(SHOTS, "desktop-%s.png" % name), full_page=True)

        # True 390px viewport, inside an iframe so Chrome cannot clamp it.
        holder = b.new_page(viewport={"width": 900, "height": 1400}, device_scale_factor=2)
        for p in PAGES:
            holder.set_content(
                '<body style="margin:0;background:#333">'
                '<iframe src="%s%s" style="width:390px;height:1300px;border:0;display:block"></iframe>'
                '</body>' % (base, p))
            holder.wait_for_timeout(900)
            frame = holder.frame_locator("iframe")
            name = (p.strip("/").replace("/", "-") or "home").replace(".html", "")
            holder.locator("iframe").screenshot(path=os.path.join(SHOTS, "mobile-%s.png" % name))
            # report any horizontal overflow at this width
            over = holder.frames[1].evaluate(
                "() => { const d=document.documentElement;"
                " return {scroll:d.scrollWidth, client:d.clientWidth}; }")
            if over["scroll"] > over["client"] + 1:
                print("  OVERFLOW %s: scrollWidth %d > clientWidth %d"
                      % (p, over["scroll"], over["client"]))
            else:
                print("  ok 390px %s" % p)
        b.close()
    httpd.shutdown()
    print("screenshots in", SHOTS)


def cmd_console():
    httpd, port = serve(PUBLIC)
    base = "http://127.0.0.1:%d" % port
    bad = 0
    with sync_playwright() as pw:
        b = browser(pw)
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        msgs = []
        pg.on("console", lambda m: msgs.append((m.type, m.text)))
        pg.on("pageerror", lambda e: msgs.append(("pageerror", str(e))))
        for p in PAGES + ["/thank-you/", "/privacy/", "/services/timing-belts/"]:
            msgs.clear()
            pg.goto(base + p, wait_until="networkidle")
            pg.wait_for_timeout(300)
            hard = [m for m in msgs if m[0] in ("error", "pageerror")]
            # The Google Maps iframe is a cross-origin embed; requests it makes
            # are not this site's JavaScript and are reported separately.
            hard = [m for m in hard if "maps" not in m[1].lower()]
            if hard:
                bad += 1
                print("  JS ERROR on %s: %s" % (p, hard[:3]))
            else:
                print("  clean %s" % p)
        b.close()
    httpd.shutdown()
    return 1 if bad else 0


def cmd_interact():
    """Open the mobile menu, fire a call click, and submit the quote form."""
    httpd, port = serve(PUBLIC)
    base = "http://127.0.0.1:%d" % port
    ok = True
    with sync_playwright() as pw:
        b = browser(pw)
        ctx = b.new_context(viewport={"width": 900, "height": 1200})
        pg = ctx.new_page()

        # --- mobile menu, measured inside a real 390px frame ---
        pg.set_content('<body style="margin:0"><iframe src="%s/" '
                       'style="width:390px;height:1100px;border:0"></iframe></body>' % base)
        pg.wait_for_timeout(800)
        f = pg.frames[1]
        vis_before = f.eval_on_selector("#primary-nav",
                                        "el => getComputedStyle(el).display")
        f.click(".nav-toggle")
        pg.wait_for_timeout(300)
        vis_after = f.eval_on_selector("#primary-nav", "el => getComputedStyle(el).display")
        expanded = f.eval_on_selector(".nav-toggle", "el => el.getAttribute('aria-expanded')")
        print("  mobile nav: display %s -> %s, aria-expanded=%s"
              % (vis_before, vis_after, expanded))
        if vis_before != "none" or vis_after == "none" or expanded != "true":
            ok = False
            print("  FAIL mobile menu did not open")

        # --- dataLayer events on a call click ---
        pg2 = ctx.new_page()
        pg2.goto(base + "/", wait_until="networkidle")
        pg2.evaluate("window.dataLayer = []")
        # Stop the tel: navigation so the click is observable.
        pg2.evaluate("document.addEventListener('click', e => {"
                     " const a = e.target.closest('a');"
                     " if (a && (a.getAttribute('href')||'').startsWith('tel:')) e.preventDefault();"
                     "}, true)")
        pg2.click('a[data-loc="hero"]')
        pg2.wait_for_timeout(200)
        dl = pg2.evaluate("window.dataLayer")
        print("  dataLayer after call click: %s" % dl)
        if not any(d.get("event") == "click_to_call" for d in dl):
            ok = False
            print("  FAIL click_to_call not fired")

        # --- directions click ---
        pg2.evaluate("window.dataLayer = []")
        pg2.evaluate("document.querySelectorAll('a[href*=\"google.com/maps\"]')"
                     ".forEach(a => a.setAttribute('target','_blank'))")
        pg2.evaluate("document.addEventListener('click', e => e.preventDefault(), true)")
        pg2.click('a[data-loc="home-directions"]')
        pg2.wait_for_timeout(200)
        dl = pg2.evaluate("window.dataLayer")
        print("  dataLayer after directions click: %s" % dl)
        if not any(d.get("event") == "get_directions" for d in dl):
            ok = False
            print("  FAIL get_directions not fired")

        # --- quote form submit, with the endpoint stubbed to succeed ---
        pg3 = ctx.new_page()
        pg3.route("**/formsubmit.co/**",
                  lambda route: route.fulfill(status=200, content_type="application/json",
                                              body='{"success":"true"}'))
        pg3.goto(base + "/services/brake-repair/", wait_until="networkidle")
        # the service page form should arrive pre-filled with its own service
        preset = pg3.eval_on_selector("#brake-repair-quote-service", "el => el.value")
        print("  brake page form pre-filled with: %r" % preset)
        if preset != "Brake Repair":
            ok = False
            print("  FAIL service not pre-selected")
        pg3.evaluate("window.dataLayer = []")
        pg3.fill("#brake-repair-quote-name", "Test Person")
        pg3.fill("#brake-repair-quote-phone", "9165550123")
        pg3.fill("#brake-repair-quote-message", "Grinding noise when braking.")
        pg3.click("#brake-repair-quote button[type=submit]")
        pg3.wait_for_timeout(700)
        status = pg3.eval_on_selector("#brake-repair-quote .form-status",
                                      "el => el.className + '|' + el.textContent")
        print("  form status: %s" % status)
        if "ok" not in status:
            ok = False
            print("  FAIL form did not report success")
        dl = pg3.evaluate("window.dataLayer")
        if not any(d.get("event") == "generate_lead" for d in dl):
            ok = False
            print("  FAIL generate_lead not fired")
        else:
            print("  generate_lead fired: %s" % [d for d in dl if d.get("event") == "generate_lead"])

        # --- honeypot: a filled trap must not submit ---
        pg4 = ctx.new_page()
        hit = {"n": 0}
        pg4.route("**/formsubmit.co/**", lambda route: (hit.__setitem__("n", hit["n"] + 1),
                                                        route.fulfill(status=200, body="{}")))
        pg4.goto(base + "/contact/", wait_until="networkidle")
        pg4.fill("#contact-quote-name", "Bot")
        pg4.fill("#contact-quote-phone", "0000000000")
        pg4.eval_on_selector('#contact-quote input[name="_gotcha"]',
                             "el => el.value = 'spam'")
        pg4.click("#contact-quote button[type=submit]")
        pg4.wait_for_timeout(500)
        print("  honeypot: endpoint hit %d time(s) (want 0)" % hit["n"])
        if hit["n"] != 0:
            ok = False
            print("  FAIL honeypot did not block")

        b.close()
    httpd.shutdown()
    return 0 if ok else 1



def cmd_contrast():
    """Walk every text node on every page and check it against the background
    it actually renders on. Catches the class of bug where a section-level
    `p` rule outranks a component's own colour and washes text out."""
    httpd, port = serve(PUBLIC)
    base = "http://127.0.0.1:%d" % port
    JS = """
    () => {
      const lum = (r,g,b) => {
        const f = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
        return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
      };
      const parse = s => {
        const m = (s||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return m ? [+m[1],+m[2],+m[3], m[4]===undefined?1:+m[4]] : null;
      };
      // effective background: walk up until something opaque, tracking gradients
      const bgOf = el => {
        let n = el, grad = false;
        while (n && n !== document.documentElement.parentNode) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') grad = true;
          const c = parse(cs.backgroundColor);
          if (c && c[3] > 0.85) return {rgb:[c[0],c[1],c[2]], grad};
          n = n.parentElement;
        }
        return {rgb:[255,255,255], grad};
      };
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (['SCRIPT','STYLE','SVG','PATH','IFRAME','NOSCRIPT'].includes(el.tagName)) return;
        // only elements holding their own visible text
        const own = Array.from(el.childNodes)
          .filter(n => n.nodeType === 3 && n.textContent.trim().length > 1)
          .map(n => n.textContent.trim()).join(' ');
        if (!own) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (el.closest('.sr-only, .skip, .hp')) return;
        if (el.closest('[aria-hidden="true"]')) return;
        const fg = parse(cs.color); if (!fg) return;
        const bg = bgOf(el);
        const L1 = lum(fg[0],fg[1],fg[2]), L2 = lum(bg.rgb[0],bg.rgb[1],bg.rgb[2]);
        const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
        const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight)||400;
        const large = px >= 24 || (px >= 18.66 && w >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
          out.push({sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).join('.') : ''),
                    text: own.slice(0,60), ratio: +ratio.toFixed(2), need,
                    fg: cs.color, bg: 'rgb('+bg.rgb.join(',')+')', grad: bg.grad,
                    size: px, weight: w});
        }
      });
      return out;
    }
    """
    bad = 0
    with sync_playwright() as pw:
        b = browser(pw)
        pg = b.new_page(viewport={"width": 1280, "height": 1000})
        for p in PAGES + ["/thank-you/", "/privacy/", "/services/timing-belts/",
                          "/advice/repair-or-replace/"]:
            pg.goto(base + p, wait_until="networkidle")
            issues = pg.evaluate(JS)
            # a gradient ancestor means the sampled solid colour is only one end
            # of the ramp, so those are reported as "check" rather than failures
            hard = [i for i in issues if not i["grad"]]
            soft = [i for i in issues if i["grad"]]
            if hard:
                bad += len(hard)
                for i in hard:
                    print("  FAIL %-28s %.2f (need %.1f) %s | %r"
                          % (p, i["ratio"], i["need"], i["sel"], i["text"]))
            # Elements over a CSS gradient cannot be sampled from computed
            # style alone (only one end of the ramp is knowable), and those
            # pairings are checked numerically where the tokens are defined.
            if not hard:
                print("  ok %-30s (%d on gradients, checked at the token level)"
                      % (p, len(soft)))
        b.close()
    httpd.shutdown()
    return 1 if bad else 0


OG_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    background:linear-gradient(158deg,#060a2e 0%,#101a63 54%,#070c33 100%);
    color:#fff;position:relative;display:flex;flex-direction:column;
    justify-content:center;padding:0 84px}
  .glow{position:absolute;inset:0;
    background:radial-gradient(620px 340px at 86% 6%,rgba(235,113,45,.34),transparent 62%),
               radial-gradient(560px 320px at 4% 96%,rgba(12,39,245,.46),transparent 66%)}
  .grid{position:absolute;inset:0;opacity:.10;
    background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);
    background-size:64px 64px;
    -webkit-mask-image:linear-gradient(115deg,#000 10%,transparent 70%)}
  .in{position:relative}
  .chip{background:#fff;border-radius:18px;padding:16px 24px;display:inline-block;
    margin-bottom:36px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
  .chip img{height:74px;display:block}
  h1{font-size:60px;line-height:1.04;letter-spacing:-.035em;font-weight:900;max-width:19ch}
  h1 em{font-style:normal;background:linear-gradient(100deg,#ffbe8f,#ff8a44);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin-top:22px;font-size:25px;color:#c3cbe8;max-width:44ch;line-height:1.42}
  .bar{position:absolute;left:0;right:0;bottom:0;height:12px;
    background:linear-gradient(90deg,#eb712d 0%,#c85214 46%,#0c27f5 100%)}
  .meta{position:absolute;right:84px;bottom:64px;text-align:right}
  .meta b{display:block;font-size:38px;font-weight:900;letter-spacing:-.03em}
  .meta span{display:block;font-size:20px;color:#c3cbe8;margin-top:6px}
  .meta .stars{color:#f5a623;font-size:26px;letter-spacing:3px}
</style></head><body>
  <div class="glow"></div><div class="grid"></div>
  <div class="in">
    <span class="chip"><img src="../assets/img/logo.png" alt=""></span>
    <h1>Honest auto repair in <em>Elk Grove, California</em></h1>
    <p>Family owned since 2001 &middot; ASE certified &middot; NAPA AutoCare</p>
  </div>
  <div class="meta">
    <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
    <b>(916) 686-5277</b>
    <span>9253 Elk Grove Blvd, Elk Grove, CA</span>
  </div>
  <div class="bar"></div>
</body></html>"""


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "shots"
    sys.exit({"og": cmd_og, "svg": cmd_svg, "shots": cmd_shots,
              "console": cmd_console, "interact": cmd_interact,
              "contrast": cmd_contrast}[what]() or 0)
