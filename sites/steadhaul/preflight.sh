#!/bin/sh
# Run before every deploy:  sh preflight.sh
# Exits non-zero if the page still carries anything that must not go public.
fail=0
say() { printf '  %s\n' "$1"; fail=1; }

echo "Preflight: sites/steadhaul"

grep -q '(000) 000-0000\|+10000000000' index.html && \
  say "FAIL  placeholder phone number still present ($(grep -o '+10000000000\|(000) 000-0000' index.html | wc -l | tr -d ' ') instances)"

grep -q 'PLACEHOLDER\|\[Carrier name\]\|\[Origin, ST' index.html && \
  say "FAIL  placeholder proof content still present"

grep -q 'hello@steadhauldispatch.com' index.html && \
  [ ! -f .email-confirmed ] && \
  say "WARN  confirm hello@steadhauldispatch.com receives mail, then: touch .email-confirmed"

for f in index.html icon.svg apple-touch-icon.png og.png robots.txt sitemap.xml; do
  [ -f "$f" ] || say "FAIL  missing $f"
done

if [ "$fail" -eq 0 ]; then
  echo "  OK    nothing blocking. Ship it."
else
  echo "  --> fix the above before deploying."
fi
exit $fail
