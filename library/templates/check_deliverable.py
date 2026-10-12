#!/usr/bin/env python3
"""Pre-delivery lint for filled library/templates/ deliverables (T-010).

    python3 library/templates/check_deliverable.py FILLED.md [--out CLIENT.md] [--allow-sample]

1. Counts the GBP description between <!-- DESC START --> and <!-- DESC END -->
   (fails over 750 characters, growth's VERIFIED limit).
2. Strips every HTML comment, including <!-- INTERNAL ... --> filler notes.
3. FAILS on: leftover [[FILL: ...]] placeholders, other unlabeled placeholder
   styles ([YOUR NAME], REPLACE-ME, TODO, XXX), the word SAMPLE (unless
   --allow-sample), ranking/result promises, review gating or incentives
   (red-team T-006 conditions C4 / card 5).
4. WARNS on copy-rule words (blueprint/MASTER-BLUEPRINT.md line 186) and on
   words that need a client source (guarantee, warranty, discount, free).
Writes --out only when there are no FAILs. Exit 0 = clean, 1 = FAIL, 2 = usage.
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
    (r"(?i)\b(rank|ranking)\s+(#?1|first|number one)\b|#1 on google|top of google|first page of google|page one of google", "ranking promise"),
    # review gating / incentives (C4)
    (r"(?i)\b(5|five)[- ]stars?\b", "star-rating ask"),
    (r"(?i)if you (loved|liked|enjoyed|were happy|are happy)|if you're happy", "gated review ask"),
    (r"(?i)tell us first|contact us before (leaving|writing) a review", "private-feedback detour"),
    (r"(?i)in exchange for (a|your) review|review and (get|receive|win)|for (a|your) review,? (get|receive)|\bentry\b.*\breview\b", "review incentive"),
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
    args = [a for a in argv if not a.startswith("--")]
    allow_sample = "--allow-sample" in argv
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
    text = open(src, encoding="utf-8").read()
    fails, warns = [], []

    m = re.search(r"<!-- DESC START -->(.*?)<!-- DESC END -->", text, flags=re.S)
    if m:
        desc = m.group(1).strip()
        n = len(desc)
        line = text[: m.start()].count("\n") + 1
        print(f"description: {n} characters (max {DESC_MAX})")
        if n > DESC_MAX:
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
