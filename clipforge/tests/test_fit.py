import json

from app import settings
from app.pipeline import fit, segment
from tests.fakes import SCRIPT_90S, fake_words

PCONF = settings.load_config("platforms")
ALL = list(PCONF["platforms"])
WORDS = fake_words(SCRIPT_90S, wps=2.2)          # ~90 s of speech
SENTS = segment.build_sentences(WORDS)
DUR = WORDS[-1]["end"] + 1.0


def _scorer(s, e, t, n):
    return 0.5 + (0.1 if "mistake" in t else 0.0)   # flat, with a small preference for one phrase


def _pconf(**over):
    cfg = json.loads(json.dumps(PCONF))
    for plat, vals in over.items():
        cfg["platforms"][plat].update(vals)
    return cfg


def _span(i, min_len):
    j = i
    while SENTS[j]["end"] - SENTS[i]["start"] < min_len:
        j += 1
    return SENTS[i]["start"], SENTS[j]["end"]


def test_master_in_sweet_spot_is_shared_everywhere():
    s, e = _span(3, 32)                                   # 32-45 s sits inside every platform's ideal range
    assert 30 <= e - s <= 45
    vs = fit.fit_variants(s, e, "x", platforms=ALL, sentences=SENTS, words=WORDS, duration=DUR, scorer=_scorer)
    assert set(vs) == set(ALL)
    assert all(v["reason"] == "master" and v["fits"] and v["start"] == s and v["end"] == e for v in vs.values())
    assert fit.unique_ranges(vs, (s, e)) == {}


def test_long_master_is_trimmed_into_ideal_range_keeping_hook():
    s, e = SENTS[0]["start"], SENTS[20]["end"]          # ~75 s master
    text = " ".join(x["text"] for x in SENTS[:21])
    vs = fit.fit_variants(s, e, text, platforms=ALL, sentences=SENTS, words=WORDS, duration=DUR, scorer=_scorer)
    for plat, v in vs.items():
        lo, hi = PCONF["platforms"][plat]["ideal_range"]
        assert v["reason"] == "trimmed" and lo <= v["duration"] <= hi, (plat, v)
        assert v["text"].endswith((".", "!", "?")) and v["text"].startswith(("Welcome", "Here", "Today", "Most"))
    # every variant starts on a sentence boundary inside the master
    assert all(v["start"] >= s and v["end"] <= e + 0.5 for v in vs.values())
    groups = fit.unique_ranges(vs, (s, e))
    assert groups and sum(len(p) for p in groups.values()) == len(ALL)


def test_short_master_is_extended_for_platforms_that_want_more():
    s, e = SENTS[1]["start"], SENTS[2]["end"]           # ~10 s
    vs = fit.fit_variants(s, e, "x", platforms=["youtube_shorts", "tiktok"], sentences=SENTS, words=WORDS, duration=DUR, scorer=_scorer)
    yt = vs["youtube_shorts"]
    assert yt["reason"] == "extended" and 30 <= yt["duration"] <= 60 and yt["start"] <= s + 0.01
    tt = vs["tiktok"]
    assert tt["reason"] == "extended" and 21 <= tt["duration"] <= 45


def test_limits_mode_only_enforces_hard_caps():
    s, e = SENTS[0]["start"], SENTS[20]["end"]          # ~75 s: legal everywhere, over every ideal
    vs = fit.fit_variants(s, e, "x", platforms=ALL, sentences=SENTS, words=WORDS, duration=DUR, scorer=_scorer, mode="limits")
    assert all(v["reason"] == "master" for v in vs.values())
    tight = _pconf(youtube_shorts={"max_duration": 40})
    vs2 = fit.fit_variants(s, e, "x", platforms=["youtube_shorts"], sentences=SENTS, words=WORDS, duration=DUR,
                           scorer=_scorer, pconf=tight, mode="limits")
    assert vs2["youtube_shorts"]["reason"] == "trimmed" and vs2["youtube_shorts"]["duration"] <= 40


def test_hard_cut_without_sentences_lands_on_a_word():
    words = fake_words(" ".join(["word"] * 300), wps=2.0)  # 150 s, no punctuation → one giant sentence
    sents = segment.build_sentences(words, max_len=10**6)
    assert len(sents) == 1
    tight = _pconf(tiktok={"max_duration": 30, "ideal_range": [21, 30]})
    vs = fit.fit_variants(0.0, 150.0, "x", platforms=["tiktok"], sentences=sents, words=words, duration=150.0,
                          scorer=_scorer, pconf=tight)
    v = vs["tiktok"]
    assert v["reason"] == "hard_cut" and v["duration"] <= 30
    assert any(abs(w["end"] + 0.25 - v["end"]) < 1e-6 for w in words), "cut should sit just after a word end"


def test_too_short_source_is_flagged_not_rendered():
    words = fake_words("Just one short line.", wps=2.5)
    sents = segment.build_sentences(words)
    vs = fit.fit_variants(0.0, 2.0, "Just one short line.", platforms=["youtube_shorts"], sentences=sents, words=words,
                          duration=2.0, scorer=_scorer)
    assert vs["youtube_shorts"]["fits"] is False and vs["youtube_shorts"]["reason"] == "too_short"
    assert fit.unique_ranges(vs, (0.0, 2.0)) == {}


def test_identical_variants_render_once():
    vs = {"a": {"fits": True, "start": 1.0, "end": 31.0}, "b": {"fits": True, "start": 1.0, "end": 31.0},
          "c": {"fits": True, "start": 0.0, "end": 60.0}, "d": {"fits": False, "start": 0, "end": 5}}
    assert fit.unique_ranges(vs, (0.0, 60.0)) == {(1.0, 31.0): ["a", "b"]}
