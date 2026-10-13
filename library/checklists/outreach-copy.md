# Checklist: customer-facing outreach / listing copy (texts, marketplace listings, profiles)

Writer: qa. First used on T-014 (library/outreach/*). Re-run every check; never copy pasted output.
Scratch dir for extracted blocks, never the repo.

## 1. Identity and opt-out (texts)
- Sender is a named person with a visible fill-in ([YOUR NAME]); location stated.
- ONE text per business; follow-up only if THEY reply; "reply STOP to opt out" in the opener, "Reply STOP anytime" in follow-ups.
- No fake urgency: grep -i "limited|spots|today only|hurry|last chance|countdown|act now". A label like
  "founding-client price" is only honest if the owner will raise the price later: flag it.

## 2. Claims
- grep -i "rank|traffic|calls|guarante|years|stars|rating|award|licensed|insured|certified|best|#1|first page|testimonial".
  Every hit must be a prohibition ("never promise"), not a promise.
- Named portfolio clients: grep the real names (Cali Tints, Phil's). Trade-only wording until A-004 Q1.
- Every feature list in a listing is traced to the kit it sells (pack-template.md headings, checklist.md points).
- Count characters of titles/descriptions against stated limits; compare to the file's own size claims.

## 3. Review-card line (C4)
- Must ask every customer; no reward; no filtering; no "5 stars", "if you loved", "tell us first".
- Compare with the approved offer line in library/outreach/review-card-kit-*.md.

## 4. Terms before payment (C7)
- Price, deposit, balance trigger, refund/cancel rule are in the message or a linked page sent BEFORE the payment link.
- Any "terms below" phrase must point at text that is inside the same message block, not a separate block.

## 5. Placeholders
- Extract fenced blocks (awk '/^```/{i=!i;next} i'), run check_deliverable.py on them, list every bracket.
- Every placeholder is ALL-CAPS in brackets and visible. A "paste as is" block must have ZERO brackets.

## 6. Platform rules (Upwork / TaskRabbit style)
- Required phrase present in each description ("AI-assisted, human-reviewed", C12).
- No phone, email or off-platform link (C11). Category/scope limits (C14: assembly only, week <= 7 h; add window hours).

## 7. Lint note
check_deliverable.py on a non-kit file fails closed on the missing DESC markers (expected). Its placeholder and SAMPLE
FAILs are expected on owner-facing checklists. Report only wording-rule FAILs; inspect each by hand (false positives seen:
"reviews" near "order" in a pre-gate line; "SAMPLE report" in a Do-not line).

## 8. Re-check recipe (added T-014b)
- Extract each fence with a short python script into the scratchpad (record open/close line numbers and len()); do not rely on grep line numbers of the whole file.
- C7 order test: inside the SAME fence, line of "Terms:" < line of the payment link. Every fence that carries a price or link needs its own Terms line.
- Every [FILL] token used inside the Terms must also appear in the file's fill checklist (grep each distinct [..] token against the checklist line).
- Size claims in notes ("375", "~850/1,000") are re-counted with len(); report drift (T-014b: Upwork notes say ~850/~1,000, actual 820/1010).
- Lint run on a fence: expected FAILs are no-DESC-markers, bracket placeholders, and "sample" in the sample-builds label; report only the rest. Keep the scratch dir clean of older runs.
