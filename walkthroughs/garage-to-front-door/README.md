# Garage to Front Door

A property walkthrough built from `source/IMG_0247.mp4` — a handheld take through
the garage, hall, living area and front entry.

| Output | File |
| --- | --- |
| The page | `public/index.html` — scroll scrubs the film, a plan tracks the route, each space carries its own copy. One self-contained file; the video is inlined as a data URI. |
| The film | `public/walkthrough-clean.mp4` — 15.8 s, 608×1080, cut, stabilised, slowed and graded. Usable on its own. |

## What was wrong with the raw take, and what was done about it

The 15.98 s original has three problems in one passage:

| Problem | Where, in the original |
| --- | --- |
| Operator's shadow across the door | from ~4.0 s |
| A hand reaching into frame | 6.20 s – 6.55 s |
| Auto-exposure crashing to near-black | ~6.6 s – 7.4 s |

All three sit between 3.8 s and 7.45 s, so **that passage is cut out and dissolved
across** — the way an editor handles it, rather than trying to paint the hand out
frame by frame. The 0.6 s dissolve reads as walking through the doorway. What is
lost is the close-up of the door; what is gained is a clip with no operator in it.

Then, on the whole thing:

- **Stabilised** — `deshake`, with a 5% crop to trim the smeared edge it leaves.
- **Slowed to 0.74×** and re-interpolated to 30 fps with `minterpolate` (motion
  compensated), which is what turns a walking pace into a glide.
- **Graded** — the black point pulled down to cut the window haze, mid contrast
  and saturation up, warmed to ~5300 K, denoised then lightly sharpened.
- **Eased** in and out of black.

### What could not be fixed

- **The blown-out slider and windows are gone for good.** Those pixels are pure
  white in the source; there is nothing to recover. The grade only stops them
  looking like a fault.
- **Softness and motion blur** in the middle of the take are baked in. Slowing
  the clip hides some of it; sharpening cannot invent detail.
- The two rooms off the hall are never entered, so the plan marks them but says
  nothing about them.

A re-shoot at half this walking pace, with exposure locked before entering the
hall, would beat any amount of post — and both builders would take the new file
unchanged.

## Privacy

The source clip carries **GPS coordinates** in its metadata. Every derived file is
written with `-map_metadata -1`, so nothing published contains them. The original
in `source/` still does.

## The spaces

Boundaries live in `tools/stations.json`, written by `build_clean.py` and read by
`build_page.py`, so the two never drift. Times are on the finished film.

| # | In | Space |
| --- | --- | --- |
| 01 | 00.0 s | Garage |
| 02 | 04.3 s | Hall |
| 03 | 09.7 s | Living area |
| 04 | 14.0 s | Front entry |

## Rebuilding

```sh
pip install imageio-ffmpeg          # only if ffmpeg isn't already on PATH
python3 tools/build_clean.py        # -> public/walkthrough-clean.mp4 + tools/stations.json
python3 tools/build_page.py         # -> public/index.html
```

`build_clean.py` takes about 2.5 minutes, nearly all of it in `minterpolate`.
The cut points, slowdown factor and grade are constants at the top of that file.
Page copy and layout live in `tools/template.html`.

## The plan drawing

Authored once in a 440 × 300 space and drawn twice — small under the film, large
in the closing panel. It is **traced from the take, not measured**: proportions
are approximate.
