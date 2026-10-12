# ClipForge

Local web app that turns a video link (or an uploaded file) into platform-ready short-form
clips for YouTube Shorts, Instagram Reels, TikTok and Facebook Reels. Runs entirely on your
machine at http://localhost:8000. Nothing is uploaded anywhere.

**What it does**

1. Downloads the video with yt-dlp (or takes your upload) and normalises it to H.264 MP4.
2. Transcribes it with faster-whisper (word-level timestamps).
3. Finds shot cuts (PySceneDetect) and the audio energy curve (librosa).
4. Builds candidate windows on sentence boundaries and scores them on hooks, energy,
   questions, keywords, self-containment and length. If an Anthropic key is set, the model
   rates the top candidates and the scores are blended.
5. Renders each pick as a 1080×1920 clip: face-centred crop (YuNet / Haar via OpenCV, centre
   crop fallback, or full-frame-over-blur), word-highlighted burned-in captions, loudness
   normalised to -14 LUFS, plus a cover frame and an SRT file.
6. Writes per-platform titles, captions, hashtags and keywords, and a posting schedule.
7. Thumbs up/down on clips teaches the scorer what you like for the next job.

## Requirements

- Python 3.11+
- ffmpeg and ffprobe on your PATH (`brew install ffmpeg` / `sudo apt install ffmpeg` /
  `winget install Gyan.FFmpeg`)
- About 2 GB of disk for Python packages and the whisper model

## Run

```bash
./run.sh          # macOS / Linux
run.bat           # Windows
```

First run creates `.venv`, installs `requirements.txt`, copies `.env.example` to `.env`, and
starts the server. The first job also downloads the whisper model (~460 MB for `small`).
Then open http://localhost:8000.

## Configuration

Edit `.env` (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Enables LLM scoring and copywriting. Without it everything runs on heuristics. |
| `CLIPFORGE_LLM_MODEL` | `claude-opus-5-5` | Model used when a key is present. |
| `CLIPFORGE_WHISPER_MODEL` | `small` | `tiny`, `base`, `small`, `medium`, `large-v3`, or a local model directory. |
| `CLIPFORGE_WHISPER_DEVICE` / `_COMPUTE` | `auto` / `int8` | Pass `cuda` + `float16` on an NVIDIA GPU. |
| `CLIPFORGE_JOBS_DIR` | `./jobs` | Where every job's files live. |
| `CLIPFORGE_RETENTION_DAYS` | `14` | Age threshold for the cleanup command. |
| `CLIPFORGE_MAX_DOWNLOAD_HEIGHT` | `1080` | Download/transcode cap. |
| `CLIPFORGE_TIMEZONE` | `America/Los_Angeles` | Timezone for the posting schedule. |
| `CLIPFORGE_PORT` | `8000` | Server port. |

JSON configs in `config/`:

- `platforms.json`: per-platform duration limits, caption/title limits, hashtag counts; render
  settings (preset, CRF, fps); caption font, size, colours, safe zones; default framing mode.
- `scoring.json`: clip length range and target, max clips, feature weights, hook/emphasis/filler
  word lists, LLM blend weight, scene-detection threshold, feedback learning rate.
- `schedule.json`: best posting windows per platform and weekday, daily caps, spacing, stagger.

## Files per job

```
jobs/<job_id>/
  source.mp4          normalised source
  audio.wav           16 kHz mono audio used for analysis
  source.json         ffprobe metadata + yt-dlp info
  transcript.json     words with timestamps
  analysis.json       shot cuts, energy curve, sentences
  candidates.json     every candidate window
  scores.json         features, heuristic/LLM scores, selection
  clips/clip_NN.mp4   rendered 1080x1920 clip
  clips/clip_NN_cover.jpg
  captions/clip_NN.ass / .srt
```

Job and clip metadata (scores, copy, schedule, feedback) live in `jobs/clipforge.db` (SQLite).

## Cleanup

```bash
.venv/bin/python -m app.cleanup                # delete jobs older than CLIPFORGE_RETENTION_DAYS
.venv/bin/python -m app.cleanup --days 3       # custom age
.venv/bin/python -m app.cleanup --dry-run      # show what would go
```
The UI's "Clean up old jobs" button and `POST /api/cleanup?days=N` do the same.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/jobs` | form fields `url` or `file`, `platforms` (comma list), `options` (JSON: `max_clips`, `reframe`, `whisper_model`, `language`, `use_llm`) |
| `GET` | `/api/jobs`, `/api/jobs/{id}` | list / detail with clips |
| `POST` | `/api/jobs/{id}/run`, `/cancel` | re-run / cancel |
| `DELETE` | `/api/jobs/{id}` | delete job and files |
| `GET` | `/api/jobs/{id}/files/{path}` | any file in the job folder |
| `GET` | `/api/jobs/{id}/export.zip`, `/export.json`, `/schedule.ics` | bundles |
| `GET` / `PATCH` | `/api/clips/{id}` | read / edit copy or trim (`start_s`, `end_s`) |
| `POST` | `/api/clips/{id}/rerender?reframe=auto|center|blur` | re-render one clip |
| `POST` | `/api/clips/{id}/feedback` | `{"rating": 1|0|-1, "note": "..."}` |
| `GET` / `POST` | `/api/feedback/weights`, `/api/feedback/reset` | learned scoring weights |
| `GET` | `/api/health`, `/api/config` | status, effective configs |

## Tests

```bash
.venv/bin/python -m pytest -q tests
```
Tests are offline: they synthesise media with ffmpeg and stub the speech model and the LLM.
To exercise the real whisper model once: `CLIPFORGE_TEST_REAL_WHISPER=1 pytest tests/test_real_whisper.py`.

## Notes

- Face detection uses the bundled YuNet ONNX model (`app/assets`), falling back to OpenCV's
  Haar cascade. Both come from the OpenCV project.
- One master 9:16 render is produced per clip and shared across platforms; the copy for each
  platform flags clips that exceed that platform's duration limit (e.g. Shorts at 60 s).
- Scoring weights learned from feedback are stored in the database and override
  `scoring.json`; reset them from the header button or `POST /api/feedback/reset`.
