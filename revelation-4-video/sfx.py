"""Sound effects for Revelation 4, cut to the verse that calls for them.

Every sound here is synthesised: a door of stone and metal swinging open,
wind out of the opening, a trumpet, the rush of being carried up, the boom
of a throne set down, crystal glinting, thunder and electric crack and a
multitude of voices, seven torches catching, glass under foot, the beat of
six wings, and twenty-four gold crowns landing on that glass.
"""

import json
import os
import sys
import wave

import numpy as np

import dsp
import script_text
from dsp import SR, add_at, fade, filt


HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def _n(dur):
    return int(dur * SR)


def _t(dur):
    return np.arange(_n(dur)) / SR


def _noise(dur, seed):
    return np.random.default_rng(seed).normal(0.0, 1.0, _n(dur))


def _sweep(dur, f0, f1, curve=1.0):
    """A sine whose frequency glides from f0 to f1."""
    t = _t(dur)
    u = (t / max(t[-1], 1e-9)) ** curve
    f = f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------------------------------------------------------------- air

def wind(dur, gain=1.0, seed=0, colour=520.0, gust=0.25):
    """The open sky, and later the draught out of the door."""
    rng = np.random.default_rng(seed)
    x = rng.normal(0, 1, _n(dur))
    x = filt(x, "bandpass", colour, 0.5)
    x = filt(x, "lowpass", colour * 3.0, 0.7)
    t = _t(dur)
    lfo = (1.0 + gust * np.sin(2 * np.pi * 0.07 * t + 1.1)
           + gust * 0.6 * np.sin(2 * np.pi * 0.031 * t))
    slow = filt(rng.normal(0, 1, _n(dur)), "lowpass", 0.5, 0.7)
    slow = slow / (np.max(np.abs(slow)) + 1e-9)
    return fade(x * lfo * (1.0 + 0.5 * slow), 2.5, 2.5) * gain * 0.5


def whoosh(dur=2.0, gain=1.0, seed=0, f0=180.0, f1=3200.0, peak=0.72):
    """Air moving fast: the door swinging, or the rush upward."""
    rng = np.random.default_rng(seed)
    x = rng.normal(0, 1, _n(dur))
    t = _t(dur)
    u = t / max(t[-1], 1e-9)
    # a band that opens up and closes again as the movement passes
    out = np.zeros_like(x)
    for f, q, w in ((260.0, 0.6, 1.0), (900.0, 0.8, 0.7), (2600.0, 1.0, 0.4)):
        out += filt(x, "bandpass", f, q) * w
    cutoff = f0 + (f1 - f0) * np.sin(np.pi * np.clip(u / peak, 0, 1) ** 0.8)
    out *= (cutoff / f1) ** 0.6
    env = np.sin(np.pi * np.clip(u, 0, 1) ** 0.75) ** 1.4
    return out * env * gain * 0.6


def sub_drop(dur=3.0, gain=1.0, f0=68.0, f1=26.0):
    """The floor falling away under a transition."""
    s = _sweep(dur, f0, f1, curve=0.6)
    t = _t(dur)
    return s * np.exp(-t * 1.1) * gain


# ---------------------------------------------------------------- stone

def stone_door(dur=6.0, gain=1.0, seed=0):
    """A great door giving way: grind, groan, and a shudder of air."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    u = t / t[-1]

    grind = rng.normal(0, 1, _n(dur))
    grind = filt(grind, "lowpass", 900.0, 0.8)
    # granular tearing: the surfaces catching on each other
    grain = np.abs(filt(rng.normal(0, 1, _n(dur)), "lowpass", 26.0, 0.7))
    grain = grain / (np.max(grain) + 1e-9)
    grind *= (0.25 + 1.3 * grain) * np.sin(np.pi * np.clip(u * 1.1, 0, 1))

    groan = np.zeros_like(t)
    for f, w in ((41.0, 1.0), (63.0, 0.6), (97.0, 0.35), (151.0, 0.18)):
        glide = f * (1.0 + 0.10 * u)
        groan += np.sin(2 * np.pi * glide * t + w) * w
    groan *= np.sin(np.pi * np.clip(u * 1.05, 0, 1)) ** 0.8

    body = filt(grind * 0.55 + groan * 0.9, "lowpass", 2200.0, 0.7)
    return fade(body, 0.35, 1.2) * gain * 0.5


def impact(gain=1.0, seed=0, dur=5.0, f0=74.0, f1=27.0):
    """Something immense set down: the throne taking its place."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    sub = _sweep(dur, f0, f1, curve=0.45) * np.exp(-t * 1.5)
    sub += np.sin(2 * np.pi * 33.0 * t) * np.exp(-t * 0.85) * 0.6
    crack = filt(rng.normal(0, 1, _n(dur)), "lowpass", 480.0, 0.8)
    crack *= np.exp(-t * 11.0)
    debris = filt(rng.normal(0, 1, _n(dur)), "bandpass", 1900.0, 0.5)
    debris *= np.exp(-t * 5.0) * 0.22
    rumble = filt(rng.normal(0, 1, _n(dur)), "lowpass", 90.0, 0.9)
    rumble *= np.exp(-t * 0.7) * 0.5
    return (sub * 1.0 + crack * 0.55 + debris + rumble) * gain * 0.6


# ---------------------------------------------------------------- fire

def fire_bed(dur, gain=1.0, seed=0):
    """Seven torches burning, as a continuous bed."""
    rng = np.random.default_rng(seed)
    body = filt(rng.normal(0, 1, _n(dur)), "lowpass", 620.0, 0.7)
    slow = np.abs(filt(rng.normal(0, 1, _n(dur)), "lowpass", 3.5, 0.7))
    slow /= np.max(slow) + 1e-9
    body *= 0.35 + 1.2 * slow

    ticks = np.zeros(_n(dur))
    for _ in range(int(dur * 26)):
        at = rng.uniform(0, dur - 0.05)
        ln = rng.uniform(0.004, 0.030)
        tk = rng.normal(0, 1, _n(ln))
        tk = filt(tk, "bandpass", rng.uniform(1600, 5200), 0.7)
        tk *= np.exp(-np.arange(len(tk)) / SR * 220.0) * rng.uniform(0.3, 1.0)
        add_at(ticks, tk, int(at * SR))
    return fade(body * 0.5 + ticks * 0.55, 1.2, 1.5) * gain * 0.45


def flame_catch(gain=1.0, seed=0):
    """One torch taking light."""
    rng = np.random.default_rng(seed)
    dur = 1.1
    t = _t(dur)
    x = filt(rng.normal(0, 1, _n(dur)), "bandpass", 700.0, 0.4)
    x += filt(rng.normal(0, 1, _n(dur)), "highpass", 2200.0, 0.7) * 0.5
    env = (1.0 - np.exp(-t * 90.0)) * np.exp(-t * 4.2)
    return x * env * gain * 0.5


# ---------------------------------------------------------------- weather

def thunder_crack(gain=1.0, seed=0, dur=7.0):
    """The split, then the roll going away for a long time."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    n = rng.normal(0, 1, _n(dur))
    snap = filt(n, "bandpass", 1500.0, 0.4) * np.exp(-t * 26.0)
    snap += filt(n, "highpass", 3500.0, 0.7) * np.exp(-t * 48.0) * 0.6
    body = filt(n, "lowpass", 210.0, 0.8) * np.exp(-t * 1.25)
    deep = filt(n, "lowpass", 62.0, 0.9) * np.exp(-t * 0.55) * 1.5
    roll = 1.0 + 0.55 * np.sin(2 * np.pi * 0.8 * t + rng.random() * 6)
    roll *= 1.0 + 0.3 * np.sin(2 * np.pi * 0.23 * t)
    return (snap * 0.8 + (body + deep) * roll) * gain * 0.5


def zap(gain=1.0, seed=0, dur=0.9):
    """The electric tear of the bolt itself, ahead of the thunder."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    n = rng.normal(0, 1, _n(dur))
    x = filt(n, "bandpass", 3400.0, 0.35) * np.exp(-t * 30.0)
    x += filt(n, "highpass", 6000.0, 0.7) * np.exp(-t * 70.0) * 0.8
    # the stutter of the strike re-striking
    for d in (0.018, 0.041, 0.077):
        add_at(x, filt(n[: _n(0.12)], "bandpass", 5200.0, 0.4)
               * np.exp(-np.arange(_n(0.12)) / SR * 60.0) * 0.5, int(d * SR))
    return x * gain * 0.4


def whispers(dur=5.0, gain=1.0, seed=0):
    """'and voices' -- a multitude just under the threshold of words."""
    rng = np.random.default_rng(seed)
    out = np.zeros(_n(dur))
    for k in range(9):
        n = rng.normal(0, 1, _n(dur))
        v = np.zeros(_n(dur))
        for f, q, w in ((rng.uniform(420, 760), 6.0, 1.0),
                        (rng.uniform(1000, 1600), 7.0, 0.6),
                        (rng.uniform(2300, 3000), 8.0, 0.3)):
            v += filt(n, "bandpass", f, q) * w
        # syllable-rate amplitude, so it reads as speech and not as noise
        syl = np.abs(filt(rng.normal(0, 1, _n(dur)), "lowpass",
                          rng.uniform(3.0, 6.5), 0.7))
        syl /= np.max(syl) + 1e-9
        out += v * syl * rng.uniform(0.5, 1.0)
    out = filt(out, "highpass", 300.0, 0.7)
    return fade(out, 0.8, 1.6) * gain * 0.25


# ---------------------------------------------------------------- crystal

def glass_chime(freq=2600.0, dur=2.6, gain=1.0, seed=0):
    """A glint of crystal catching the light."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    out = np.zeros_like(t)
    for ratio, amp, dec in ((1.0, 1.0, 2.4), (2.76, 0.5, 3.6),
                            (5.40, 0.24, 5.0), (8.93, 0.11, 7.0)):
        out += np.sin(2 * np.pi * freq * ratio * t + rng.random()) \
            * amp * np.exp(-t * dec)
    return out * gain * 0.22


def glass_floor(dur, gain=1.0, seed=0, root=180.0):
    """The sea of glass: a still, ringing surface under everything."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    out = np.zeros_like(t)
    for h in (4, 6, 9, 12, 16, 24):
        f = root * h * (1.0 + rng.normal(0, 0.0015))
        vib = 1.0 + 0.0022 * np.sin(2 * np.pi * rng.uniform(0.2, 0.7) * t)
        out += np.sin(2 * np.pi * f * np.cumsum(vib) / SR) / h
    shimmer = np.abs(filt(rng.normal(0, 1, _n(dur)), "lowpass", 1.4, 0.7))
    shimmer /= np.max(shimmer) + 1e-9
    out *= 0.35 + 0.9 * shimmer
    return fade(filt(out, "highpass", 500.0, 0.7), 2.5, 3.0) * gain * 0.4


def crown_fall(gain=1.0, seed=0):
    """Gold landing on glass, and settling."""
    rng = np.random.default_rng(seed)
    out = np.zeros(_n(3.2))
    base = rng.uniform(1500, 2400)
    for i, (at, amp) in enumerate([(0.0, 1.0), (0.17, 0.45), (0.28, 0.3),
                                   (0.36, 0.2), (0.42, 0.13), (0.47, 0.08)]):
        dur = 2.2 if i == 0 else 0.8
        t = _t(dur)
        ring = np.zeros_like(t)
        for ratio, a, dec in ((1.0, 1.0, 2.2), (2.41, 0.6, 3.0),
                              (3.87, 0.35, 4.2), (6.11, 0.18, 6.0)):
            ring += np.sin(2 * np.pi * base * ratio * t + rng.random()) \
                * a * np.exp(-t * dec)
        click = filt(rng.normal(0, 1, _n(dur)), "bandpass", 4200.0, 0.5)
        click *= np.exp(-t * 120.0) * 0.5
        add_at(out, (ring * 0.5 + click) * amp, int(at * SR))
    return out * gain * 0.3


# ---------------------------------------------------------------- living

def wing_beat(gain=1.0, seed=0):
    """One stroke of a very large wing."""
    rng = np.random.default_rng(seed)
    dur = 0.85
    t = _t(dur)
    air = filt(rng.normal(0, 1, _n(dur)), "bandpass", 420.0, 0.45)
    air += filt(rng.normal(0, 1, _n(dur)), "lowpass", 180.0, 0.8) * 1.2
    env = np.sin(np.pi * np.clip(t / (dur * 0.55), 0, 1) ** 0.6) ** 1.3
    thump = np.sin(2 * np.pi * 52.0 * t) * np.exp(-t * 7.0) * 0.5
    return (air * env + thump) * gain * 0.4


def rustle(dur=2.2, gain=1.0, seed=0):
    """Robes, all at once, going down."""
    rng = np.random.default_rng(seed)
    out = np.zeros(_n(dur))
    for _ in range(90):
        at = rng.uniform(0, dur * 0.7)
        ln = rng.uniform(0.05, 0.22)
        s = filt(rng.normal(0, 1, _n(ln)), "bandpass",
                 rng.uniform(1800, 5200), 0.6)
        s *= np.sin(np.pi * np.linspace(0, 1, len(s))) ** 1.5
        add_at(out, s * rng.uniform(0.3, 1.0), int(at * SR))
    t = _t(dur)
    body = filt(rng.normal(0, 1, _n(dur)), "lowpass", 150.0, 0.8)
    body *= np.exp(-np.clip(t - dur * 0.45, 0, None) * 3.0) \
        * np.clip(t / (dur * 0.45), 0, 1) ** 2
    return (out * 0.5 + body * 0.6) * gain * 0.35


def trumpet_blast(dur=6.0, gain=1.0, freq=146.8):
    """Not an instrument in a room -- a voice like a trumpet, far off."""
    t = _t(dur)
    out = np.zeros_like(t)
    for h, a in ((1, 1.0), (2, 0.8), (3, 0.62), (4, 0.45), (5, 0.32),
                 (6, 0.22), (7, 0.15), (8, 0.10), (9, 0.07), (10, 0.05)):
        bend = 1.0 + 0.010 * np.exp(-t * 6.0)       # the note settling in
        out += np.sin(2 * np.pi * freq * h * np.cumsum(bend) / SR) * a
    env = (1.0 - np.exp(-t * 4.5)) * np.exp(-t * 0.42)
    growl = 1.0 + 0.05 * np.sin(2 * np.pi * 6.2 * t)
    return filt(out * env * growl, "lowpass", 3400.0, 0.8) * gain * 0.14


# ---------------------------------------------------------------- placement

def holy_pulses(ev):
    """When the three 'Holy's land, read off the actual reading.

    The worship line is spoken in pieces, so its word offsets are measured
    at synthesis time and written into the timeline. Reading them here is
    what keeps a flash of lightning on the word rather than near it.
    """
    parts = ev["holy"].get("parts") or []
    if len(parts) >= 6:
        return [parts[0], parts[1], parts[2], parts[5]]
    return list(script_text.HOLY_PULSES)


def build(tl):
    ev = {e["id"]: e for e in tl["events"]}

    def b(i, k="start"):
        return ev[i][k]

    dur = tl["duration"]
    N = _n(dur) + SR * 10
    near = np.zeros(N)      # heard in the room
    far = np.zeros(N)       # sent to the hall

    def at(buf, sig, t, g=1.0):
        add_at(buf, sig * g, int(t * SR))

    # --- before the door: open sky, weather at a distance ---------
    at(near, wind(b("portal") + 6.0, 0.55, seed=1, colour=430.0), 0.0)
    at(far, thunder_crack(0.30, seed=2, dur=8.0), 2.6)
    at(far, thunder_crack(0.22, seed=3, dur=7.0), b("portal") - 2.4)

    # --- verse 1: the door opens ----------------------------------
    t_open = b("portal") + 2.9
    at(near, stone_door(6.5, 0.85, seed=4), t_open)
    at(near, whoosh(3.2, 0.60, seed=5, f0=140, f1=2600), t_open + 1.1)
    at(far, impact(0.34, seed=6, dur=5.0, f0=58, f1=24), t_open + 4.4)
    at(near, wind(b("spirit") - t_open + 4.0, 0.75, seed=7, colour=760.0,
                  gust=0.35), t_open + 1.6)
    for k in range(5):                      # light coming through the gap
        at(far, glass_chime(1800 + k * 620, 2.4, 0.30, seed=10 + k),
           t_open + 1.5 + k * 0.42)

    # --- verse 1: the trumpet-voice -------------------------------
    at(far, trumpet_blast(7.0, 0.90, 146.83), b("trumpet") + 0.9)
    at(far, trumpet_blast(6.0, 0.45, 220.0), b("trumpet") + 1.25)
    at(far, impact(0.40, seed=12, dur=6.0), b("ascend") - 0.55)
    at(far, whispers(4.0, 0.30, seed=13), b("ascend") - 0.3)

    # --- verse 2: taken up ----------------------------------------
    rush = b("spirit")
    at(near, whoosh(b("spirit", "end") - rush + 1.2, 0.78, seed=14,
                    f0=120, f1=4200, peak=0.86), rush + 0.3)
    at(near, sub_drop(4.0, 0.75, 72.0, 24.0), b("spirit", "end") - 0.5)
    at(far, impact(0.42, seed=15, dur=7.0, f0=80, f1=26),
       b("spirit", "end") + 0.15)

    # --- verse 2: the throne set in place --------------------------
    at(far, impact(0.70, seed=16, dur=8.0, f0=88, f1=28),
       b("throne_set") + 2.2)
    at(far, impact(0.40, seed=17, dur=6.0, f0=64, f1=22),
       b("throne_set") + 2.6)
    at(far, glass_chime(1320, 4.0, 0.40, seed=18), b("throne_set") + 2.25)

    # --- verse 3: crystal and carnelian; the emerald bow -----------
    for k in range(9):
        at(far, glass_chime(2100 + 700 * (k % 4) + 130 * k, 2.6,
                            0.34, seed=20 + k),
           b("jasper") + 1.0 + k * 0.55)
    at(far, glass_floor(b("elders") - b("emerald") + 3.0, 0.30, seed=30,
                        root=196.0), b("emerald") + 0.4)

    # --- verse 4: the elders, and their crowns ---------------------
    for k in range(6):
        at(far, glass_chime(1500 + k * 430, 3.0, 0.22, seed=40 + k),
           b("elders") + 2.6 + k * 0.5)

    # --- verse 5: lightning, thunder, and voices -------------------
    for i, (off, p) in enumerate(script_text.STRIKES):
        t0 = b("lightning") + off
        at(near, zap(0.70 * p, seed=50 + i), t0)
        at(far, thunder_crack(1.05 * p, seed=60 + i, dur=8.0), t0 + 0.14)
    at(far, whispers(6.0, 0.55, seed=70), b("lightning") + 3.4)

    # --- verse 5: seven torches ------------------------------------
    for k in range(7):
        at(near, flame_catch(0.85, seed=80 + k), b("torches") + 1.5 + k * 0.30)
    at(near, fire_bed(dur - b("torches") - 1.4, 0.80, seed=88),
       b("torches") + 1.5)

    # --- verse 6: the sea of glass ---------------------------------
    at(far, glass_floor(dur - b("sea"), 0.95, seed=90, root=174.6),
       b("sea") + 0.6)
    for k in range(4):
        at(far, glass_chime(2400 + k * 980, 3.4, 0.55, seed=94 + k),
           b("sea") + 1.2 + k * 0.7)

    # --- verses 6-8: six wings -------------------------------------
    wing_t = b("wings") + 1.2
    while wing_t < b("holy") + 5.0:
        at(near, wing_beat(0.95, seed=int(wing_t * 13) % 997), wing_t)
        at(near, wing_beat(0.55, seed=int(wing_t * 29) % 997), wing_t + 0.11)
        wing_t += 1.35
    for k in range(3):
        at(near, wing_beat(0.85, seed=200 + k), b("creatures") + 2.0 + k * 1.6)

    # --- verse 8: holy, holy, holy ---------------------------------
    # The multitude arrives before the words and gets out of their way.
    at(far, whispers(4.5, 0.30, seed=100), b("holy") - 3.2)
    for k, off in enumerate(holy_pulses(ev)):
        at(far, impact(0.30, seed=110 + k, dur=6.0, f0=70, f1=25),
           b("holy") + off)
        at(far, thunder_crack(0.32, seed=120 + k, dur=7.0), b("holy") + off + 0.2)

    # --- verse 10: they fall, and the crowns go down ---------------
    at(near, rustle(2.6, 0.85, seed=130), b("facedown") + 2.4)
    at(far, impact(0.30, seed=131, dur=5.0, f0=56, f1=22), b("facedown") + 3.0)
    rng = np.random.default_rng(7)
    for k in range(24):
        t0 = b("crowns") + 1.4 + k * 0.105 + rng.uniform(-0.04, 0.06)
        at(near, crown_fall(0.52 * rng.uniform(0.6, 1.0), seed=140 + k), t0)
    at(far, glass_chime(1046, 5.0, 0.35, seed=170), b("crowns") + 1.5)

    # --- verse 11: worthy ------------------------------------------
    at(far, trumpet_blast(8.0, 0.55, 146.83), b("worthy") - 0.5)
    at(far, whispers(9.0, 0.45, seed=180), b("worthy") + 0.2)
    peal = b("created") + script_text.FINAL_PEAL
    at(far, impact(0.55, seed=181, dur=9.0, f0=76, f1=24), peal)
    at(far, thunder_crack(0.75, seed=182, dur=10.0), peal + 0.18)
    at(near, wind(dur - tl["speech_end"] + 2.0, 0.40, seed=190, colour=380.0),
       tl["speech_end"] - 1.0)

    return near[: _n(dur)], far[: _n(dur)]


def main():
    with open(os.path.join(BUILD, "timeline.json")) as f:
        tl = json.load(f)
    print("building sound effects...")
    near, far = build(tl)

    hall = dsp.impulse_response(rt60=3.8, size=1.2, damping=0.5, seed=21)
    room = dsp.impulse_response(rt60=1.8, size=0.8, damping=0.6, seed=22)
    wet_far = dsp.reverb(far, hall, wet=0.44)[: len(far)]
    wet_near = dsp.reverb(near, room, wet=0.19)[: len(near)]

    mix = wet_near + wet_far
    mix = filt(mix, "highpass", 24.0, 0.7)
    mix = dsp.compress(mix, thresh_db=-20.0, ratio=2.4, makeup_db=1.0)
    mix = filt(mix, "highshelf", 7000.0, 0.7, -3.0)
    mix = dsp.normalize(mix, 0.82)

    left, right = dsp.widen(mix, 0.013)
    out = dsp.stereo(left, right)
    path = os.path.join(BUILD, "sfx.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"sfx: {len(mix) / SR:.1f}s -> {path}")


if __name__ == "__main__":
    sys.exit(main())
