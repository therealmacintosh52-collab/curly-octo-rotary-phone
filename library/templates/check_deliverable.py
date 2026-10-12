#!/usr/bin/env python3
"""Pre-delivery lint for filled library/templates/ deliverables (T-010).

    python3 library/templates/check_deliverable.py FILLED.md [--out CLIENT.md] [--allow-sample] [--no-desc]
    python3 library/templates/check_deliverable.py -h

1. Counts the GBP description between <!-- DESC START --> and <!-- DESC END -->
   (fails over 750 characters, growth's VERIFIED limit). FAILS CLOSED: missing,
   empty, duplicated or misordered markers are a FAIL, not a skip. A deliverable
   with no GBP description (the AI-search report) must say so with --no-desc.
2. Strips every HTML comment, including <!-- INTERNAL ... --> filler notes.
3. FAILS on: leftover [[FILL: ...]] placeholders, other unlabeled placeholder
   styles ([YOUR NAME], REPLACE-ME, TODO, XXX), the word SAMPLE (unless
   --allow-sample), ranking/result promises, review gating or incentives
   (red-team T-006 conditions C4 / card 5).
4. WARNS on copy-rule words (blueprint/MASTER-BLUEPRINT.md line 186) and on
   words that need a client source (guarantee, warranty, discount, free).
The wording checks are PATTERN-BASED, line by line. A clean run does not prove the
copy is compliant; the owner's read of every client file stays mandatory.
Writes --out only when there are no FAILs. Exit 0 = clean (or -h), 1 = FAIL, 2 = usage.
Standard library only.
"""
import re
import sys

DESC_MAX = 750

FAIL_PATTERNS = [
    (r"\[\[FILL", "unfilled [[FILL: ...]] placeholder"),
    # any [bracket] placeholder ([YOUR NAME], [n], [city]); skips [[FILL]] inner part,
    # checkboxes "[ ]"/"[x]" and Markdown links "[text](url)"
    (r"(?<!\[)\[(?!\[)[^\[\]\n]{2,60}\](?![\](])", "unlabeled bracket placeholder like [YOUR NAME]"),
    (r"REPLACE[-_ ]?ME|\bTODO\b|\bXXX\b|\bTBD\b", "unlabeled placeholder word"),
    # result promises (growth offers: "Do not promise rankings, calls, or reviews")
    (r"(?i)guarantee\w*\s+(\w+\s+){0,3}(rank|ranking|calls|leads|traffic|reviews|citation)", "result guarantee"),
    # digit and word forms: #1, no. 1, number one / number-1, 1st, first, top spot
    (r"(?i)\b(rank(s|ed|ing)?|get(ting)? you|put(ting)? you|land(ing)? you|take(s|n)? you)\s+(\w+\s+){0,3}"
     r"(#\s?1|(number|no\.?)[\s-]*(1|one)\b|1st|first|top)", "ranking promise"),
    (r"(?i)(#\s?1|\b(number|no\.?)[\s-]*(1|one)\b|\b1st\b|\bfirst\b|\btop\b)[\s-]*"
     r"(place\s+)?(google\s+)?(rank\w*|position|spot|result|listing)", "ranking promise"),
    (r"(?i)#\s?1 (on|in) (google|search|maps)|(number|no\.?)[\s-]*(one|1) (on|in) (google|search|maps)", "ranking promise"),
    (r"(?i)\b(top|front|first|1st)\s+(of|on|in)\s+(the\s+)?(google|search|results|rankings?|serps?|maps)", "ranking promise"),
    (r"(?i)\b(first|1st|one|1)\s+page\s+(of\s+)?(the\s+)?(google|search|results)|page\s+(one|1)\s+(of|on)\b", "ranking promise"),
    (r"(?i)\bguarantee\w*\b.{0,40}\b(rank\w*|top|first page|page one)\b", "ranking promise"),
    # review gating / incentives (C4)
    (r"(?i)\b(5|five)[\s-]*stars?\b|\b(5|five)\s*(/|out of|of)\s*(5|five)\b|\b(10|ten)\s*(/|out of)\s*(10|ten)\b"
     r"|\u2605|\u2b50|\b(perfect|top|full)\s+(score|rating|marks)\b|\brate\s+us\s+(a\s+)?(5|five|10|ten|perfect|highly)\b",
     "star-rating ask"),
    (r"(?i)if you (loved|liked|enjoyed|were happy|are happy|were satisfied|are satisfied|were pleased)|if you're (happy|satisfied|pleased)"
     r"|if you (had|have|received) (a |an )?(great|good|positive|excellent|wonderful) ", "gated review ask"),
    (r"(?i)\bonly\s+(\w+\s+){0,2}(happy|satisfied|pleased|positive)\b|\b(happy|satisfied|pleased)\s+customers?\s+only\b"
     r"|\bonly\s+(leave|write|post|send)\s+(a\s+)?(positive|good|great|5|five)|\bpositive reviews? (only|please)\b", "gated review ask"),
    (r"(?i)tell us first|contact us before (leaving|writing) a review|(call|email|message|text) us (first|before)", "private-feedback detour"),
    (r"(?i)in exchange for (a|your) review|review and (get|receive|win|enter)|for (a|your) review,? (get|receive)|\bentry\b.*\breview\b"
     r"|\benter\s+(\w+\s+){0,3}(draw|raffle|giveaway|sweepstakes?|contest|competition)\b"
     r"|(?<!no )(?<!without )(?<!never )\b(draw|raffle|giveaway|sweepstakes?|prize|voucher|coupon|gift card|freebie|reward)\b.*\breview|\breview\b.*(?<!no )(?<!without )(?<!never )\b(draw|raffle|giveaway|sweepstakes?|prize|voucher|coupon|gift card|freebie|reward)\b",
     "review incentive"),
]
WARN_PATTERNS = [
    (r"(?i)\bcheap\b|\bbest in town\b|treat you like family|\bpassionate\b|\bdeal\b", "copy-rule word (blueprint line 186)"),
    (r"(?i)\bguarantee|\bwarrant(y|ies)\b|\bcertified\b|\baward", "needs the client as source (blueprint line 187)"),
    (r"(?i)\bdiscount\b|% off\b|\bfree\b", "offer word: only if the client stated it"),
]


def strip_comments(text):
    """Remove HTML comments but keep their newlines so line numbers still match."""
    return re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


def main(argv):
    if any(a in ("-h", "--help") for a in argv):
        print(__doc__)
        return 0
    args = [a for a in argv if not a.startswith("--")]
    allow_sample = "--allow-sample" in argv
    no_desc = "--no-desc" in argv
    unknown = [a for a in argv if a.startswith("-") and a not in ("--out", "--allow-sample", "--no-desc")]
    if unknown:
        print(f"unknown option(s): {' '.join(unknown)}\n(run with -h)"); return 2
    out = None
    if "--out" in argv:
        i = argv.index("--out")
        if i + 1 >= len(argv):
            print("usage: --out needs a path"); return 2
        out = argv[i + 1]
        args = [a for a in args if a != out]
    if len(args) != 1:
        print(__doc__); return 2
    src = args[0]
    try:
        text = open(src, encoding="utf-8").read()
    except OSError as e:
        print(f"cannot read {src}: {e.strerror}"); return 2
    fails, warns = [], []

    if no_desc:
        print("description check: skipped by --no-desc (deliverable has no GBP description)")
    else:
        starts = [m.start() for m in re.finditer(r"<!-- DESC START -->", text)]
        ends = [m.start() for m in re.finditer(r"<!-- DESC END -->", text)]
        m = re.search(r"<!-- DESC START -->(.*?)<!-- DESC END -->", text, flags=re.S)
        if not starts and not ends:
            fails.append((0, "no <!-- DESC START --> / <!-- DESC END --> markers: the 750-character "
                             "check cannot run. Restore the markers, or pass --no-desc if this "
                             "deliverable has no GBP description"))
        elif len(starts) != 1 or len(ends) != 1 or not m:
            fails.append((0, f"DESC markers must appear once each, START before END (found "
                             f"{len(starts)} START, {len(ends)} END)"))
        else:
            desc = m.group(1).strip()
            n = len(desc)
            line = text[: m.start()].count("\n") + 1
            print(f"description: {n} characters (max {DESC_MAX})")
            if n == 0:
                fails.append((line, "description between the DESC markers is empty"))
            elif n > DESC_MAX:
                fails.append((line, f"description is {n} characters, over {DESC_MAX}"))

    client = strip_comments(text)
    if "<!--" in client or "-->" in client:
        fails.append((0, "unbalanced HTML comment; internal notes may leak"))
    patterns = list(FAIL_PATTERNS)
    if not allow_sample:
        patterns.append((r"\bSAMPLE\b", "SAMPLE text in a client deliverable"))
    for ln, row in enumerate(client.splitlines(), 1):
        for pat, why in patterns:
            if re.search(pat, row):
                fails.append((ln, f"{why}: {row.strip()[:70]}"))
        for pat, why in WARN_PATTERNS:
            if re.search(pat, row):
                warns.append((ln, f"{why}: {row.strip()[:70]}"))

    for ln, msg in fails:
        print(f"FAIL line {ln}: {msg}")
    for ln, msg in warns:
        print(f"WARN line {ln}: {msg}")
    print(f"{src}: {len(fails)} FAIL, {len(warns)} WARN")
    if fails:
        return 1
    if out:
        cleaned = re.sub(r"\n{3,}", "\n\n", client).strip() + "\n"
        open(out, "w", encoding="utf-8").write(cleaned)
        print(f"wrote client copy: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
