"""Opt-in: exercises the real faster-whisper model. Run with CLIPFORGE_TEST_REAL_WHISPER=1.
Needs network on first run (model download) and takes ~10-60 s."""
import os

import pytest

from app.pipeline import ffmpeg_tools as ff
from app.pipeline import transcribe

pytestmark = pytest.mark.skipif(not os.environ.get("CLIPFORGE_TEST_REAL_WHISPER"),
                                reason="set CLIPFORGE_TEST_REAL_WHISPER=1 to run")


def test_real_model_runs_on_tone(tmp_path, sample_video, monkeypatch):
    monkeypatch.undo()  # drop the conftest block on get_model
    wav = ff.extract_audio_wav(sample_video, tmp_path / "a.wav")
    res = transcribe.transcribe(wav, tmp_path / "transcript.json", model_size="tiny")
    assert res["available"] is True  # a pure tone yields few/no words; we only assert the model ran
    assert isinstance(res["words"], list)
