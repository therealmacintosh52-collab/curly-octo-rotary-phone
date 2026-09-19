"""Small DSP toolkit: pitch, EQ, reverb, dynamics. Mono float arrays in, out."""

from fractions import Fraction

import numpy as np
from scipy.signal import fftconvolve, resample_poly, sosfilt

SR = 48000


# ---------------------------------------------------------------- basics

def db(x):
    return 10.0 ** (x / 20.0)


def pad_to(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x), dtype=x.dtype)])


def add_at(dst, src, start):
    """Additively mix src into dst at sample offset start, clipping to bounds."""
    start = int(start)
    if start >= len(dst):
        return
    if start < 0:
        src = src[-start:]
        start = 0
    n = min(len(src), len(dst) - start)
    if n > 0:
        dst[start:start + n] += src[:n]


def fade(x, attack=0.01, release=0.05, sr=SR):
    y = x.copy()
    a = int(attack * sr)
    r = int(release * sr)
    if a > 0 and a < len(y):
        y[:a] *= np.linspace(0.0, 1.0, a) ** 2
    if r > 0 and r < len(y):
        y[-r:] *= np.linspace(1.0, 0.0, r) ** 2
    return y


def resample_rate(x, ratio):
    """Resample by `ratio` (>1 = more samples = slower and lower pitch)."""
    f = Fraction(ratio).limit_denominator(400)
    return resample_poly(x, f.numerator, f.denominator)


def pitch_down(x, semitones, sr=SR):
    """Shift pitch by resampling. Negative semitones means lower, and the
    clip gets proportionally longer -- which is the point: a line slowed
    this way has no stretched vowels, only more weight."""
    return resample_rate(x, 2.0 ** (-semitones / 12.0))


# ---------------------------------------------------------------- filters
# RBJ cookbook biquads, returned as second-order sections for sosfilt.

def _biquad(kind, f0, q, gain_db=0.0, sr=SR):
    a_ = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2.0 * q)
    if kind == "lowpass":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "highpass":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * a_, -2 * cw, 1 - alpha * a_]
        a = [1 + alpha / a_, -2 * cw, 1 - alpha / a_]
    elif kind == "lowshelf":
        s = 2.0 * np.sqrt(a_) * alpha
        b = [a_ * ((a_ + 1) - (a_ - 1) * cw + s),
             2 * a_ * ((a_ - 1) - (a_ + 1) * cw),
             a_ * ((a_ + 1) - (a_ - 1) * cw - s)]
        a = [(a_ + 1) + (a_ - 1) * cw + s,
             -2 * ((a_ - 1) + (a_ + 1) * cw),
             (a_ + 1) + (a_ - 1) * cw - s]
    elif kind == "highshelf":
        s = 2.0 * np.sqrt(a_) * alpha
        b = [a_ * ((a_ + 1) + (a_ - 1) * cw + s),
             -2 * a_ * ((a_ - 1) + (a_ + 1) * cw),
             a_ * ((a_ + 1) + (a_ - 1) * cw - s)]
        a = [(a_ + 1) - (a_ - 1) * cw + s,
             2 * ((a_ - 1) - (a_ + 1) * cw),
             (a_ + 1) - (a_ - 1) * cw - s]
    elif kind == "bandpass":
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    else:
        raise ValueError(kind)
    b = np.asarray(b, float) / a[0]
    a = np.asarray(a, float) / a[0]
    return np.concatenate([b, a])[None, :]


def filt(x, kind, f0, q=0.707, gain_db=0.0, sr=SR):
    return sosfilt(_biquad(kind, f0, q, gain_db, sr), x)


# ---------------------------------------------------------------- space

def impulse_response(rt60=2.5, pre_delay=0.02, size=1.0, damping=0.5,
                     seed=0, sr=SR):
    """Synthetic hall: sparse early reflections plus a damped noise tail."""
    rng = np.random.default_rng(seed)
    n = int(rt60 * 1.15 * sr)
    t = np.arange(n) / sr
    tail = rng.normal(0.0, 1.0, n) * np.exp(-6.9078 * t / rt60)
    # Progressive high-frequency absorption: blend a darkening copy over time.
    dark = filt(tail, "lowpass", 900.0, 0.7)
    mix = np.clip(t / (rt60 * 0.6), 0.0, 1.0) ** (0.6 + damping)
    ir = tail * (1.0 - mix) + dark * mix
    ir = filt(ir, "highpass", 90.0, 0.7)
    # Early reflections give the space a readable size.
    for k in range(14):
        d = int((0.012 + 0.11 * size * rng.random() ** 1.6) * sr)
        if d < n:
            ir[d] += rng.choice([-1.0, 1.0]) * 0.55 * np.exp(-2.4 * d / sr)
    ir[: int(pre_delay * sr)] = 0.0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    return ir


def reverb(x, ir, wet=0.3):
    w = fftconvolve(x, ir)
    w *= np.max(np.abs(x)) / (np.max(np.abs(w)) + 1e-9)
    out = np.zeros(len(w))
    out[: len(x)] += x * (1.0 - 0.35 * wet)
    out += w * wet
    return out


# ---------------------------------------------------------------- dynamics

def envelope(x, attack=0.005, release=0.15, sr=SR):
    """One-pole peak follower."""
    a = np.exp(-1.0 / (attack * sr))
    r = np.exp(-1.0 / (release * sr))
    absx = np.abs(x).astype(np.float64)
    env = np.empty_like(absx)
    prev = 0.0
    # Vectorising a one-pole needs a scan; chunked python loop over a
    # decimated envelope keeps it fast enough and smooth enough.
    step = 32
    dec = absx[::step]
    out = np.empty_like(dec)
    for i, v in enumerate(dec):
        coef = a if v > prev else r
        prev = v + coef * (prev - v)
        out[i] = prev
    env = np.interp(np.arange(len(x)), np.arange(len(dec)) * step, out)
    return env


def compress(x, thresh_db=-20.0, ratio=3.5, attack=0.006, release=0.18,
             makeup_db=0.0, sr=SR):
    env = envelope(x, attack, release, sr)
    env_db = 20.0 * np.log10(env + 1e-9)
    over = np.maximum(0.0, env_db - thresh_db)
    gain_db = -over * (1.0 - 1.0 / ratio)
    return x * db(gain_db + makeup_db)


def limit(x, ceiling=0.97):
    peak = np.max(np.abs(x)) + 1e-12
    if peak > ceiling:
        x = x * (ceiling / peak)
    return np.tanh(x * 1.02) * 0.985


def normalize(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def stereo(left, right):
    n = max(len(left), len(right))
    return np.stack([pad_to(left, n), pad_to(right, n)], axis=1)


def widen(x, spread=0.012, sr=SR):
    """Haas-style widening: tiny delay and tilt between the two sides."""
    d = int(spread * sr)
    l = np.concatenate([x, np.zeros(d)])
    r = np.concatenate([np.zeros(d), x])
    l = filt(l, "highshelf", 4000.0, 0.7, 1.2)
    r = filt(r, "highshelf", 4000.0, 0.7, -1.2)
    return l, r
