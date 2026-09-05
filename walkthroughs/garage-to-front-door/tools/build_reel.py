#!/usr/bin/env python3
"""Render the annotated cut of the walkthrough.

Draws every overlay frame with Pillow — timecode, station cards, route plan,
progress bar — composites them onto the footage with ffmpeg, and tops and tails
the result with a title and an end card.

    python3 tools/build_reel.py
"""

import math
import pathlib
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "source" / "IMG_0247.mp4"
OUT = ROOT / "public" / "garage-to-front-door-annotated.mp4"

W, H = 608, 1080
FPS = 30
DUR = 15.98
TITLE_S, END_S = 2.4, 3.4

FONTS = pathlib.Path("/mnt/skills/examples/canvas-design/canvas-fonts")

# Same ink as the page, over footage rather than paper.
INK = (18, 22, 24)
CHALK = (238, 234, 226)
MUTED = (150, 156, 158)
MARK = (208, 86, 58)
DAY = (221, 165, 62)

STATIONS = [
    (0.00, 3.50, "Garage bay", "The garage, wide",
     ["Bare slab, rubber runners laid to the door",
      "Extinguisher standing loose, not bracketed"]),
    (3.50, 6.60, "Utility door", "Closing on the utility door",
     ["Flush slab, round knob — no deadbolt, no closer",
      "Service notices taped to the jamb"]),
    (6.60, 11.40, "Hall", "Through, and down the hall",
     ["Plank floor, sprayed ceiling, register at the entry",
      "Doorways both sides; cord run along the wall"]),
    (11.40, 14.60, "Living area", "Living area and the slider",
     ["Two-panel patio slider, blown out by daylight",
      "Room reads empty — a cat tree and little else"]),
    (14.60, 15.98, "Front entry", "Front entry, and out",
     ["Six-panel door, lever over a single deadbolt",
      "Garage slab to front threshold, no cuts"]),
]

# Schematic plan, authored in a 440 x 300 space and scaled where it is drawn.
PLAN_W, PLAN_H = 440, 300
WALLS = [
    (24, 52, 168, 52), (24, 52, 24, 264), (24, 264, 168, 264),
    (168, 52, 168, 152), (168, 186, 168, 264),
    (168, 152, 196, 152), (168, 186, 196, 186),
    (268, 152, 300, 152), (268, 186, 300, 186),
    (196, 152, 212, 152), (252, 152, 268, 152),
    (196, 186, 212, 186), (252, 186, 268, 186),
    (196, 152, 196, 88), (268, 152, 268, 88), (196, 88, 268, 88),
    (196, 186, 196, 254), (268, 186, 268, 254), (196, 254, 268, 254),
    (300, 52, 300, 152), (300, 186, 300, 264),
    (300, 52, 416, 52), (300, 264, 416, 264),
    (416, 52, 416, 96), (416, 176, 416, 264),
]
SLIDER = [(416, 96, 416, 136), (419, 136, 419, 176)]
FRONT = [(332, 264, 382, 264)]
ROUTE = [(96, 206), (152, 178), (186, 172), (262, 170), (322, 174), (350, 214), (354, 240)]


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


F_DISPLAY = lambda s: font("WorkSans-Bold.ttf", s)
F_BODY = lambda s: font("IBMPlexSerif-Regular.ttf", s)
F_DATA = lambda s: font("JetBrainsMono-Regular.ttf", s)
F_DATA_B = lambda s: font("JetBrainsMono-Bold.ttf", s)


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("ffmpeg not found. Install it, or: pip install imageio-ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ease(x):
    """Cubic ease-out, clamped."""
    x = max(0.0, min(1.0, x))
    return 1 - pow(1 - x, 3)


def tc(t):
    cs = int(round(t * 100))
    return f"00:{cs // 100:02d}.{cs % 100:02d}"


def spaced(draw, xy, text, fnt, fill, tracking=0):
    """Draw text with letter-spacing; returns the width used."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x - xy[0]


def route_point(p):
    """Point and heading at fraction p along the route polyline."""
    segs, total = [], 0.0
    for a, b in zip(ROUTE, ROUTE[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        segs.append((a, b, d))
        total += d
    want = max(0.0, min(1.0, p)) * total
    run_len = 0.0
    for a, b, d in segs:
        if run_len + d >= want or (a, b, d) == segs[-1]:
            k = (want - run_len) / d if d else 0
            k = max(0.0, min(1.0, k))
            return (a[0] + (b[0] - a[0]) * k,
                    a[1] + (b[1] - a[1]) * k,
                    math.atan2(b[1] - a[1], b[0] - a[0]))
        run_len += d
    return (ROUTE[-1][0], ROUTE[-1][1], 0.0)


def draw_plan(d, ox, oy, scale, p, wall=(120, 128, 130), lw=1):
    """Draw the schematic with the route filled to fraction p."""
    def P(x, y):
        return (ox + x * scale, oy + y * scale)

    for x1, y1, x2, y2 in WALLS:
        d.line([P(x1, y1), P(x2, y2)], fill=wall, width=lw)
    for x1, y1, x2, y2 in SLIDER:
        d.line([P(x1, y1), P(x2, y2)], fill=DAY, width=max(2, lw + 1))
    for x1, y1, x2, y2 in FRONT:
        d.line([P(x1, y1), P(x2, y2)], fill=MARK, width=max(2, lw + 1))

    d.line([P(*pt) for pt in ROUTE], fill=(*DAY, 90), width=lw)

    if p > 0:
        walked, total = [], 0.0
        for a, b in zip(ROUTE, ROUTE[1:]):
            total += math.hypot(b[0] - a[0], b[1] - a[1])
        want, acc = p * total, 0.0
        walked.append(ROUTE[0])
        for a, b in zip(ROUTE, ROUTE[1:]):
            d_ab = math.hypot(b[0] - a[0], b[1] - a[1])
            if acc + d_ab <= want:
                walked.append(b)
                acc += d_ab
            else:
                k = (want - acc) / d_ab if d_ab else 0
                walked.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k))
                break
        if len(walked) > 1:
            d.line([P(*pt) for pt in walked], fill=MARK, width=max(2, lw + 1))

    cx, cy, ang = route_point(p)
    px, py = P(cx, cy)
    cone = [(0, 0), (24, -12), (24, 12)]
    pts = [(px + (x * math.cos(ang) - y * math.sin(ang)) * scale,
            py + (x * math.sin(ang) + y * math.cos(ang)) * scale) for x, y in cone]
    d.polygon(pts, fill=(*MARK, 55))
    r = max(2.5, 4 * scale)
    d.ellipse([px - r, py - r, px + r, py + r], fill=MARK)


# ----------------------------------------------------------------- overlays --
def overlay_frame(t):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    p = max(0.0, min(1.0, t / DUR))

    # timecode, top left
    d.rectangle([20, 20, 20 + 132, 20 + 34], fill=(*INK, 190))
    d.text((30, 26), tc(t), font=F_DATA(21), fill=CHALK)

    # mini plan, top right
    pw, ph = 176, 120
    px, py = W - pw - 20, 20
    d.rectangle([px, py, px + pw, py + ph], fill=(*INK, 175))
    draw_plan(d, px + 8, py + 10, (pw - 16) / PLAN_W, p, wall=(126, 134, 136), lw=1)

    # station card
    for i, (a, b, name, headline, notes) in enumerate(STATIONS):
        if not (a - 0.1 <= t <= b + 0.1):
            continue
        span = b - a
        rise = ease((t - a) / min(0.45, span * 0.35))
        fade_out = 1.0
        if b - t < 0.35 and i < len(STATIONS) - 1:
            fade_out = max(0.0, (b - t) / 0.35)
        alpha = rise * fade_out
        if alpha <= 0.01:
            continue

        top = 792 + int((1 - rise) * 26)
        A = lambda v: int(v * alpha)

        d.rectangle([0, top, W, 1032], fill=(*INK, A(214)))
        d.rectangle([0, top, 4, 1032], fill=(*MARK, A(255)))

        y = top + 26
        spaced(d, (28, y), f"STATION {i+1} / 5", F_DATA_B(13),
               (*MARK, A(255)), tracking=1.6)
        spaced(d, (196, y), f"{tc(a)} - {tc(b)}", F_DATA(13),
               (*MUTED, A(255)), tracking=1.0)

        y += 30
        d.text((26, y), headline, font=F_DISPLAY(33), fill=(*CHALK, A(255)))

        y += 52
        for line in notes:
            d.ellipse([30, y + 9, 35, y + 14], fill=(*DAY, A(255)))
            d.text((48, y), line, font=F_BODY(19), fill=(210, 208, 200, A(255)))
            y += 30

    # progress bar
    bar_y = 1064
    d.rectangle([0, bar_y, W, bar_y + 4], fill=(*CHALK, 55))
    d.rectangle([0, bar_y, int(W * p), bar_y + 4], fill=MARK)
    for a, _, _, _, _ in STATIONS[1:]:
        x = int(W * a / DUR)
        d.rectangle([x, bar_y - 3, x + 1, bar_y + 7], fill=(*CHALK, 150))

    return img


# ---------------------------------------------------------------- title card -
def title_frame(t):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img, "RGBA")

    rule = ease(t / 0.55)
    d.rectangle([56, 300, 56 + int((W - 112) * rule), 302], fill=MARK)

    def rise(delay):
        return ease((t - delay) / 0.5)

    r1 = rise(0.25)
    if r1 > 0:
        a = int(255 * r1)
        d.ellipse([56, 250 + int((1 - r1) * 10), 66, 260 + int((1 - r1) * 10)],
                  fill=(*MARK, a))
        spaced(d, (78, 246 + int((1 - r1) * 10)), "FIELD TAKE - IMG_0247",
               F_DATA(15), (*MUTED, a), tracking=1.8)

    for i, line in enumerate(["GARAGE", "TO FRONT", "DOOR"]):
        r = rise(0.45 + i * 0.14)
        if r <= 0:
            continue
        a = int(255 * r)
        d.text((52, 350 + i * 78 + int((1 - r) * 18)), line,
               font=F_DISPLAY(72), fill=(*CHALK, a))

    r2 = rise(1.05)
    if r2 > 0:
        a = int(255 * r2)
        y = 630 + int((1 - r2) * 12)
        for col, (k, v) in enumerate([("RUNTIME", "15.98 s"), ("STATIONS", "5"), ("CUTS", "0")]):
            x = 56 + col * 168
            spaced(d, (x, y), k, F_DATA(12), (*MUTED, a), tracking=1.6)
            d.text((x, y + 22), v, font=F_DATA(22), fill=(*CHALK, a))

    r3 = rise(1.35)
    if r3 > 0:
        draw_plan(d, 56, 760, (W - 112) / PLAN_W * 0.86, 0.0,
                  wall=(70, 78, 80), lw=1)

    return img


def end_frame(t):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img, "RGBA")

    d.rectangle([56, 150, W - 56, 152], fill=(70, 78, 80))
    spaced(d, (56, 108), "ROUTE COMPLETE", F_DATA(15), MUTED, tracking=2.0)

    walked = ease(t / 1.6)
    draw_plan(d, 56, 190, (W - 112) / PLAN_W, walked, wall=(70, 78, 80), lw=1)

    y = 560
    for i, (a, _, name, _, _) in enumerate(STATIONS):
        r = ease((t - 0.9 - i * 0.22) / 0.45)
        if r <= 0:
            continue
        al = int(255 * r)
        yy = y + i * 62 + int((1 - r) * 10)
        d.text((56, yy + 4), tc(a), font=F_DATA(17), fill=(*MUTED, al))
        d.text((190, yy), name, font=F_DISPLAY(26), fill=(*CHALK, al))
        d.rectangle([56, yy + 46, W - 56, yy + 47], fill=(48, 55, 57, al))

    r = ease((t - 2.1) / 0.6)
    if r > 0:
        al = int(255 * r)
        spaced(d, (56, 936), "GARAGE SLAB TO FRONT THRESHOLD", F_DATA(14),
               (*DAY, al), tracking=1.6)
        spaced(d, (56, 962), "15.98 SECONDS - ONE CONTINUOUS SHOT", F_DATA(14),
               (*MUTED, al), tracking=1.6)

    return img


def main():
    if not SOURCE.exists():
        sys.exit(f"missing source clip: {SOURCE}")
    ff = ffmpeg()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = pathlib.Path(tmpdir)
        for sub in ("ov", "ti", "en"):
            (tmp / sub).mkdir()

        n_ov = int(DUR * FPS)
        for i in range(n_ov):
            overlay_frame(i / FPS).save(tmp / "ov" / f"f{i:04d}.png")
        for i in range(int(TITLE_S * FPS)):
            title_frame(i / FPS).save(tmp / "ti" / f"f{i:04d}.png")
        for i in range(int(END_S * FPS)):
            end_frame(i / FPS).save(tmp / "en" / f"f{i:04d}.png")
        print(f"drew {n_ov + int(TITLE_S*FPS) + int(END_S*FPS)} frames")

        enc = ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
               "-crf", "20", "-preset", "medium", "-r", str(FPS)]

        title = tmp / "p1.mp4"
        run([ff, "-y", "-framerate", str(FPS), "-i", str(tmp / "ti" / "f%04d.png"),
             *enc, str(title)])

        body = tmp / "p2.mp4"
        run([ff, "-y", "-i", str(SOURCE),
             "-framerate", str(FPS), "-i", str(tmp / "ov" / "f%04d.png"),
             "-filter_complex",
             f"[0:v]scale={W}:-2,fps={FPS},format=yuva420p[v];[v][1:v]overlay=0:0:format=auto[o]",
             "-map", "[o]", "-an", *enc, str(body)])

        tail = tmp / "p3.mp4"
        run([ff, "-y", "-framerate", str(FPS), "-i", str(tmp / "en" / "f%04d.png"),
             *enc, str(tail)])

        listfile = tmp / "parts.txt"
        listfile.write_text("".join(f"file '{p}'\n" for p in (title, body, tail)))

        OUT.parent.mkdir(parents=True, exist_ok=True)
        run([ff, "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
             "-c", "copy", "-movflags", "+faststart", str(OUT)])

    mb = OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {OUT.relative_to(ROOT)}  ({mb:.1f} MB)")


if __name__ == "__main__":
    main()
