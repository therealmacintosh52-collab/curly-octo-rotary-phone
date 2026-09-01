#!/usr/bin/env python3
"""Crop a PNG to an exact size — no third-party libraries.

Headless Chrome reserves ~87px of window height for browser chrome, so a
screenshot taken at 1200x717 paints a 1200x630 page and leaves a blank strip
at the bottom. This trims it off.

Usage: python3 png_crop.py in.png out.png WIDTH HEIGHT
Supports 8-bit RGB / RGBA, non-interlaced — which is what Chrome writes.
"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("not a PNG: %s" % path)
    pos, idat = 8, b""
    width = height = depth = color = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if depth != 8 or color not in (2, 6) or interlace:
                raise SystemExit("unsupported PNG format (depth=%s color=%s interlace=%s)"
                                 % (depth, color, interlace))
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break
        pos += 12 + length

    channels = 3 if color == 2 else 4
    stride = width * channels
    raw = zlib.decompress(idat)
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        filt = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        rows.append(bytes(line))
        prev = line
    return width, height, channels, rows


def write_png(path, width, height, channels, rows):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2 if channels == 3 else 6, 0, 0, 0)
    out = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    open(path, "wb").write(out)


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    src, dst, want_w, want_h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    width, height, channels, rows = read_png(src)
    if want_w > width or want_h > height:
        raise SystemExit("cannot crop %dx%d up to %dx%d" % (width, height, want_w, want_h))
    rows = [r[:want_w * channels] for r in rows[:want_h]]
    write_png(dst, want_w, want_h, channels, rows)
    print("%s -> %s (%dx%d)" % (src, dst, want_w, want_h))


if __name__ == "__main__":
    main()
