import os
import time

from app import cleanup, db, settings


def test_cleanup_removes_old_jobs_and_orphans():
    old = db.create_job("upload")
    d_old = settings.JOBS_DIR / old["id"]; d_old.mkdir(); (d_old / "source.mp4").write_bytes(b"x")
    db.update_job(old["id"], created_at=time.time() - 20 * 86400)

    new = db.create_job("upload")
    (settings.JOBS_DIR / new["id"]).mkdir()

    orphan = settings.JOBS_DIR / "deadbeef0000"; orphan.mkdir()
    old_ts = time.time() - 40 * 86400
    os.utime(orphan, (old_ts, old_ts))
    fresh_orphan = settings.JOBS_DIR / "fresh0000000"; fresh_orphan.mkdir()

    res = cleanup.cleanup(days=14)
    assert res["removed_jobs"] == [old["id"]]
    assert res["removed_orphan_dirs"] == ["deadbeef0000"]
    assert not d_old.exists() and not orphan.exists()
    assert (settings.JOBS_DIR / new["id"]).exists() and fresh_orphan.exists()
    assert db.get_job(old["id"]) is None and db.get_job(new["id"])


def test_cleanup_default_days_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "RETENTION_DAYS", 3)
    j = db.create_job("upload"); (settings.JOBS_DIR / j["id"]).mkdir()
    db.update_job(j["id"], created_at=time.time() - 4 * 86400)
    res = cleanup.cleanup()
    assert res["days"] == 3 and res["removed_jobs"] == [j["id"]]


def test_cleanup_cli(monkeypatch, capsys):
    j = db.create_job("upload"); (settings.JOBS_DIR / j["id"]).mkdir()
    db.update_job(j["id"], created_at=time.time() - 100 * 86400)
    monkeypatch.setattr("sys.argv", ["cleanup", "--days", "30"])
    cleanup.main()
    out = capsys.readouterr().out
    assert "Deleted 1 item(s)" in out and j["id"] in out
