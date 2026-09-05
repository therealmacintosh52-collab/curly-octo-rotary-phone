#!/usr/bin/env python3
"""Build the self-contained walkthrough page from the source clip.

Re-encodes a web cut of the take (H.264 plus a VP9 fallback), pulls the station
thumbnails and the poster frame, then inlines everything into
tools/template.html as data URIs so the result is one file with no external
assets.

    python3 tools/build_page.py
"""

import base64
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "source" / "IMG_0247.mp4"
TEMPLATE = ROOT / "tools" / "template.html"
OUT = ROOT / "public" / "index.html"

# Station cue times, in seconds, matched to the stations in the template.
THUMB_TIMES = [1.5, 4.6, 8.2, 12.6, 15.5]
POSTER_TIME = 1.2


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
    if not SOURCE.exists():
        sys.exit(f"missing source clip: {SOURCE}")

    ff = ffmpeg()
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = pathlib.Path(tmpdir)

        web = tmp / "walk.mp4"
        run([ff, "-y", "-i", str(SOURCE), "-an",
             "-vf", "scale=608:-2",
             "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
             "-crf", "30", "-preset", "slow", "-g", "15",
             "-movflags", "+faststart", str(web)])

        webm = tmp / "walk.webm"
        run([ff, "-y", "-i", str(SOURCE), "-an",
             "-vf", "scale=608:-2",
             "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40",
             "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
             "-pix_fmt", "yuv420p", str(webm)])

        poster = tmp / "poster.jpg"
        run([ff, "-y", "-ss", str(POSTER_TIME), "-i", str(SOURCE), "-frames:v", "1",
             "-vf", "scale=456:-2", "-q:v", "5", str(poster)])

        thumbs = []
        for i, t in enumerate(THUMB_TIMES, start=1):
            th = tmp / f"t{i}.jpg"
            run([ff, "-y", "-ss", str(t), "-i", str(SOURCE), "-frames:v", "1",
                 "-vf", "scale=168:-2", "-q:v", "6", str(th)])
            thumbs.append(th)

        html = TEMPLATE.read_text()
        html = html.replace("__VIDEO_WEBM__", b64(webm))
        html = html.replace("__VIDEO__", b64(web))
        html = html.replace("__POSTER__", b64(poster))
        for i, th in enumerate(thumbs, start=1):
            html = html.replace(f"__T{i}__", b64(th))

        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(html)

    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(ROOT)}  ({kb:,.0f} KB)")


if __name__ == "__main__":
    main()
