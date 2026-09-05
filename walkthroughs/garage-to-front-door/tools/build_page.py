#!/usr/bin/env python3
"""Inline the graded master into the walkthrough page.

Reads public/walkthrough-clean.mp4 and tools/stations.json (both written by
build_clean.py), makes a web-weight H.264 cut plus a VP9 fallback and a poster
frame, and substitutes all of it into tools/template.html as data URIs. The
result is one file with no external assets except the Google Fonts stylesheet.

    python3 tools/build_clean.py     # first — makes the master
    python3 tools/build_page.py      # then — makes the page
"""

import base64
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
MASTER = ROOT / "public" / "walkthrough-clean.mp4"
STATIONS_JSON = ROOT / "tools" / "stations.json"
TEMPLATE = ROOT / "tools" / "template.html"
OUT = ROOT / "public" / "index.html"

POSTER_TIME = 1.4
CRF_H264 = 29
CRF_VP9 = 39


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("ffmpeg not found. Install it, or: pip install imageio-ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    for f in (MASTER, STATIONS_JSON):
        if not f.exists():
            sys.exit(f"missing {f.name} — run tools/build_clean.py first")

    meta = json.loads(STATIONS_JSON.read_text())
    stations = [{"name": s["name"], "in": s["in"]} for s in meta["stations"]]

    ff = ffmpeg()
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = pathlib.Path(tmpdir)

        web = tmp / "web.mp4"
        run([ff, "-y", "-i", str(MASTER), "-an", "-map_metadata", "-1",
             "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
             "-crf", str(CRF_H264), "-preset", "slow", "-g", "15",
             "-movflags", "+faststart", str(web)])

        webm = tmp / "web.webm"
        run([ff, "-y", "-i", str(MASTER), "-an", "-map_metadata", "-1",
             "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(CRF_VP9),
             "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
             "-pix_fmt", "yuv420p", str(webm)])

        poster = tmp / "poster.jpg"
        run([ff, "-y", "-ss", str(POSTER_TIME), "-i", str(MASTER), "-frames:v", "1",
             "-vf", "scale=456:-2", "-q:v", "5", str(poster)])

        html = TEMPLATE.read_text(encoding="utf-8")
        html = html.replace("__VIDEO_WEBM__", b64(webm))
        html = html.replace("__VIDEO__", b64(web))
        html = html.replace("__POSTER__", b64(poster))
        html = html.replace("__DURATION__", f"{meta['duration']:.3f}")
        html = html.replace("__STATIONS__", json.dumps(stations, separators=(",", ":")))

        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(html, encoding="utf-8")

    print(f"wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:,.0f} KB)")
    print(f"  {meta['duration']:.2f} s, {len(stations)} spaces")


if __name__ == "__main__":
    main()
