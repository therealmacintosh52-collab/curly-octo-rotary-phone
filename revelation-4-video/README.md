# Revelation 4 — a spoken-vision film

A 2:07 film of Revelation 4:1–11 (The Passion Translation): the text read
aloud with authority over a vision built only from what the chapter itself
describes.

Everything here is generated — no stock footage, no sample libraries, no
image models. The picture is drawn per-frame with numpy and PIL; the voice is
a local neural TTS model shaped by a hand-built DSP chain; the score is
synthesized from oscillators and noise. The audio timings drive the cut, so
picture and word never drift.

## What is on screen, and where it comes from

| Beat | Verse | Image |
|---|---|---|
| Storm, then a seam of light | v1 | a door standing open in heaven |
| The blazing doorway | v1 | the trumpet-voice: "Ascend into this realm" |
| Rush through the door | v2 | taken into the spirit realm |
| Throne of light, One seated | v2–3 | jasper crystal and carnelian fire, no form given |
| A green circle around the throne | v3 | the emerald rainbow |
| Twenty-four seats, white figures, gold crowns | v4 | the elders |
| Bolts out of the throne, expanding rings | v5 | lightning, thunder and voices |
| Seven flames before the throne | v5 | the seven Spirits of God |
| Mirrored pavement | v6 | the crystal sea of glass |
| Four winged silhouettes, full of eyes | v6–8 | lion, ox, human face, eagle |
| Three great swells of light | v8 | "Holy, holy, holy" |
| The figures bow, crowns arc to the foot of the throne | v10 | crowns surrendered |
| Full blaze, then dark | v11 | "You are worthy" |

The One on the throne is never given a face or a body — only light, as the
chapter itself leaves it.

## Build

Needs `ffmpeg`, and Python with `numpy scipy pillow piper-tts`, plus a piper
voice at `$PIPER_VOICE_DIR/voice-en-us-ryan-high/`.

```bash
python3 narration.py    # TTS + DSP  -> build/narration.wav, build/timeline.json
python3 score.py        # synth score -> build/score.wav
python3 render.py       # 1080p30     -> build/video.mp4    (~20 min, 4 cores)
python3 mix.py          # mix + mux   -> revelation-4.mp4
```

Useful while working:

```bash
python3 render.py --probe 47.8 84.0    # single frames to build/probe/
python3 render.py --preview            # 720p, every other frame
python3 render.py --range 80 90        # just that stretch
```

## Files

- `script_text.py` — the passage, split into beats, each with its delivery
- `narration.py` — synthesis, pitch/EQ/compression/hall, layered voices for
  the sung lines; writes the timeline everything else is cut to
- `dsp.py` — biquads, convolution reverb, compressor, stereo widening
- `score.py` — drones, pads, choir, bells, thunder, risers, shimmer
- `scenes.py` — every element of the vision, drawn in HDR linear light
- `fx.py` — noise, bloom, anamorphic streak, ACES tonemap, grain, grade
- `render.py` — timeline, camera, subtitles, frame pipeline, encode
- `mix.py` — final mix and mux

## Note on the text

The words are The Passion Translation, quoted on screen and credited. That
translation is under copyright; this cut is a personal devotional piece. If
it is going anywhere public, check the publisher's permissions policy for
quoting a full chapter first.
