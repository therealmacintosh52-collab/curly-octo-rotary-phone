import json
import shutil
import subprocess

import pytest

from app.pipeline import captions, ffmpeg_tools as ff, render
from tests.fakes import SCRIPT_90S, fake_words


def test_crop_filter_wide_source_centres_on_face():
    vf = render.crop_filter(1920, 1080, 0.5)
    assert vf.startswith("crop=608:1080:656:0,scale=1080:1920")
    left = render.crop_filter(1920, 1080, 0.1)
    assert left.startswith("crop=608:1080:0:0")          # clamped to the left edge
    right = render.crop_filter(1920, 1080, 0.95)
    assert right.startswith("crop=608:1080:1312:0")      # clamped to the right edge
    assert "boxblur" in render.crop_filter(1920, 1080, 0.5, mode="blur")
    tall = render.crop_filter(720, 1280, 0.5)
    assert tall.startswith("scale=1080:-2") and "pad=1080:1920" in tall


def test_detect_face_center_uses_median_of_detections(sample_video, monkeypatch):
    calls = {"n": 0}
    def fake_faces(frame):
        calls["n"] += 1
        h, w = frame.shape[:2]
        return [(int(w * 0.6), int(h * 0.3), 100, 100)] if calls["n"] % 2 else []  # face on every other frame
    monkeypatch.setattr(render, "_detect_faces_in_frame", fake_faces)
    res = render.detect_face_center(sample_video, 0.0, 10.0, samples=8)
    assert res["samples"] == 8 and res["hits"] == 4 and res["found"] is True
    assert abs(res["cx"] - (0.6 + 50 / 1280)) < 0.01


def test_detect_face_center_no_faces_falls_back(sample_video):
    res = render.detect_face_center(sample_video, 0.0, 5.0, samples=4)  # colour bars: no faces
    assert res["found"] is False and res["cx"] == 0.5 and res["samples"] == 4


def test_loudnorm_filter_formats_measured_values():
    assert render.loudnorm_filter(None, -14, -1) == "loudnorm=I=-14:TP=-1:LRA=11"
    m = {"input_i": "-23.1", "input_tp": "-5.0", "input_lra": "3.2", "input_thresh": "-33.5", "target_offset": "0.4"}
    f = render.loudnorm_filter(m, -14, -1)
    assert "measured_I=-23.10" in f and "linear=true" in f and "offset=0.40" in f


def _measure_lufs(path):
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af",
                           "loudnorm=I=-14:TP=-1:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    block = proc.stderr[proc.stderr.rfind("{"):proc.stderr.rfind("}") + 1]
    return float(json.loads(block)["input_i"])


def test_render_clip_end_to_end(tmp_path, sample_video):
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(sample_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    words = fake_words(SCRIPT_90S, wps=3.0)
    caps = captions.write_captions(job, 0, words, 2.0, 14.0)
    events = []
    res = render.render_clip(job, idx=0, start=2.0, end=14.0, src_media=media, captions_ass=caps["ass"],
                             reframe="auto", progress=lambda f, m: events.append(f))
    out = job / res["video_path"]
    assert out.exists() and (job / res["cover_path"]).exists()
    info = ff.probe(out)
    assert (info.width, info.height) == (1080, 1920)
    assert abs(info.duration - 12.0) < 0.3
    assert info.video_codec == "h264" and info.audio_codec == "aac" and info.audio_sample_rate == 48000
    assert abs(info.fps - 30) < 0.01
    assert res["reframe"]["mode"] == "crop" and res["reframe"]["face"]["found"] is False
    assert "measured_I" in res["loudnorm"]
    assert abs(_measure_lufs(out) - (-14.0)) < 1.5
    cover = ff.probe(job / res["cover_path"])
    assert (cover.width, cover.height) == (1080, 1920)
    assert events[-1] == 1.0 and events == sorted(events)
    # Captions were burned in: a frame mid-clip differs from the same frame rendered without captions.
    res2 = render.render_clip(job, idx=1, start=2.0, end=14.0, src_media=media, captions_ass=None, reframe="center")
    import cv2
    a = cv2.imread(str(job / res["cover_path"])); b = cv2.imread(str(job / res2["cover_path"]))
    assert a.shape == b.shape and (abs(a.astype(int) - b.astype(int)).mean() > 0.5)


def test_render_blur_mode(tmp_path, sample_video):
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(sample_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    res = render.render_clip(job, idx=0, start=0.0, end=4.0, src_media=media, captions_ass=None, reframe="blur")
    info = ff.probe(job / res["video_path"])
    assert (info.width, info.height) == (1080, 1920) and res["reframe"]["mode"] == "blur"


@pytest.fixture(scope="session")
def face_video(tmp_path_factory):
    """1920x1080 clip with a real face photo (OpenCV sample) sitting in the right third of the frame."""
    from pathlib import Path
    photo = Path(__file__).parent / "assets" / "face.jpg"
    p = tmp_path_factory.mktemp("media") / "face.mp4"
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x202020:s=1920x1080:r=25:d=6",
            "-loop", "1", "-t", "6", "-i", str(photo), "-f", "lavfi", "-i", "sine=frequency=300:sample_rate=16000:d=6",
            "-filter_complex", "[1:v]scale=822:-2[ph];[0:v][ph]overlay=1040:270[v]",
            "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", str(p)])
    return p


def test_auto_reframe_tracks_a_real_face(tmp_path, face_video):
    assert render.detector_name() in ("yunet", "haar")
    res = render.detect_face_center(face_video, 0.0, 6.0, samples=6)
    assert res["found"] is True and res["hits"] >= 4
    # photo spans x 1040..1862 with the face at ~44% of its width → face cx ≈ 0.73 of the frame
    assert 0.66 < res["cx"] < 0.80, res
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(face_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    out = render.render_clip(job, idx=0, start=0.0, end=4.0, src_media=media, captions_ass=None, reframe="auto")
    assert out["reframe"]["face"]["found"] and out["reframe"]["mode"] == "crop"
    # the rendered 9:16 frame must still contain the face
    import cv2
    cover = cv2.imread(str(job / out["cover_path"]))
    assert cover.shape[:2] == (1920, 1080)
    assert render._detect_faces_in_frame(cover), "face was cropped out of the vertical render"
    # centre crop of the same source would lose it
    out2 = render.render_clip(job, idx=1, start=0.0, end=4.0, src_media=media, captions_ass=None, reframe="center")
    cover2 = cv2.imread(str(job / out2["cover_path"]))
    assert not render._detect_faces_in_frame(cover2)
