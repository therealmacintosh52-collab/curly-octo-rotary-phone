#!/usr/bin/env python3
"""Cut, stabilise, slow and grade the raw take into the walkthrough master.

The raw clip has three problems that read as amateur: the operator's shadow
falls across the door from about 4.0 s, a hand reaches into frame from 6.20 s
to 6.55 s, and the auto-exposure crashes to near-black crossing the threshold.
All three sit inside one passage, so that passage is cut and dissolved through —
the way an editor would handle it — rather than patched.

What comes out is one continuous glide: garage, through the door, hall, living
area, front entry.

    python3 tools/build_clean.py

Writes public/walkthrough-clean.mp4 and tools/stations.json, the station
boundaries remapped onto the new timeline for the page builder to read.
"""

import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "source" / "IMG_0247.mp4"
MASTER = ROOT / "public" / "walkthrough-clean.mp4"
STATIONS_JSON = ROOT / "tools" / "stations.json"

# The raw clip carries GPS coordinates in its metadata; every derived file is
# written with -map_metadata -1 so none of it reaches anything published.

# --- the cut -----------------------------------------------------------------
# Segment A ends before the operator's shadow lands on the door; segment B picks
# up after the hand has left frame and the exposure has recovered.
A_IN, A_OUT = 0.00, 3.80
B_IN, B_OUT = 7.45, 15.95
XFADE = 0.60           # dissolve that carries us through the doorway
SLOW = 1.35            # 0.74x — a walking pace becomes a glide

W, H = 608, 1080
FPS = 30

# Station boundaries as timecodes in the ORIGINAL take.
RAW_STATIONS = [
    ("Garage", A_IN, A_OUT),
    ("Hall", B_IN, 11.40),
    ("Living area", 11.40, 14.60),
    ("Front entry", 14.60, B_OUT),
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


def remap(raw_t):
    """Original timecode -> final (cut and slowed) timecode."""
    offset = A_OUT - XFADE                      # where segment B is laid down
    if raw_t <= A_OUT:
        cut_t = raw_t
    else:
        cut_t = offset + (raw_t - B_IN)
    return round(cut_t * SLOW, 3)


def main():
    if not SOURCE.exists():
        sys.exit(f"missing source clip: {SOURCE}")
    ff = ffmpeg()

    cut_len = (A_OUT - XFADE) + (B_OUT - B_IN)
    final_len = cut_len * SLOW
    MASTER.parent.mkdir(parents=True, exist_ok=True)

    tmp_cut = MASTER.with_name("_cut.mp4")

    # pass 1 — trim out the shadow/hand/blackout passage, dissolve across it
    run([ff, "-y", "-i", str(SOURCE), "-an", "-filter_complex",
         f"[0:v]split=2[s0][s1];"
         f"[s0]trim={A_IN}:{A_OUT},setpts=PTS-STARTPTS,scale=664:-2,fps={FPS}[a];"
         f"[s1]trim={B_IN}:{B_OUT},setpts=PTS-STARTPTS,scale=664:-2,fps={FPS}[b];"
         f"[a][b]xfade=transition=fade:duration={XFADE}:offset={A_OUT - XFADE:.3f}[v]",
         "-map", "[v]", "-map_metadata", "-1", "-c:v", "libx264", "-crf", "14", "-preset", "veryfast",
         "-pix_fmt", "yuv420p", str(tmp_cut)])

    # pass 2 — stabilise, trim the stabiliser's smeared edge, slow, interpolate,
    # grade, and ease in and out of black
    chain = (
        "deshake=rx=32:ry=32:edge=clamp,"
        "crop=in_w*0.95:in_h*0.95,"
        f"scale={W}:{H},"
        f"setpts={SLOW}*PTS,"
        f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
        f"{GRADE},"
        "fade=t=in:st=0:d=0.6,"
        f"fade=t=out:st={final_len - 0.7:.2f}:d=0.7"
    )
    run([ff, "-y", "-i", str(tmp_cut), "-an", "-vf", chain,
         "-map_metadata", "-1",
         "-c:v", "libx264", "-profile:v", "high", "-crf", "21", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(MASTER)])
    tmp_cut.unlink()

    stations = []
    for i, (name, raw_in, raw_out) in enumerate(RAW_STATIONS):
        stations.append({
            "name": name,
            "in": remap(raw_in) if i else 0.0,
            "out": round(final_len, 3) if i == len(RAW_STATIONS) - 1 else remap(raw_out),
        })
    STATIONS_JSON.write_text(json.dumps(
        {"duration": round(final_len, 3), "fps": FPS,
         "width": W, "height": H, "stations": stations}, indent=2) + "\n")

    mb = MASTER.stat().st_size / (1024 * 1024)
    print(f"wrote {MASTER.relative_to(ROOT)}  ({final_len:.2f} s, {mb:.1f} MB)")
    for s in stations:
        print(f"  {s['in']:>6.2f} -> {s['out']:>6.2f}  {s['name']}")


if __name__ == "__main__":
    main()
