"""Delete jobs (DB rows + ./jobs/<id> folders) older than N days.

Usage:
    python -m app.cleanup                 # uses CLIPFORGE_RETENTION_DAYS (default 14)
    python -m app.cleanup --days 3
    python -m app.cleanup --days 3 --dry-run
Also exposed as POST /api/cleanup.
"""
from __future__ import annotations

import argparse
import shutil
import time
from pathlib import Path

from . import db, settings


def cleanup(days: float | None = None, *, dry_run: bool = False) -> dict:
    days = settings.RETENTION_DAYS if days is None else days
    cutoff_seconds = days * 86400
    removed: list[str] = []
    orphans: list[str] = []

    for job in db.jobs_older_than(cutoff_seconds):
        jdir = settings.JOBS_DIR / job["id"]
        if not dry_run:
            shutil.rmtree(jdir, ignore_errors=True)
            db.delete_job(job["id"])
        removed.append(job["id"])

    # Folders with no DB row (crashed mid-create, manual copies) that are older than the cutoff.
    known = {j["id"] for j in db.list_jobs(limit=100000)}
    if settings.JOBS_DIR.exists():
        now = time.time()
        for p in settings.JOBS_DIR.iterdir():
            if not p.is_dir() or p.name in known or p.name.startswith("."):
                continue
            if now - p.stat().st_mtime > cutoff_seconds:
                if not dry_run:
                    shutil.rmtree(p, ignore_errors=True)
                orphans.append(p.name)

    return {"days": days, "dry_run": dry_run, "removed_jobs": removed, "removed_orphan_dirs": orphans,
            "count": len(removed) + len(orphans)}


def main() -> None:
    ap = argparse.ArgumentParser(description="Delete ClipForge jobs older than N days")
    ap.add_argument("--days", type=float, default=None, help=f"age threshold (default {settings.RETENTION_DAYS})")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    settings.ensure_dirs()
    res = cleanup(args.days, dry_run=args.dry_run)
    verb = "Would delete" if args.dry_run else "Deleted"
    print(f"{verb} {res['count']} item(s) older than {res['days']} day(s)")
    for jid in res["removed_jobs"]:
        print(f"  job   {jid}")
    for d in res["removed_orphan_dirs"]:
        print(f"  orphan {d}")


if __name__ == "__main__":
    main()
