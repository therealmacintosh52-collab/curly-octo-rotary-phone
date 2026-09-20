"""Lay the piece end to end into a long, seamless loop.

A loop gives itself away at the join. Butting two copies together leaves a
hole where the reverb tail is cut off and the ambience restarts, and after
a few passes that click is all you hear. So each pass is crossfaded into
the next over the held silence at the end, and the whole thing ends where
it began.

  python3 loop.py                 # 90 minutes -> build/revelation-4-loop.mp3
  python3 loop.py --minutes 30
"""

import argparse
import os
import subprocess
import sys
import wave

import numpy as np

import dsp
from dsp import SR

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def read_wav(path):
    with wave.open(path, "rb") as w:
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2")
    x = x.astype(np.float64) / 32768.0
    return x.reshape(-1, ch) if ch > 1 else np.stack([x, x], axis=1)


def build_loop(master, minutes=90.0, overlap=6.0):
    """Repeat `master` with an equal-power crossfade at every join."""
    n = len(master)
    ov = min(int(overlap * SR), n // 4)
    step = n - ov                                  # each pass starts here
    passes = max(1, int(np.ceil((minutes * 60 * SR - ov) / step)))
    out = np.zeros((step * passes + ov, 2))

    # Equal power, so the sum holds its level across the join instead of
    # dipping the way a straight linear fade does.
    u = np.linspace(0.0, 1.0, ov)[:, None]
    fade_in, fade_out = np.sin(u * np.pi / 2) ** 1.0, np.cos(u * np.pi / 2) ** 1.0

    shaped = master.copy()
    head, tail = shaped[:ov].copy(), shaped[-ov:].copy()
    for p in range(passes):
        at = p * step
        piece = shaped.copy()
        if p > 0:
            piece[:ov] = head * fade_in
        if p < passes - 1:
            piece[-ov:] = tail * fade_out
        out[at:at + n] += piece
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=90.0)
    ap.add_argument("--bitrate", default="96k")
    ap.add_argument("--overlap", type=float, default=6.0)
    ap.add_argument("--out", default=os.path.join(BUILD,
                                                  "revelation-4-loop.mp3"))
    args = ap.parse_args()

    master = read_wav(os.path.join(BUILD, "master.wav"))
    once = len(master) / SR
    out = build_loop(master, args.minutes, args.overlap)
    peak = np.max(np.abs(out))
    if peak > 0.94:
        out *= 0.94 / peak

    raw = os.path.join(BUILD, "loop.wav")
    with wave.open(raw, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw,
                    "-c:a", "libmp3lame", "-b:a", args.bitrate, args.out],
                   check=True)
    os.remove(raw)
    total = len(out) / SR
    passes = int(round((total - args.overlap) / (once - args.overlap)))
    size_mb = os.path.getsize(args.out) / 1e6
    print(f"one pass {once / 60:.2f} min  x{passes} -> {total / 60:.1f} min"
          f"  {args.out}  ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
