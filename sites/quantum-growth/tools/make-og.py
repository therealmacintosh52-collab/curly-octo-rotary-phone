#!/usr/bin/env python3
"""Render public/og.png — the 1200x630 card that shows when the link is shared.

    python3 tools/make-og.py

Without this file every share of the site — a text, a Facebook post, a
LinkedIn message — renders as a bare blue link with no picture. Open Graph
will not accept SVG, so this builds the card as HTML and screenshots it with
the Chromium that already ships in this environment.

Re-run it after changing the wordmark, the palette or the headline.
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "og.png")

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
]

# Anton is a webfont and this render has no network, so the card uses the
# heaviest condensed face the machine has. Keep the tracking wide enough that
# a plain grotesque still reads as a wordmark.
CARD = """<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    background:#08080D;color:#fff;position:relative;
    font-family:"Arial Narrow",Impact,"Liberation Sans",Arial,sans-serif;
    display:flex;flex-direction:column;justify-content:center;padding:0 82px;
  }
  body::before{
    content:"";position:absolute;inset:0;
    background:radial-gradient(760px 460px at 84% 4%,rgba(242,100,25,.44),transparent 62%),
               radial-gradient(560px 360px at 2% 98%,rgba(245,166,35,.18),transparent 66%);
  }
  body::after{
    content:"";position:absolute;inset:0;opacity:.10;
    background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);
    background-size:58px 58px;
    -webkit-mask-image:linear-gradient(115deg,#000 8%,transparent 72%);
  }
  .in{position:relative}
  .mark{display:flex;align-items:center;gap:15px;margin-bottom:34px}
  .mark b{font-size:32px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
  h1{font-size:60px;line-height:1.02;font-weight:800;letter-spacing:-.01em;text-transform:uppercase;max-width:20ch}
  h1 em{font-style:normal;color:#F5A623}
  p{margin-top:26px;font-family:"Liberation Sans",Arial,sans-serif;font-size:23px;
    font-weight:700;color:#C9BFB4;max-width:52ch;line-height:1.4}
  .bar{display:flex;align-items:center;gap:20px;margin-top:36px}
  .pill{background:linear-gradient(135deg,#F5A623,#F26419);color:#1A0E03;font-family:"Liberation Sans",Arial,sans-serif;
    font-weight:800;font-size:21px;padding:13px 26px;border-radius:999px}
  .ph{font-family:"Liberation Sans",Arial,sans-serif;font-size:22px;font-weight:800;color:#fff}
</style>
<div class="in">
  <div class="mark">
    <svg width="58" height="58" viewBox="0 0 40 40">
      <ellipse cx="20" cy="20" rx="17" ry="8.4" fill="none" stroke="#3B6EF6" stroke-width="2.4" transform="rotate(-38 20 20)"/>
      <circle cx="20" cy="20" r="4.4" fill="#F5A623"/>
      <path d="M27.5 16.5 L33 9.5 L34.5 18" fill="none" stroke="#F26419" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <b>Quantum Growth</b>
  </div>
  <h1>Your competitors are winning <em>the phone call.</em></h1>
  <p>Websites, Google profiles and local search for auto shops, trades and home services. You own everything.</p>
  <div class="bar"><span class="pill">Nationwide &middot; no contracts</span><span class="ph">(916) 868-2447</span></div>
</div>
"""


def chrome():
    for c in CHROME_CANDIDATES:
        if os.path.exists(c):
            return c
    hit = subprocess.run(["which", "chromium"], capture_output=True, text=True)
    if hit.returncode == 0:
        return hit.stdout.strip()
    sys.exit("No Chromium found. Looked in:\n  " + "\n  ".join(CHROME_CANDIDATES))


def main():
    tmp = tempfile.mkdtemp()
    card = os.path.join(tmp, "card.html")
    with open(card, "w", encoding="utf-8") as fh:
        fh.write(CARD)
    subprocess.run([chrome(), "--headless=new", "--no-sandbox", "--disable-gpu",
                    "--hide-scrollbars", "--virtual-time-budget=3000",
                    "--window-size=1200,630", "--screenshot=" + OUT,
                    "file://" + card], check=True, capture_output=True)
    print("%s  %.0f KB" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
