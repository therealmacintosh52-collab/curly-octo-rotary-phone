"""Every image in this film is drawn from Revelation 4 and nothing else:
an opened door, a throne set in place, One seated, jasper and carnelian,
an emerald rainbow, twenty-four thrones with crowned elders, lightning and
thunder and voices, seven torches, a sea of glass, four living creatures
full of eyes with six wings, and crowns cast down.
"""

import numpy as np
from PIL import Image, ImageDraw

import fx
from fx import H, LH, LW, W, blur, ease, fbm, ramp, resize, smoothstep

# ---------------------------------------------------------------- palette
INDIGO = np.float32([0.035, 0.058, 0.150])
VIOLET = np.float32([0.085, 0.100, 0.260])
STORM = np.float32([0.040, 0.048, 0.080])
CRYSTAL = np.float32([0.85, 0.93, 1.00])
CARNELIAN = np.float32([1.00, 0.24, 0.10])
JASPER = np.float32([1.00, 0.86, 0.72])
EMERALD = np.float32([0.10, 1.00, 0.52])
GOLD = np.float32([1.00, 0.72, 0.26])
WHITE = np.float32([1.00, 0.98, 0.95])
LIGHTNING = np.float32([0.78, 0.86, 1.00])
FLAME = np.float32([1.00, 0.55, 0.16])

# World layout (world units: 1.0 = half the frame height at zoom 1).
THRONE_Y = -0.10          # centre of the throne block
HORIZON = 0.46            # where the sea of glass begins
RING_R = (1.62, 0.38)     # ellipse of the twenty-four thrones
RING_Y = 0.02

NOISE_A = fx.Noise3((20, 34, 20), seed=11)   # cloud body
NOISE_B = fx.Noise3((14, 22, 16), seed=29)   # warp
NOISE_C = fx.Noise3((10, 18, 12), seed=47)   # rays / flame


# ---------------------------------------------------------------- stage

class Stage:
    """One frame: an HDR canvas plus the camera mapping used to draw on it."""

    def __init__(self, t, cam, env=0.0):
        self.t = float(t)
        self.cx, self.cy, self.zoom = cam
        self.env = float(env)
        self.hdr = np.zeros((H, W, 3), np.float32)
        self._wl = None

    # --- camera -------------------------------------------------
    @property
    def s(self):
        """Pixels per world unit."""
        return (H / 2.0) * self.zoom

    def px(self, wx, wy):
        return (W / 2.0 + (wx - self.cx) * self.s,
                H / 2.0 + (wy - self.cy) * self.s)

    def world_grid(self, low=True):
        """World coordinates of every pixel (cached per frame)."""
        if low and self._wl is not None:
            return self._wl
        w, h = (LW, LH) if low else (W, H)
        nx, ny = fx.norm_grid(w, h)
        wx = nx / self.zoom + self.cx
        wy = ny / self.zoom + self.cy
        if low:
            self._wl = (wx, wy)
        return wx, wy

    # --- compositing --------------------------------------------
    def add_low(self, rgb_low, gain=1.0):
        self.hdr += resize(rgb_low, W, H) * gain

    def add(self, rgb, gain=1.0):
        self.hdr += rgb * gain

    def add_mask(self, mask, color, gain=1.0):
        self.hdr += mask[:, :, None] * np.asarray(color, np.float32) * gain

    def mul_mask(self, mask):
        self.hdr *= mask[:, :, None]


def layer():
    im = Image.new("L", (W, H), 0)
    return im, ImageDraw.Draw(im)


def arr(im):
    return np.asarray(im, np.float32) / 255.0


# ---------------------------------------------------------------- sky

def cloud_field(stage, base_gain=1.0, lit=1.0, light_pos=(0.0, THRONE_Y),
                tint_a=INDIGO, tint_b=VIOLET, speed=0.06, warp=0.45,
                scale=1.35, ceiling=None):
    """Volumetric cloud bank lit from a single source."""
    wx, wy = stage.world_grid()
    t = stage.t
    u, v = wx * scale, wy * scale
    wu = fbm(NOISE_B, u * 0.6 + 3.0, v * 0.6, t * speed * 0.7, octaves=2)
    wv = fbm(NOISE_B, u * 0.6, v * 0.6 + 7.0, t * speed * 0.7, octaves=2)
    d = fbm(NOISE_A, u + warp * (wu - 0.5) * 4.0,
            v + warp * (wv - 0.5) * 4.0, t * speed, octaves=5)
    d = np.clip(d * 2.4 - 0.72, 0.0, None) ** 1.25

    lx, ly = light_pos
    dist = np.sqrt((wx - lx) ** 2 + (wy - ly) ** 2)
    fall = 1.0 / (1.0 + (dist * 1.25) ** 2)
    shade = (0.18 + 0.82 * fall * lit)

    body = d[:, :, None] * (tint_a[None, None, :] * (1.0 - fall[:, :, None])
                            + tint_b[None, None, :] * fall[:, :, None])
    body = body * shade[:, :, None] * 5.5
    # Rim of light where the cloud thins out near the source.
    body += (np.clip(0.45 - d, 0.0, None) * fall * 1.2)[:, :, None] * tint_b
    if ceiling is not None:
        body *= np.clip((ceiling - wy) * 6.0, 0.0, 1.0)[:, :, None]
    stage.add_low(body, base_gain)


def motes(stage, count=150, gain=1.0, seed=5, spread=(2.4, 1.6)):
    """Slow embers drifting up through the light."""
    rng = np.random.default_rng(seed)
    px = rng.uniform(-spread[0], spread[0], count)
    py0 = rng.uniform(-spread[1], spread[1], count)
    spd = rng.uniform(0.010, 0.045, count)
    ph = rng.uniform(0, 7.0, count)
    size = rng.uniform(0.9, 2.6, count)
    im, d = layer()
    for i in range(count):
        wy = ((py0[i] - stage.t * spd[i] + spread[1]) %
              (2 * spread[1])) - spread[1]
        wx = px[i] + 0.06 * np.sin(stage.t * 0.35 + ph[i])
        x, y = stage.px(wx, wy + THRONE_Y)
        if -40 < x < W + 40 and -40 < y < H + 40:
            r = size[i] * max(0.6, stage.zoom)
            a = int(150 * (0.45 + 0.55 * np.sin(stage.t * 1.7 + ph[i]) ** 2))
            d.ellipse([x - r, y - r, x + r, y + r], fill=a)
    m = arr(im)
    stage.add_mask(blur(m, 1.2), JASPER, gain * 0.55)
    stage.add_mask(fx.glow_from(m, ((6, 0.5), (18, 0.3))), GOLD, gain * 0.28)


# ---------------------------------------------------------------- throne

def _throne_polys(stage, scale=1.0):
    """Throne geometry in pixel space: (back, seat, arms, steps)."""
    def P(x, y):
        return stage.px(x * scale, THRONE_Y + y * scale)

    back = [P(-0.30, 0.16), P(-0.30, -0.52), P(-0.22, -0.72), P(0.0, -0.78),
            P(0.22, -0.72), P(0.30, -0.52), P(0.30, 0.16)]
    seat = [P(-0.38, 0.14), P(0.38, 0.14), P(0.34, 0.30), P(-0.34, 0.30)]
    arms = [[P(-0.44, -0.10), P(-0.30, -0.10), P(-0.30, 0.16), P(-0.44, 0.16)],
            [P(0.30, -0.10), P(0.44, -0.10), P(0.44, 0.16), P(0.30, 0.16)]]
    steps = []
    for i, (hw, y0, y1) in enumerate([(0.52, 0.30, 0.375),
                                      (0.66, 0.375, 0.445),
                                      (0.82, 0.445, 0.52)]):
        steps.append([P(-hw, y0), P(hw, y0), P(hw + 0.04, y1), P(-hw - 0.04, y1)])
    return back, seat, arms, steps


def throne(stage, intensity=1.0):
    """The throne itself: carved out of the light, edges blazing."""
    if intensity <= 0.01:
        return
    back, seat, arms, steps = _throne_polys(stage)

    solid, ds = layer()
    for poly in [back, seat] + arms + steps:
        ds.polygon(poly, fill=255)
    body = arr(solid)

    edge, de = layer()
    lw = max(2, int(3.0 * stage.zoom))
    for poly in [back, seat] + arms + steps:
        de.line(poly + [poly[0]], fill=255, width=lw, joint="curve")
    rim = arr(edge)

    # The throne occludes the sky, then is re-lit from its own edges.
    stage.mul_mask(1.0 - body * (0.965 * intensity))
    stage.add_mask(body, np.float32([0.10, 0.11, 0.20]), 0.16 * intensity)
    stage.add_mask(blur(rim, 1.0), JASPER, 1.25 * intensity)
    stage.add_mask(fx.glow_from(rim, ((5, 0.6), (16, 0.4), (44, 0.25))),
                   GOLD, 0.55 * intensity)


def presence(stage, intensity=1.0, carn=1.0, sparkle=1.0):
    """The One seated: crystal light, carnelian fire, no form given."""
    if intensity <= 0.01:
        return
    wx, wy = stage.world_grid()
    cy = THRONE_Y - 0.16
    pulse = 1.0 + 0.10 * np.sin(stage.t * 0.9) + 0.35 * stage.env

    core = fx.radial(wx * 1.55, (wy - cy) * 0.80, 0.0, 0.0, 0.10, 1.6)
    halo = fx.radial(wx * 1.15, (wy - cy) * 0.90, 0.0, 0.0, 0.26, 1.2)
    wide = fx.radial(wx, (wy - cy) * 0.95, 0.0, 0.0, 0.44, 1.1)

    rgb = (core[:, :, None] * CRYSTAL * 2.3 * pulse
           + halo[:, :, None] * JASPER * 0.55 * pulse
           + wide[:, :, None] * CARNELIAN * 0.26 * carn * pulse)
    stage.add_low(rgb, intensity)

    r = fx.rays(wx, wy, 0.0, cy, NOISE_C, stage.t, count=15.0, spin=0.08,
                sharp=2.6, inner=0.05, reach=1.5)
    stage.add_low(r[:, :, None] * JASPER, 0.30 * intensity * (0.7 + stage.env))

    if sparkle > 0.01:
        _sparkle(stage, cy, sparkle * intensity)


def _sparkle(stage, cy, gain):
    """Jasper glints: crystal catching light, with little star flares."""
    rng = np.random.default_rng(3)
    n = 34
    ang = rng.uniform(0, 2 * np.pi, n)
    rad = rng.uniform(0.05, 0.42, n) ** 0.7
    ph = rng.uniform(0, 6.3, n)
    im, d = layer()
    for i in range(n):
        tw = np.sin(stage.t * (1.1 + 0.7 * (i % 5)) + ph[i])
        a = max(0.0, tw) ** 6
        if a < 0.05:
            continue
        wx = np.cos(ang[i]) * rad[i] * 0.9
        wy = cy + np.sin(ang[i]) * rad[i] * 0.55
        x, y = stage.px(wx, wy)
        r = (2.0 + 5.0 * a) * max(0.7, stage.zoom)
        v = int(255 * a)
        d.ellipse([x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5], fill=v)
        d.line([x - r * 3.2, y, x + r * 3.2, y], fill=int(v * 0.7), width=1)
        d.line([x, y - r * 2.4, x, y + r * 2.4], fill=int(v * 0.7), width=1)
    m = arr(im)
    stage.add_mask(blur(m, 0.8), CRYSTAL, 1.15 * gain)
    stage.add_mask(blur(m, 7.0), JASPER, 0.55 * gain)


def emerald_rainbow(stage, intensity=1.0, front=False):
    """A circle of green light around the throne, like an emerald rainbow."""
    if intensity <= 0.01:
        return
    rx, ry = 0.98, 0.60
    cyw = THRONE_Y - 0.02
    im, d = layer()
    steps = 220
    lo, hi = (0, steps // 2) if not front else (steps // 2, steps)
    band = max(3, int(16 * stage.zoom))
    pts = []
    for i in range(lo, hi + 1):
        a = np.pi + np.pi * (i / steps) * 2.0
        pts.append(stage.px(rx * np.cos(a), cyw + ry * np.sin(a)))
    d.line(pts, fill=255, width=band, joint="curve")
    m = arr(im)

    core, dc = layer()
    dc.line(pts, fill=255, width=max(1, band // 5), joint="curve")
    mc = arr(core)

    shimmer = 0.85 + 0.25 * np.sin(stage.t * 0.7)
    stage.add_mask(blur(m, 5.0), EMERALD, 0.42 * intensity * shimmer)
    stage.add_mask(blur(mc, 1.4), np.float32([0.62, 1.0, 0.80]),
                   0.85 * intensity)
    stage.add_mask(fx.glow_from(m, ((10, 0.5), (30, 0.35), (70, 0.22))),
                   EMERALD, 0.40 * intensity)


# ---------------------------------------------------------------- elders

def _elder_positions():
    out = []
    for i in range(24):
        a = 2 * np.pi * (i + 0.5) / 24.0
        wx = RING_R[0] * np.cos(a)
        wy = RING_Y + RING_R[1] * np.sin(a)
        depth = (np.sin(a) + 1.0) * 0.5          # 0 far, 1 near
        out.append((wx, wy, depth, a))
    return out


ELDERS = _elder_positions()


def elders(stage, intensity=1.0, bow=0.0, crowns=1.0, crown_fly=0.0,
           front_only=None):
    """Twenty-four thrones, elders in white, crowns of gold."""
    if intensity <= 0.01:
        return
    seats, dseat = layer()
    robes, drobe = layer()
    gold, dgold = layer()

    for i, (wx, wy, depth, a) in enumerate(ELDERS):
        near = np.sin(a) > 0
        if front_only is True and not near:
            continue
        if front_only is False and near:
            continue
        sc = 0.115 + 0.075 * depth
        lean = bow * (0.55 + 0.25 * np.sin(i * 1.7))
        glim = (0.48 + 0.42 * depth) * (0.86 + 0.28 * ((i * 5) % 7) / 7.0)

        def P(dx, dy):
            return stage.px(wx + dx * sc, wy + dy * sc)

        # throne
        prof = [P(-0.52, 0.34), P(-0.52, -0.62), P(-0.36, -0.78),
                P(0.36, -0.78), P(0.52, -0.62), P(0.52, 0.34)]
        dseat.polygon(prof, fill=int(34 * glim))
        dseat.line(prof, fill=int(95 * glim),
                   width=max(1, int(1.5 * stage.zoom)), joint="curve")
        # elder: a seated figure in white, folding forward as he falls down
        hy = -0.92 + lean * 1.30
        hx = lean * 0.40
        hr = 0.19 * sc * stage.s
        hxp, hyp = P(hx, hy)
        drobe.ellipse([hxp - hr, hyp - hr, hxp + hr, hyp + hr],
                      fill=int(175 * glim))
        drobe.polygon([P(hx - 0.14, hy + 0.15), P(hx - 0.30, hy + 0.42),
                       P(-0.30, 0.02), P(-0.44, 0.32), P(0.44, 0.32),
                       P(0.30, 0.02), P(hx + 0.30, hy + 0.42),
                       P(hx + 0.14, hy + 0.15)], fill=int(150 * glim))
        # crown of victory
        if crowns > 0.02:
            fly = crown_fly * (0.35 + 0.65 * ((i * 7) % 24) / 24.0)
            fly = float(np.clip(fly, 0.0, 1.0))
            ex, ey = wx + hx * sc, wy + (hy - 0.30) * sc
            tx, ty = 0.0, THRONE_Y + 0.62
            arc = np.sin(np.pi * fly) * 0.55
            cx_ = ex + (tx - ex) * ease(fly)
            cy_ = ey + (ty - ey) * ease(fly) - arc
            k = 0.30 * sc * stage.s * (1.0 - 0.45 * fly)
            x, y = stage.px(cx_, cy_)
            v = int(255 * glim * min(1.0, crowns))
            dgold.arc([x - k, y - k * 0.75, x + k, y + k * 0.75],
                      190, 350, fill=v, width=max(1, int(2.4 * stage.zoom)))
            for s in (-1.0, -0.4, 0.4, 1.0):
                dgold.line([x + s * k * 0.8, y - k * 0.18,
                            x + s * k * 0.8, y - k * 0.62], fill=v,
                           width=max(1, int(2 * stage.zoom)))

    ms, mr, mg = arr(seats), arr(robes), arr(gold)
    stage.mul_mask(1.0 - np.clip(ms * 0.5 + mr * 0.25, 0, 1) * intensity)
    stage.add_mask(blur(ms, 1.0), np.float32([0.45, 0.50, 0.75]), 0.35 * intensity)
    stage.add_mask(blur(mr, 1.2), WHITE, 0.72 * intensity)
    stage.add_mask(fx.glow_from(mr, ((6, 0.45), (20, 0.30))), CRYSTAL,
                   0.38 * intensity)
    stage.add_mask(blur(mg, 0.9), GOLD, 1.30 * intensity)
    stage.add_mask(fx.glow_from(mg, ((5, 0.5), (16, 0.35))), GOLD,
                   0.70 * intensity)


def fallen_crowns(stage, amount):
    """The heap of surrendered crowns lying before the throne."""
    if amount <= 0.02:
        return
    im, d = layer()
    rng = np.random.default_rng(12)
    n = 24
    for i in range(n):
        if (i + 1) / n > amount:
            continue
        wx = rng.uniform(-0.42, 0.42)
        wy = THRONE_Y + 0.60 + rng.uniform(-0.03, 0.05)
        k = 0.055 * stage.s
        x, y = stage.px(wx, wy)
        d.arc([x - k, y - k * 0.42, x + k, y + k * 0.42], 200, 340,
              fill=230, width=max(1, int(2.2 * stage.zoom)))
    m = arr(im)
    stage.add_mask(blur(m, 1.0), GOLD, 1.20)
    stage.add_mask(fx.glow_from(m, ((6, 0.5), (22, 0.35))), GOLD, 0.65)


# ---------------------------------------------------------------- creatures

CREATURE_ANGLES = [np.deg2rad(a) for a in (222.0, 318.0, 156.0, 24.0)]
CREATURE_KIND = ["lion", "ox", "man", "eagle"]


def _wing_polygon(cx, cy, ang, length, width, curve, s, px):
    """One wing: a swept blade, returned as (outline, spine, feathers)."""
    top, bot, spine = [], [], []
    for i in range(15):
        u = i / 14.0
        a = ang + curve * u
        r = length * u
        wx = cx + np.cos(a) * r
        wy = cy + np.sin(a) * r * 0.76
        wdt = width * (u ** 0.40) * ((1.0 - u) ** 0.85) * 2.6
        nx_, ny_ = -np.sin(a), np.cos(a) * 0.76
        top.append(px(wx + nx_ * wdt, wy + ny_ * wdt))
        bot.append(px(wx - nx_ * wdt, wy - ny_ * wdt))
        spine.append(px(wx, wy))
    feathers = []
    for k in range(1, 5):                       # pinions along the trailing edge
        u = 0.30 + 0.17 * k
        j = int(u * 14)
        feathers.append([spine[j], bot[j]])
    return top + bot[::-1], top, feathers


# Six wings apiece: two lifted high, two spread wide, two folded down.
# (angle, length, width, origin-y, curve) — deliberately uneven.
WING_SET = [(-2.36, 1.48, 0.150, -0.34, -0.34), (-0.78, 1.48, 0.150, -0.34, 0.34),
            (3.02, 1.08, 0.132, 0.06, -0.20), (0.12, 1.08, 0.132, 0.06, 0.20),
            (2.20, 0.76, 0.112, 0.48, -0.30), (0.94, 0.76, 0.112, 0.48, 0.30)]


def creatures(stage, intensity=1.0, eyes=1.0, beat=0.0, face_focus=-1,
              front_only=None):
    """Four living creatures, six wings each, full of eyes.

    They are drawn as one silhouette apiece, standing against the light of
    the throne, rimmed in fire — shape and eyes, nothing more.
    """
    if intensity <= 0.01:
        return
    sil_im, ds = layer()
    eye_im, de = layer()
    rng = np.random.default_rng(99)
    drew = False

    for ci, a in enumerate(CREATURE_ANGLES):
        near = np.sin(a) > 0
        if front_only is True and not near:
            continue
        if front_only is False and near:
            continue
        drew = True
        wx = 1.18 * np.cos(a)
        wy = RING_Y - 0.26 + 0.34 * np.sin(a)
        depth = (np.sin(a) + 1.0) * 0.5
        sc = 0.185 + 0.105 * depth
        glim = (0.62 + 0.38 * depth) * intensity
        if face_focus == ci:
            glim *= 1.35
        flap = np.sin(stage.t * 1.15 + ci * 1.9) * 0.09 + beat * 0.14
        fill = int(255 * min(1.0, glim))

        def P(dx, dy):
            return stage.px(wx + dx * sc, wy + dy * sc)

        for wi, (ang, ln, wd, oy, curve) in enumerate(WING_SET):
            side = 1.0 if wi % 2 else -1.0
            aa = ang + side * flap
            ox, oyw = wx, wy + oy * sc
            poly, _lead, _f = _wing_polygon(ox, oyw, aa, ln * sc, wd * sc,
                                            curve, stage.s, stage.px)
            ds.polygon(poly, fill=fill)
            if eyes > 0.02:                      # eyes all around the wings
                for _ in range(7):
                    u = 0.22 + 0.70 * rng.random()
                    a2 = aa + curve * u
                    r = ln * sc * u
                    off = (rng.random() - 0.5) * wd * sc * 2.6
                    ex = ox + np.cos(a2) * r - np.sin(a2) * off
                    ey = oyw + np.sin(a2) * r * 0.76 + np.cos(a2) * off * 0.76
                    ph = rng.random() * 6.3
                    op = max(0.0, np.sin(stage.t * 1.25 + ph)) ** 2.5
                    if op < 0.07:
                        continue
                    x, y = stage.px(ex, ey)
                    rr = max(1.6, 0.022 * sc * stage.s * (0.55 + 0.45 * op))
                    de.ellipse([x - rr, y - rr * 0.78, x + rr, y + rr * 0.78],
                               fill=int(255 * op * min(1.0, eyes) * glim))

        # upright body, and the face that names each one
        ds.polygon([P(-0.19, -0.34), P(0.19, -0.34), P(0.25, 0.58),
                    P(0.13, 1.10), P(-0.13, 1.10), P(-0.25, 0.58)], fill=fill)
        hr = 0.21 * sc * stage.s
        hx, hy = P(0.0, -0.50)
        ds.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=fill)
        kind = CREATURE_KIND[ci]
        if kind == "lion":                       # mane
            mane = []
            for k in range(26):
                ka = 2 * np.pi * k / 26.0
                rr = hr * (1.92 if k % 2 == 0 else 1.28)
                mane.append((hx + np.cos(ka) * rr, hy + np.sin(ka) * rr))
            ds.polygon(mane, fill=fill)
        elif kind == "ox":                       # horns
            for sgn in (-1.0, 1.0):
                ds.polygon([(hx + sgn * hr * 0.75, hy - hr * 0.45),
                            (hx + sgn * hr * 2.05, hy - hr * 1.45),
                            (hx + sgn * hr * 2.25, hy - hr * 0.70),
                            (hx + sgn * hr * 0.80, hy + hr * 0.05)], fill=fill)
        elif kind == "eagle":                    # crest and beak
            ds.polygon([(hx + hr * 0.5, hy - hr * 0.15),
                        (hx + hr * 1.95, hy + hr * 0.20),
                        (hx + hr * 0.5, hy + hr * 0.55)], fill=fill)
            ds.polygon([(hx - hr * 0.25, hy - hr * 0.9),
                        (hx - hr * 1.35, hy - hr * 1.75),
                        (hx - hr * 0.05, hy - hr * 0.45)], fill=fill)

    if not drew:
        return
    sil, me = arr(sil_im), arr(eye_im)
    rim = np.clip(blur(sil, 2.4) - sil, 0.0, 1.0)
    stage.mul_mask(1.0 - sil * 0.93)
    stage.add_mask(sil, np.float32([0.10, 0.14, 0.30]), 0.22)
    stage.add_mask(rim, np.float32([0.78, 0.88, 1.00]), 2.60)
    stage.add_mask(fx.glow_from(rim, ((6, 0.45), (20, 0.30), (52, 0.20))),
                   CRYSTAL, 0.55)
    stage.add_mask(blur(me, 0.7), WHITE, 1.70 * min(1.6, eyes))
    stage.add_mask(fx.glow_from(me, ((5, 0.45), (16, 0.3))), JASPER,
                   0.80 * min(1.6, eyes))


# ---------------------------------------------------------------- torches

def torches(stage, intensity=1.0):
    """Seven blazing torches burning before the throne."""
    if intensity <= 0.01:
        return
    wx, wy = stage.world_grid()
    field = np.zeros((LH, LW), np.float32)
    for i in range(7):
        fx_ = -0.60 + i * 0.20
        fy = THRONE_Y + 0.54
        fl = 0.80 + 0.25 * np.sin(stage.t * (4.0 + i * 0.7) + i * 2.1) \
            + 0.14 * np.sin(stage.t * 11.0 + i)
        # height above the torch head, 0 at the wick, 1 at the tip
        hgt = (fy - wy) / (0.24 * fl)
        taper = 1.0 - 0.62 * np.clip(hgt, 0.0, 1.0)
        lean = 0.012 * np.sin(stage.t * 1.6 + i) * np.clip(hgt, 0, 1) ** 2
        dx = (wx - fx_ - lean) / (0.030 * taper)
        n = fbm(NOISE_C, (wx - fx_) * 26.0, (wy - fy) * 13.0 - stage.t * 6.0,
                stage.t * 2.0, octaves=3)
        body = np.exp(-dx * dx * 1.15)
        body *= np.exp(-np.clip(hgt, 0.0, None) ** 1.9 * 1.9)
        body *= np.clip((hgt + 0.18) / 0.18, 0.0, 1.0)      # nothing below
        body *= (0.45 + 1.0 * n) * fl
        field += body
    f = np.clip(field, 0, None)
    f = np.clip(f, 0.0, 1.6)
    rgb = (f[:, :, None] ** 2.2 * WHITE * 0.95
           + f[:, :, None] * FLAME * 1.05
           + np.clip(f - 0.15, 0, None)[:, :, None] * CARNELIAN * 0.42)
    stage.add_low(rgb, intensity)

    # stands
    im, d = layer()
    for i in range(7):
        x0, y0 = stage.px(-0.60 + i * 0.20, THRONE_Y + 0.55)
        x1, y1 = stage.px(-0.60 + i * 0.20, THRONE_Y + 0.70)
        d.line([x0, y0, x1, y1], fill=120, width=max(1, int(3 * stage.zoom)))
    m = arr(im)
    stage.mul_mask(1.0 - m * 0.65 * intensity)
    stage.add_mask(blur(m, 1.2), GOLD, 0.35 * intensity)


# ---------------------------------------------------------------- weather

def lightning(stage, strikes, intensity=1.0):
    """Blinding flashes out of the throne, with the thunder behind them."""
    if not strikes:
        return
    wide, dwide = layer()
    core, dcore = layer()
    flash = 0.0
    for (t0, seed, power) in strikes:
        age = stage.t - t0
        if age < 0 or age > 0.65:
            continue
        rng = np.random.default_rng(seed)
        life = np.exp(-age * 7.5)
        if age < 0.035:                       # the strike arriving
            life *= age / 0.035
        if 0.16 < age < 0.22:                 # the second flicker
            life *= 1.5
        life *= power
        flash += life
        for _ in range(int(rng.integers(3, 6))):
            # fan upward and outward out of the seat of the throne
            a = rng.uniform(-np.pi * 0.97, -np.pi * 0.03)
            a += rng.normal(0.0, 0.10)
            length = rng.uniform(1.3, 2.6)
            pts = [(0.0, THRONE_Y - 0.14)]
            steps = 16
            for k in range(1, steps + 1):
                u = k / steps
                j = 0.16 * u ** 0.6
                pts.append((np.cos(a) * length * u + rng.normal(0, j),
                            THRONE_Y - 0.14 + np.sin(a) * length * u
                            + rng.normal(0, j * 0.8)))
            scr = [stage.px(x, y) for x, y in pts]
            for k in range(steps):
                taper = (1.0 - k / steps) ** 0.7
                w = max(1, int((2.0 + 8.0 * taper) * stage.zoom * life))
                dwide.line([scr[k], scr[k + 1]],
                           fill=int(190 * min(1.0, life)), width=w)
                dcore.line([scr[k], scr[k + 1]],
                           fill=int(255 * min(1.0, life)),
                           width=max(1, int((0.8 + 2.6 * taper) * stage.zoom)))
            if rng.random() < 0.8:            # a fork
                j = int(rng.integers(5, steps - 2))
                bx, by = pts[j]
                fa = a + rng.uniform(-1.2, 1.2)
                fl_ = rng.uniform(0.3, 0.8)
                fp = [stage.px(bx, by),
                      stage.px(bx + np.cos(fa) * fl_ * 0.5,
                               by + np.sin(fa) * fl_ * 0.5),
                      stage.px(bx + np.cos(fa + 0.3) * fl_,
                               by + np.sin(fa + 0.3) * fl_)]
                dcore.line(fp, fill=int(210 * min(1.0, life)),
                           width=max(1, int(1.6 * stage.zoom)), joint="curve")
    mw, mc = arr(wide), arr(core)
    if mc.max() > 0:
        stage.add_mask(blur(mw, 3.0), LIGHTNING, 1.10 * intensity)
        stage.add_mask(blur(mc, 0.8), WHITE, 3.60 * intensity)
        stage.add_mask(fx.glow_from(mc, ((7, 0.55), (24, 0.4), (64, 0.3))),
                       LIGHTNING, 1.60 * intensity)
    if flash > 0.01:
        stage.add(np.ones((H, W, 3), np.float32) * LIGHTNING[None, None, :],
                  0.30 * min(1.1, flash) * intensity)


def voice_rings(stage, events, intensity=1.0):
    """Voices going out from the throne as rings of light."""
    if not events:
        return
    im, d = layer()
    hit = False
    for t0, power in events:
        age = stage.t - t0
        if age < 0 or age > 3.2:
            continue
        r = 0.18 + age * 0.95
        a = np.exp(-age * 1.15) * power
        if a < 0.02:
            continue
        hit = True
        x0, y0 = stage.px(-r, THRONE_Y - 0.05 - r * 0.62)
        x1, y1 = stage.px(r, THRONE_Y - 0.05 + r * 0.62)
        d.ellipse([x0, y0, x1, y1], outline=int(255 * min(1.0, a)),
                  width=max(1, int(2.4 * stage.zoom)))
    if hit:
        m = arr(im)
        stage.add_mask(blur(m, 2.0), CRYSTAL, 0.45 * intensity)
        stage.add_mask(fx.glow_from(m, ((10, 0.4), (34, 0.25))), JASPER,
                       0.26 * intensity)


# ---------------------------------------------------------------- sea

def sea_of_glass(stage, intensity=1.0):
    """Pavement like a crystal sea of glass: the throne room, mirrored."""
    if intensity <= 0.01:
        return
    _, hy = stage.px(0.0, HORIZON)
    hy = int(round(hy))
    if hy >= H - 4:
        return
    top = max(0, hy)
    rows = H - top
    ys = np.arange(top, H, dtype=np.float32)[:, None]
    xs = np.arange(W, dtype=np.float32)[None, :]
    depth = (ys - hy) / max(1.0, (H - hy))

    ripple = (np.sin(xs * 0.011 + stage.t * 0.7 + depth * 22.0) * 2.4
              + np.sin(xs * 0.031 - stage.t * 0.45 + depth * 41.0) * 1.3)
    wob = (np.sin(ys * 0.06 + stage.t * 0.9) * 1.6
           + np.sin(ys * 0.017 - stage.t * 0.5) * 3.0)
    amp = (0.25 + 3.4 * depth ** 1.4)
    src_y = np.clip(hy - (ys - hy) * 1.12 + ripple * amp, 0, hy - 1)
    src_x = np.clip(xs + wob * amp * 0.55, 0, W - 1)

    from scipy.ndimage import map_coordinates
    coords = np.stack([np.broadcast_to(src_y, (rows, W)),
                       np.broadcast_to(src_x, (rows, W))])
    refl = np.stack([map_coordinates(stage.hdr[:, :, c], coords, order=1,
                                     mode="nearest") for c in range(3)], axis=2)

    fade = (np.exp(-depth * 1.9) * 0.62 + 0.05)[:, :, None]
    glassy = np.float32([0.72, 0.85, 1.0])[None, None, :]
    refl = refl * fade * glassy

    # Specular glass: fine bright lines skating across the pavement.
    spec = (np.sin(xs * 0.006 + np.sin(ys * 0.02 + stage.t * 0.6) * 3.0
                   + stage.t * 0.3) ** 12)
    spec = spec * np.exp(-depth * 2.6) * 0.16
    refl += spec[:, :, None] * CRYSTAL

    band = np.clip((ys - hy) / 30.0, 0, 1)[:, :, None]     # horizon seam
    refl += (1.0 - band) ** 2 * np.float32([0.6, 0.75, 1.0]) * 0.22

    k = float(np.clip(intensity, 0, 1))
    stage.hdr[top:, :, :] = stage.hdr[top:, :, :] * (1.0 - k) + refl * k


# ---------------------------------------------------------------- prologue

def storm_sky(stage, unrest=1.0, gain=1.0):
    cloud_field(stage, base_gain=gain, lit=0.55, light_pos=(0.0, -0.06),
                tint_a=np.float32([0.075, 0.090, 0.150]),
                tint_b=np.float32([0.190, 0.210, 0.330]),
                speed=0.09, warp=0.6, scale=1.1)


DOOR_CY = -0.04
DOOR_HH = 0.40
DOOR_HW = 0.145


def _door_shape(wx, wy, openness, soft=0.010):
    """Soft mask of the arched doorway at this stage of opening."""
    hw = max(1e-4, DOOR_HW * ease(openness))
    u = (wy - (DOOR_CY - DOOR_HH)) / (2.0 * DOOR_HH)
    shoulder = 0.34
    k = np.clip((shoulder - u) / shoulder, 0.0, 1.0)
    halfw = hw * np.sqrt(np.clip(1.0 - k * k, 0.0, 1.0))
    halfw = np.where(u >= shoulder, hw, halfw)
    inside = np.clip((halfw - np.abs(wx)) / soft, 0.0, 1.0)
    inside *= np.clip(u / 0.012, 0.0, 1.0) * np.clip((1.0 - u) / 0.012, 0.0, 1.0)
    return inside, u


def portal(stage, openness, blaze=1.0, seam=0.0):
    """A door standing open in heaven, with the light pouring through it."""
    wx, wy = stage.world_grid()
    door, u = _door_shape(wx, wy, openness)

    # Inside the doorway: graded light, brightest high and centred.
    grad = (0.55 + 0.75 * np.clip(1.0 - u, 0, 1) ** 1.6)
    shimmer = 0.85 + 0.30 * fbm(NOISE_C, wx * 6.0, wy * 6.0, stage.t * 0.5,
                                octaves=2)
    inner = door * grad * shimmer
    rgb = (inner[:, :, None] * CRYSTAL * 1.35 * blaze
           + inner[:, :, None] * JASPER * 0.45 * blaze)

    # Spill: the sky around the door catches it.
    glow = fx.radial(wx, (wy - DOOR_CY) * 0.85, 0.0, 0.0,
                     0.10 + 0.34 * openness, 1.25)
    rgb += glow[:, :, None] * JASPER * 0.34 * blaze
    rgb += glow[:, :, None] * GOLD * 0.12 * blaze
    stage.add_low(rgb, 1.0)

    r = fx.rays(wx, wy, 0.0, DOOR_CY, NOISE_C, stage.t, count=9.0, spin=0.10,
                sharp=2.4, inner=0.10, reach=2.0)
    stage.add_low(r[:, :, None] * JASPER,
                  0.42 * blaze * (0.45 + 0.55 * openness))

    # Crisp rim, drawn at full resolution so the doorway keeps its edge.
    if openness > 0.02:
        im, d = layer()
        hw = DOOR_HW * ease(openness)
        pts = []
        for i in range(41):
            a = np.pi * i / 40.0
            pts.append((np.cos(a) * hw,
                        DOOR_CY - DOOR_HH + 0.34 * 2 * DOOR_HH
                        - np.sin(a) * 0.34 * 2 * DOOR_HH))
        pts = [(-hw, DOOR_CY + DOOR_HH)] + pts + [(hw, DOOR_CY + DOOR_HH)]
        d.line([stage.px(x, y) for x, y in pts], fill=255,
               width=max(1, int(2.4 * stage.zoom)), joint="curve")
        m = arr(im)
        stage.add_mask(blur(m, 0.8), WHITE, 3.2 * blaze)
        stage.add_mask(fx.glow_from(m, ((6, 0.5), (20, 0.3), (52, 0.2))),
                       JASPER, 0.5 * blaze)

    if seam > 0.01:                       # the first thread of light
        s = np.exp(-(wx / 0.008) ** 2) * np.clip(
            1.0 - np.abs(wy - DOOR_CY) / 0.60, 0, 1) ** 0.7
        stage.add_low(s[:, :, None] * CRYSTAL, 2.6 * seam)


def ascent(stage, speed, whiteout=0.0):
    """Taken up into the spirit realm: the rush through the open door."""
    wx, wy = stage.world_grid()
    d = np.sqrt(wx * wx + wy * wy) + 1e-3
    ang = np.arctan2(wy, wx)
    u = (ang / (2 * np.pi) + 0.5) * 60.0
    v = np.full_like(u, 0.5)
    streaks = fbm(NOISE_C, u, v + stage.t * 3.0, stage.t * 2.4, octaves=2)
    streaks = np.clip(streaks - 0.44, 0, None) ** 1.7 * 9.0
    radial_fall = np.clip(1.0 - np.exp(-d * 2.2), 0, 1) * np.exp(-d * 0.9)
    field = streaks * radial_fall * speed

    rgb = (field[:, :, None] * CRYSTAL * 0.75
           + field[:, :, None] * JASPER * 0.30
           + fx.radial(wx, wy, 0, 0, 0.11, 1.4)[:, :, None] * WHITE
           * 1.6 * speed)
    stage.add_low(rgb, 1.0)
    if whiteout > 0.001:
        stage.add(np.ones((H, W, 3), np.float32) * WHITE[None, None, :],
                  7.0 * whiteout)
