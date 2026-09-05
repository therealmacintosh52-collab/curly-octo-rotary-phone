# Garage to Front Door

An animated walkthrough built from `source/IMG_0247.mp4` — a 15.98 s handheld
take, one continuous shot, from the garage bay through the utility door and down
the hall to the front entry.

Two outputs, both generated from the same station data:

| Output | File | What it is |
| --- | --- | --- |
| Interactive page | `public/index.html` | Scroll scrubs the footage. A schematic plan tracks the camera along the route, the HUD reads out timecode and current station, and each station carries its observation notes. One self-contained file — video, poster and thumbnails are inlined as data URIs, so it runs from disk with no server. |
| Annotated cut | `public/garage-to-front-door-annotated.mp4` | 21.8 s, 608×1080. Title card, per-station lower thirds, a live corner plan, a progress bar with station ticks, and an end card listing the route. |

## Stations

The take is cut into five stations. Both builders read the same boundaries.

| # | In | Out | Station |
| --- | --- | --- | --- |
| 1 | 00:00.00 | 00:03.50 | Garage bay |
| 2 | 00:03.50 | 00:06.60 | Utility door |
| 3 | 00:06.60 | 00:11.40 | Hall |
| 4 | 00:11.40 | 00:14.60 | Living area |
| 5 | 00:14.60 | 00:15.98 | Front entry |

## Rebuilding

```sh
pip install Pillow imageio-ffmpeg     # imageio-ffmpeg only if ffmpeg isn't on PATH
python3 tools/build_page.py           # -> public/index.html   (~1.9 MB)
python3 tools/build_reel.py           # -> public/*-annotated.mp4 (~2.8 MB)
```

`tools/build_page.py` re-encodes a web cut (H.264 at CRF 30, plus a VP9 fallback
for browsers without H.264), pulls the poster and the five station thumbnails,
and inlines all of it into `tools/template.html`. Edit the template for copy and
layout; edit `THUMB_TIMES` in the builder if the station cues move.

`tools/build_reel.py` draws all 653 overlay frames with Pillow and composites
them with ffmpeg. Station copy, colours and the plan geometry live at the top of
that file.

## The plan drawing

The schematic is authored once in a 440 × 300 space and drawn at three sizes —
in the page's SVG, in the video's corner plan, and full-bleed on the end card.
It is **traced from the take, not measured**: room proportions are approximate
and the two doorways off the hall were never entered.

## A note on the notes

The observation copy describes what is visible in the frames. Readings marked
`°` on the page are probable rather than certain — the footage is handheld,
auto-exposed and moving. It is a record of a walk, not an inspection.
