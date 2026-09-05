#!/usr/bin/env python3
"""Move an MP4's index to the front, and report what is inside it.

A phone writes the `moov` atom after all the video data, so a browser has to
fetch the whole file before it can seek anywhere. That is fine for a file you
double-click and fatal for a video the scroll position drives: every seek waits
on the download. Moving `moov` in front of `mdat` — "faststart" — lets the
browser start seeking after a few kilobytes. No re-encoding, so the pixels are
untouched; only the chunk offset tables have to be shifted.

Usage: python3 mp4_faststart.py in.mp4 out.mp4
"""
import struct
import sys

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts", b"dinf"}


def boxes(data, start=0, end=None):
    """Yield (type, header_start, body_start, box_end) for one level."""
    end = len(data) if end is None else end
    pos = start
    while pos + 8 <= end:
        size = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = pos + 8
        if size == 1:                      # 64-bit extended size
            size = struct.unpack(">Q", data[pos + 8:pos + 16])[0]
            body = pos + 16
        elif size == 0:                    # runs to the end of the file
            size = end - pos
        if size < 8:
            break
        yield kind, pos, body, pos + size
        pos += size


def find(data, path, start=0, end=None):
    """Walk a path like [b'moov', b'trak'] and yield the matching boxes."""
    head, rest = path[0], path[1:]
    for kind, box, body, stop in boxes(data, start, end):
        if kind != head:
            continue
        if not rest:
            yield box, body, stop
        elif kind in CONTAINERS:
            for hit in find(data, rest, body, stop):
                yield hit


def describe(data):
    """Duration, frame rate and keyframe spacing, straight from the tables."""
    out = {}
    for _box, body, _stop in find(data, [b"moov", b"mvhd"]):
        version = data[body]
        if version == 0:
            scale, dur = struct.unpack(">II", data[body + 12:body + 20])
        else:
            scale, dur = struct.unpack(">IQ", data[body + 20:body + 32])
        out["seconds"] = dur / scale if scale else 0
        break

    for tbox, tbody, tstop in find(data, [b"moov", b"trak"]):
        handler = None
        for _b, hbody, _s in find(data, [b"mdia", b"hdlr"], tbody, tstop):
            handler = data[hbody + 8:hbody + 12]
            break
        if handler != b"vide":
            continue
        for _b, sbody, _s in find(data, [b"mdia", b"minf", b"stbl", b"stts"], tbody, tstop):
            count = struct.unpack(">I", data[sbody + 4:sbody + 8])[0]
            frames = delta_total = 0
            for i in range(count):
                n, delta = struct.unpack(">II", data[sbody + 8 + i * 8:sbody + 16 + i * 8])
                frames += n
                delta_total += n * delta
            out["frames"] = frames
            for _b2, mbody, _s2 in find(data, [b"mdia", b"mdhd"], tbody, tstop):
                mscale = struct.unpack(">I", data[mbody + 12:mbody + 16])[0]
                if delta_total:
                    out["fps"] = round(frames * mscale / delta_total, 3)
                break
            break
        out["keyframes"] = 0
        for _b, kbody, _s in find(data, [b"mdia", b"minf", b"stbl", b"stss"], tbody, tstop):
            out["keyframes"] = struct.unpack(">I", data[kbody + 4:kbody + 8])[0]
            break
        break
    return out


def shift_offsets(data, moov_start, moov_end, delta):
    """Every chunk offset points into mdat; moving moov moves all of them."""
    buf = bytearray(data)
    moved = 0
    for kind, path in ((b"stco", [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stco"]),
                       (b"co64", [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"co64"])):
        for _box, body, _stop in find(data, path, moov_start, moov_end):
            count = struct.unpack(">I", data[body + 4:body + 8])[0]
            width = 4 if kind == b"stco" else 8
            fmt = ">I" if width == 4 else ">Q"
            for i in range(count):
                at = body + 8 + i * width
                value = struct.unpack(fmt, data[at:at + width])[0] + delta
                if width == 4 and value > 0xFFFFFFFF:
                    sys.exit("offsets no longer fit in 32 bits; this file needs co64")
                buf[at:at + width] = struct.pack(fmt, value)
                moved += 1
    return bytes(buf), moved


def faststart(data):
    top = [(kind, box, stop) for kind, box, _body, stop in boxes(data)]
    kinds = [k for k, _b, _s in top]
    if b"moov" not in kinds or b"mdat" not in kinds:
        sys.exit("not an MP4 with both moov and mdat")
    if kinds.index(b"moov") < kinds.index(b"mdat"):
        return data, 0                      # already faststart

    moov = next((box, stop) for k, box, stop in top if k == b"moov")
    moov_bytes = data[moov[0]:moov[1]]
    # The offsets are relative to the whole file, so they shift by exactly the
    # size of the moov atom now sitting in front of them.
    patched, moved = shift_offsets(data, moov[0], moov[1], len(moov_bytes))
    moov_bytes = patched[moov[0]:moov[1]]

    head, tail = [], []
    for kind, box, stop in top:
        if kind == b"moov":
            continue
        (head if kind == b"ftyp" else tail).append(data[box:stop])
    return b"".join(head) + moov_bytes + b"".join(tail), moved


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    with open(sys.argv[1], "rb") as fh:
        data = fh.read()

    facts = describe(data)
    out, moved = faststart(data)

    with open(sys.argv[2], "wb") as fh:
        fh.write(out)

    assert len(out) == len(data), "the remux changed the file length"
    assert describe(out) == facts, "the remux changed the video's own numbers"
    print("%.2fs · %s frames · %s fps · %s keyframes · %.1f MB"
          % (facts.get("seconds", 0), facts.get("frames", "?"), facts.get("fps", "?"),
             facts.get("keyframes", "?"), len(out) / 1048576))
    print("moved moov ahead of mdat, rewrote %d chunk offsets" % moved
          if moved else "already faststart; copied unchanged")


if __name__ == "__main__":
    main()
