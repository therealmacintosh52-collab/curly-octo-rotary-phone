#!/bin/sh
# Run before every deploy:  sh preflight.sh
# Exits non-zero if anything that must not go public is still in the files.
fail=0
say() { printf '  %s\n' "$1"; fail=1; }

echo "Preflight: sites/steadhaul"

for f in index.html onboarding.html; do
  [ -f "$f" ] || { say "FAIL  missing $f"; continue; }
  grep -q '(000) 000-0000\|+10000000000' "$f" && \
    say "FAIL  $f: placeholder phone number ($(grep -o '+10000000000\|(000) 000-0000' "$f" | wc -l | tr -d ' ') instances)"
  grep -q 'PLACEHOLDER\|\[Carrier name\]\|\[Origin, ST' "$f" && \
    say "FAIL  $f: placeholder proof content still present"
done

# The signing link is the whole point of the onboarding page. Never ship it dead.
grep -q 'BOLDSIGN_ENVELOPE_URL' onboarding.html 2>/dev/null && \
  say "FAIL  onboarding.html: signing link is still the placeholder — carriers cannot sign or upload"

grep -q 'hello@steadhauldispatch.com' index.html && \
  [ ! -f .email-confirmed ] && \
  say "WARN  confirm hello@steadhauldispatch.com receives mail, then: touch .email-confirmed"

for f in index.html onboarding.html icon.svg apple-touch-icon.png og.png robots.txt sitemap.xml netlify.toml; do
  [ -f "$f" ] || say "FAIL  missing $f"
done

if [ "$fail" -eq 0 ]; then
  echo "  OK    nothing blocking. Ship it."
else
  echo "  --> fix the above before deploying."
fi
exit $fail
