"""Shared fixtures. Every test gets an isolated jobs dir + SQLite DB under tmp_path."""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import settings, db  # noqa: E402
from app.pipeline import ffmpeg_tools as ff  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_env(tmp_path, monkeypatch):
    jobs = tmp_path / "jobs"
    jobs.mkdir()
    monkeypatch.setattr(settings, "JOBS_DIR", jobs)
    monkeypatch.setattr(settings, "DB_PATH", jobs / "test.db")
    db._initialized_paths.clear()
    db.init_db()
    yield jobs


@pytest.fixture(autouse=True)
def no_real_whisper(monkeypatch):
    """Tests must never download/load a real whisper model; override per-test with a fake."""
    from app.pipeline import transcribe
    def _blocked(*a, **k):
        raise RuntimeError("real whisper model blocked in tests")
    monkeypatch.setattr(transcribe, "get_model", _blocked)
    yield


@pytest.fixture(scope="session")
def sample_video(tmp_path_factory) -> Path:
    """20 s synthetic 720p video with alternating loud/quiet tone. Built once per session."""
    p = tmp_path_factory.mktemp("media") / "sample.mp4"
    ff.make_test_video(p, duration=20, width=1280, height=720)
    return p


@pytest.fixture(autouse=True)
def no_real_whisper(monkeypatch):
    """Tests must never download/load a real whisper model; override per-test with a fake."""
    from app.pipeline import transcribe
    def _blocked(*a, **k):
        raise RuntimeError("real whisper model blocked in tests")
    monkeypatch.setattr(transcribe, "get_model", _blocked)
    yield


@pytest.fixture(scope="session")
def sample_video_mkv(tmp_path_factory) -> Path:
    """Same content but in a Matroska container so the transcode path gets exercised."""
    p = tmp_path_factory.mktemp("media") / "sample.mkv"
    ff.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=22050", "-t", "6",
            "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", str(p)])
    return p


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    import app.main as main_mod
    importlib.reload(main_mod)  # pick up patched settings in lifespan
    with TestClient(main_mod.app) as c:
        yield c
