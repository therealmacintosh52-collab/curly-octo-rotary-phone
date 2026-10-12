import json
import shutil

from app import settings
from app.pipeline import captions, ffmpeg_tools as ff, render, spec
from tests.fakes import SCRIPT_90S, fake_words

PCONF = settings.load_config("platforms")
ALL = list(PCONF["platforms"])


def test_profiles_differ_and_universal_is_strictest():
    keys = {p: spec.profile_key(spec.profile_for(p)) for p in ALL}
    assert len(set(keys.values())) == len(ALL), "every platform should have its own spec"
    u = spec.universal_profile(ALL)
    assert u["render"]["max_file_mb"] == min(spec.profile_for(p)["render"]["max_file_mb"] for p in ALL)
    assert u["render"]["fps"] == 30 and u["render"]["video_maxrate_mbps"] == 8
    for k in ("top_pct", "bottom_pct", "left_pct", "right_pct"):
        assert u["safe_zone"][k] == max(spec.profile_for(p)["safe_zone"][k] for p in ALL)
    assert spec.profile_key(u) == spec.profile_key(spec.universal_profile(ALL))
    assert spec.profile_key(spec.profile_for("tiktok")) == spec.profile_key(spec.universal_profile(["tiktok"]))


def test_captions_respect_platform_safe_zone():
    words = captions.words_in_range(fake_words(SCRIPT_90S), 0, 10)
    for p in ALL:
        prof = spec.profile_for(p)
        ass = captions.build_ass(words, 10.0, profile=prof)
        style = next(l for l in ass.splitlines() if l.startswith("Style:")).split(",")
        margin_l, margin_r, margin_v = int(style[-4]), int(style[-3]), int(style[-2])
        assert margin_v >= int(1920 * prof["safe_zone"]["bottom_pct"]), p
        assert margin_r >= int(1080 * prof["safe_zone"]["right_pct"]) and margin_l >= int(1080 * prof["safe_zone"]["left_pct"])


def test_check_copy_limits():
    ok = spec.check_copy({"title": "Short title #Shorts", "caption": "hook line\nmore", "hashtags": ["#a", "#b"]}, "youtube_shorts")
    assert ok["ok"] and {c["name"] for c in ok["checks"]} >= {"title length", "caption length", "hook visible before fold", "hashtag count", "#shorts tag present"}
    bad = spec.check_copy({"title": "x" * 120, "caption": "y" * 70 + "\nz", "hashtags": ["#1", "#2", "#3", "#4", "#5", "#6", "#7"]}, "tiktok")
    names = {c["name"]: c["ok"] for c in bad["checks"]}
    assert bad["ok"] is False and names["hook visible before fold"] is False and names["hashtag count"] is False
    assert "title length" not in names  # TikTok has no title field


def test_render_to_platform_profile_and_verify(tmp_path, sample_video):
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(sample_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    prof = spec.profile_for("tiktok")
    res = render.render_clip(job, idx=0, start=1.0, end=9.0, src_media=media, captions_ass=None, reframe="center",
                             folder="tiktok", profile=prof)
    assert res["video_path"] == "clips/tiktok/clip_01.mp4" and (job / res["video_path"]).exists()
    assert res["profile"]["max_file_mb"] == 287 and res["profile"]["fps"] == 30
    chk = spec.check_render(job / res["video_path"], prof, expected_duration=8.0)
    assert chk["ok"], [c for c in chk["checks"] if not c["ok"]]
    assert {c["name"] for c in chk["checks"]} >= {"resolution", "video codec", "audio codec", "frame rate", "duration", "file size", "bitrate", "cut length", "loudness"}
    # a profile the file does not meet fails the right checks
    tight = json.loads(json.dumps(prof)); tight["render"]["max_file_mb"] = 0.01; tight["max_duration"] = 3
    bad = spec.check_render(job / res["video_path"], tight, measure_loudness=False)
    failed = {c["name"] for c in bad["checks"] if not c["ok"]}
    assert bad["ok"] is False and failed == {"file size", "duration"}


def test_file_size_cap_triggers_reencode(tmp_path, sample_video):
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(sample_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    prof = spec.profile_for("tiktok"); prof = json.loads(json.dumps(prof)); prof["render"]["max_file_mb"] = 0.5
    res = render.render_clip(job, idx=0, start=0.0, end=6.0, src_media=media, captions_ass=None, reframe="center", folder="t", profile=prof)
    assert res["size_mb"] <= 0.5, res["size_mb"]
