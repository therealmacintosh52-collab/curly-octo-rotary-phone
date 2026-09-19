"""Rendering primitives: animated noise, additive light, bloom, film grade.

Everything is float32 linear light, HDR (values above 1 are allowed and are
what makes the bloom and the tonemap behave like a camera pointed at
something far too bright).
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import convolve1d, gaussian_filter, map_coordinates

W, H = 1920, 1080
LW, LH = 480, 270          # working resolution for volumetrics and glow


# ---------------------------------------------------------------- grids

def _grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


_CACHE = {}


def grid(w, h):
    key = ("g", w, h)
    if key not in _CACHE:
        _CACHE[key] = _grid(w, h)
    return _CACHE[key]


def norm_grid(w, h):
    """x in [-aspect, aspect], y in [-1, 1], origin at frame centre."""
    key = ("n", w, h)
    if key not in _CACHE:
        x, y = grid(w, h)
        nx = (x - w / 2.0) / (h / 2.0)
        ny = (y - h / 2.0) / (h / 2.0)
        _CACHE[key] = (nx.astype(np.float32), ny.astype(np.float32))
    return _CACHE[key]


# ---------------------------------------------------------------- noise

class Noise3:
    """Tileable-in-time 3D value noise, sampled on whole arrays at once."""

    def __init__(self, shape=(24, 40, 24), seed=0):
        rng = np.random.default_rng(seed)
        self.n = np.asarray(shape, dtype=np.int32)
        lat = rng.random(tuple(shape)).astype(np.float32)
        # Wrap one cell on every axis so interpolation is seamless.
        lat = np.concatenate([lat, lat[:1]], axis=0)
        lat = np.concatenate([lat, lat[:, :1]], axis=1)
        lat = np.concatenate([lat, lat[:, :, :1]], axis=2)
        self.lat = lat

    def sample(self, u, v, t):
        """u, v, t in lattice units (float arrays, wrapped)."""
        c = np.stack([
            np.mod(v, self.n[0]),
            np.mod(u, self.n[1]),
            np.full(u.shape, np.mod(t, self.n[2]), np.float32)
            if np.isscalar(t) else np.mod(t, self.n[2]),
        ])
        return map_coordinates(self.lat, c, order=1, mode="grid-wrap")


def fbm(noise, u, v, t, octaves=4, lac=2.0, gain=0.5):
    out = np.zeros(u.shape, np.float32)
    amp, f, norm = 1.0, 1.0, 0.0
    for _ in range(octaves):
        out += amp * noise.sample(u * f, v * f, t * f * 0.55)
        norm += amp
        amp *= gain
        f *= lac
    return out / norm


# ---------------------------------------------------------------- blur

def blur(img, sigma):
    if sigma <= 0:
        return img
    if img.ndim == 3:
        return gaussian_filter(img, (sigma, sigma, 0), mode="nearest")
    return gaussian_filter(img, sigma, mode="nearest")


def resize(img, w, h, smooth=True):
    """Resize a float HxW or HxWx3 array."""
    mode = Image.BILINEAR if smooth else Image.NEAREST
    if img.ndim == 2:
        return np.asarray(
            Image.fromarray(img.astype(np.float32), "F").resize((w, h), mode),
            dtype=np.float32)
    chans = [np.asarray(
        Image.fromarray(img[:, :, c].astype(np.float32), "F").resize((w, h), mode),
        dtype=np.float32) for c in range(img.shape[2])]
    return np.stack(chans, axis=2)


# ---------------------------------------------------------------- light

def radial(nx, ny, cx, cy, radius, power=2.0):
    """Soft additive falloff, 1.0 at the centre."""
    d2 = (nx - cx) ** 2 + (ny - cy) ** 2
    return (radius * radius / (d2 + radius * radius)) ** power


def tint(field, color):
    return field[:, :, None] * np.asarray(color, np.float32)[None, None, :]


def rays(nx, ny, cx, cy, noise, t, count=13.0, spin=0.05, sharp=3.0,
         inner=0.02, reach=1.2):
    """God-rays: angular noise modulated by distance from the source."""
    dx, dy = nx - cx, ny - cy
    ang = np.arctan2(dy, dx)
    d = np.sqrt(dx * dx + dy * dy) + 1e-4
    u = (ang / (2 * np.pi) + 0.5) * count
    v = np.full_like(u, 0.5)
    a = fbm(noise, u, v, t * spin, octaves=3)
    a = np.clip(a - 0.42, 0.0, None) ** sharp * 9.0
    fall = np.exp(-d / reach) * (inner / (d + inner)) ** 0.55
    return (a * fall).astype(np.float32)


def bloom(hdr, thresh=0.95, scales=((4, 0.34), (12, 0.24), (34, 0.20))):
    """Multi-scale bloom taken from the over-bright part of the image."""
    small = resize(hdr, LW, LH)
    lum = small.max(axis=2)
    mask = np.clip(lum - thresh, 0.0, None) / (1.0 + thresh)
    bright = small * mask[:, :, None]
    acc = np.zeros_like(small)
    for sigma, weight in scales:
        acc += blur(bright, sigma) * weight
    return hdr + resize(acc, hdr.shape[1], hdr.shape[0])


def streak(hdr, strength=0.22, length=110, thresh=1.6):
    """Horizontal anamorphic flare from the hottest highlights."""
    small = resize(hdr, LW, LH)
    lum = small.max(axis=2)
    mask = np.clip(lum - thresh, 0.0, None)
    bright = small * mask[:, :, None]
    k = np.exp(-np.abs(np.linspace(-3, 3, length))) ** 1.4
    k /= k.sum()
    out = convolve1d(bright, k, axis=1, mode="constant")
    out *= np.asarray([0.55, 0.75, 1.25], np.float32)[None, None, :]
    return hdr + resize(out, hdr.shape[1], hdr.shape[0]) * strength


# ---------------------------------------------------------------- grade

_ACES = (2.51, 0.03, 2.43, 0.59, 0.14)


def tonemap(x):
    a, b, c, d, e = _ACES
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0)


def vignette(shape, amount=0.35, radius=1.25):
    nx, ny = norm_grid(shape[1], shape[0])
    r = np.sqrt(nx * nx + ny * ny) / radius
    return (1.0 - amount * np.clip(r, 0, 1.6) ** 2.2).astype(np.float32)


def chroma(img, amount=1.6):
    """Slight lateral chromatic aberration; sells the 'lens'."""
    if amount <= 0:
        return img
    h, w = img.shape[:2]
    out = img.copy()
    for c, s in ((0, 1.0), (2, -1.0)):
        k = 1.0 + s * amount / w * 2.0
        lay = resize(img[:, :, c], int(w * k), int(h * k))
        oy = (lay.shape[0] - h) // 2
        ox = (lay.shape[1] - w) // 2
        if oy >= 0 and ox >= 0:
            out[:, :, c] = lay[oy:oy + h, ox:ox + w]
    return out


def grain(shape, t, amount=0.012, seed=7):
    rng = np.random.default_rng(seed + int(t * 977) % 100000)
    g = rng.normal(0.0, 1.0, (LH, LW, 1)).astype(np.float32)
    g = np.repeat(g, 3, axis=2) * np.asarray([1.0, 0.95, 1.1], np.float32)
    return resize(g, shape[1], shape[0]) * amount


def grade(hdr, t, exposure=1.0, sat=1.0, lift=None, vig=0.26, ca=1.4,
          grain_amt=0.013):
    x = np.clip(hdr * exposure, 0.0, 9.0)
    x = bloom(x)
    x = streak(x)
    x = chroma(x, ca)
    rgb = tonemap(np.clip(x, 0.0, None))
    if sat != 1.0:
        lum = (rgb * np.asarray([0.2126, 0.7152, 0.0722], np.float32)).sum(2)
        rgb = np.clip(lum[:, :, None] + (rgb - lum[:, :, None]) * sat, 0, 1)
    if lift is not None:
        rgb = np.clip(rgb + np.asarray(lift, np.float32) * (1.0 - rgb) ** 3, 0, 1)
    rgb *= vignette(rgb.shape, vig)[:, :, None]
    rgb += grain(rgb.shape, t, grain_amt)
    return np.clip(rgb, 0.0, 1.0)


def to_bytes(rgb):
    return (np.clip(rgb, 0, 1) ** (1 / 1.0) * 255.0 + 0.5).astype(np.uint8)


# ---------------------------------------------------------------- shapes

def pil_layer(w=W, h=H):
    im = Image.new("L", (w, h), 0)
    return im, ImageDraw.Draw(im)


def layer_array(im, soften=0.0):
    a = np.asarray(im, dtype=np.float32) / 255.0
    if soften > 0:
        a = blur(a, soften)
    return a


def glow_from(mask, sigmas=((2, 0.8), (7, 0.5), (20, 0.35), (55, 0.22))):
    """Turn a drawn mask into a layered halo."""
    small = resize(mask, LW, LH)
    acc = np.zeros_like(small)
    for sigma, weight in sigmas:
        acc += blur(small, sigma) * weight
    return resize(acc, mask.shape[1], mask.shape[0])


def ease(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def smoothstep(a, b, x):
    return ease((x - a) / (b - a + 1e-9))


def ramp(t, t0, t1):
    return float(ease((t - t0) / (t1 - t0 + 1e-9)))
