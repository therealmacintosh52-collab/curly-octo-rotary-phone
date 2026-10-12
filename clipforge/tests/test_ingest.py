import json

import pytest

from app.pipeline import ffmpeg_tools as ff
from app.pipeline import ingest


def test_check_ffmpeg_present():
    info = ff.check_ffmpeg()
    assert info["ffmpeg"] and info["version"] != "unknown"


def test_check_ffmpeg_missing(monkeypatch):
    monkeypatch.setattr(ff.shutil, "which", lambda _: None)
    with pytest.raises(ff.FFmpegMissing) as ei:
        ff.check_ffmpeg()
    assert "brew install ffmpeg" in str(ei.value)


def test_probe_sample(sample_video):
    info = ff.probe(sample_video)
    assert info.width == 1280 and info.height == 720
    assert 19.5 <= info.duration <= 20.6
    assert info.video_codec == "h264" and info.audio_codec == "aac"
    assert abs(info.fps - 30) < 0.1 and info.has_audio


def test_ingest_upload_remux_path(tmp_path, sample_video):
    job_dir = tmp_path / "job1"
    events = []
    meta = ingest.ingest(job_dir, upload_path=sample_video, upload_name="My Talk.mp4",
                         progress=lambda f, m: events.append((f, m)))
    assert meta["source_type"] == "upload" and meta["normalised"] == "remux"
    assert meta["title"] == "My Talk"
    assert (job_dir / "source.mp4").exists() and (job_dir / "audio.wav").exists()
    assert not (job_dir / "upload.mp4").exists(), "raw upload should be removed after normalising"
    saved = json.loads((job_dir / "source.json").read_text())
    assert saved["media"]["width"] == 1280
    wav = ff.probe(job_dir / "audio.wav")
    assert wav.audio_sample_rate == 16000 and wav.audio_channels == 1
    assert events[-1][0] == 1.0 and events == sorted(events, key=lambda e: e[0])


def test_ingest_upload_transcode_path(tmp_path, sample_video_mkv):
    job_dir = tmp_path / "job2"
    meta = ingest.ingest(job_dir, upload_path=sample_video_mkv)
    assert meta["normalised"] == "transcode"
    out = ff.probe(job_dir / "source.mp4")
    assert out.video_codec == "h264" and out.audio_codec == "aac" and out.width == 640


def test_ingest_caps_height(tmp_path, sample_video):
    job_dir = tmp_path / "job3"
    meta = ingest.ingest(job_dir, upload_path=sample_video, max_height=360)
    assert meta["normalised"] == "transcode" and meta["media"]["height"] == 360 and meta["media"]["width"] == 640


def test_ingest_rejects_bad_inputs(tmp_path):
    with pytest.raises(ValueError):
        ingest.ingest(tmp_path / "x", url="not a url")
    with pytest.raises(ValueError):
        ingest.ingest(tmp_path / "y")
    with pytest.raises(FileNotFoundError):
        ingest.ingest(tmp_path / "z", upload_path=tmp_path / "missing.mp4")


def test_ingest_url_uses_ytdlp(tmp_path, sample_video, monkeypatch):
    """Stub the downloader so the test is offline; verify the URL path wires through to normalisation."""
    def fake_download(url, job_dir, progress, max_height):
        import shutil
        dst = job_dir / "download.mp4"
        shutil.copy(sample_video, dst)
        progress(0.5, "downloading 50%")
        return dst, {"title": "Remote Title", "uploader": "someone", "webpage_url": url}
    monkeypatch.setattr(ingest, "_download", fake_download)
    meta = ingest.ingest(tmp_path / "j", url="https://www.youtube.com/watch?v=abc")
    assert meta["source_type"] == "url" and meta["title"] == "Remote Title"
    assert meta["remote"]["uploader"] == "someone"
    assert (tmp_path / "j" / "source.mp4").exists()
