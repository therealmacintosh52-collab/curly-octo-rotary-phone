#!/usr/bin/env python3
"""Re-encode the owner's hero frames into build/cache/hero (run by build.py when the cache is missing).
Source: 916-dent-detail/public/hero/{m,d}/NNN.webp (121 frames each). Output:
  poster-{m,d}.avif/.webp   frame 0 (dented), 720 wide
  static-{m,d}.avif/.webp   frame 120 (clean, beaded), 720 wide
  {m,d}/fNN.avif            31 scrub frames (every 4th), 540 wide, AVIF
"""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent.parent / "916-dent-detail" / "public" / "hero"
OUT = ROOT / "build" / "cache" / "hero"

def enc(im, path, fmt, q):
    if fmt == "avif":
        im.save(path, "AVIF", quality=q, speed=4)
    else:
        im.save(path, "WEBP", quality=q, method=6)

def main(force=False):
    if OUT.exists() and not force and any(OUT.iterdir()):
        return
    (OUT / "m").mkdir(parents=True, exist_ok=True)
    (OUT / "d").mkdir(parents=True, exist_ok=True)
    for k in ("m", "d"):
        for name, idx in (("poster", 0), ("static", 120)):
            im = Image.open(SRC / k / f"{idx:03d}.webp").convert("RGB")
            enc(im, OUT / f"{name}-{k}.avif", "avif", 45)
            enc(im, OUT / f"{name}-{k}.webp", "webp", 70)
        for n, idx in enumerate(range(0, 121, 4)):
            im = Image.open(SRC / k / f"{idx:03d}.webp").convert("RGB")
            w = 540
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            enc(im, OUT / k / f"f{n:02d}.avif", "avif", 38)
    for k in ("m", "d"):
        tot = sum(p.stat().st_size for p in (OUT / k).glob("f*.avif"))
        print(k, "scrub total KB", round(tot / 1024))

if __name__ == "__main__":
    main("--force" in sys.argv)
