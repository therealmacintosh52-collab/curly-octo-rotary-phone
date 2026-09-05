#!/usr/bin/env python3
"""Cut, stabilise, slow and grade the raw take into the walkthrough master.

The take opens in the garage, and the garage is where all the clutter is —
stacked totes, a folding table, boxes, a loose extinguisher — plus the operator's
shadow on the door from ~4.0 s and a hand in frame at 6.20-6.55 s. None of that
survives a cut that simply starts inside the house.

So the master opens at 8.60 s of the original, once the camera is clear of the
doorway and the auto-exposure has settled. What is left is three rooms that
were already close to empty: hall, living area, front entry.

    python3 tools/build_clean.py

Writes public/walkthrough-clean.mp4 and tools/stations.json, the room boundaries
remapped onto the new timeline for the page builder to read.
"""

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "source" / "IMG_0247.mp4"
MASTER = ROOT / "public" / "walkthrough-clean.mp4"
STATIONS_JSON = ROOT / "tools" / "stations.json"

# The raw clip carries GPS coordinates in its metadata; every derived file is
# written with -map_metadata -1 so none of it reaches anything published.

# --- the cut -----------------------------------------------------------------
IN, OUT = 8.60, 15.95   # opens in the hall, clear of the door and the exposure crash
SLOW = 1.55             # 0.65x — a walking pace becomes a glide

W, H = 608, 1080
FPS = 30

# No fades to black at either end. The page rests the film at t=0 and at t=DUR
# while scrubbing, so a faded frame there would show as a black panel.

# Floor falloff: a gentle shadow across the bottom edge that sinks the small
# things left on the floor near the front door. Kept subtle on purpose — the
# plank floor is a feature, and darkening it to hide clutter costs more than it
# saves. It does nothing for the extension cord, which runs at wall height.
FALLOFF_START = 0.76    # fraction of frame height where the darkening begins
FALLOFF_MAX = 0.20      # alpha at the very bottom edge
FALLOFF_RGB = (11, 9, 7)

# Room boundaries as timecodes in the ORIGINAL take.
RAW_ROOMS = [
    ("The hall", IN, 11.40),
    ("The living area", 11.40, 14.60),
    ("The front door", 14.60, OUT),
]

GRADE = (
    "hqdn3d=2:2:6:6,"
    "curves=all='0/0 0.14/0.065 0.42/0.44 0.78/0.83 1/1',"
    "eq=contrast=1.10:saturation=1.14:gamma=1.0,"
    "colortemperature=temperature=5300:mix=0.8,"
    "unsharp=5:5:0.7:5:5:0.0"
)


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


def write_falloff(path: pathlib.Path) -> None:
    """A transparent plate that ramps to shadow across the bottom of the frame."""
    img = Image.new("RGBA", (W, H), (*FALLOFF_RGB, 0))
    px = img.load()
    y0 = int(H * FALLOFF_START)
    for y in range(y0, H):
        k = (y - y0) / max(1, H - 1 - y0)
        a = int(round(FALLOFF_MAX * 255 * (k ** 1.7)))   # eased, so the top edge is invisible
        for x in range(W):
            px[x, y] = (*FALLOFF_RGB, a)
    img.save(path)


def remap(raw_t):
    """Original timecode -> final (cut and slowed) timecode."""
    return round((raw_t - IN) * SLOW, 3)


def main():
    if not SOURCE.exists():
        sys.exit(f"missing source clip: {SOURCE}")
    ff = ffmpeg()

    final_len = (OUT - IN) * SLOW
    MASTER.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        plate = pathlib.Path(tmpdir) / "falloff.png"
        write_falloff(plate)

        chain = (
            f"[0:v]trim={IN}:{OUT},setpts=PTS-STARTPTS,"
            "scale=664:-2,"
            "deshake=rx=32:ry=32:edge=clamp,"
            "crop=in_w*0.95:in_h*0.95,"
            f"scale={W}:{H},"
            f"setpts={SLOW}*PTS,"
            f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
            f"{GRADE}[base];"
            "[base][1:v]overlay=0:0:format=auto:eof_action=repeat[v]"
        )
        run([ff, "-y", "-i", str(SOURCE), "-i", str(plate),
             "-filter_complex", chain, "-map", "[v]", "-an", "-map_metadata", "-1",
             "-c:v", "libx264", "-profile:v", "high", "-crf", "21", "-preset", "slow",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(MASTER)])

    rooms = []
    for i, (name, raw_in, raw_out) in enumerate(RAW_ROOMS):
        rooms.append({
            "name": name,
            "in": remap(raw_in),
            "out": round(final_len, 3) if i == len(RAW_ROOMS) - 1 else remap(raw_out),
        })
    STATIONS_JSON.write_text(json.dumps(
        {"duration": round(final_len, 3), "fps": FPS,
         "width": W, "height": H, "stations": rooms}, indent=2) + "\n")

    mb = MASTER.stat().st_size / (1024 * 1024)
    print(f"wrote {MASTER.relative_to(ROOT)}  ({final_len:.2f} s, {mb:.1f} MB)")
    for r in rooms:
        print(f"  {r['in']:>6.2f} -> {r['out']:>6.2f}  {r['name']}")


if __name__ == "__main__":
    main()
