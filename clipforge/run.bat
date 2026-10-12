@echo off
REM ClipForge launcher (Windows). Creates a venv on first run, installs deps, starts the server.
setlocal
cd /d "%~dp0"

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo ffmpeg not found. Install it first:  winget install Gyan.FFmpeg   ^(then reopen this terminal^)
  exit /b 1
)

if not exist .venv (
  echo Creating virtualenv...
  python -m venv .venv || exit /b 1
)
call .venv\Scripts\activate.bat
if not exist .venv\.deps-installed (
  echo Installing dependencies ^(first run takes a few minutes^)...
  python -m pip install --upgrade pip >nul
  pip install -r requirements.txt || exit /b 1
  type nul > .venv\.deps-installed
)
if not exist .env copy .env.example .env >nul

if "%CLIPFORGE_PORT%"=="" set CLIPFORGE_PORT=8000
echo ClipForge -^> http://localhost:%CLIPFORGE_PORT%
uvicorn app.main:app --host 127.0.0.1 --port %CLIPFORGE_PORT% %*
