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
    assert c["status"] == "pending" and c["end_s"] - c["start_s"] >= 10
    assert "features" in c["score_breakdown"] and 0 < c["score"] <= 1
    assert c["transcript"]
    for name in ("transcript.json", "analysis.json", "candidates.json", "scores.json"):
        assert client.get(f"/api/jobs/{job['id']}/files/{name}").status_code == 200
    h = client.get("/api/health").json()
    assert h["stages"] == ["ingest", "transcribe", "analyze", "score"]
