#!/usr/bin/env bash
# One-shot installer for ChromeOS Linux (Crostini), Debian/Ubuntu, or Raspberry Pi OS.
# Installs system packages, clones or updates ClipForge, writes a tuned .env, and starts it.
# Usage:  bash install-chromebook.sh            (interactive: asks for a password and API key)
set -euo pipefail

BRANCH="${CLIPFORGE_BRANCH:-claude/affectionate-brown-h3wfam}"
REPO="${CLIPFORGE_REPO:-https://github.com/therealmacintosh52-collab/curly-octo-rotary-phone.git}"
DIR="$HOME/clipforge-src"

echo "==> Installing system packages (Python, ffmpeg, git, fonts)"
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-venv python3-pip ffmpeg git fonts-dejavu-core fontconfig >/dev/null

if [ -d "$DIR/.git" ]; then
  echo "==> Updating existing checkout"
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q origin "$BRANCH"
else
  echo "==> Cloning ClipForge"
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/clipforge"

if [ ! -f .env ]; then
  cp .env.example .env
  echo
  read -r -p "Set a password for the app (needed to use it from your phone; leave blank for none): " PW
  read -r -p "Anthropic API key (optional, enables the smart copy; leave blank to skip): " KEY
  {
    echo "CLIPFORGE_LOW_POWER=1"
    echo "CLIPFORGE_HOST=0.0.0.0"
    [ -n "$PW" ] && echo "CLIPFORGE_PASSWORD=$PW"
    [ -n "$KEY" ] && echo "ANTHROPIC_API_KEY=$KEY"
  } >> .env
  echo "==> Wrote .env (low-power mode on, listening on all interfaces)"
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "==> Starting ClipForge. On this device: http://localhost:8000"
[ -n "${IP:-}" ] && echo "    From your phone on the same Wi-Fi: http://$IP:8000   (enable port 8000 under Settings > Linux > Port forwarding on ChromeOS)"
echo "    Press Ctrl+C to stop. Re-run this script any time to update."
echo
exec ./run.sh
