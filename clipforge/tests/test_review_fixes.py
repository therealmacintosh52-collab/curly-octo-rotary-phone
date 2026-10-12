"""Regression tests for the issues found in the post-build code review."""
import shutil
import time

import pytest

from app import db, settings
from app.pipeline import ffmpeg_tools as ff, ingest, render, runner, schedule, transcribe
from app.pipeline.runner import JobCancelled
from tests.fakes import FakeWhisperModel, fake_words


def test_loudnorm_silent_audio_falls_back_to_single_pass():
    m = {"input_i": "-inf", "input_tp": "-inf", "input_lra": "0.00", "input_thresh": "-inf", "target_offset": "inf"}
    assert render.loudnorm_filter(m, -14, -1) == "loudnorm=I=-14:TP=-1:LRA=11"


def test_render_silent_clip_succeeds(tmp_path):
    job = tmp_path / "job"; job.mkdir()
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "4", "-c:v", "libx264", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(job / "source.mp4")])
    media = ff.probe(job / "source.mp4").to_dict()
    res = render.render_clip(job, idx=0, start=0.0, end=3.0, src_media=media, captions_ass=None, reframe="center")
    assert (job / res["video_path"]).exists() and "measured_I" not in res["loudnorm"]


def test_vertical_upload_keeps_full_resolution(tmp_path):
    src = tmp_path / "phone.mp4"
    ff.make_test_video(src, duration=3, width=1080, height=1920, fps=30)
    meta = ingest.ingest(tmp_path / "job", upload_path=src)
    assert meta["normalised"] == "remux" and (meta["media"]["width"], meta["media"]["height"]) == (1080, 1920)


def test_transcode_caps_shorter_side(tmp_path):
    tall = tmp_path / "tall.mp4"; ff.make_test_video(tall, duration=2, width=1440, height=2560, fps=25)
    out = ff.transcode_to_mp4(tall, tmp_path / "tall_out.mp4", max_height=1080)
    i = ff.probe(out); assert (i.width, i.height) == (1080, 1920)
    wide = tmp_path / "wide.mp4"; ff.make_test_video(wide, duration=2, width=2560, height=1440, fps=25)
    out = ff.transcode_to_mp4(wide, tmp_path / "wide_out.mp4", max_height=1080)
    i = ff.probe(out); assert (i.width, i.height) == (1920, 1080)


def test_audio_only_upload_gets_a_canvas(tmp_path):
    wav = tmp_path / "podcast.wav"
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "4", str(wav)])
    assert ff.probe(wav).has_video is False
    meta = ingest.ingest(tmp_path / "job", upload_path=wav, upload_name="podcast.wav")
    assert meta["normalised"] == "audio-only"
    m = meta["media"]; assert (m["width"], m["height"]) == (1080, 1920) and m["has_audio"] and abs(m["duration"] - 4) < 0.3


def test_probe_ignores_embedded_cover_art(tmp_path):
    cover = tmp_path / "cover.png"
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-frames:v", "1", str(cover)])
    mp3 = tmp_path / "song.mp3"
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-i", str(cover),
            "-t", "3", "-map", "0:a", "-map", "1:v", "-c:a", "libmp3lame", "-c:v", "png", "-disposition:v", "attached_pic",
            "-id3v2_version", "3", str(mp3)])
    info = ff.probe(mp3)
    assert info.has_video is False and info.has_audio is True


def test_schedule_timezone_fallback(monkeypatch):
    assert str(schedule.resolve_tz("America/Los_Angeles")) == "America/Los_Angeles"
    assert schedule.resolve_tz("Not/AZone").utcoffset(None).total_seconds() == 0
    monkeypatch.setattr(settings, "TIMEZONE", "Not/AZone")
    plan = schedule.build_schedule([{"id": "c", "idx": 0, "score": 1}], ["tiktok"])
    assert plan["c"]["tiktok"]["timezone"] == "UTC"


def test_cancel_during_render_leaves_clip_pending(tmp_path, sample_video, monkeypatch):
    monkeypatch.setattr(settings, "JOBS_DIR", tmp_path)
    job = db.create_job("upload", options={})
    jd = tmp_path / job["id"]; jd.mkdir(); shutil.copy(sample_video, jd / "source.mp4")
    db.merge_job_meta(job["id"], source={"media": ff.probe(jd / "source.mp4").to_dict()})
    clip = db.create_clip(job["id"], 0, 0.0, 5.0)
    def cancelling_progress(f, m):
        raise JobCancelled()
    with pytest.raises(JobCancelled):
        runner.render_one_clip(job["id"], clip, progress=cancelling_progress)
    assert db.get_clip(clip["id"])["status"] == "pending"


def test_stale_rendering_clips_fail_on_startup(client):
    job = db.create_job("upload")
    c = db.create_clip(job["id"], 0, 0, 5)
    db.update_clip(c["id"], status="rendering")
    assert db.fail_stale_clips("restart") == 1
    got = db.get_clip(c["id"]); assert got["status"] == "failed" and got["error"] == "restart"


def test_rerender_and_trim_refused_while_job_active(client, monkeypatch):
    job = db.create_job("upload")
    c = db.create_clip(job["id"], 0, 0, 20)
    monkeypatch.setattr(runner, "is_active", lambda jid: jid == job["id"])
    assert client.post(f"/api/clips/{c['id']}/rerender").status_code == 409
    assert client.patch(f"/api/clips/{c['id']}", json={"start_s": 1, "end_s": 10}).status_code == 409
    assert client.patch(f"/api/clips/{c['id']}", json={"copy": {}}).status_code == 200  # copy edits are fine
    assert client.post(f"/api/jobs/{job['id']}/run").status_code == 409


def test_feedback_survives_job_rerun():
    job = db.create_job("upload")
    c = db.create_clip(job["id"], 0, 0, 20, score_breakdown={"features": {"hook_phrases": 0.9}})
    db.add_feedback(c["id"], job["id"], 1, None, {"hook_phrases": 0.9})
    db.delete_clips(job["id"])
    assert len(db.list_feedback()) == 1
    db.delete_job(job["id"])
    assert len(db.list_feedback()) == 1


def test_bad_language_code_degrades_to_autodetect(tmp_path):
    words = fake_words("Hello there. General Kenobi.")
    class Picky(FakeWhisperModel):
        supported_languages = ["en", "de"]
        def transcribe(self, path, language=None, **kw):
            if language not in (None, "en", "de"):
                raise ValueError(f"{language!r} is not a valid language code")
            return super().transcribe(path, **kw)
    res = transcribe.transcribe(tmp_path / "a.wav", model=Picky(words), language="Engli")
    assert res["available"] and len(res["words"]) == 4
    class Strict(FakeWhisperModel):  # no supported_languages attribute → rejection happens in transcribe()
        def transcribe(self, path, language=None, **kw):
            if language:
                raise ValueError("bad code")
            return super().transcribe(path, **kw)
    res2 = transcribe.transcribe(tmp_path / "a.wav", model=Strict(words), language="jp")
    assert res2["available"] and len(res2["words"]) == 4
