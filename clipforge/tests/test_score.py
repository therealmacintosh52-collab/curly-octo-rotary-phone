from app import db, settings
from app.pipeline import llm, score, segment
from tests.fakes import SCRIPT_90S, fake_words

CFG = settings.load_config("scoring")


def _setup():
    words = fake_words(SCRIPT_90S)
    duration = words[-1]["end"] + 1.0
    sentences = segment.build_sentences(words)
    cands = segment.generate_candidates(sentences, duration, scenes=[], cfg=CFG)
    analysis = {"energy": {"hop": 0.1, "values": [0.6] * int(duration * 10)}, "scenes": [20.0, 40.0, 41.0, 42.0]}
    return cands, analysis, SCRIPT_90S


def test_features_in_range_and_sensible():
    cands, analysis, text = _setup()
    kws = score.top_keywords(text)
    assert "listings" in kws and "the" not in kws
    for c in cands:
        f = score.features_for(c, energy=analysis["energy"], scenes=analysis["scenes"], keywords=kws, cfg=CFG)
        for k, v in f.items():
            assert 0.0 <= v <= 1.0, (k, v)
    hooky = {"start": 0, "end": 30, "text": "Here's the thing. Nobody tells you the biggest mistake! Why? Because it's insane.", "n_words": 14}
    bland = {"start": 0, "end": 30, "text": "and then we went to the store and then we came back and then", "n_words": 14}
    fh = score.features_for(hooky, energy={}, scenes=[], keywords=[], cfg=CFG)
    fb = score.features_for(bland, energy={}, scenes=[], keywords=[], cfg=CFG)
    assert fh["hook_phrases"] > fb["hook_phrases"] == 0.0
    assert fh["question"] == 0.5 and fb["question"] == 0.0
    assert fh["self_contained"] == 1.0 and fb["self_contained"] == 0.0
    assert fh["emphasis"] > 0 and fh["length_fit"] > 0.8
    assert score.heuristic_score(fh, CFG["weights"]) > score.heuristic_score(fb, CFG["weights"])
    dense = {"start": 40.5, "end": 52.5, "text": "x", "n_words": 1}
    assert score.features_for(dense, energy={}, scenes=analysis["scenes"], keywords=[], cfg=CFG)["scene_change_density"] > 0.5


def test_filler_penalty_lowers_score():
    clean = {"start": 0, "end": 30, "text": "Check sold comps before you list.", "n_words": 6}
    filler = {"start": 0, "end": 30, "text": "um like you know um check uh comps like before um", "n_words": 10}
    fc = score.features_for(clean, energy={}, scenes=[], keywords=[], cfg=CFG)
    ff_ = score.features_for(filler, energy={}, scenes=[], keywords=[], cfg=CFG)
    assert ff_["filler_penalty"] > fc["filler_penalty"] == 0.0


def test_select_clips_no_overlap_and_limits():
    scored = [
        {"start": 0, "end": 30, "score": 0.9}, {"start": 5, "end": 35, "score": 0.85},  # overlaps first
        {"start": 40, "end": 70, "score": 0.7}, {"start": 42, "end": 60, "score": 0.95},  # overlaps third, higher
        {"start": 100, "end": 130, "score": 0.5}, {"start": 200, "end": 230, "score": 0.4},
    ]
    picked = score.select_clips(scored, max_clips=3, min_gap=5)
    assert [(p["start"], p["end"]) for p in picked] == [(0, 30), (42, 60), (100, 130)]
    assert len(score.select_clips(scored, max_clips=10, min_gap=5)) == 4


def test_score_candidates_heuristic_only():
    cands, analysis, text = _setup()
    events = []
    res = score.score_candidates(cands, analysis=analysis, full_text=text, title="Reselling", options={"max_clips": 3},
                                 progress=lambda f, m: events.append(f), use_llm=False)
    assert res["llm_used"] is False and res["n_candidates"] == len(cands)
    assert 1 <= len(res["selected"]) <= 3
    assert res["selected"] == sorted(res["selected"], key=lambda c: c["start"])
    assert all(c["llm"] is None and c["score"] == c["heuristic"] for c in res["selected"])
    assert res["all"][0]["score"] >= res["all"][-1]["score"]
    assert events[-1] == 1.0


def test_score_candidates_blends_llm(monkeypatch):
    cands, analysis, text = _setup()
    sent = {}
    def fake_llm(top, title=None, keywords=None):
        sent["n"] = len(top)
        # Make the LLM love the lowest-heuristic candidate it sees.
        worst = min(top, key=lambda c: c["heuristic"])
        return [{"index": worst["index"], "score": 1.0, "hook": "WOW", "reason": "great"}]
    monkeypatch.setattr(llm, "score_candidates", fake_llm)
    res = score.score_candidates(cands, analysis=analysis, full_text=text, options={"max_clips": 2}, use_llm=True)
    assert res["llm_used"] and sent["n"] <= CFG["llm"]["max_candidates_sent"]
    boosted = [c for c in res["all"] if c["llm"] == 1.0]
    assert len(boosted) == 1 and boosted[0]["llm_hook"] == "WOW"
    w = CFG["llm"]["blend_weight"]
    assert abs(boosted[0]["score"] - ((1 - w) * boosted[0]["heuristic"] + w)) < 1e-3


def test_llm_failure_falls_back(monkeypatch):
    cands, analysis, text = _setup()
    monkeypatch.setattr(llm, "score_candidates", lambda *a, **k: None)
    res = score.score_candidates(cands, analysis=analysis, full_text=text, use_llm=True)
    assert res["llm_used"] is False and res["selected"]


def test_learned_weights_override_config():
    base = score.effective_weights(CFG)
    assert base == CFG["weights"]
    db.kv_set("scoring_weights", {"audio_energy": 0.45, "bogus": 9})
    w = score.effective_weights(CFG)
    assert w["audio_energy"] == 0.45 and "bogus" not in w and w["hook_phrases"] == CFG["weights"]["hook_phrases"]


def test_llm_module_parses_and_rejects(monkeypatch):
    cands = [{"index": 3, "start": 0, "end": 20, "text": "a"}, {"index": 7, "start": 30, "end": 50, "text": "b"}]
    monkeypatch.setattr(llm, "_structured", lambda *a, **k: {"ratings": [
        {"index": 3, "score": 150, "hook": "h", "reason": "r"}, {"index": 99, "score": 50, "hook": "", "reason": ""}]})
    out = llm.score_candidates(cands, title="t")
    assert out == [{"index": 3, "score": 1.0, "hook": "h", "reason": "r"}]
    monkeypatch.setattr(llm, "_structured", lambda *a, **k: None)
    assert llm.score_candidates(cands) is None
    assert llm.score_candidates([]) is None
