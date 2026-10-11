#!/usr/bin/env bash
# ClipForge launcher (macOS / Linux). Creates a venv on first run, installs deps, starts the server.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it first:  brew install ffmpeg   |   sudo apt install ffmpeg" >&2
  exit 1
fi

PY=${PYTHON:-python3}
if [ ! -d .venv ]; then
  echo "Creating virtualenv..."
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
if [ ! -f .venv/.deps-installed ] || [ requirements.txt -nt .venv/.deps-installed ]; then
  echo "Installing dependencies (first run takes a few minutes)..."
  pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
  touch .venv/.deps-installed
fi
[ -f .env ] || cp .env.example .env

HOST=${CLIPFORGE_HOST:-127.0.0.1}
PORT=${CLIPFORGE_PORT:-8000}
echo "ClipForge → http://localhost:${PORT}"
exec uvicorn app.main:app --host "$HOST" --port "$PORT" "$@"
