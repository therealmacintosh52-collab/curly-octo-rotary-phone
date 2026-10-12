import json

from app.pipeline import transcribe
from tests.fakes import SCRIPT_90S, FakeWhisperModel, fake_words


def test_transcribe_with_fake_model(tmp_path):
    words = fake_words(SCRIPT_90S)
    out = tmp_path / "transcript.json"
    events = []
    res = transcribe.transcribe(tmp_path / "audio.wav", out, model=FakeWhisperModel(words),
                                progress=lambda f, m: events.append(f))
    assert res["available"] and res["language"] == "en"
    assert len(res["words"]) == len(words)
    assert res["words"][0]["word"] == "Welcome" and res["words"][0]["start"] == 0.0
    assert all(w["end"] > w["start"] for w in res["words"])
    assert res["text"].startswith("Welcome back")
    saved = json.loads(out.read_text())
    assert saved["segments"][0]["words"][0]["word"] == "Welcome"
    assert events[-1] == 1.0 and events == sorted(events)


def test_transcribe_degrades_when_model_unavailable(tmp_path, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("no network")
    monkeypatch.setattr(transcribe, "get_model", boom)
    out = tmp_path / "transcript.json"
    res = transcribe.transcribe(tmp_path / "audio.wav", out)
    assert res["available"] is False and "no network" in res["error"]
    assert json.loads(out.read_text())["words"] == []
    assert transcribe.load_transcript(tmp_path)["available"] is False
    assert transcribe.load_transcript(tmp_path / "nope") is None
