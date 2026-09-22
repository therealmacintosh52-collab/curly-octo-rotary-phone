#!/usr/bin/env python3
"""Generate placeholder art so the site renders before real photography lands.

Stdlib only -- writes valid PNGs by hand (zlib + struct), no Pillow. Every file
produced here is meant to be REPLACED; each carries a visible diagonal hatch so
a placeholder can never be mistaken for the real thing in a screenshot.
"""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")

BLACK = (11, 11, 13)
CHAR = (28, 28, 33)
RED = (224, 31, 38)
FLAME = (242, 100, 25)


def png(path, w, h, painter):
    rows = bytearray()
    for y in range(h):
        rows.append(0)                      # filter type 0 for each scanline
        for x in range(w):
            rows.extend(painter(x, y, w, h))
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    out = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
           + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(out)
    return path


def hatch(x, y, base, accent, period=26, width=9):
    return accent if ((x + y) % period) < width else base


def logo(x, y, w, h):
    cx, cy = w / 2.0, h / 2.0
    r = min(w, h) / 2.0 - 2
    d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    if d > r:
        return bytes(BLACK)
    # flame-ish radial ramp
    t = d / r
    col = FLAME if t > 0.55 else RED
    return bytes(hatch(x, y, col, CHAR, 22, 6))


def cover(x, y, w, h):
    band = FLAME if y > h * 0.72 else CHAR
    return bytes(hatch(x, y, band, BLACK, 34, 11))


def food(x, y, w, h):
    return bytes(hatch(x, y, CHAR, BLACK, 24, 8))


def main():
    made = []
    made.append(png(os.path.join(IMG, "logo.png"), 160, 160, logo))
    made.append(png(os.path.join(IMG, "og-cover.png"), 1200, 630, cover))
    for name in ("storefront", "signature-sando", "entrance", "interior"):
        made.append(png(os.path.join(IMG, "gallery", name + ".png"), 800, 600, food))
    for name in ("stark-sando", "double-sando", "korean-sweet-pop-chicken",
                 "tenders-3", "wings", "sloppy-cheeto-fries", "combo-1",
                 "combo-3", "mac"):
        made.append(png(os.path.join(IMG, "menu", name + ".png"), 640, 480, food))

    # Favicon as SVG -- sharp at every size, no binary needed.
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
           '<rect width="64" height="64" rx="14" fill="#0B0B0D"/>'
           '<path d="M32 54c-9 0-16-6.3-16-15.4 0-6.1 3.8-10.5 6.8-14.2 1-1.2 2.9-.4 2.8 1.2 0 2 .6 3.8 2 4.9C29 25 30.2 18.1 35.2 13.5c1.2-1 3 0 2.8 1.6-.2 3.4.6 6.1 3.2 9.1C44 27.4 48 31.5 48 38.6 48 47.7 41 54 32 54z" fill="#F26419"/>'
           '<path d="M32 50c-5.2 0-9.4-3.8-9.4-9 0-3.8 2.4-6.4 4.2-8.4.8-.8 2-.2 2 .8.2 1.2.6 2.2 1.4 2.8 1.6-2.8 2.4-6.4 5.4-8.8.8-.8 2.2 0 2 1.2-.2 2 .4 3.4 1.8 5.2 1.6 2 3.8 4.4 3.8 8 0 5.2-4.2 9-9.2 9z" fill="#E01F26"/>'
           '</svg>')
    fav = os.path.join(IMG, "favicon.svg")
    with open(fav, "w", encoding="utf-8") as fh:
        fh.write(svg)
    made.append(fav)
    for p in made:
        print("  %s" % os.path.relpath(p, ROOT))
    print("%d placeholder assets written" % len(made))


if __name__ == "__main__":
    main()
