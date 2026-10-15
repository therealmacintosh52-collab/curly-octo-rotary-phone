#!/usr/bin/env bash
# Re-creates the self-hosted font subsets in src/fonts/ from the @fontsource npm packages.
# Needs: npm, python3 with fonttools + brotli (pip install fonttools brotli).
#   bash scripts/subset-fonts.sh
# Subset = Basic Latin + Latin-1 + common punctuation (en/em dash, curly quotes, bullet, ellipsis, →).
# Cuts ~40% of the bytes that load before first paint (see DECISIONS P-016).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm pack @fontsource/michroma@5.3.0 @fontsource/inter@5.3.0 >/dev/null 2>&1
mkdir mi in && tar -xzf fontsource-michroma-5.3.0.tgz -C mi && tar -xzf fontsource-inter-5.3.0.tgz -C in
U="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201F,U+2022,U+2026,U+2192,U+2122"
sub() { pyftsubset "$1" --unicodes="$U" --flavor=woff2 --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk' --no-hinting --desubroutinize --output-file="$2"; }
sub mi/package/files/michroma-latin-400-normal.woff2 "$ROOT/src/fonts/michroma-400.woff2"
sub in/package/files/inter-latin-400-normal.woff2 "$ROOT/src/fonts/inter-400.woff2"
sub in/package/files/inter-latin-600-normal.woff2 "$ROOT/src/fonts/inter-600.woff2"
cp mi/package/LICENSE "$ROOT/src/fonts/LICENSE-michroma.txt"
cp in/package/LICENSE "$ROOT/src/fonts/LICENSE-inter.txt"
ls -l "$ROOT/src/fonts"
