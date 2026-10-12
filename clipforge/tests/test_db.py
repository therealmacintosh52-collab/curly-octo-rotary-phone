import time

from app import db


def test_job_roundtrip():
    j = db.create_job("url", source_url="https://example.com/v", options={"platforms": ["tiktok"]})
    assert j["status"] == "queued" and j["options"]["platforms"] == ["tiktok"]
    db.update_job(j["id"], status="running", stage="ingest", progress=0.25, message="hi")
    got = db.get_job(j["id"])
    assert got["status"] == "running" and got["stage"] == "ingest" and got["progress"] == 0.25
    assert got["updated_at"] >= got["created_at"]


def test_meta_merge_keeps_existing_keys():
    j = db.create_job("upload", source_name="a.mp4")
    db.merge_job_meta(j["id"], a=1)
    db.merge_job_meta(j["id"], b={"x": [1, 2]})
    assert db.get_job(j["id"])["meta"] == {"a": 1, "b": {"x": [1, 2]}}


def test_list_order_and_delete():
    a = db.create_job("upload")
    time.sleep(0.01)
    b = db.create_job("upload")
    ids = [x["id"] for x in db.list_jobs()]
    assert ids[:2] == [b["id"], a["id"]]
    assert db.delete_job(a["id"]) is True
    assert db.delete_job(a["id"]) is False
    assert db.get_job(a["id"]) is None


def test_clips_cascade_and_json_fields():
    j = db.create_job("upload")
    c1 = db.create_clip(j["id"], 0, 1.0, 9.5, score=0.8, score_breakdown={"audio": 0.9}, transcript="hello")
    c2 = db.create_clip(j["id"], 1, 20.0, 50.0, score=0.5)
    assert c1["duration"] == 8.5 and c1["score_breakdown"] == {"audio": 0.9}
    db.update_clip(c2["id"], status="done", video_path="clips/clip_02.mp4", copy={"tiktok": {"caption": "x"}},
                   schedule={"tiktok": "2026-10-12T18:30"})
    clips = db.list_clips(j["id"])
    assert [c["idx"] for c in clips] == [0, 1]
    assert clips[1]["copy"]["tiktok"]["caption"] == "x" and clips[1]["schedule"]["tiktok"].startswith("2026")
    db.add_feedback(c1["id"], j["id"], 1, "great hook", {"audio_energy": 0.9})
    assert len(db.list_feedback()) == 1
    db.delete_job(j["id"])
    assert db.list_clips(j["id"]) == []
    assert len(db.list_feedback()) == 1  # ratings are kept: they feed the learned weights


def test_kv_store():
    assert db.kv_get("weights") is None
    db.kv_set("weights", {"a": 0.1})
    db.kv_set("weights", {"a": 0.2})
    assert db.kv_get("weights") == {"a": 0.2}


def test_jobs_older_than():
    j = db.create_job("upload")
    db.update_job(j["id"], created_at=time.time() - 10 * 86400)
    assert [x["id"] for x in db.jobs_older_than(5 * 86400)] == [j["id"]]
    assert db.jobs_older_than(20 * 86400) == []
