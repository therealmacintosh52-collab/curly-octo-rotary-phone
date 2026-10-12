from datetime import datetime
from zoneinfo import ZoneInfo

from app import db, settings
from app.pipeline import copy as copy_mod, feedback, llm, schedule
from tests.fakes import SCRIPT_90S

PCONF = settings.load_config("platforms")
ALL = list(PCONF["platforms"])


def _clip(text=SCRIPT_90S[:400], dur=35.0, hook=None):
    return {"id": "c1", "idx": 0, "start_s": 10.0, "end_s": 10.0 + dur, "score": 0.7, "transcript": text,
            "score_breakdown": {"llm_hook": hook}}


def test_heuristic_copy_respects_platform_rules():
    out = copy_mod.generate_copy(_clip(), platforms=ALL, keywords=["reselling", "listings", "titles"], use_llm=False)
    assert set(out) == set(ALL)
    yt = out["youtube_shorts"]
    assert yt["source"] == "heuristic" and yt["title"].endswith("#Shorts") and len(yt["title"]) <= 100
    assert yt["hashtags"][-1] == "#shorts" and len(yt["hashtags"]) == 3
    tt = out["tiktok"]
    assert "#fyp" in tt["hashtags"] and len(tt["hashtags"]) == 4 and "#reselling" in tt["hashtags"]
    assert tt["caption"].splitlines()[0].startswith("Welcome back to the channel")
    assert "Follow for part two." in tt["caption"] and tt["caption"].rstrip().endswith("#fyp")
    assert all(k in ("reselling", "listings", "titles") or len(k) >= 4 for k in tt["keywords"])
    assert all(v["fits"] for v in out.values())


def test_fit_check_flags_overlong_clips():
    out = copy_mod.generate_copy(_clip(dur=75), platforms=ALL, keywords=[], use_llm=False)
    assert out["youtube_shorts"]["fits"] is False and "60s" in out["youtube_shorts"]["fit_note"]
    assert out["tiktok"]["fits"] is True


def test_llm_hook_feeds_title_and_filler_stripped():
    out = copy_mod.generate_copy(_clip(hook="um, nobody tells you this trick"), platforms=["tiktok"], keywords=[], use_llm=False)
    assert out["tiktok"]["hook"] == "Nobody tells you this trick"


def test_llm_copy_merges_over_heuristic(monkeypatch):
    def fake(clip, platforms, platform_config, keywords=None, video_title=None):
        return {"tiktok": {"title": "LLM title", "hook": "LLM hook", "caption": "LLM caption\n\n#one #two",
                           "hashtags": ["one", "#two"], "keywords": ["alpha"]}}
    monkeypatch.setattr(llm, "generate_copy", fake)
    out = copy_mod.generate_copy(_clip(), platforms=["tiktok", "instagram_reels"], keywords=[], use_llm=True)
    assert out["tiktok"]["source"] == "llm" and out["tiktok"]["hashtags"] == ["#one", "#two"]
    assert out["tiktok"]["hook"] == "LLM hook" and out["tiktok"]["caption"].startswith("LLM caption")
    assert out["instagram_reels"]["source"] == "heuristic"
    monkeypatch.setattr(llm, "generate_copy", lambda *a, **k: None)
    out2 = copy_mod.generate_copy(_clip(), platforms=["tiktok"], keywords=[], use_llm=True)
    assert out2["tiktok"]["source"] == "heuristic"


def test_schedule_respects_windows_caps_and_stagger():
    tz = ZoneInfo("America/Los_Angeles")
    now = datetime(2026, 10, 12, 9, 0, tzinfo=tz)  # a Monday
    clips = [{"id": f"c{i}", "idx": i, "score": 1 - i * 0.1} for i in range(5)]
    plan = schedule.build_schedule(clips, ["tiktok", "youtube_shorts"], now=now)
    assert set(plan) == {c["id"] for c in clips}
    tt = sorted(datetime.fromisoformat(plan[c["id"]]["tiktok"]["at"]) for c in clips)
    assert all(t > now for t in tt) and tt[0].date() >= now.date().replace(day=13)
    assert tt == sorted(tt) and all((b - a).total_seconds() >= 6 * 3600 for a, b in zip(tt, tt[1:]))
    per_day: dict = {}
    for t in tt:
        per_day[t.date()] = per_day.get(t.date(), 0) + 1
    assert max(per_day.values()) <= 2
    # TikTok Mon-Fri windows are 07:30/18:30/21:00
    assert all((t.hour, t.minute) in {(7, 30), (18, 30), (21, 0), (11, 0), (20, 0)} for t in tt)
    # best clip gets the first slot; second platform is staggered by 20 min from its own slot grid
    best = plan["c0"]; assert datetime.fromisoformat(best["tiktok"]["at"]) == tt[0]
    yt = datetime.fromisoformat(best["youtube_shorts"]["at"])
    assert yt.minute in (20, 50) and best["youtube_shorts"]["timezone"] == "America/Los_Angeles"
    assert "weekday" in best["tiktok"] and best["tiktok"]["local"]


def test_ics_export():
    clips = [{"id": "c1", "idx": 0, "copy": {"tiktok": {"title": "T", "caption": "a\nb"}},
              "schedule": {"tiktok": {"at": "2026-10-13T18:30-07:00"}}}]
    ics = schedule.to_ics({"id": "j"}, clips, {"tiktok": "TikTok"})
    assert "BEGIN:VEVENT" in ics and "DTSTART:20261014T013000Z" in ics and "SUMMARY:Post TikTok: T" in ics
    assert "DESCRIPTION:a\\nb" in ics


def test_feedback_moves_weights_toward_liked_features():
    job = db.create_job("upload")
    liked = db.create_clip(job["id"], 0, 0, 30, score=0.8, score_breakdown={"features": {"hook_phrases": 0.9, "audio_energy": 0.1}})
    hated = db.create_clip(job["id"], 1, 40, 70, score=0.3, score_breakdown={"features": {"hook_phrases": 0.1, "audio_energy": 0.9}})
    base = settings.load_config("scoring")["weights"]
    assert feedback.current_weights()["learned"] is None
    fb = feedback.record(liked["id"], 1, "great")
    w1 = fb["weights"]
    assert w1["hook_phrases"] > base["hook_phrases"] and w1["audio_energy"] < base["audio_energy"]
    feedback.record(hated["id"], -1)
    w2 = feedback.current_weights()["learned"]
    assert w2["hook_phrases"] > w1["hook_phrases"] and w2["audio_energy"] < w1["audio_energy"]
    assert abs(sum(w2.values()) - sum(base.values())) < 1e-3
    assert feedback.current_weights()["n_feedback"] == 2
    from app.pipeline import score
    assert score.effective_weights(settings.load_config("scoring"))["hook_phrases"] == w2["hook_phrases"]
    assert feedback.reset()["learned"] is None


def test_caption_body_keeps_whole_short_sentences():
    out = copy_mod.generate_copy(_clip(text="Welcome back. Today I want to talk about reselling. Here's the thing. Most people are wrong."),
                                 platforms=["tiktok"], keywords=[], use_llm=False)
    cap = out["tiktok"]["caption"]
    assert "Today I want to talk about reselling. Here's the thing." in cap
    assert "…" not in cap
