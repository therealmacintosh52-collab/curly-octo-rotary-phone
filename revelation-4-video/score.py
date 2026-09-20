"""Synthesise the score and sound design, cut to build/timeline.json.

Nothing is sampled — every drone, choir swell, bell and thunderclap here is
built out of numpy and shaped by the same beat times the picture is cut to.
"""

import json
import os
import sys
import wave

import numpy as np

import dsp
import script_text
from dsp import SR, add_at, db, fade, filt

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")

# D as the root of the whole film; it opens minor and ends major.
def note(semis_from_d2, octave=0):
    return 73.416 * 2.0 ** ((semis_from_d2 + 12 * octave) / 12.0)


D, E, F, Fs, G, A, Bb, B, Cs = 0, 2, 3, 4, 5, 7, 8, 9, 11


def n(*args):
    return [note(s, o) for s, o in args]


# ---------------------------------------------------------------- voices

def _osc(freq, dur, kind="saw", detune=0.0, phase=0.0):
    t = np.arange(int(dur * SR)) / SR
    f = freq * (1.0 + detune)
    ph = 2 * np.pi * f * t + phase
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2.0 / np.pi * np.arcsin(np.sin(ph))
    # band-limited-ish saw: summed harmonics, cheap and warm
    out = np.zeros_like(t)
    k = 1
    while f * k < 9000 and k <= 24:
        out += np.sin(ph * k) / k
        k += 1
    return out * 0.6


def drone(freq, dur, gain=1.0, detunes=(0.0, 0.004, -0.0035), cutoff=420.0):
    out = np.zeros(int(dur * SR))
    for i, d in enumerate(detunes):
        out += _osc(freq, dur, "saw", d, phase=i * 1.7) * (1.0 / len(detunes))
    out += _osc(freq * 0.5, dur, "sine") * 0.55
    out = filt(out, "lowpass", cutoff, 0.8)
    lfo = 1.0 + 0.10 * np.sin(2 * np.pi * 0.06 * np.arange(len(out)) / SR)
    return fade(out * lfo, 2.5, 3.0) * gain


def pad(freqs, dur, gain=1.0, cutoff=1500.0, attack=2.2, release=3.0):
    out = np.zeros(int(dur * SR))
    for j, f in enumerate(freqs):
        for d in (-0.003, 0.0, 0.0032):
            out += _osc(f, dur, "saw", d, phase=j * 2.3) / (len(freqs) * 3)
    out = filt(out, "lowpass", cutoff, 0.7)
    out = filt(out, "highpass", 110.0, 0.7)
    return fade(out, attack, release) * gain


def choir(freqs, dur, gain=1.0, breath=0.16, seed=0):
    """A wordless choir: harmonics, vibrato, vowel formants, breath."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros(len(t))
    for f in freqs:
        for v in range(3):                      # three singers per part
            vib = 1.0 + 0.006 * np.sin(2 * np.pi * (4.6 + v * 0.4) * t
                                       + rng.random() * 6.3)
            det = 1.0 + rng.normal(0.0, 0.0026)
            ph = 2 * np.pi * f * det * np.cumsum(vib) / SR
            sing = np.zeros(len(t))
            for h, amp in ((1, 1.0), (2, 0.45), (3, 0.26), (4, 0.15),
                           (5, 0.09), (6, 0.05)):
                sing += np.sin(ph * h + rng.random() * 6.3) * amp
            out += sing / (len(freqs) * 3)
    # "ah" formants
    voiced = (filt(out, "peak", 720.0, 2.0, 7.0)
              + filt(out, "peak", 1180.0, 2.4, 5.0) * 0.6
              + filt(out, "peak", 2600.0, 3.0, 3.5) * 0.3)
    air = filt(rng.normal(0, 1, len(t)), "bandpass", 2200.0, 0.8) * breath
    sig = filt(voiced * 0.5 + air, "lowpass", 5200.0, 0.7)
    env = np.clip(np.sin(np.pi * np.linspace(0, 1, len(t))) ** 0.75, 0, 1)
    return sig * env * gain


def bell(freq, dur, gain=1.0, seed=0):
    """Inharmonic struck metal, long decay."""
    t = np.arange(int(dur * SR)) / SR
    rng = np.random.default_rng(seed)
    out = np.zeros(len(t))
    for ratio, amp, decay in ((1.0, 1.0, 1.0), (2.01, 0.6, 1.5),
                              (2.98, 0.42, 1.9), (4.21, 0.26, 2.6),
                              (5.44, 0.16, 3.2), (8.12, 0.09, 4.0)):
        out += (np.sin(2 * np.pi * freq * ratio * t + rng.random())
                * amp * np.exp(-t * decay * 1.05))
    strike = filt(rng.normal(0, 1, len(t)), "bandpass", freq * 4, 0.6)
    out += strike * np.exp(-t * 60.0) * 0.5
    return out * gain * 0.4


def thunder(dur=5.0, gain=1.0, seed=0, crack=1.0):
    """A crack, then the rumble rolling away."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    noise = rng.normal(0, 1, len(t))
    body = filt(noise, "lowpass", 160.0, 0.8) * np.exp(-t * 1.05)
    body += filt(noise, "lowpass", 55.0, 0.9) * np.exp(-t * 0.55) * 1.4
    snap = filt(noise, "bandpass", 900.0, 0.5) * np.exp(-t * 16.0) * 0.55 * crack
    snap += filt(noise, "highpass", 2200.0, 0.7) * np.exp(-t * 34.0) * 0.3 * crack
    roll = 1.0 + 0.5 * np.sin(2 * np.pi * 0.7 * t + rng.random() * 6)
    return (body * roll + snap) * gain


def riser(dur, gain=1.0, seed=0):
    """The rush of being taken up."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    u = t / dur
    noise = rng.normal(0, 1, len(t))
    sweep = np.zeros(len(t))
    # three overlapping band-passes climbing in pitch
    for k, base in enumerate((300.0, 620.0, 1250.0)):
        f = base * (1.0 + 7.0 * u ** 2.2)
        ph = 2 * np.pi * np.cumsum(f) / SR
        sweep += np.sin(ph + k) * (0.35 - 0.08 * k)
    air = filt(noise, "highpass", 500.0, 0.7) * (0.3 + 1.2 * u ** 2)
    out = (sweep * (0.25 + 0.9 * u ** 1.6) + air * 0.55)
    return out * (u ** 1.4) * gain


def shimmer(dur, root, gain=1.0, seed=0, density=26):
    """Crystal: high partials struck at random, like glass catching light."""
    rng = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    for _ in range(density):
        at = rng.uniform(0.0, max(0.1, dur - 2.5))
        f = root * rng.choice([4, 6, 8, 9, 12, 16]) * (1 + rng.normal(0, 0.002))
        ln = rng.uniform(1.4, 3.0)
        t = np.arange(int(ln * SR)) / SR
        g = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) * rng.uniform(0.2, 0.6)
        g += np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 3.4) * 0.25
        add_at(out, g, int(at * SR))
    return filt(out, "highpass", 900.0, 0.7) * gain


def brass(freq, dur, gain=1.0):
    """The trumpet-voice: a single sustained blast, far off and enormous."""
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros(len(t))
    for h, amp in ((1, 1.0), (2, 0.72), (3, 0.5), (4, 0.34), (5, 0.22),
                   (6, 0.14), (7, 0.09), (8, 0.06)):
        out += np.sin(2 * np.pi * freq * h * t + h * 0.3) * amp
    env = (1.0 - np.exp(-t * 3.5)) * np.exp(-t * 0.55)
    growl = 1.0 + 0.04 * np.sin(2 * np.pi * 5.5 * t)
    return filt(out * env * growl, "lowpass", 3200.0, 0.8) * gain * 0.25


# ---------------------------------------------------------------- score

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
    N = int(dur * SR) + SR * 8
    low = np.zeros(N)      # drones and thunder
    mid = np.zeros(N)      # pads and choir
    high = np.zeros(N)     # bells and shimmer

    def at(buf, sig, t):
        add_at(buf, sig, int(t * SR))

    # --- the storm, before the door ------------------------------
    at(low, drone(note(D, -1), b("ascend") + 4.0, 0.30), 0.0)
    at(low, drone(note(Bb, 0), b("portal") + 5.0, 0.10), 1.0)
    at(low, thunder(7.0, 0.16, seed=2, crack=0.25), 2.2)
    at(low, thunder(6.0, 0.12, seed=5, crack=0.2), b("portal") - 1.2)

    # --- the door opens -----------------------------------------
    t_open = b("portal") + 2.1
    at(high, bell(note(D, 2), 8.0, 0.30, seed=1), t_open)
    at(high, bell(note(A, 2), 8.0, 0.22, seed=2), t_open + 0.35)
    at(mid, pad(n((D, 1), (A, 1), (D, 2)), b("ascend") - t_open + 3.0, 0.20,
                cutoff=1100.0, attack=3.0), t_open)

    # --- the trumpet-voice --------------------------------------
    at(mid, brass(note(A, 1), 5.0, 0.55), b("trumpet") - 0.5)
    at(mid, brass(note(D, 2), 4.0, 0.32), b("trumpet") - 0.2)
    at(low, drone(note(D, 0), 9.0, 0.22), b("ascend") - 1.0)
    at(high, bell(note(D, 3), 7.0, 0.18, seed=7), b("ascend") + 0.05)

    # --- taken up ------------------------------------------------
    rise = b("spirit", "end") - b("spirit") + 0.9
    at(mid, riser(rise, 0.34, seed=3), b("spirit") + 0.2)
    at(low, thunder(8.0, 0.30, seed=9, crack=0.5), b("spirit", "end") + 0.05)
    at(high, bell(note(D, 3), 9.0, 0.34, seed=11), b("spirit", "end") + 0.05)
    at(high, bell(note(Fs, 2), 9.0, 0.26, seed=12), b("spirit", "end") + 0.1)

    # --- the throne room: a slow progression in D ----------------
    prog = [
        (b("throne_set") - 0.6, b("jasper") + 0.5, [(D, 0), (A, 0), (D, 1), (Fs, 1)]),
        (b("jasper") - 0.2, b("emerald") + 0.6, [(D, 0), (A, 0), (D, 1), (A, 1)]),
        (b("emerald") - 0.2, b("elders") + 0.6, [(B, -1), (Fs, 0), (B, 0), (D, 1)]),
        (b("elders") - 0.2, b("lightning") + 0.6, [(G, -1), (D, 0), (G, 0), (B, 0)]),
        (b("lightning") - 0.2, b("torches") + 0.6, [(D, 0), (A, 0), (D, 1), (F, 1)]),
        (b("torches") - 0.2, b("sea") + 0.6, [(G, -1), (D, 0), (G, 0), (B, 0)]),
        (b("sea") - 0.2, b("creatures") + 0.6, [(D, 0), (A, 0), (Fs, 1), (A, 1)]),
        (b("creatures") - 0.2, b("wings") + 0.6, [(B, -1), (Fs, 0), (D, 1), (Fs, 1)]),
        (b("wings") - 0.2, b("holy") + 0.4, [(G, -1), (D, 0), (B, 0), (D, 1)]),
        (b("holy") - 0.3, b("glory") + 0.8, [(D, 0), (A, 0), (Fs, 1), (A, 1)]),
        (b("glory") - 0.2, b("crowns") + 0.8, [(G, -1), (D, 0), (G, 0), (B, 0)]),
        (b("crowns") - 0.2, b("worthy") + 0.6, [(A, -1), (E, 0), (A, 0), (Cs, 1)]),
        (b("worthy") - 0.3, dur - 2.0, [(D, 0), (A, 0), (D, 1), (Fs, 1)]),
    ]
    for t0, t1, chord in prog:
        ln = max(2.0, t1 - t0)
        at(mid, pad(n(*chord), ln, 0.16, cutoff=1400.0, attack=2.4), t0)
        at(low, drone(n(*chord)[0] * 0.5, ln, 0.20), t0)

    # --- the sound of the vision itself --------------------------
    at(high, shimmer(b("elders") - b("jasper") + 6.0, note(D, 1), 0.10, seed=4),
       b("jasper"))
    at(high, shimmer(b("creatures") - b("sea") + 8.0, note(D, 1), 0.13, seed=6),
       b("sea") - 0.5)
    at(high, shimmer(dur - b("worthy"), note(D, 1), 0.12, seed=8), b("worthy"))

    # thunder under every flash of lightning
    strikes = [(b("lightning") + off, p) for off, p in script_text.STRIKES]
    strikes += [(b("holy") + off, 0.8 + 0.15 * i)
                for i, off in enumerate(holy_pulses(ev))]
    strikes += [(b("created") + script_text.FINAL_PEAL, 1.0)]
    for i, (t0, power) in enumerate(strikes):
        at(low, thunder(6.5, 0.26 * power, seed=20 + i, crack=0.5), t0 + 0.20)

    # --- worship -------------------------------------------------
    # three swells under "Holy, holy, holy"
    _hp = holy_pulses(ev)
    for k, (off, ch) in enumerate([
            (_hp[0] - 0.1, [(D, 0), (A, 0), (D, 1), (Fs, 1)]),
            (_hp[1] - 0.1, [(D, 0), (A, 0), (E, 1), (A, 1)]),
            (_hp[2] - 0.1, [(D, 0), (A, 0), (Fs, 1), (D, 2)])]):
        # Kept well down: this sits in the same range as the sung line, and
        # the words have to come through it.
        at(mid, choir(n(*ch), 3.0, 0.085 + 0.02 * k, seed=30 + k),
           b("holy") + off - 0.25)
    at(high, bell(note(D, 2), 10.0, 0.26, seed=41), b("holy") - 0.1)

    # the elders falling down, and the crowns going down with them
    at(low, thunder(7.0, 0.20, seed=44, crack=0.15), b("facedown") + 1.6)
    for k in range(6):
        at(high, bell(note([D, A, Fs, D, A, D][k], 2 + (k % 2)), 6.0,
                      0.13, seed=50 + k), b("crowns") + 1.0 + k * 0.34)

    # "You are worthy" — the whole choir, and it does not let go
    at(mid, choir(n((D, 0), (A, 0), (D, 1), (Fs, 1)), 5.4, 0.26, seed=60),
       b("worthy") - 0.3)
    at(mid, choir(n((D, 0), (A, 0), (Fs, 1), (A, 1), (D, 2)), 7.5, 0.30,
                  seed=61), b("created") - 0.4)
    at(high, bell(note(D, 2), 12.0, 0.30, seed=62), b("created") + 0.1)
    at(high, bell(note(A, 2), 12.0, 0.22, seed=63), b("created") + 0.45)
    at(mid, choir(n((D, 0), (A, 0), (D, 1), (Fs, 1), (A, 1)), 10.0, 0.22,
                  seed=64), tl["speech_end"] - 0.5)
    at(low, drone(note(D, -1), 14.0, 0.26), tl["speech_end"] - 1.0)

    return low[:int(dur * SR)], mid[:int(dur * SR)], high[:int(dur * SR)]


def main():
    with open(os.path.join(BUILD, "timeline.json")) as f:
        tl = json.load(f)
    print("building score...")
    low, mid, high = build(tl)

    ir_hall = dsp.impulse_response(rt60=3.4, size=1.1, damping=0.55, seed=5)
    mid_w = dsp.reverb(mid, ir_hall, wet=0.32)[: len(mid)]
    high_w = dsp.reverb(high, ir_hall, wet=0.40)[: len(high)]
    low_w = dsp.reverb(low, dsp.impulse_response(rt60=2.2, seed=6),
                       wet=0.17)[: len(low)]

    mix = low_w * 1.0 + mid_w * 1.0 + high_w * 1.0
    mix = filt(mix, "highpass", 28.0, 0.7)
    mix = dsp.compress(mix, thresh_db=-24.0, ratio=2.2, makeup_db=1.5)

    # duck under the voice
    fps = tl["fps"]
    venv = np.asarray(tl["voice_env"], float)
    idx = np.clip(np.arange(len(mix)) / SR * fps, 0, len(venv) - 1)
    v = np.interp(idx, np.arange(len(venv)), venv)
    v = filt(np.clip(v, 0, 1), "lowpass", 2.5, 0.7)
    duck = db(-9.5 * np.clip(v, 0, 1) ** 0.7)
    mix = mix * duck

    mix = dsp.normalize(mix, 0.75)
    left, right = dsp.widen(mix, 0.016)
    out = dsp.stereo(left, right)
    path = os.path.join(BUILD, "score.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"score: {len(mix) / SR:.1f}s -> {path}")


if __name__ == "__main__":
    sys.exit(main())
