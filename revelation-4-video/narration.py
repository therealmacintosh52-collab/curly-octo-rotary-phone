"""Synthesise the narration and write build/narration.wav + build/timeline.json.

The timeline is the single source of truth for the visuals: every scene is cut
against the real, measured length of the spoken lines.

This is made to be listened to for an hour and a half on repeat, so the
processing is deliberately light. Heavy compression, saturation and doubling
all read as "machine" within a few passes, and what sounds impressive once
becomes unbearable on the twentieth loop. The voice is left close to how the
model actually speaks; the weight comes from pace and from silence.
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
VOICE_MODEL = os.path.join(VOICE_DIR, "voice-en-us-libritts-high",
                           "en-us-libritts-high.onnx")
# LibriTTS is multi-speaker; 538 is a man whose voice actually sits near
# 100 Hz, so the depth is his and not an effect laid over someone lighter.
SPEAKER = 538

# Delivery per voice.
#
# `length` stays near 1.2: past about 1.3 this model holds its vowels and
# the reading starts to sound dragged rather than slow. The slowness that
# matters lives in the gaps between lines, not inside the words.
#
# `noise` and `noise_w` are kept high on purpose. They are what vary the
# pitch and the length of each phoneme, and a voice with that variation
# turned down is exactly what a robot sounds like.
STYLE = {
    # John recounting the vision.
    "narrator": dict(length=1.20, noise=0.62, noise_w=0.80, semis=0.0,
                     rt60=2.2, wet=0.15, layers=1, drive=0.08),
    # The trumpet-voice out of the open door: slower, a shade lower, and
    # given more room than the narration -- but not a cathedral.
    "throne": dict(length=1.30, noise=0.55, noise_w=0.72, semis=-1.2,
                   rt60=3.6, wet=0.30, layers=2, drive=0.12),
    # Sung by the living creatures and the elders: many voices as one.
    "worship": dict(length=1.24, noise=0.58, noise_w=0.76, semis=-0.6,
                    rt60=3.4, wet=0.22, layers=3, drive=0.08),
}


# NOTE: this model's duration predictor is stochastic and ONNX gives no seed
# to pin, so line lengths move a little between runs. Build the narration
# once and render the picture against the timeline it writes -- re-running
# this after a render will put the two out of step.


def synth_raw(voice, text, style):
    from piper import SynthesisConfig

    cfg = SynthesisConfig(length_scale=style["length"],
                          noise_scale=style["noise"],
                          noise_w_scale=style["noise_w"],
                          speaker_id=SPEAKER,
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


def trim(x, thresh=2e-3, pad=0.06):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    y = x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]
    return dsp.fade(y, 0.012, 0.045)      # no clicks at the joins


def voice_eq(x):
    """A light touch: clear the rumble and the boxiness, and little else."""
    x = dsp.filt(x, "highpass", 68.0, 0.7)
    x = dsp.filt(x, "lowshelf", 150.0, 0.7, 1.6)     # a little chest
    x = dsp.filt(x, "peak", 430.0, 1.0, -2.0)        # clear the boxiness
    x = dsp.filt(x, "peak", 2600.0, 0.8, 1.1)        # just enough presence
    x = dsp.filt(x, "peak", 5600.0, 1.4, -1.8)       # the edge that tires
    x = dsp.filt(x, "highshelf", 10000.0, 0.7, -1.0)
    return x


def soften(x, drive=0.08):
    """A trace of harmonic warmth. More than this and it starts to buzz."""
    if drive <= 0:
        return x
    hot = np.tanh(dsp.filt(x, "lowpass", 2200.0, 0.7) * 2.2) * 0.45
    return x * (1.0 - 0.15 * drive) + hot * drive


def dry_line(voice, text, style):
    """One utterance, synthesised and lightly shaped."""
    base = trim(synth_raw(voice, text, style))
    if style["semis"]:
        base = dsp.pitch_down(base, style["semis"])
    base = voice_eq(base)
    base = soften(base, style["drive"])
    # Gentle and slow: enough to even the line out, not enough to hear.
    base = dsp.compress(base, thresh_db=-20.0, ratio=2.4, attack=0.020,
                        release=0.34, makeup_db=1.6)

    # Layered voices read as a multitude. The offsets stay short and the
    # copies are rolled off hard: a detuned copy 30ms behind the lead
    # doubles every consonant, which turns a sung line to mush. All the
    # articulation comes from the lead; the layers only add body.
    if style["layers"] > 1:
        acc, weight = base.copy(), 1.0
        offsets = [(-0.11, 0.009, 0.26), (0.09, 0.016, 0.21)]
        for i in range(style["layers"] - 1):
            semi, delay, gain = offsets[i % len(offsets)]
            lay = dsp.pitch_down(base, semi)
            lay = dsp.filt(lay, "lowpass", 1900.0, 0.7)
            buf = np.zeros(max(len(acc), len(lay) + int(delay * SR)))
            dsp.add_at(buf, lay * gain, int(delay * SR))
            acc = dsp.pad_to(acc, len(buf)) + buf
            weight += gain
        base = acc / weight               # keep the level, not just the size
    return base


def dry_beat(voice, beat):
    """The whole beat, dry, plus where each spoken piece begins."""
    style = STYLE[beat["voice"]]
    offsets = []
    if beat.get("parts"):
        pieces = [(dry_line(voice, text, style), gap)
                  for text, gap in beat["parts"]]
        total = sum(len(p) + int(g * SR) for p, g in pieces)
        base = np.zeros(total)
        at = 0
        for piece, gap in pieces:
            offsets.append(round(at / SR, 3))
            dsp.add_at(base, piece, at)
            at += len(piece) + int(gap * SR)
    else:
        base = dry_line(voice, beat["say"], style)
    return base, offsets


def main():
    os.makedirs(BUILD, exist_ok=True)
    from piper import PiperVoice

    print("loading voice:", VOICE_MODEL)
    voice = PiperVoice.load(VOICE_MODEL)

    dry = []
    for beat in BEATS:
        base, offsets = dry_beat(voice, beat)
        dry.append((beat, base, offsets))
        print(f"  {beat['id']:<10} {len(base) / SR:6.2f}s")

    # One gain for the whole reading rather than one per line. Normalising
    # each line separately flattens the natural rise and fall between them,
    # and that evenness is a good part of what sounds mechanical.
    peak = max(np.max(np.abs(b)) for _, b, _ in dry) + 1e-9
    gain = 0.80 / peak

    total = LEAD_IN + sum(len(b) / SR + bt["gap"] for bt, b, _ in dry) + TAIL
    master = np.zeros(int(total * SR) + SR * 8)

    events, t = [], LEAD_IN
    for beat, base, offsets in dry:
        style = STYLE[beat["voice"]]
        ir = dsp.impulse_response(rt60=style["rt60"], size=1.0, damping=0.6,
                                  seed=abs(hash(beat["id"])) % 1000)
        wet = dsp.reverb(base * gain, ir, wet=style["wet"])
        dsp.add_at(master, wet, int(t * SR))
        n = len(base)
        events.append(dict(id=beat["id"], text=beat["text"],
                           voice=beat["voice"], start=round(t, 3),
                           end=round(t + n / SR, 3),
                           gap=beat["gap"], parts=offsets))
        t += n / SR + beat["gap"]
    speech_end = t
    duration = speech_end + TAIL

    master = master[: int(duration * SR)]
    master = dsp.normalize(master, 0.84)

    # Per-frame loudness envelope so the light can breathe with the voice.
    fps = 30
    frames = int(np.ceil(duration * fps))
    env = dsp.envelope(master, attack=0.02, release=0.22)
    idx = np.clip((np.arange(frames) / fps * SR).astype(int), 0, len(env) - 1)
    venv = env[idx]
    venv = venv / (np.percentile(venv, 99) + 1e-9)

    left, right = dsp.widen(master, 0.007)
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
