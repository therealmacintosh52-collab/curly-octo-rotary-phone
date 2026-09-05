# Hall to Front Door

A walkthrough built from `source/IMG_0247.mp4` — hall, living area, front entry.

| Output | File |
| --- | --- |
| The page | `public/index.html` — scroll scrubs the film, a plan tracks the route, each room carries its own copy. One self-contained file; the video is inlined as a data URI. |
| The film | `public/walkthrough-clean.mp4` — 11.4 s, 608×1080, cut, stabilised, slowed and graded. Usable on its own. |

## Why the take starts where it does

The original opens in the garage and walks in. Everything wrong with it is in that
first eight seconds:

| Problem | Where, in the original |
| --- | --- |
| Clutter — totes, boxes, folding table, loose extinguisher, floor mats | 0.0 – 3.8 s |
| Operator's shadow across the door | from ~4.0 s |
| A hand reaching into frame | 6.20 – 6.55 s |
| Auto-exposure crashing to near-black | ~6.6 – 7.4 s |

So the master **starts at 8.60 s**, once the camera is clear of the doorway and the
exposure has settled. Nothing before that survives. What is left is three rooms
that were already close to empty.

This is a cut, not a repair. Removing that clutter *in* the footage would need
video inpainting, and a stacked storage wall shot handheld with parallax is
exactly where video inpainting smears. Twenty minutes of moving boxes before the
next shoot beats any amount of post.

## What was done to the remaining footage

- **Stabilised** — `deshake`, with a 5% crop to trim the smeared edge it leaves.
- **Slowed to 0.65×** and re-interpolated to 30 fps with `minterpolate` (motion
  compensated). This is what turns a walking pace into a glide.
- **Graded** — black point pulled down to cut the window haze, mid contrast and
  saturation up, warmed to ~5300 K, denoised then lightly sharpened.
- **Floor falloff** — a gentle shadow across the bottom edge (`FALLOFF_*` in the
  builder) that sinks the small things left on the floor near the front door.
  Deliberately subtle: the plank floor is a feature, and darkening it to hide
  clutter costs more than it saves.
- **No fades to black.** The page rests the film at `t=0` and at `t=DUR` while
  scrubbing, so a faded frame at either end shows as a black panel.

### What is still visible, and cannot be fixed here

- **The extension cord.** It runs at wall height through the hall and the living
  area. A floor gradient does nothing for it and it moves with parallax, so a
  static mask will not track it. Unplug and coil it before any re-shoot.
- **The blown-out slider and windows.** Those pixels are pure white in the
  source; there is nothing to recover. The grade only stops them reading as a
  fault.
- **Softness and motion blur** are baked in. Slowing hides some of it;
  sharpening cannot invent detail.
- The two rooms off the hall are never entered, so the plan marks them but says
  nothing about them.

## Privacy

The source clip carries **GPS coordinates** in its metadata. Every derived file is
written with `-map_metadata -1`, so nothing published contains them. The original
in `source/` still does.

## The rooms

Boundaries live in `tools/stations.json`, written by `build_clean.py` and read by
`build_page.py`, so the two cannot drift. Times are on the finished film.

| # | In | Room |
| --- | --- | --- |
| 01 | 00.0 s | Hall |
| 02 | 04.3 s | Living area |
| 03 | 09.3 s | Front entry |

## Rebuilding

```sh
pip install Pillow imageio-ffmpeg     # imageio-ffmpeg only if ffmpeg isn't on PATH
python3 tools/build_clean.py          # ~2 min -> public/walkthrough-clean.mp4 + stations.json
python3 tools/build_page.py           # -> public/index.html
```

Nearly all of `build_clean.py`'s runtime is `minterpolate`. The in and out points,
the slowdown factor, the grade and the falloff are constants at the top of that
file. Page copy and layout live in `tools/template.html`.

## The plan drawing

Authored once in a 440 × 300 space and drawn twice — small under the film, large
in the closing panel. The garage is drawn faint: it is attached, but the walk no
longer covers it. **Traced from the take, not measured** — proportions are
approximate.
