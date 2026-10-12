import json
import time

from app import db, settings


def _wait_done(client, job_id, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("done", "failed", "cancelled"):
            return j
        time.sleep(0.2)
    raise AssertionError("job did not finish")


def test_index_and_health(client):
    r = client.get("/")
    assert r.status_code == 200 and "ClipForge" in r.text
    h = client.get("/api/health").json()
    assert h["ok"] is True and h["stages"][0] == "ingest"
    assert h["llm_enabled"] is False or isinstance(h["llm_model"], str)
    cfg = client.get("/api/config").json()
    assert set(cfg["platforms"]["platforms"]) == {"youtube_shorts", "instagram_reels", "tiktok", "facebook_reels"}


def test_create_job_validation(client):
    assert client.post("/api/jobs", data={}).status_code == 400
    assert client.post("/api/jobs", data={"url": "ftp://nope"}).status_code == 400
    r = client.post("/api/jobs", data={"url": "https://x.y/v", "platforms": "tiktok,myspace", "run": "false"})
    assert r.status_code == 400 and "myspace" in r.json()["detail"]
    r = client.post("/api/jobs", data={"url": "https://x.y/v", "options": "[1,2]", "run": "false"})
    assert r.status_code == 400
    r = client.post("/api/jobs", files={"file": ("evil.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400


def test_upload_job_runs_ingest_end_to_end(client, sample_video):
    with sample_video.open("rb") as fh:
        r = client.post("/api/jobs", data={"platforms": "tiktok,youtube_shorts", "options": '{"max_clips": 3}'},
                        files={"file": ("talk.mp4", fh, "video/mp4")})
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["source_type"] == "upload" and job["options"]["platforms"] == ["tiktok", "youtube_shorts"]
    assert job["options"]["max_clips"] == 3

    done = _wait_done(client, job["id"])
    assert done["status"] == "done", done.get("error")
    assert done["title"] == "talk" and done["progress"] == 1.0
    assert done["meta"]["source"]["media"]["width"] == 1280
    # No speech model in tests → transcript unavailable → fallback windows still yield a clip.
    assert done["meta"]["transcript"]["available"] is False
    assert done["meta"]["analysis"]["mode"] == "fallback"
    assert len(done["clips"]) >= 1 and done["clips"][0]["transcript"] in (None, "")

    # Files are served from the job dir, path traversal is blocked.
    v = client.get(f"/api/jobs/{job['id']}/files/source.mp4")
    assert v.status_code == 200 and v.headers["content-type"].startswith("video/")
    assert client.get(f"/api/jobs/{job['id']}/files/../../etc/passwd").status_code in (400, 404)
    assert client.get(f"/api/jobs/{job['id']}/files/nope.mp4").status_code == 404

    jobs = client.get("/api/jobs").json()
    assert jobs[0]["id"] == job["id"]

    r = client.delete(f"/api/jobs/{job['id']}")
    assert r.status_code == 200
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404
    assert not (settings.JOBS_DIR / job["id"]).exists()


def test_url_job_failure_is_recorded(client, monkeypatch):
    from app.pipeline import ingest
    def boom(*a, **k):
        raise RuntimeError("Video unavailable")
    monkeypatch.setattr(ingest, "_download", boom)
    r = client.post("/api/jobs", data={"url": "https://www.youtube.com/watch?v=dead"})
    assert r.status_code == 201
    done = _wait_done(client, r.json()["id"])
    assert done["status"] == "failed" and "Video unavailable" in done["error"] and done["error"].startswith("ingest:")
    # Re-run endpoint re-queues it
    rr = client.post(f"/api/jobs/{done['id']}/run")
    assert rr.status_code == 200
    _wait_done(client, done["id"])


def test_create_without_run_stays_queued(client):
    r = client.post("/api/jobs", data={"url": "https://example.com/v.mp4", "run": "false"})
    assert r.status_code == 201 and r.json()["status"] == "queued"
    assert client.get("/api/jobs/doesnotexist").status_code == 404


def test_cleanup_endpoint(client):
    old = db.create_job("upload")
    (settings.JOBS_DIR / old["id"]).mkdir()
    db.update_job(old["id"], created_at=time.time() - 30 * 86400)
    fresh = db.create_job("upload")
    (settings.JOBS_DIR / fresh["id"]).mkdir()
    r = client.post("/api/cleanup", params={"days": 7, "dry_run": "true"}).json()
    assert r["removed_jobs"] == [old["id"]] and (settings.JOBS_DIR / old["id"]).exists()
    r = client.post("/api/cleanup", params={"days": 7}).json()
    assert r["removed_jobs"] == [old["id"]] and r["count"] == 1
    assert not (settings.JOBS_DIR / old["id"]).exists() and (settings.JOBS_DIR / fresh["id"]).exists()
    assert db.get_job(old["id"]) is None and db.get_job(fresh["id"]) is not None


def test_full_pipeline_phase2_creates_clips(client, sample_video, monkeypatch):
    """Upload → ingest → (fake) transcribe → analyze → score; clips land in the DB."""
    from app.pipeline import transcribe
    from tests.fakes import FakeWhisperModel, fake_words
    words = fake_words(
        "Here's the thing about this test video. Nobody tells you how boring colour bars are. "
        "The biggest mistake is watching all twenty seconds. So let me show you the trick. "
        "You skip to the end and write this down. That's the secret. Thanks for watching.", wps=3.0)
    monkeypatch.setattr(transcribe, "get_model", lambda *a, **k: FakeWhisperModel(words, duration=20.0))

    with sample_video.open("rb") as fh:
        r = client.post("/api/jobs", data={"options": '{"max_clips": 2}'}, files={"file": ("talk.mp4", fh, "video/mp4")})
    job = _wait_done(client, r.json()["id"], timeout=120)
    assert job["status"] == "done", job.get("error")
    assert job["meta"]["transcript"]["available"] and job["meta"]["transcript"]["n_words"] == len(words)
    assert job["meta"]["analysis"]["mode"] == "transcript"
    assert job["meta"]["scoring"]["llm_used"] is False
    assert 1 <= len(job["clips"]) <= 2
    c = job["clips"][0]
    assert c["status"] == "done" and c["end_s"] - c["start_s"] >= 10
    assert "features" in c["score_breakdown"] and 0 < c["score"] <= 1
    assert c["transcript"]
    for name in ("transcript.json", "analysis.json", "candidates.json", "scores.json"):
        assert client.get(f"/api/jobs/{job['id']}/files/{name}").status_code == 200
    h = client.get("/api/health").json()
    assert h["stages"][:4] == ["ingest", "transcribe", "analyze", "score"]


def test_full_pipeline_all_stages(client, sample_video, monkeypatch):
    """Upload → ... → render → copy → schedule, then exercise clip endpoints and exports."""
    from app.pipeline import transcribe
    from tests.fakes import FakeWhisperModel, fake_words
    words = fake_words(
        "Here's the thing about this test video. Nobody tells you how boring colour bars are. "
        "The biggest mistake is watching all twenty seconds. So let me show you the trick. "
        "You skip to the end and write this down. That's the secret. Thanks for watching.", wps=3.0)
    monkeypatch.setattr(transcribe, "get_model", lambda *a, **k: FakeWhisperModel(words, duration=20.0))

    with sample_video.open("rb") as fh:
        r = client.post("/api/jobs", data={"options": '{"max_clips": 1}', "platforms": "tiktok,youtube_shorts"},
                        files={"file": ("talk.mp4", fh, "video/mp4")})
    job = _wait_done(client, r.json()["id"], timeout=240)
    assert job["status"] == "done", job.get("error")
    assert job["meta"]["render"]["n_clips"] == 1 and job["meta"]["render"]["n_failed"] == 0 and job["meta"]["render"]["n_files"] == 2
    assert job["meta"]["copy"]["n_clips"] == 1 and job["meta"]["schedule"]["n_posts"] == 2
    c = job["clips"][0]
    assert c["status"] == "done" and c["video_path"].endswith("/clip_01.mp4") and c["captions_path"].endswith("/clip_01.srt")
    assert c["score_breakdown"]["render"]["n_caption_words"] > 5
    assert set(c["copy"]) == {"tiktok", "youtube_shorts"} and c["copy"]["tiktok"]["caption"]
    assert set(c["schedule"]) == {"tiktok", "youtube_shorts"} and c["schedule"]["tiktok"]["at"]
    # per-platform cuts: a ~15 s master on a 20 s source stays legal everywhere; every variant has files
    assert set(c["variants"]) == {"tiktok", "youtube_shorts"} and job["meta"]["fit"]["n_clips"] == 1
    for plat, v in c["variants"].items():
        assert v["fits"] and v["video_path"] and v["cover_path"] and v["captions_path"], (plat, v)
        assert v["video_path"] == f"clips/{plat}/clip_01.mp4" and v["spec"]["ok"]
        assert c["copy"][plat]["fits"] and abs(c["copy"][plat]["duration"] - v["duration"]) < 0.01
        assert client.get(f"/api/jobs/{job['id']}/files/{v['video_path']}").status_code == 200
    for rel in (c["video_path"], c["cover_path"], c["captions_path"]):
        assert client.get(f"/api/jobs/{job['id']}/files/{rel}").status_code == 200

    # clip endpoints
    assert client.get(f"/api/clips/{c['id']}").json()["id"] == c["id"]
    p = client.patch(f"/api/clips/{c['id']}", json={"copy": {"tiktok": {"title": "Edited"}}}).json()
    assert p["copy"]["tiktok"]["title"] == "Edited" and p["copy"]["tiktok"]["source"] == "edited"
    assert client.patch(f"/api/clips/{c['id']}", json={"start_s": 5, "end_s": 6}).status_code == 400
    fb = client.post(f"/api/clips/{c['id']}/feedback", json={"rating": 1, "note": "nice"})
    assert fb.status_code == 201 and fb.json()["weights"]
    assert client.get("/api/feedback/weights").json()["n_feedback"] == 1
    assert client.post(f"/api/clips/{c['id']}/feedback", json={"rating": 5}).status_code == 422

    # exports
    ics = client.get(f"/api/jobs/{job['id']}/schedule.ics")
    assert ics.status_code == 200 and ics.text.count("BEGIN:VEVENT") == 2
    z = client.get(f"/api/jobs/{job['id']}/export.zip")
    assert z.status_code == 200
    import io, zipfile
    names = zipfile.ZipFile(io.BytesIO(z.content)).namelist()
    assert {"tiktok/clip_01.mp4", "tiktok/clip_01_cover.jpg", "tiktok/clip_01.srt", "youtube_shorts/clip_01.mp4", "clips.json", "schedule.ics", "README.txt"} <= set(names)
    assert client.get(f"/api/jobs/{job['id']}/export.json").json()["clips"][0]["copy"]["tiktok"]["title"] == "Edited"

    # re-render with a different framing, then trim + re-render
    rr = client.post(f"/api/clips/{c['id']}/rerender", params={"reframe": "blur"})
    assert rr.status_code == 200
    t0 = time.time()
    while time.time() - t0 < 120:
        cc = client.get(f"/api/clips/{c['id']}").json()
        if cc["status"] in ("done", "failed"):
            break
        time.sleep(0.3)
    assert cc["status"] == "done", cc.get("error")
    assert cc["score_breakdown"]["render"]["reframe"]["mode"] == "blur"
    assert client.get("/api/health").json()["stages"] == ["ingest", "transcribe", "brief", "analyze", "score", "fit", "render", "copy", "schedule"]


def test_render_groups_separate_platforms_unless_identical(client, sample_video, monkeypatch):
    from app import settings as st
    from app.pipeline import runner, transcribe
    from tests.fakes import FakeWhisperModel, fake_words
    words = fake_words("Here's the thing about this test. Nobody tells you how boring colour bars are. "
                       "The biggest mistake is watching all twenty seconds. Write this down.", wps=3.0)
    monkeypatch.setattr(transcribe, "get_model", lambda *a, **k: FakeWhisperModel(words, duration=20.0))
    with sample_video.open("rb") as fh:
        r = client.post("/api/jobs", data={"options": '{"max_clips": 1}', "platforms": "tiktok,instagram_reels,facebook_reels"},
                        files={"file": ("talk.mp4", fh, "video/mp4")})
    job = _wait_done(client, r.json()["id"], timeout=300)
    assert job["status"] == "done", job.get("error")
    c = job["clips"][0]
    folders = {pl: v["folder"] for pl, v in c["variants"].items()}
    # three platforms, three specs → three files even when the cut is identical
    assert folders == {"tiktok": "tiktok", "instagram_reels": "instagram_reels", "facebook_reels": "facebook_reels"}
    assert all(v["scope"] == "platform" and v["spec"]["ok"] and v["video_path"].startswith(f"clips/{pl}/") for pl, v in c["variants"].items())
    assert job["meta"]["render"]["n_files"] == 3 and job["meta"]["render"]["placement"] == "platform"
    assert all(c["copy"][pl]["spec"]["ok"] for pl in c["copy"])

    import io, zipfile
    z = zipfile.ZipFile(io.BytesIO(client.get(f"/api/jobs/{job['id']}/export.zip").content))
    names = set(z.namelist())
    assert {"tiktok/clip_01.mp4", "instagram_reels/clip_01.mp4", "facebook_reels/clip_01.mp4", "tiktok/clip_01_copy.txt", "README.txt", "schedule.ics"} <= names
    assert not any(n.startswith("universal/") for n in names)
    pack = zipfile.ZipFile(io.BytesIO(client.get(f"/api/jobs/{job['id']}/export.zip", params={"platform": "tiktok"}).content))
    pn = set(pack.namelist())
    assert "tiktok/clip_01.mp4" in pn and "tiktok/clip_01_copy.txt" in pn and not any(n.startswith("instagram") for n in pn)
    assert "FILE CHECKS" in pack.read("tiktok/clip_01_copy.txt").decode()
    assert client.get(f"/api/jobs/{job['id']}/export.zip", params={"platform": "myspace"}).status_code == 400

    # universal placement: one file per cut, built to the strictest spec, valid for all
    pconf = json.loads(json.dumps(st.load_config("platforms"))); pconf["defaults"]["placement"] = "universal"
    monkeypatch.setattr(st, "load_config", lambda name, _o=st.load_config: pconf if name == "platforms" else _o(name))
    clip = db.get_clip(c["id"])
    groups = runner.plan_render_groups(clip, ["tiktok", "instagram_reels", "facebook_reels"], pconf)
    assert len(groups) == 1 and groups[0]["folder"] == "universal" and groups[0]["scope"] == "universal"
    assert groups[0]["profile"]["render"]["max_file_mb"] == 287


def test_pipeline_has_brief_stage_and_hint(client, sample_video, monkeypatch):
    from app.pipeline import transcribe
    from tests.fakes import FakeWhisperModel, fake_words
    words = fake_words("Here's the thing about reselling on eBay. Nobody tells you listings with keyword titles sell faster. "
                       "The biggest mistake is sourcing all day. Write this down and check sold comps first.", wps=3.0)
    monkeypatch.setattr(transcribe, "get_model", lambda *a, **k: FakeWhisperModel(words, duration=20.0))
    with sample_video.open("rb") as fh:
        r = client.post("/api/jobs", data={"options": '{"max_clips": 1, "brief_hint": "eBay tips for new sellers"}', "platforms": "tiktok"},
                        files={"file": ("talk.mp4", fh, "video/mp4")})
    job = _wait_done(client, r.json()["id"], timeout=300)
    assert job["status"] == "done", job.get("error")
    b = job["meta"]["brief"]
    assert b["source"] == "heuristic" and b["niche"] == "reselling_ecommerce" and b["subject"] == "eBay tips for new sellers"
    assert b["trends"] is None and b["subtitles_polished"] == 0
    assert "brief" in client.get("/api/health").json()["stages"]
    c = job["clips"][0]
    assert "#" + b["hashtags"][0] in c["copy"]["tiktok"]["hashtags"] or any(t.lstrip("#") in b["hashtags"] for t in c["copy"]["tiktok"]["hashtags"])
    assert c["variants"]["tiktok"].get("cover_hook_path", "").endswith("_cover_hook.jpg")
    assert client.get(f"/api/jobs/{job['id']}/files/{c['variants']['tiktok']['cover_hook_path']}").status_code == 200
    import io, zipfile
    z = zipfile.ZipFile(io.BytesIO(client.get(f"/api/jobs/{job['id']}/export.zip").content))
    assert "brief.txt" in z.namelist() and "tiktok/clip_01_cover_hook.jpg" in z.namelist()
