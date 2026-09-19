"""Drive the film: timeline, camera, subtitles, frame render, encode.

  python3 render.py --probe 12.0 44.0 96.0     # single frames to build/probe
  python3 render.py --preview                  # 720p draft, every 2nd frame
  python3 render.py                            # full 1080p master
"""

import argparse
import json
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import fx
import scenes
import script_text
from fx import H, W, ease, ramp
from scenes import Stage

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
FONT_R = "/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Regular.otf"
FONT_I = "/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Italic.otf"

TL = None
EV = None
_FONTS = {}


def load_timeline():
    global TL, EV
    with open(os.path.join(BUILD, "timeline.json")) as f:
        TL = json.load(f)
    EV = {e["id"]: e for e in TL["events"]}
    return TL


def b(id_, key="start"):
    return EV[id_][key]


# ---------------------------------------------------------------- camera

def camera_keys():
    """(time, cx, cy, zoom) — the eye moving through the vision."""
    k = [
        (0.0, 0.0, -0.10, 1.00),
        (b("portal"), 0.0, -0.08, 1.06),
        (b("ascend"), 0.0, -0.06, 1.22),
        (b("spirit"), 0.0, -0.04, 1.45),
        (b("spirit", "end"), 0.0, 0.00, 2.40),
        (b("throne_set"), 0.0, scenes.THRONE_Y + 0.02, 1.62),
        (b("throne_set", "end"), 0.0, scenes.THRONE_Y - 0.02, 1.48),
        (b("jasper"), 0.0, scenes.THRONE_Y - 0.14, 2.05),
        (b("jasper", "end"), 0.0, scenes.THRONE_Y - 0.16, 1.95),
        (b("emerald"), 0.0, scenes.THRONE_Y - 0.02, 1.24),
        (b("emerald", "end"), 0.0, scenes.THRONE_Y + 0.00, 1.16),
        (b("elders"), 0.0, 0.02, 0.86),
        (b("elders", "end"), 0.0, 0.03, 0.80),
        (b("lightning"), 0.0, scenes.THRONE_Y - 0.06, 1.00),
        (b("lightning", "end"), 0.0, scenes.THRONE_Y - 0.04, 0.96),
        (b("torches"), 0.0, scenes.THRONE_Y + 0.38, 1.42),
        (b("torches", "end"), 0.0, scenes.THRONE_Y + 0.34, 1.34),
        (b("sea"), 0.0, 0.30, 1.05),
        (b("sea", "end"), 0.0, 0.26, 1.00),
        (b("creatures"), -0.10, 0.00, 0.98),
        (b("faces"), -0.95, -0.26, 1.34),
        (b("faces", "end"), 0.95, -0.26, 1.34),
        (b("wings"), 0.0, -0.02, 1.02),
        (b("ceaseless"), 0.0, 0.00, 0.90),
        (b("holy"), 0.0, -0.02, 0.80),
        (b("holy", "end"), 0.0, -0.02, 0.76),
        (b("glory"), 0.0, 0.04, 0.88),
        (b("facedown"), 0.0, 0.08, 0.94),
        (b("crowns"), 0.0, 0.14, 1.06),
        (b("worthy"), 0.0, 0.06, 0.92),
        (b("created"), 0.0, 0.00, 0.78),
        (TL["duration"], 0.0, -0.04, 0.70),
    ]
    return sorted(k, key=lambda r: r[0])


_KEYS = None


def camera(t):
    global _KEYS
    if _KEYS is None:
        _KEYS = camera_keys()
    keys = _KEYS
    if t <= keys[0][0]:
        cx, cy, z = keys[0][1:]
    elif t >= keys[-1][0]:
        cx, cy, z = keys[-1][1:]
    else:
        i = max(i for i, k in enumerate(keys) if k[0] <= t)
        t0, x0, y0, z0 = keys[i]
        t1, x1, y1, z1 = keys[min(i + 1, len(keys) - 1)]
        u = ease((t - t0) / max(1e-6, t1 - t0))
        cx = x0 + (x1 - x0) * u
        cy = y0 + (y1 - y0) * u
        z = z0 + (z1 - z0) * u
    # a breath of life, so nothing is ever mechanically still
    cx += 0.012 * np.sin(t * 0.23) + 0.006 * np.sin(t * 0.61 + 2.0)
    cy += 0.009 * np.sin(t * 0.31 + 1.3)
    z *= 1.0 + 0.007 * np.sin(t * 0.17 + 0.6)
    for t0, seed, power in strike_times():           # thunder shakes the eye
        age = t - t0
        if 0 <= age < 0.6:
            s = np.exp(-age * 6.0) * power * 0.012
            cx += s * np.sin(age * 61.0 + seed)
            cy += s * np.sin(age * 47.0 + seed * 2)
    return cx, cy, z


# ---------------------------------------------------------------- events

_STRIKES = None


def strike_times():
    """Lightning out of the throne, on the same clock as the thunder."""
    global _STRIKES
    if _STRIKES is not None:
        return _STRIKES
    t0 = b("lightning")
    s = [(t0 + off, 3 + i * 8, p)
         for i, (off, p) in enumerate(script_text.STRIKES)]
    s += [(b("holy") + off, 51 + i * 8, 0.8 + 0.15 * i)
          for i, off in enumerate(script_text.HOLY_PULSES)]
    s += [(b("created") + script_text.FINAL_PEAL, 79, 1.0)]
    _STRIKES = s
    return s


def voice_ring_times():
    """Rings going out from the throne, tied to the voices you can hear."""
    r = [(b("ascend") + 0.15, 1.0), (b("ascend") + 1.9, 0.8)]
    r += [(b("lightning") + 3.8, 0.9), (b("lightning") + 4.6, 0.7)]
    r += [(b("holy") + off, 1.0 + 0.05 * i)
          for i, off in enumerate(script_text.HOLY_PULSES)]
    r += [(b("worthy") + 0.3, 0.8), (b("created") + 0.4, 0.9)]
    return r


# ---------------------------------------------------------------- frame

def render_hdr(t, env):
    st = Stage(t, camera(t), env)
    trans = b("spirit", "end") + 0.45          # whiteout hand-off
    tr_start = b("throne_set")

    if t < trans:
        # --- the door in heaven --------------------------------
        seam = ramp(t, b("portal") + 1.5, b("portal") + 2.3)
        openness = ramp(t, b("portal") + 2.2, b("trumpet") + 1.2)
        unrest = 1.0 - 0.5 * openness
        scenes.storm_sky(st, unrest, gain=1.0 - 0.25 * openness)
        blaze = 1.0 + 1.4 * env * ramp(t, b("ascend") - 0.3, b("ascend"))
        if seam > 0 or openness > 0:
            scenes.portal(st, openness, blaze=blaze,
                          seam=seam * (1.0 - ramp(t, b("portal") + 2.4,
                                                  b("portal") + 3.0)))
        scenes.voice_rings(st, [e for e in voice_ring_times() if e[0] < trans])
        rush = ramp(t, b("spirit") + 0.4, b("spirit", "end") + 0.2)
        if rush > 0:
            wo = ramp(t, b("spirit", "end") - 0.15, b("spirit", "end") + 0.35)
            scenes.ascent(st, rush * 1.6, whiteout=wo ** 2 * 0.9)
        scenes.motes(st, 90, gain=0.5 + 0.5 * openness, spread=(2.6, 1.8))
        return st

    # --- the throne room ---------------------------------------
    i_throne = ramp(t, tr_start + 0.1, tr_start + 2.2)
    i_pres = ramp(t, tr_start + 0.5, tr_start + 2.8)
    carn = 0.35 + 0.65 * ramp(t, b("jasper") + 0.9, b("jasper", "end"))
    spark = ramp(t, b("jasper") + 0.3, b("jasper") + 2.0)
    i_emer = ramp(t, b("emerald") + 0.5, b("emerald", "end") + 0.4)
    i_eld = ramp(t, b("elders") + 0.4, b("elders") + 3.4)
    i_torch = ramp(t, b("torches") + 0.6, b("torches", "end"))
    i_sea = ramp(t, b("sea") + 0.5, b("sea", "end") + 0.5)
    i_crea = ramp(t, b("creatures") + 0.4, b("creatures", "end"))
    i_eyes = ramp(t, b("creatures") + 1.6, b("creatures", "end") + 0.6)
    i_eyes *= 1.0 + 0.6 * ramp(t, b("wings") + 1.0, b("wings", "end"))

    bow = ramp(t, b("facedown") + 0.9, b("facedown", "end") + 0.3)
    fly = ramp(t, b("crowns") + 0.9, b("crowns", "end") + 1.4)
    heap = ramp(t, b("crowns") + 1.6, b("crowns", "end") + 1.8)
    beat = (0.5 + 0.5 * np.sin(t * 2.0)) * ramp(t, b("ceaseless"), b("holy"))

    glory = 1.0 + 0.45 * ramp(t, b("holy") - 0.4, b("holy") + 1.0) \
        * (1.0 - 0.5 * ramp(t, b("holy", "end"), b("glory") + 1.0))
    glory += 0.55 * ramp(t, b("worthy") - 0.3, b("created") + 1.5)
    glory *= 1.0 + 0.22 * env
    glory = float(min(glory, 1.9))

    lit = 0.55 + 0.45 * i_pres
    scenes.cloud_field(st, base_gain=0.95, lit=lit,
                       light_pos=(0.0, scenes.THRONE_Y - 0.1),
                       tint_a=scenes.INDIGO, tint_b=scenes.VIOLET,
                       speed=0.045, warp=0.5, scale=1.2)

    scenes.elders(st, i_eld, bow=bow, crowns=1.0, crown_fly=fly,
                  front_only=False)
    scenes.creatures(st, i_crea, eyes=i_eyes, beat=beat,
                     face_focus=face_focus(t), front_only=False)
    scenes.emerald_rainbow(st, i_emer, front=False)
    scenes.throne(st, i_throne)
    scenes.presence(st, i_pres * glory, carn=carn, sparkle=spark)
    scenes.lightning(st, strike_times(), intensity=1.0)
    scenes.voice_rings(st, voice_ring_times())
    scenes.creatures(st, i_crea, eyes=i_eyes, beat=beat,
                     face_focus=face_focus(t), front_only=True)
    scenes.elders(st, i_eld, bow=bow, crowns=1.0, crown_fly=fly,
                  front_only=True)
    scenes.emerald_rainbow(st, i_emer * 0.35, front=True)
    scenes.fallen_crowns(st, heap)
    scenes.torches(st, i_torch)
    scenes.motes(st, 130, gain=0.55 + 0.5 * i_pres)
    scenes.sea_of_glass(st, i_sea)

    wo = 1.0 - ramp(t, tr_start - 0.75, tr_start + 0.85)
    if wo > 0.001:
        st.add(np.ones((H, W, 3), np.float32) *
               scenes.WHITE[None, None, :], 7.0 * wo ** 2.2)
    return st


def face_focus(t):
    """Which creature the eye rests on while their faces are named."""
    if not (b("faces") <= t <= b("faces", "end") + 0.3):
        return -1
    u = (t - b("faces")) / max(0.1, b("faces", "end") - b("faces"))
    return int(np.clip(u * 4.0, 0, 3.999))


# ---------------------------------------------------------------- text

def fonts():
    if not _FONTS:
        _FONTS["body"] = ImageFont.truetype(FONT_R, 46)
        _FONTS["ital"] = ImageFont.truetype(FONT_I, 47)
        _FONTS["credit"] = ImageFont.truetype(FONT_R, 34)
        _FONTS["title"] = ImageFont.truetype(FONT_R, 62)
        _FONTS["sub"] = ImageFont.truetype(FONT_I, 30)
    return _FONTS


def text_mask(t):
    """White text mask for this instant, or None."""
    f = fonts()
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    drew = False

    # opening title, before the first word
    a = ramp(t, 1.6, 3.0) * (1.0 - ramp(t, b("portal") - 2.6, b("portal") - 1.4))
    if a > 0.01:
        _center(d, "REVELATION 4", f["title"], H * 0.46, int(255 * a), sp=9)
        _center(d, "The Passion Translation", f["sub"], H * 0.54,
                int(200 * a))
        drew = True

    for e, (s, en) in zip(TL["events"], caption_windows()):
        if not (s - 0.4 <= t <= en + 0.5):
            continue
        a = ramp(t, s, s + 0.40) * (1.0 - ramp(t, en, en + 0.45))
        if a <= 0.01:
            continue
        quoted = e["text"].lstrip().startswith("“")
        font = f["ital"] if quoted else f["body"]
        lines = e["text"].split("\n")
        lh = 62
        y = H * 0.845 - (len(lines) - 1) * lh * 0.5
        for ln in lines:
            _center(d, ln, font, y, int(240 * a))
            y += lh
        drew = True

    # closing credit
    cs = TL["speech_end"] + 2.6
    a = ramp(t, cs, cs + 1.8) * (1.0 - ramp(t, TL["duration"] - 3.0,
                                            TL["duration"] - 1.4))
    if a > 0.01:
        _center(d, TL["credit"], f["credit"], H * 0.53, int(238 * a), sp=3)
        drew = True

    return np.asarray(im, np.float32) / 255.0 if drew else None


_WINDOWS = None


def caption_windows():
    """On-screen span per line, trimmed so two lines are never up at once."""
    global _WINDOWS
    if _WINDOWS is None:
        ev = TL["events"]
        out = []
        for i, e in enumerate(ev):
            s = e["start"] - 0.30
            en = e["end"] + 0.55
            if i + 1 < len(ev):
                en = min(en, ev[i + 1]["start"] - 0.75)
            out.append((s, max(s + 0.6, en)))
        _WINDOWS = out
    return _WINDOWS


def _center(d, text, font, y, value, sp=0):
    if sp:
        widths = [d.textlength(ch, font=font) + sp for ch in text]
        x = (W - (sum(widths) - sp)) / 2.0
        for ch, w in zip(text, widths):
            d.text((x, y), ch, font=font, fill=value)
            x += w
    else:
        w = d.textlength(text, font=font)
        d.text(((W - w) / 2.0, y), text, font=font, fill=value)


def draw_text(rgb, t):
    m = text_mask(t)
    if m is None:
        return rgb
    shadow = fx.resize(fx.blur(fx.resize(m, fx.LW, fx.LH), 4.0), W, H)
    rgb = rgb * (1.0 - 0.72 * np.clip(shadow * 2.4, 0, 1))[:, :, None]
    ink = np.float32([1.0, 0.985, 0.95])
    return np.clip(rgb + m[:, :, None] * ink, 0, 1)


# ---------------------------------------------------------------- frames

def frame(i):
    t = i / TL["fps"]
    env = TL["voice_env"][min(i, len(TL["voice_env"]) - 1)]
    st = render_hdr(t, env)

    expo = 1.0
    sat = 1.06
    rgb = fx.grade(st.hdr, t, exposure=expo, sat=sat, vig=0.40, ca=1.5)
    rgb *= ramp(t, 0.0, 2.2)                                   # fade up
    # the vision lets go before the credit, so the credit can be read
    rgb *= 1.0 - 0.80 * ramp(t, TL["speech_end"] + 0.6,
                             TL["speech_end"] + 4.6)
    rgb *= 1.0 - ramp(t, TL["duration"] - 2.6, TL["duration"])  # fade out
    rgb = draw_text(rgb, t)
    return fx.to_bytes(rgb)


def _init():
    load_timeline()
    fonts()
    camera(0.0)


def encode(out, fps, size, frames, workers, chunk=2):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "17",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(workers, initializer=_init) as pool:
        for n, buf in enumerate(pool.imap(frame, frames, chunksize=chunk)):
            if size != (W, H):
                buf = np.asarray(Image.fromarray(buf).resize(size,
                                                             Image.LANCZOS))
            proc.stdin.write(buf.tobytes())
            if n % 60 == 0:
                el = time.time() - t0
                rate = (n + 1) / max(el, 1e-6)
                left = (len(frames) - n - 1) / max(rate, 1e-6)
                print(f"  frame {n + 1}/{len(frames)}  "
                      f"{rate:.2f} fps  eta {left / 60:.1f} min", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"encoded {out} in {(time.time() - t0) / 60:.1f} min")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", nargs="*", type=float)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--range", nargs=2, type=float)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    load_timeline()
    fps = TL["fps"]
    total = int(TL["duration"] * fps)

    if args.probe:
        _init()
        os.makedirs(os.path.join(BUILD, "probe"), exist_ok=True)
        for t in args.probe:
            i = int(t * fps)
            img = Image.fromarray(frame(i))
            p = os.path.join(BUILD, "probe", f"t{t:07.2f}.png")
            img.save(p)
            print("wrote", p)
        return 0

    frames = list(range(total))
    if args.range:
        frames = list(range(int(args.range[0] * fps),
                            min(total, int(args.range[1] * fps))))
    size = (W, H)
    out = args.out or os.path.join(BUILD, "video.mp4")
    if args.preview:
        size = (1280, 720)
        frames = frames[::2]
        out = args.out or os.path.join(BUILD, "preview.mp4")
        fps = fps // 2

    print(f"rendering {len(frames)} frames at {size[0]}x{size[1]}")
    encode(out, fps, size, frames, args.workers)
    return 0


if __name__ == "__main__":
    sys.exit(main())
