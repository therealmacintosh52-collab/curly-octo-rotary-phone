from app.pipeline import captions
from tests.fakes import SCRIPT_90S, fake_words


def test_words_in_range_rebases_and_clamps():
    words = fake_words("one two three four five six seven eight nine ten", wps=2.0)  # 0..5 s
    w = captions.words_in_range(words, 1.0, 3.0)
    assert w and w[0]["start"] == 0.0 and all(0 <= x["start"] < x["end"] <= 2.0 for x in w)
    assert [x["word"] for x in w][0] == "three"
    assert captions.words_in_range(words, 100, 110) == []


def test_chunk_words_breaks_on_punctuation_and_count():
    words = fake_words("Here's the thing. Most people think the money is in finding cheap products.")
    lines = captions.chunk_words(words, max_words=4, max_seconds=2.4)
    assert lines[0][-1]["word"] == "thing."
    assert all(len(l) <= 4 for l in lines)
    assert sum(len(l) for l in lines) == len(words)


def test_build_ass_has_one_event_per_word_and_highlight():
    words = captions.words_in_range(fake_words(SCRIPT_90S), 0.0, 10.0)
    ass = captions.build_ass(words, 10.0)
    assert "[Script Info]" in ass and "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    events = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
    assert len(events) == len(words)
    assert events[0].count("\\c&H") == 2 and "\\fscx108" in events[0]
    assert "Welcome" in events[0] and "MarginV" not in events[0]
    # styles line carries the default safe-zone bottom margin (+10 px so captions sit above the UI strip)
    from app import settings
    bottom = int(1920 * settings.load_config("platforms")["defaults"]["safe_zone"]["bottom_pct"]) + 10
    style = next(l for l in ass.splitlines() if l.startswith("Style:"))
    assert style.split(",")[-2] == str(bottom)
    # times monotonic
    starts = [e.split(",")[1] for e in events]
    assert starts == sorted(starts)
    assert captions.build_ass([], 5.0).endswith("Text\n")


def test_build_srt_format():
    words = captions.words_in_range(fake_words(SCRIPT_90S), 0.0, 6.0)
    srt = captions.build_srt(words)
    assert srt.startswith("1\n00:00:00,000 --> ")
    assert "-->" in srt and "Welcome back" in srt


def test_write_captions_files(tmp_path):
    words = fake_words(SCRIPT_90S)
    res = captions.write_captions(tmp_path, 2, words, 10.0, 25.0)
    assert res["ass"] == "captions/clip_03.ass" and (tmp_path / res["ass"]).exists()
    assert (tmp_path / res["srt"]).exists() and res["n_words"] > 10
    assert all(0 <= w["start"] <= 15.0 for w in res["words"])
