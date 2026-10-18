#!/usr/bin/env python3
"""Leak and claim lint for public/. Strict by default (the deploy gate).

  python3 tools/lint.py                 production: fails while ANY token, marker, banned claim or foreign name remains
  python3 tools/lint.py --allow-tokens  build check: tokens and the phone marker are listed as 'pending', everything else still fails

Rules come from COMPLIANCE.md sections 1 and 15, BLUEPRINT stage 4 and the task brief. ALLOW is the whole exception list."""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_SUFFIX = {".png", ".avif", ".webp", ".woff2", ".ico", ".jpg", ".jpeg", ".svg"}

TOKEN = re.compile(r"\{\{[A-Z_]+\}\}")
MARKERS = [(re.compile(r'<meta name="phone-status" content="unconfirmed">'), "PHONE_CONFIRMED is false (TO-CONFIRM #1)"),
           (re.compile(r"<!--FORM-UNCONNECTED-->"), "form is marked not connected")]
W = lambda w: re.compile(r"(?<![\w-])(?:%s)(?![\w-])" % w, re.I)  # noqa: E731
BANNED = [
    ("licensed", W("licensed|licence number|license number|bar registered")), ("insured", W("insured|insurance certificate|COI")),
    ("bonded", W("bonded")), ("certified", W("certified|certification")), ("guarantee", W("guarantee|guaranteed|guarantees")),
    ("warranty", W("warranty|warranties")), ("lifetime", W("lifetime")), ("years", re.compile(r"\byears\b|\b\d+(-\d+)? year\b", re.I)),
    ("award", W("awards?|award-winning")), ("best", W("best")), ("family owned", W("family[- ]owned|locally[ -]owned")),
    ("since 19xx/20xx", re.compile(r"\bsince (19|20)\d\d\b", re.I)), ("#1", re.compile(r"#1\b")),
    ("price claim", W("cheapest|fastest|free estimates?|same[- ]day|30 minutes|scratch-proof|permanent|never wash again|net terms|master technician|trusted by|open now|contractor")),
    ("eco claim", W("eco-friendly|biodegradable|zero discharge|reclaim|water reclaim|green")),
    ("base ZIP", re.compile(r"95624")), ("price", re.compile(r"\$\s?\d")),
    ("review markup", re.compile(r'"@type":\s*"(AggregateRating|Review)"|aggregateRating', re.I)),
    ("stars", re.compile("[\u2605\u2606\u2B50]")),
    ("placeholder", re.compile(r"example\.com|TODO|lorem|replace-with|\[CONFIRM|REPLACE WITH|will name here|will add [^<.]{0,60} here|once it is chosen", re.I)),
    ("other business", re.compile(r"Phil.?s Auto|Cali Tints|Quantum|Lodi\b", re.I)),
    ("address", re.compile(r"\b\d{3,5} [A-Z][a-z]+ (St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way)\b")),
]
# Exceptions: (rule name, file suffix or '*', regex that must match the offending text, reason). Keep tiny.
ALLOW = [
    ("address", "/service-area/sacramento/index.html", re.compile(r"2500 Auburn Boulevard"),
     "Third-party dealership address cited from the county air-district dealer list; it is not the business's address"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--public", default=str(ROOT / "public"))
    ap.add_argument("--allow-tokens", action="store_true")
    a = ap.parse_args()
    pub = Path(a.public)
    if not pub.exists():
        sys.exit("no public/ folder; run build.py first")
    fails, pending, allowed = [], {}, 0
    for f in sorted(pub.rglob("*")):
        if not f.is_file() or f.suffix in SKIP_SUFFIX:
            continue
        rel = "/" + f.relative_to(pub).as_posix()
        try:
            s = f.read_text()
        except UnicodeDecodeError:
            continue
        for m in TOKEN.finditer(s):
            pending.setdefault(m.group(0), set()).add(rel)
        for rx, why in MARKERS:
            if rx.search(s):
                pending.setdefault(why, set()).add(rel)
        for name, rx in BANNED:
            for m in rx.finditer(s):
                ctx = s[max(0, m.start() - 40):m.end() + 40].replace("\n", " ")
                if any(n == name and (suf == "*" or rel.endswith(suf)) and al.search(ctx) for n, suf, al, _ in ALLOW):
                    allowed += 1
                    continue
                fails.append("%s: [%s] ...%s..." % (rel, name, ctx))
    for k, v in sorted(pending.items()):
        print("PENDING %-45s in %d file(s)" % (k, len(v)))
    for x in fails[:80]:
        print("FAIL", x)
    print("allowlisted hits: %d; hard failures: %d; pending tokens/markers: %d" % (allowed, len(fails), len(pending)))
    if fails:
        sys.exit(1)
    if pending and not a.allow_tokens:
        print("PRODUCTION LINT FAILED: stamp the tokens first (tools/stamp.py)")
        sys.exit(1)
    print("lint ok" + (" (tokens still pending)" if pending else ""))


if __name__ == "__main__":
    main()
