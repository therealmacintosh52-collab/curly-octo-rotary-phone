import json
import shutil
from types import SimpleNamespace

from app import db, settings
from app.pipeline import brief, copy as copy_mod, ffmpeg_tools as ff, llm, render, spec
from tests.fakes import SCRIPT_90S, fake_words


def test_niche_detection_from_transcript_and_metadata():
    key, n, scores = brief.detect_niche(SCRIPT_90S)
    assert key == "reselling_ecommerce" and n["label"].startswith("Reselling")
    key2, _, _ = brief.detect_niche("today we talk about the weather", {"title": "Bible prophecy of Daniel explained", "tags": ["scripture"]})
    assert key2 == "faith_bible"
    key3, n3, _ = brief.detect_niche("hello there how are you")
    assert key3 == "general" and n3["key"] == "general"


def test_heuristic_brief_fields():
    words = fake_words(SCRIPT_90S)
    b = brief.heuristic_brief(SCRIPT_90S, remote_meta={"title": "How I 4x'd my eBay sales"}, words=words)
    assert b["source"] == "heuristic" and b["niche"] == "reselling_ecommerce"
    assert b["subject"] == "How I 4x'd my eBay sales" and "listings" in b["keywords"]
    assert b["audience"] and b["cta"] and "#" not in b["hashtags"][0]
    assert "mistake" in b["promise"].lower() or "here's" in b["promise"].lower()
    b2 = brief.heuristic_brief(SCRIPT_90S, hint="Poshmark tips for busy moms")
    assert b2["subject"] == "Poshmark tips for busy moms" and b2["hint"]


def test_build_brief_merges_llm_and_trends(tmp_path, monkeypatch):
    monkeypatch.setattr(llm, "research_trends", lambda **k: {"summary": "Sell-through rate is the phrase this month.", "hashtags": ["sellthrough", "resellertips"],
                                                              "phrases": ["sell through rate"], "sources": ["https://example.com/a"], "checked_at": "2026-10-12"})
    monkeypatch.setattr(llm, "generate_brief", lambda **k: {"subject": "Keyword titles that sell faster on eBay", "niche": "reselling_ecommerce",
                                                            "audience": "part-time eBay sellers with under 200 listings", "promise": "4x faster sales from titles alone",
                                                            "tone": "direct", "entities": ["eBay"], "keywords": ["ebay titles", "sold comps"],
                                                            "hashtags": ["ebayseller", "resellertips"], "platform_angles": {"tiktok": "the 4x stat", "youtube_shorts": "how-to"}})
    b = brief.build_brief(tmp_path, text=SCRIPT_90S, words=None, remote_meta={}, platforms=["tiktok", "youtube_shorts"], use_llm=True, web_search=True)
    assert b["source"] == "llm" and b["audience"].startswith("part-time") and b["trends"]["hashtags"] == ["sellthrough", "resellertips"]
    assert b["platform_angles"]["tiktok"] == "the 4x stat" and b["niche_label"].startswith("Reselling")
    assert json.loads((tmp_path / "brief.json").read_text())["subject"].startswith("Keyword titles")
    # LLM brief fails → heuristic brief but trends kept
    monkeypatch.setattr(llm, "generate_brief", lambda **k: None)
    b2 = brief.build_brief(tmp_path, text=SCRIPT_90S, words=None, remote_meta={}, platforms=["tiktok"], use_llm=True, web_search=True)
    assert b2["source"] == "heuristic" and b2["trends"]["checked_at"] == "2026-10-12"
    # no LLM → no research call at all
    monkeypatch.setattr(llm, "research_trends", lambda **k: (_ for _ in ()).throw(AssertionError("should not be called")))
    b3 = brief.build_brief(tmp_path, text=SCRIPT_90S, words=None, remote_meta={}, platforms=["tiktok"], use_llm=False)
    assert b3["source"] == "heuristic" and b3["trends"] is None


def test_research_trends_parses_tags_and_sources(monkeypatch):
    monkeypatch.setattr(llm, "_text_with_search", lambda *a, **k: {"text": "Creators are leaning into sold-comps breakdowns.\nHASHTAGS: #ebay, resellertips , SoldComps\nPHRASES: ebay sold comps; what sells on ebay", "sources": ["https://x.y/1"]})
    t = llm.research_trends(subject="s", niche_label="n", audience="a", platforms=["tiktok"])
    assert t["hashtags"] == ["ebay", "resellertips", "soldcomps"] and t["phrases"] == ["ebay sold comps", "what sells on ebay"]
    assert t["summary"].startswith("Creators") and "HASHTAGS" not in t["summary"] and t["sources"] == ["https://x.y/1"]
    monkeypatch.setattr(llm, "_text_with_search", lambda *a, **k: None)
    assert llm.research_trends(subject="s", niche_label="n", audience="a", platforms=["tiktok"]) is None


def test_text_with_search_resumes_pause_turn(monkeypatch):
    calls = []
    class Resp:
        def __init__(self, stop, content): self.stop_reason, self.content = stop, content
    class Client:
        class beta:
            class messages:
                @staticmethod
                def create(**kw):
                    calls.append(kw)
                    if len(calls) == 1:
                        return Resp("pause_turn", [SimpleNamespace(type="server_tool_use")])
                    return Resp("end_turn", [SimpleNamespace(type="web_search_tool_result", content=[SimpleNamespace(url="https://a.b/c")]),
                                             SimpleNamespace(type="text", text="done")])
    monkeypatch.setattr(llm, "_get_client", lambda: Client())
    res = llm._text_with_search("sys", "user")
    assert res == {"text": "done", "sources": ["https://a.b/c"]} and len(calls) == 2
    assert calls[1]["messages"][1]["role"] == "assistant" and calls[0]["tools"][0]["type"] == "web_search_20260209"


def test_polish_words_keeps_count_and_timing(monkeypatch):
    words = fake_words("i sold it on ebay for ten dollars.")
    good = ["I", "sold", "it", "on", "eBay", "for", "ten", "dollars."]
    monkeypatch.setattr(llm, "_structured", lambda *a, **k: {"words": good})
    out = llm.polish_words(words, brief={"entities": ["eBay"]}, chunk=5)
    # chunks of 5 then 3: the stub returns 8 both times → both chunks rejected → None
    assert out is None
    monkeypatch.setattr(llm, "_structured", lambda s, u, sch, **k: {"words": good[:5] if "exactly 5" in u else good[5:]})
    out = llm.polish_words(words, brief={"entities": ["eBay"]}, chunk=5)
    assert [w["word"] for w in out] == good
    assert [(w["start"], w["end"]) for w in out] == [(w["start"], w["end"]) for w in words]
    monkeypatch.setattr(llm, "_structured", lambda *a, **k: {"words": [w["word"] for w in words]})
    assert llm.polish_words(words, brief=None) is None  # nothing changed → None


def test_copy_uses_brief_hashtags_cta_and_description():
    b = brief.heuristic_brief(SCRIPT_90S, remote_meta={"title": "eBay titles"})
    b["trends"] = {"hashtags": ["sellthrough"]}
    clip = {"id": "c", "idx": 0, "start_s": 0, "end_s": 30, "score": .5, "transcript": SCRIPT_90S[:300], "score_breakdown": {}}
    out = copy_mod.generate_copy(clip, platforms=["tiktok", "youtube_shorts"], keywords=["listings"], use_llm=False, brief=b)
    tt = out["tiktok"]
    assert tt["hashtags"][0] == "#sellthrough" and any(t in ("#sidehustle", "#ecommerce", "#reselling") for t in tt["hashtags"])
    assert "Follow for the next listing trick." in tt["caption"] and tt["rationale"] and tt["title_options"]
    yt = out["youtube_shorts"]
    assert yt["description"] and "eBay titles" in yt["description"] and "#shorts" in yt["description"].lower()
    assert tt["description"] == "" and out["tiktok"]["spec"]["ok"] and yt["spec"]["ok"]


def test_llm_copy_merge_keeps_description_and_options(monkeypatch):
    monkeypatch.setattr(llm, "generate_copy", lambda *a, **k: {"youtube_shorts": {"title": "Why keyword titles sell 4x faster", "title_options": ["A", "B", "C", "D"],
                                                                                   "hook": "4x faster sales", "caption": "4x faster sales\n\nTitles decide.\n\n#ebay #reselling #shorts",
                                                                                   "description": "Keyword-first titles doubled sales. What's your best seller?", "hashtags": ["ebay", "reselling", "shorts"],
                                                                                   "keywords": ["ebay titles"], "rationale": "search-led"}})
    clip = {"id": "c", "idx": 0, "start_s": 0, "end_s": 30, "score": .5, "transcript": "Titles matter.", "score_breakdown": {}}
    out = copy_mod.generate_copy(clip, platforms=["youtube_shorts"], keywords=[], use_llm=True)
    yt = out["youtube_shorts"]
    assert yt["source"] == "llm" and yt["title_options"] == ["A", "B", "C"] and yt["description"].startswith("Keyword-first")
    assert yt["rationale"] == "search-led" and yt["spec"]["ok"]


def test_cover_with_hook_text(tmp_path, sample_video):
    job = tmp_path / "job"; job.mkdir()
    shutil.copy(sample_video, job / "source.mp4")
    media = ff.probe(job / "source.mp4").to_dict()
    res = render.render_clip(job, idx=0, start=0.0, end=4.0, src_media=media, captions_ass=None, reframe="center", folder="tiktok",
                             profile=spec.profile_for("tiktok"))
    out = render.cover_with_text(job, res["cover_path"], "Nobody tells you this", "clips/tiktok/clip_01_cover_hook.jpg",
                                 safe_zone=spec.profile_for("tiktok")["safe_zone"])
    assert out and (job / out).exists() and ff.probe(job / out).width == 1080
    import cv2
    a = cv2.imread(str(job / res["cover_path"])); b = cv2.imread(str(job / out))
    assert abs(a.astype(int) - b.astype(int)).mean() > 1.0
    assert render.cover_with_text(job, res["cover_path"], "", "clips/tiktok/x.jpg") is None


def test_brief_endpoint_edit_rewrites_copy(client):
    from app.pipeline import runner
    job = db.create_job("upload", options={"platforms": ["tiktok"]})
    jd = runner.job_dir_for(job["id"]); jd.mkdir(parents=True)
    b = brief.heuristic_brief(SCRIPT_90S); (jd / "brief.json").write_text(json.dumps(b))
    c = db.create_clip(job["id"], 0, 0, 30, transcript=SCRIPT_90S[:200])
    db.update_clip(c["id"], copy=copy_mod.generate_copy(db.get_clip(c["id"]), platforms=["tiktok"], keywords=[], use_llm=False, brief=b))
    assert client.get(f"/api/jobs/{job['id']}/brief").json()["niche"] == "reselling_ecommerce"
    r = client.patch(f"/api/jobs/{job['id']}/brief", json={"niche": "gaming", "audience": "ranked grinders"})
    assert r.status_code == 200 and r.json()["source"] == "edited" and r.json()["niche_label"].startswith("Gaming")
    cp = db.get_clip(c["id"])["copy"]["tiktok"]
    assert "#gaming" in cp["hashtags"] and "ranked tip" in cp["caption"]
    assert client.patch(f"/api/jobs/{job['id']}/brief", json={"niche": "nope"}).status_code == 400
