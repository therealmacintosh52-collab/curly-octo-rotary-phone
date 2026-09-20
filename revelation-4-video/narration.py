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
VOICE_MODEL = os.path.join(VOICE_DIR, "voice-en-us-libritts-high",
                           "en-us-libritts-high.onnx")
# LibriTTS is multi-speaker; 538 is a man whose voice actually sits near
# 98 Hz, so the depth is his and not an effect laid over someone lighter.
SPEAKER = 538

# Delivery per voice: how the raw TTS is slowed, dropped and placed in space.
# Pace note: the pitch drop is done by resampling, so it lengthens the line
# too. Most of the slowing is done that way on purpose: resampling stretches
# a line without the smeared vowels a big length_scale gives you.
STYLE = {
    # John recounting the vision. No pitch shifting at all -- resampling a
    # voice down drags its formants with it, and that is what makes a
    # reading sound processed instead of deep.
    "narrator": dict(length=1.38, noise=0.38, noise_w=0.52, semis=0.0,
                     rt60=2.1, wet=0.16, layers=1, drive=0.28, double=0.18),
    # The trumpet-voice out of the open door: slower, a shade lower, and
    # given more room than the narration -- but not a cathedral.
    "throne": dict(length=1.50, noise=0.32, noise_w=0.44, semis=-1.2,
                   rt60=4.0, wet=0.33, layers=2, drive=0.34, double=0.0),
    # Sung by the living creatures and the elders: many voices as one, and
    # the slowest thing in the film. "Holy, holy, holy ... the Was, the Is,
    # and the Coming" is sung without ceasing, not recited.
    "worship": dict(length=1.40, noise=0.36, noise_w=0.46, semis=-0.6,
                    rt60=3.4, wet=0.21, layers=3, drive=0.24, double=0.0),
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


def trim(x, thresh=2e-3, pad=0.04):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]


def voice_eq(x):
    x = dsp.filt(x, "highpass", 62.0, 0.7)
    x = dsp.filt(x, "peak", 105.0, 1.2, 1.0)         # the floor of the voice
    x = dsp.filt(x, "lowshelf", 155.0, 0.7, 2.8)     # chest / authority
    x = dsp.filt(x, "peak", 430.0, 1.1, -2.8)        # clear the boxiness
    x = dsp.filt(x, "peak", 2700.0, 0.9, 3.0)        # presence, consonants
    x = dsp.filt(x, "peak", 6200.0, 1.6, -1.6)       # take the edge off
    x = dsp.filt(x, "highshelf", 9500.0, 0.7, 0.6)   # a little air, no hiss
    return x


def saturate(x, drive=0.3):
    """Parallel harmonic drive: density, which the ear hears as power."""
    if drive <= 0:
        return x
    hot = np.tanh(dsp.filt(x, "lowpass", 2400.0, 0.7) * 3.2) * 0.45
    return x * (1.0 - 0.25 * drive) + hot * drive


def parallel_compress(x, amount=0.45):
    """Crushed copy tucked under the dry: it never lets the line go slack."""
    crushed = dsp.compress(x, thresh_db=-34.0, ratio=8.0, attack=0.004,
                           release=0.26, makeup_db=9.0)
    crushed = dsp.filt(crushed, "lowpass", 5200.0, 0.7)
    return x + crushed * amount


def dry_line(voice, text, style):
    """One utterance, synthesised and shaped, before any room is added."""
    base = trim(synth_raw(voice, text, style))
    if style["semis"]:
        base = dsp.pitch_down(base, style["semis"])
    base = voice_eq(base)
    base = saturate(base, style["drive"])
    # Slow attack so the consonants still land before the gain moves.
    base = dsp.compress(base, thresh_db=-25.0, ratio=5.0, attack=0.014,
                        release=0.30, makeup_db=5.4)
    base = parallel_compress(base, 0.55)
    base = dsp.normalize(base, 0.88)

    # A close double thickens the narrator without reading as an effect.
    if style["double"] > 0.0:
        dbl = dsp.pitch_down(base, -0.14)
        dbl = dsp.filt(dbl, "lowpass", 4200.0, 0.7)
        buf = np.zeros(max(len(base), len(dbl)) + SR // 4)
        dsp.add_at(buf, base, 0)
        dsp.add_at(buf, dbl * style["double"], int(0.019 * SR))
        base = dsp.normalize(buf, 0.90)

    n = len(base)
    # Layered voices read as a multitude. The offsets stay short and the
    # copies are rolled off hard: a detuned copy 30ms behind the lead
    # doubles every consonant, which is what turns a sung line to mush.
    # All the articulation comes from the lead; the layers only add body.
    if style["layers"] > 1:
        acc = base.copy()
        offsets = [(-0.11, 0.009, 0.26), (0.09, 0.016, 0.21)]
        for i in range(style["layers"] - 1):
            semi, delay, gain = offsets[i % len(offsets)]
            lay = dsp.pitch_down(base, semi)
            lay = dsp.filt(lay, "lowpass", 1900.0, 0.7)
            buf = np.zeros(max(n, len(lay) + int(abs(delay) * SR)) + SR // 2)
            dsp.add_at(buf, lay * gain, int(max(0.0, delay) * SR))
            acc = dsp.pad_to(acc, len(buf))
            acc += buf
        base = dsp.normalize(acc, 0.92)
        n = len(base)

    return base


def render_beat(voice, beat):
    """Return (dry_length, wet_audio_with_tail) for one spoken line.

    A beat carrying `parts` is spoken in pieces with silence between them.
    That is how the worship lines are slowed: by leaving air around the
    words rather than by drawing the words themselves out, which only
    smears them.
    """
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
    n = len(base)

    ir = dsp.impulse_response(rt60=style["rt60"], size=1.0, damping=0.55,
                              seed=abs(hash(beat["id"])) % 1000)
    wet = dsp.reverb(base, ir, wet=style["wet"])
    return n, wet, offsets


def main():
    os.makedirs(BUILD, exist_ok=True)
    from piper import PiperVoice

    print("loading voice:", VOICE_MODEL)
    voice = PiperVoice.load(VOICE_MODEL)

    rendered = []
    for beat in BEATS:
        n, wet, offsets = render_beat(voice, beat)
        rendered.append((beat, n, wet, offsets))
        print(f"  {beat['id']:<10} {n / SR:6.2f}s")

    total = LEAD_IN + sum(n / SR + b["gap"] for b, n, _, _ in rendered) + TAIL
    master = np.zeros(int(total * SR) + SR * 8)

    events, t = [], LEAD_IN
    for beat, n, wet, offsets in rendered:
        dsp.add_at(master, wet, int(t * SR))
        events.append(dict(id=beat["id"], text=beat["text"],
                           voice=beat["voice"], start=round(t, 3),
                           end=round(t + n / SR, 3),
                           gap=beat["gap"], parts=offsets))
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
