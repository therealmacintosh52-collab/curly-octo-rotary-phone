"""Fold the narration and the score into one master, then mux with the video."""

import os
import subprocess
import sys
import wave

import numpy as np

import dsp
from dsp import SR, filt

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == SR, path
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2")
    x = x.astype(np.float64) / 32768.0
    return x.reshape(-1, ch) if ch > 1 else np.stack([x, x], axis=1)


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def stale(video, audio_seconds, tol=0.5):
    """True if the rendered picture does not match this audio's length.

    The two only line up when the picture was rendered from the same
    timeline, so this is a cheap guard against muxing an old render onto a
    new reading and shipping something that drifts.
    """
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", video], capture_output=True, text=True,
            check=True).stdout.strip()
        return abs(float(out) - audio_seconds) > tol
    except Exception:
        return True


def main():
    voice = read_wav(os.path.join(BUILD, "narration.wav"))
    music = read_wav(os.path.join(BUILD, "score.wav"))
    fx_path = os.path.join(BUILD, "sfx.wav")
    effects = read_wav(fx_path) if os.path.exists(fx_path) else voice * 0.0
    n = max(len(voice), len(music), len(effects))
    voice = np.stack([dsp.pad_to(voice[:, c], n) for c in range(2)], axis=1)
    music = np.stack([dsp.pad_to(music[:, c], n) for c in range(2)], axis=1)
    effects = np.stack([dsp.pad_to(effects[:, c], n) for c in range(2)], axis=1)

    # Carve a little room for the voice in the score's midrange, and keep the
    # effects out of the way of the consonants.
    for c in range(2):
        music[:, c] = filt(music[:, c], "peak", 1900.0, 1.1, -2.6)
        effects[:, c] = filt(effects[:, c], "peak", 2600.0, 1.0, -2.0)

    # Effects sit under the reading, not beside it: duck them with the voice.
    venv = np.abs(voice).max(axis=1)
    venv = filt(dsp.envelope(venv, attack=0.02, release=0.35), "lowpass",
                3.0, 0.7)
    venv = np.clip(venv / (np.percentile(venv, 99) + 1e-9), 0, 1)
    duck = dsp.db(-5.0 * venv ** 0.7)[:, None]
    effects = effects * duck

    mix = voice * 0.98 + music * 0.46 + effects * 0.42
    for c in range(2):
        mix[:, c] = filt(mix[:, c], "highpass", 30.0, 0.7)
        mix[:, c] = dsp.compress(mix[:, c], thresh_db=-17.0, ratio=2.4,
                                 attack=0.012, release=0.28, makeup_db=2.6)
        mix[:, c] = dsp.limit(mix[:, c], 0.95)

    peak = np.max(np.abs(mix))
    mix *= 0.95 / (peak + 1e-9)
    out = os.path.join(BUILD, "master.wav")
    write_wav(out, mix)
    rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)
    print(f"master: {len(mix) / SR:.1f}s  peak {20 * np.log10(peak):.1f} dBFS"
          f" -> {rms:.1f} dB RMS  {out}")

    video = os.path.join(BUILD, "video.mp4")
    final = os.path.join(HERE, "revelation-4.mp4")
    if os.path.exists(video) and not stale(video, len(mix) / SR):
        # The grain is expensive to store; re-encode for delivery with the
        # adaptive quantiser leaning on the flat, dark areas.
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", video, "-i", out,
               "-c:v", "libx264", "-preset", "slow", "-crf", "20",
               "-x264-params", "aq-mode=3:aq-strength=0.9:psy-rd=1.0,0.15",
               "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "224k",
               "-movflags", "+faststart", "-shortest", final]
        subprocess.run(cmd, check=True)
        size = os.path.getsize(final) / 1e6
        print(f"muxed -> {final}  ({size:.1f} MB)")
    elif os.path.exists(video):
        print("picture is cut to a different length than this audio; "
              "re-render before muxing. Audio master written.")
    else:
        print("no video yet; audio master written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
