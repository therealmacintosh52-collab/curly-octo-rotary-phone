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

# The dashboard and the form both need real Supabase credentials.
[ -f sh-config.js ] || say "WARN  sh-config.js missing — the form will fall back to Netlify Forms instead of the database"
grep -q 'YOUR-PROJECT' sh-config.js 2>/dev/null && say "FAIL  sh-config.js still has placeholder credentials"
[ -f dashboard/config.js ] || say "WARN  dashboard/config.js missing — the dashboard will not load"
grep -q 'YOUR-PROJECT' dashboard/config.js 2>/dev/null && say "FAIL  dashboard/config.js still has placeholder credentials"
# The service key bypasses every security policy. It must never ship to a browser.
# Only real code counts — the example files mention it to warn against it.
for f in sh-config.js dashboard/config.js dashboard/index.html; do
  [ -f "$f" ] || continue
  if grep -v '^[[:space:]]*\(//\|\*\|/\*\)' "$f" | grep -q 'service_role'; then
    say "FAIL  $f contains service_role outside a comment — that key must never reach a browser"
  fi
done
# A service key is a JWT whose payload names the role; catch a pasted one too.
for f in sh-config.js dashboard/config.js; do
  [ -f "$f" ] || continue
  grep -oE 'eyJ[A-Za-z0-9_-]+' "$f" 2>/dev/null | while read -r tok; do
    if printf '%s' "$tok" | sed 's/^eyJ//' | base64 -d 2>/dev/null | grep -q 'service_role'; then
      say "FAIL  $f holds a service_role JWT — replace it with the anon key"
    fi
  done
done

if [ "$fail" -eq 0 ]; then
  echo "  OK    nothing blocking. Ship it."
else
  echo "  --> fix the above before deploying."
fi
exit $fail
