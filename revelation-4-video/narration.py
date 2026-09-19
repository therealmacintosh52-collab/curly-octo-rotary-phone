"""Synthesise the narration and write build/narration.wav + build/timeline.json.

The timeline is the single source of truth for the visuals: every scene is cut
against the real, measured length of the spoken lines.
"""

import io
import json
import os
import sys
import wave

import numpy as np

import dsp
from dsp import SR
from script_text import BEATS, CREDIT, LEAD_IN, TAIL

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
VOICE_DIR = os.environ.get(
    "PIPER_VOICE_DIR",
    "/tmp/claude-0/-home-user-curly-octo-rotary-phone/"
    "95ecc93b-21f3-503b-89d8-1426cc1fb6f2/scratchpad/voices",
)
VOICE_MODEL = os.path.join(VOICE_DIR, "voice-en-us-ryan-high",
                           "en-us-ryan-high.onnx")

# Delivery per voice: how the raw TTS is slowed, dropped and placed in space.
STYLE = {
    # John recounting the vision: unhurried, chest-weighted, a room around it.
    "narrator": dict(length=0.99, noise=0.50, noise_w=0.70, semis=-2.2,
                     rt60=2.4, wet=0.30, layers=1),
    # The trumpet-voice out of the open door: slower, deeper, vast.
    "throne": dict(length=1.06, noise=0.42, noise_w=0.60, semis=-4.6,
                   rt60=5.2, wet=0.52, layers=2),
    # Sung by the living creatures and the elders: many voices as one.
    "worship": dict(length=1.05, noise=0.48, noise_w=0.68, semis=-3.0,
                    rt60=5.8, wet=0.46, layers=3),
}


def synth_raw(voice, text, style):
    from piper import SynthesisConfig

    cfg = SynthesisConfig(length_scale=style["length"],
                          noise_scale=style["noise"],
                          noise_w_scale=style["noise_w"],
                          normalize_audio=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=cfg)
    buf.seek(0)
    with wave.open(buf, "rb") as w:
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    if rate != SR:
        x = dsp.resample_rate(x, SR / rate)
    return x


def trim(x, thresh=2e-3, pad=0.04):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]


def voice_eq(x):
    x = dsp.filt(x, "highpass", 78.0, 0.7)
    x = dsp.filt(x, "lowshelf", 165.0, 0.7, 2.6)     # chest / authority
    x = dsp.filt(x, "peak", 420.0, 1.1, -2.4)        # clear the boxiness
    x = dsp.filt(x, "peak", 2900.0, 0.9, 2.6)        # presence, consonants
    x = dsp.filt(x, "highshelf", 9000.0, 0.7, 1.4)   # air
    return x


def render_beat(voice, beat):
    """Return (dry_audio, wet_audio_with_tail) for one spoken line."""
    style = STYLE[beat["voice"]]
    base = trim(synth_raw(voice, beat["say"], style))
    base = dsp.pitch_down(base, style["semis"])
    base = voice_eq(base)
    base = dsp.compress(base, thresh_db=-21.0, ratio=3.6, makeup_db=3.4)
    base = dsp.normalize(base, 0.82)

    n = len(base)
    # Layered voices: detuned, slightly offset copies read as a multitude.
    if style["layers"] > 1:
        acc = base.copy()
        offsets = [(-0.16, 0.030, 0.42), (0.13, -0.055, 0.36)]
        for i in range(style["layers"] - 1):
            semi, delay, gain = offsets[i % len(offsets)]
            lay = dsp.pitch_down(base, semi)
            lay = dsp.filt(lay, "lowpass", 5200.0, 0.7)
            buf = np.zeros(max(n, len(lay) + int(abs(delay) * SR)) + SR // 2)
            dsp.add_at(buf, lay * gain, int(max(0.0, delay) * SR))
            acc = dsp.pad_to(acc, len(buf))
            acc += buf
        base = dsp.normalize(acc, 0.86)
        n = len(base)

    ir = dsp.impulse_response(rt60=style["rt60"], size=1.0, damping=0.55,
                              seed=abs(hash(beat["id"])) % 1000)
    wet = dsp.reverb(base, ir, wet=style["wet"])
    return n, wet


def main():
    os.makedirs(BUILD, exist_ok=True)
    from piper import PiperVoice

    print("loading voice:", VOICE_MODEL)
    voice = PiperVoice.load(VOICE_MODEL)

    rendered = []
    for beat in BEATS:
        n, wet = render_beat(voice, beat)
        rendered.append((beat, n, wet))
        print(f"  {beat['id']:<10} {n / SR:6.2f}s")

    total = LEAD_IN + sum(n / SR + b["gap"] for b, n, _ in rendered) + TAIL
    master = np.zeros(int(total * SR) + SR * 8)

    events, t = [], LEAD_IN
    for beat, n, wet in rendered:
        dsp.add_at(master, wet, int(t * SR))
        events.append(dict(id=beat["id"], text=beat["text"],
                           voice=beat["voice"], start=round(t, 3),
                           end=round(t + n / SR, 3),
                           gap=beat["gap"]))
        t += n / SR + beat["gap"]
    speech_end = t
    duration = speech_end + TAIL

    master = master[: int(duration * SR)]
    master = dsp.limit(dsp.normalize(master, 0.88))

    # Per-frame loudness envelope so the light can breathe with the voice.
    fps = 30
    frames = int(np.ceil(duration * fps))
    env = dsp.envelope(master, attack=0.02, release=0.22)
    idx = np.clip((np.arange(frames) / fps * SR).astype(int), 0, len(env) - 1)
    venv = env[idx]
    venv = venv / (np.percentile(venv, 99) + 1e-9)

    left, right = dsp.widen(master, 0.009)
    out = dsp.stereo(left, right)
    path = os.path.join(BUILD, "narration.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())

    tl = dict(fps=fps, duration=round(duration, 3),
              lead_in=LEAD_IN, speech_end=round(speech_end, 3),
              credit=CREDIT, events=events,
              voice_env=[round(float(v), 4) for v in venv])
    with open(os.path.join(BUILD, "timeline.json"), "w") as f:
        json.dump(tl, f, indent=1)

    print(f"\nnarration: {duration:.2f}s -> {path}")
    print(f"frames at {fps}fps: {frames}")


if __name__ == "__main__":
    sys.exit(main())
