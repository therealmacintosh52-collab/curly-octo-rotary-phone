"""Central settings. Reads .env from the clipforge root and JSON configs from ./config."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    return default if val is None or val == "" else val


def _resolve(p: str) -> Path:
    path = Path(p).expanduser()
    return path if path.is_absolute() else (ROOT / path).resolve()


JOBS_DIR: Path = _resolve(_env("CLIPFORGE_JOBS_DIR", "./jobs"))
DB_PATH: Path = _resolve(_env("CLIPFORGE_DB_PATH", str(JOBS_DIR / "clipforge.db")))
RETENTION_DAYS: int = int(_env("CLIPFORGE_RETENTION_DAYS", "14"))
MAX_DOWNLOAD_HEIGHT: int = int(_env("CLIPFORGE_MAX_DOWNLOAD_HEIGHT", "1080"))

WHISPER_MODEL: str = _env("CLIPFORGE_WHISPER_MODEL", "base" if _env("CLIPFORGE_LOW_POWER", "0").lower() in ("1", "true", "yes", "on") else "small")
WHISPER_DEVICE: str = _env("CLIPFORGE_WHISPER_DEVICE", "auto")
WHISPER_COMPUTE: str = _env("CLIPFORGE_WHISPER_COMPUTE", "int8")

ANTHROPIC_API_KEY: str = _env("ANTHROPIC_API_KEY", "")
LLM_MODEL: str = _env("CLIPFORGE_LLM_MODEL", "claude-opus-5-5")
LLM_WEB_SEARCH: bool = _env("CLIPFORGE_LLM_WEB_SEARCH", "1").lower() in ("1", "true", "yes", "on")
LLM_POLISH_SUBTITLES: bool = _env("CLIPFORGE_LLM_POLISH_SUBTITLES", "1").lower() in ("1", "true", "yes", "on")

PASSWORD: str = _env("CLIPFORGE_PASSWORD", "")
LOW_POWER: bool = _env("CLIPFORGE_LOW_POWER", "0").lower() in ("1", "true", "yes", "on")
PLACEMENT: str = _env("CLIPFORGE_PLACEMENT", "")          # platform | universal (overrides platforms.json)
RENDER_PRESET: str = _env("CLIPFORGE_RENDER_PRESET", "")  # ffmpeg x264 preset (overrides platforms.json)
HOST: str = _env("CLIPFORGE_HOST", "127.0.0.1")
PORT: int = int(_env("CLIPFORGE_PORT", "8000"))
TIMEZONE: str = _env("CLIPFORGE_TIMEZONE", "America/Los_Angeles")

CONFIG_DIR = ROOT / "config"
STATIC_DIR = ROOT / "app" / "static"


def llm_enabled() -> bool:
    return bool(ANTHROPIC_API_KEY)


@lru_cache(maxsize=None)
def load_config(name: str) -> dict:
    """Load config/<name>.json (cached). Environment overrides for low-power machines are applied here
    so the JSON files stay untouched."""
    path = CONFIG_DIR / f"{name}.json"
    with path.open("r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    if name == "platforms":
        d = cfg.setdefault("defaults", {})
        placement = PLACEMENT or ("universal" if LOW_POWER else "")
        if placement in ("platform", "universal"):
            d["placement"] = placement
        preset = RENDER_PRESET or ("ultrafast" if LOW_POWER else "")
        if preset:
            d["render_preset"] = preset
    if name == "scoring" and LOW_POWER:
        cfg["max_clips"] = min(int(cfg.get("max_clips", 8)), 4)
        cfg["scene_frame_skip"] = max(int(cfg.get("scene_frame_skip", 1)), 3)
    return cfg


def ensure_dirs() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
