"""SQLite persistence for jobs, clips, and feedback.

Each call opens its own connection (thread-safe for the background workers). WAL mode is on
so the API can read while a worker writes.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from . import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id            TEXT PRIMARY KEY,
    source_type   TEXT NOT NULL,            -- url | upload
    source_url    TEXT,
    source_name   TEXT,
    title         TEXT,
    status        TEXT NOT NULL,            -- queued | running | done | failed | cancelled
    stage         TEXT,                     -- current pipeline stage name
    progress      REAL NOT NULL DEFAULT 0,  -- 0..1 overall
    message       TEXT,
    error         TEXT,
    options_json  TEXT NOT NULL DEFAULT '{}',
    meta_json     TEXT NOT NULL DEFAULT '{}',
    created_at    REAL NOT NULL,
    updated_at    REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS clips (
    id               TEXT PRIMARY KEY,
    job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    idx              INTEGER NOT NULL,
    start_s          REAL NOT NULL,
    end_s            REAL NOT NULL,
    score            REAL NOT NULL DEFAULT 0,
    score_json       TEXT NOT NULL DEFAULT '{}',
    transcript       TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',   -- pending | rendering | done | failed
    video_path       TEXT,
    cover_path       TEXT,
    captions_path    TEXT,
    copy_json        TEXT NOT NULL DEFAULT '{}',
    schedule_json    TEXT NOT NULL DEFAULT '{}',
    variants_json    TEXT NOT NULL DEFAULT '{}',
    error            TEXT,
    created_at       REAL NOT NULL,
    updated_at       REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS clips_job_idx ON clips(job_id, idx);
CREATE TABLE IF NOT EXISTS feedback (
    id          TEXT PRIMARY KEY,
    clip_id     TEXT NOT NULL,         -- no FK: ratings must outlive re-runs (features are denormalised)
    job_id      TEXT NOT NULL,
    rating      INTEGER NOT NULL,     -- -1 | 0 | 1  (thumbs down / neutral / thumbs up)
    note        TEXT,
    features_json TEXT NOT NULL DEFAULT '{}',
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

def _migrate(conn: sqlite3.Connection) -> None:
    """Bring older databases up to the current schema."""
    cols = {r[1] for r in conn.execute("PRAGMA table_info(clips)").fetchall()}
    if "variants_json" not in cols:
        conn.execute("ALTER TABLE clips ADD COLUMN variants_json TEXT NOT NULL DEFAULT '{}'")
    if conn.execute("PRAGMA foreign_key_list(feedback)").fetchall():
        conn.executescript("""
            CREATE TABLE feedback_new (
                id TEXT PRIMARY KEY, clip_id TEXT NOT NULL, job_id TEXT NOT NULL, rating INTEGER NOT NULL,
                note TEXT, features_json TEXT NOT NULL DEFAULT '{}', created_at REAL NOT NULL);
            INSERT INTO feedback_new SELECT id, clip_id, job_id, rating, note, features_json, created_at FROM feedback;
            DROP TABLE feedback;
            ALTER TABLE feedback_new RENAME TO feedback;
        """)


_init_lock = threading.Lock()
_initialized_paths: set[str] = set()


def _db_path() -> Path:
    return settings.DB_PATH


def init_db(path: Optional[Path] = None) -> None:
    p = Path(path or _db_path())
    p.parent.mkdir(parents=True, exist_ok=True)
    with _init_lock:
        conn = sqlite3.connect(p)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.executescript(_SCHEMA)
            _migrate(conn)
            conn.commit()
        finally:
            conn.close()
        _initialized_paths.add(str(p))


@contextmanager
def connect(path: Optional[Path] = None) -> Iterator[sqlite3.Connection]:
    p = Path(path or _db_path())
    if str(p) not in _initialized_paths:
        init_db(p)
    conn = sqlite3.connect(p, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def _row_to_job(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["options"] = json.loads(d.pop("options_json") or "{}")
    d["meta"] = json.loads(d.pop("meta_json") or "{}")
    return d


def _row_to_clip(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["score_breakdown"] = json.loads(d.pop("score_json") or "{}")
    d["copy"] = json.loads(d.pop("copy_json") or "{}")
    d["schedule"] = json.loads(d.pop("schedule_json") or "{}")
    d["variants"] = json.loads(d.pop("variants_json") or "{}")
    d["duration"] = round(d["end_s"] - d["start_s"], 3)
    return d


# ----------------------------------------------------------------------------- jobs

def create_job(source_type: str, *, source_url: str | None = None, source_name: str | None = None,
               options: dict | None = None, job_id: str | None = None) -> dict:
    jid = job_id or new_id()
    now = time.time()
    with connect() as c:
        c.execute(
            "INSERT INTO jobs (id, source_type, source_url, source_name, status, stage, progress, "
            "options_json, meta_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (jid, source_type, source_url, source_name, "queued", None, 0.0,
             json.dumps(options or {}), "{}", now, now),
        )
    return get_job(jid)  # type: ignore[return-value]


def get_job(job_id: str) -> Optional[dict]:
    with connect() as c:
        row = c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    return _row_to_job(row) if row else None


def list_jobs(limit: int = 200) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_job(r) for r in rows]


def update_job(job_id: str, **fields: Any) -> None:
    if not fields:
        return
    if "meta" in fields:
        fields["meta_json"] = json.dumps(fields.pop("meta"))
    if "options" in fields:
        fields["options_json"] = json.dumps(fields.pop("options"))
    fields["updated_at"] = time.time()
    cols = ", ".join(f"{k}=?" for k in fields)
    with connect() as c:
        c.execute(f"UPDATE jobs SET {cols} WHERE id=?", (*fields.values(), job_id))


def merge_job_meta(job_id: str, **meta: Any) -> dict:
    with connect() as c:
        row = c.execute("SELECT meta_json FROM jobs WHERE id=?", (job_id,)).fetchone()
        current = json.loads(row["meta_json"]) if row else {}
        current.update(meta)
        c.execute("UPDATE jobs SET meta_json=?, updated_at=? WHERE id=?",
                  (json.dumps(current), time.time(), job_id))
    return current


def delete_job(job_id: str) -> bool:
    with connect() as c:
        cur = c.execute("DELETE FROM jobs WHERE id=?", (job_id,))
    return cur.rowcount > 0


def jobs_older_than(seconds: float) -> list[dict]:
    cutoff = time.time() - seconds
    with connect() as c:
        rows = c.execute("SELECT * FROM jobs WHERE created_at < ? ORDER BY created_at", (cutoff,)).fetchall()
    return [_row_to_job(r) for r in rows]


# ----------------------------------------------------------------------------- clips

def create_clip(job_id: str, idx: int, start_s: float, end_s: float, *, score: float = 0.0,
                score_breakdown: dict | None = None, transcript: str | None = None) -> dict:
    cid = new_id()
    now = time.time()
    with connect() as c:
        c.execute(
            "INSERT INTO clips (id, job_id, idx, start_s, end_s, score, score_json, transcript, status, "
            "created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (cid, job_id, idx, float(start_s), float(end_s), float(score),
             json.dumps(score_breakdown or {}), transcript, "pending", now, now),
        )
    return get_clip(cid)  # type: ignore[return-value]


def get_clip(clip_id: str) -> Optional[dict]:
    with connect() as c:
        row = c.execute("SELECT * FROM clips WHERE id=?", (clip_id,)).fetchone()
    return _row_to_clip(row) if row else None


def list_clips(job_id: str) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM clips WHERE job_id=? ORDER BY idx", (job_id,)).fetchall()
    return [_row_to_clip(r) for r in rows]


def update_clip(clip_id: str, **fields: Any) -> None:
    if not fields:
        return
    for key, col in (("score_breakdown", "score_json"), ("copy", "copy_json"), ("schedule", "schedule_json"),
                     ("variants", "variants_json")):
        if key in fields:
            fields[col] = json.dumps(fields.pop(key))
    fields["updated_at"] = time.time()
    cols = ", ".join(f"{k}=?" for k in fields)
    with connect() as c:
        c.execute(f"UPDATE clips SET {cols} WHERE id=?", (*fields.values(), clip_id))


def delete_clips(job_id: str) -> None:
    with connect() as c:
        c.execute("DELETE FROM clips WHERE job_id=?", (job_id,))


def fail_stale_clips(reason: str) -> int:
    """Clips left in 'rendering' by a previous process can never finish; mark them failed."""
    with connect() as c:
        cur = c.execute("UPDATE clips SET status='failed', error=?, updated_at=? WHERE status='rendering'",
                        (reason, time.time()))
    return cur.rowcount


# ----------------------------------------------------------------------------- feedback

def add_feedback(clip_id: str, job_id: str, rating: int, note: str | None, features: dict) -> dict:
    fid = new_id()
    now = time.time()
    with connect() as c:
        c.execute(
            "INSERT INTO feedback (id, clip_id, job_id, rating, note, features_json, created_at) VALUES (?,?,?,?,?,?,?)",
            (fid, clip_id, job_id, int(rating), note, json.dumps(features), now),
        )
    return {"id": fid, "clip_id": clip_id, "job_id": job_id, "rating": rating, "note": note,
            "features": features, "created_at": now}


def list_feedback(limit: int = 1000) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["features"] = json.loads(d.pop("features_json") or "{}")
        out.append(d)
    return out


# ----------------------------------------------------------------------------- kv

def kv_get(key: str, default: Any = None) -> Any:
    with connect() as c:
        row = c.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def kv_set(key: str, value: Any) -> None:
    with connect() as c:
        c.execute("INSERT INTO kv (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                  (key, json.dumps(value)))
