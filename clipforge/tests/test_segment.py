import numpy as np
import pytest

from app import settings
from app.pipeline import ffmpeg_tools as ff
from app.pipeline import segment
from tests.fakes import SCRIPT_90S, fake_words

CFG = settings.load_config("scoring")


@pytest.fixture(scope="session")
def scene_video(tmp_path_factory):
    p = tmp_path_factory.mktemp("media") / "scenes.mp4"
    ff.make_scene_test_video(p, segment_seconds=4.0, colors=("red", "green", "blue"))
    return p


def test_detect_scenes_finds_hard_cuts(scene_video):
    cuts = segment.detect_scenes(scene_video)
    assert len(cuts) == 2, cuts
    assert abs(cuts[0] - 4.0) < 0.3 and abs(cuts[1] - 8.0) < 0.3


def test_audio_energy_tracks_loud_quiet(sample_video, tmp_path):
    wav = ff.extract_audio_wav(sample_video, tmp_path / "a.wav")
    e = segment.audio_energy(wav)
    assert e["hop"] == 0.1
    assert abs(len(e["values"]) - 200) <= 3  # 20 s at 10 Hz
    assert 0.0 <= min(e["values"]) and max(e["values"]) <= 1.0
    # The test tone is loud for 3 s then quiet for 3 s, repeating.
    loud = segment.energy_window(e, 0.3, 2.7)
    quiet = segment.energy_window(e, 3.3, 5.7)
    assert loud > quiet + 0.3, (loud, quiet)
    assert segment.energy_window({"hop": 0.1, "values": []}, 0, 1) == 0.5


def test_build_sentences_splits_on_punctuation_and_gaps():
    words = fake_words("Hello there. How are you? I am fine thanks")
    words[-1]["start"] += 3.0; words[-1]["end"] += 3.0  # long pause before the last word
    s = segment.build_sentences(words)
    assert [x["text"] for x in s] == ["Hello there.", "How are you?", "I am fine", "thanks"]
    assert s[0]["start"] == 0.0 and s[0]["n_words"] == 2
    assert segment.build_sentences([]) == []


def test_build_sentences_caps_length():
    words = fake_words(" ".join(["word"] * 120), wps=2.0)  # 60 s with no punctuation
    s = segment.build_sentences(words, max_len=18.0)
    assert len(s) >= 3 and all(x["end"] - x["start"] <= 19.0 for x in s)


def test_generate_candidates_respect_length_and_boundaries():
    words = fake_words(SCRIPT_90S)
    duration = words[-1]["end"] + 1.0
    sentences = segment.build_sentences(words)
    cands = segment.generate_candidates(sentences, duration, scenes=[], cfg=CFG)
    assert cands, "expected candidates from a 90 s script"
    lo, hi = CFG["clip_length"]["min_seconds"], CFG["clip_length"]["max_seconds"]
    for c in cands:
        d = c["end"] - c["start"]
        assert lo * 0.9 <= d <= hi + 1.0, c
        assert 0 <= c["start"] < c["end"] <= duration
        assert c["text"].strip() and c["n_words"] > 0
        assert c["sentence_start"] <= c["sentence_end"]
    starts = {c["sentence_start"] for c in cands}
    assert len(starts) > 5


def test_generate_candidates_snaps_to_nearby_cut():
    words = fake_words(SCRIPT_90S)
    sentences = segment.build_sentences(words)
    s0 = sentences[1]["start"] - CFG["clip_length"]["pad_before"]
    cut = round(s0 + 0.3, 3)
    cands = segment.generate_candidates(sentences, 200.0, scenes=[cut], cfg=CFG)
    from_s1 = [c for c in cands if c["sentence_start"] == 1]
    assert from_s1 and all(c["start"] == cut for c in from_s1)


def test_fallback_candidates_without_transcript():
    cands = segment.fallback_candidates(120.0, scenes=[30.0, 61.0], cfg=CFG)
    assert cands and all(CFG["clip_length"]["min_seconds"] <= c["end"] - c["start"] <= CFG["clip_length"]["max_seconds"] for c in cands)
    assert cands[0]["text"] == "" and cands[0]["n_words"] == 0
    assert any(c["start"] == 30.0 or c["end"] == 30.0 for c in cands)


def test_analyze_writes_files(tmp_path, scene_video):
    import shutil
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(scene_video, job / "source.mp4")
    ff.extract_audio_wav(scene_video, job / "audio.wav")
    transcript = {"words": fake_words("One two three four. Five six seven eight nine ten eleven twelve. "
                                      "Thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.", wps=1.6)}
    analysis, cands = segment.analyze(job, transcript=transcript, duration=12.0)
    assert analysis["mode"] == "transcript" and analysis["n_scenes"] == 3 and analysis["whole_source"] is False
    assert len(analysis["energy"]["values"]) > 100
    assert cands == segment.load_candidates(job) and segment.load_analysis(job)["n_scenes"] == 3
    # Without words → fallback mode.
    analysis2, cands2 = segment.analyze(job, transcript=None, duration=12.0, audio=None)
    assert analysis2["mode"] == "fallback" and analysis2["energy"]["values"] == []


def test_analyze_short_source_yields_whole_clip(tmp_path, scene_video):
    import shutil
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(scene_video, job / "source.mp4")
    analysis, cands = segment.analyze(job, transcript=None, duration=8.0, audio=None)
    assert analysis["mode"] == "fallback" and analysis["whole_source"] is True and len(cands) == 1
    assert cands[0]["start"] == 0.0 and cands[0]["end"] == 8.0 and cands[0]["text"] == ""
    words = fake_words("Short and sweet. That is all.", wps=2.5)
    analysis2, cands2 = segment.analyze(job, transcript={"words": words}, duration=5.0, audio=None)
    assert analysis2["whole_source"] is True and cands2[0]["text"] == "Short and sweet. That is all."
    assert cands2[0]["n_words"] == 6 and (cands2[0]["sentence_start"], cands2[0]["sentence_end"]) == (0, 1)
    _, none = segment.analyze(job, transcript=None, duration=2.0, audio=None)
    assert none == []


def test_analyze_sparse_speech_in_long_source_uses_grid_with_overlapping_text(tmp_path, scene_video):
    import shutil
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(scene_video, job / "source.mp4")
    words = fake_words("Only one sentence here.", start=50.0, wps=2.0)  # 50-52 s of speech in a 100 s video
    analysis, cands = segment.analyze(job, transcript={"words": words}, duration=100.0, audio=None)
    assert analysis["mode"] == "fallback" and analysis["whole_source"] is False and len(cands) > 3
    assert cands[0]["start"] == 0.0 and cands[0]["end"] <= 60.0
    with_text = [c for c in cands if c["text"]]
    assert with_text and all(c["start"] < 52 and c["end"] > 50 for c in with_text)
    assert all(c["text"] == "" for c in cands if c["end"] <= 50 or c["start"] >= 52)
