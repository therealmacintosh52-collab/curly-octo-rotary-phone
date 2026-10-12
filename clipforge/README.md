# ClipForge

Local web app that turns a video link (or an uploaded file) into platform-ready short-form
clips for YouTube Shorts, Instagram Reels, TikTok and Facebook Reels. Runs entirely on your
machine at http://localhost:8000. Nothing is uploaded anywhere.

**What it does**

1. Downloads the video with yt-dlp (or takes your upload) and normalises it to H.264 MP4.
   Vertical phone videos keep their full resolution. Audio-only files (podcasts, voice memos)
   get a dark 9:16 canvas so you still get captioned clips.
2. Transcribes it with faster-whisper (word-level timestamps).
3. Works out what the video is about: subject, niche, ideal audience, core promise, tone, names
   and jargon, search keywords (`brief.json`). Heuristics use `config/niches.json`; with an API key
   the model writes the brief, can run a few web searches for what is current in that niche this
   month (hashtags, phrasings, format shifts, with sources and a checked date), and corrects
   transcript errors on names and jargon before captions are burned in. You can steer it with a
   one-line hint when creating the job, and correct it afterwards from the UI (copy is rewritten).
4. Finds shot cuts (PySceneDetect) and the audio energy curve (librosa).
5. Builds candidate windows on sentence boundaries and scores them on hooks, energy,
   questions, keywords, self-containment and length. If an Anthropic key is set, the model
   rates the top candidates and the scores are blended.
6. Fits each pick to every platform. Each platform has hard limits and an ideal window its
   algorithm rewards (`ideal_range` in `platforms.json`). A pick inside the window is shared;
   otherwise it is trimmed to the best-scoring run of whole sentences that keeps the hook, or
   extended with neighbouring sentences. Set `fit_mode` to `limits` to enforce only the caps.
7. Renders every platform's cut to that platform's own spec: its safe zones for the burned-in
   captions (each app's UI covers different parts of the frame), frame rate, bitrate ceiling,
   H.264 profile, audio bitrate, loudness target (measured on the finished file and corrected to
   within 0.6 LU), and file-size cap (re-encoded if exceeded). Face-centred crop (YuNet / Haar via
   OpenCV, centre crop fallback, or full-frame-over-blur), word-highlighted captions, cover frame
   and SRT. Two platforms share a file only when both their cut and their spec are identical; set
   `placement` to `universal` in `platforms.json` to get one file per cut built to the strictest
   spec of all selected platforms instead. Every file is probed afterwards and the checks
   (resolution, codecs, fps, duration, size, bitrate, loudness) are shown per platform.
8. Writes per-platform titles (plus options to A/B test), captions, YouTube descriptions,
   hashtags (1 broad + niche + at most 1 current) and keywords for that platform's cut, aimed at the
   brief's audience and following `config/playbook.json` (what each platform rewards right now, with
   an as-of date). Checks them against the platform's limits, burns the hook into a cover variant,
   and builds a posting schedule.
9. Thumbs up/down on clips teaches the scorer what you like for the next job.

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
| `CLIPFORGE_LLM_WEB_SEARCH` | `1` | Let the model research current trends for the niche (a few searches per job). |
| `CLIPFORGE_LLM_POLISH_SUBTITLES` | `1` | Let the model fix transcript names/jargon before captions are burned in. |
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
- `niches.json`: niche taxonomy (keywords, audience, tone, hashtags, CTA) for offline detection and
  as seed context for the model. Add your own niches here.
- `playbook.json`: what the platforms reward right now (ranking signals, hook formulas, caption
  structure, per-platform notes). Dated; update it as platforms change.

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
  clips/<platform>/clip_NN.mp4        built for that platform (its cut + its spec)
  clips/universal/clip_NN.mp4         one file that passes every selected platform's spec
  clips/<a>+<b>/clip_NN.mp4           a file two platforms share (same cut, same spec)
  clips/<folder>/clip_NN_cover.jpg
  captions/<folder>/clip_NN.ass / .srt
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
| `GET` | `/api/jobs/{id}/export.zip[?platform=tiktok]` | all platforms grouped by folder, or one platform's pack (files, cover, SRT, copy.txt with spec checks, .ics) |
| `GET` | `/api/jobs/{id}/export.json`, `/schedule.ics` | metadata and calendar |
| `GET` / `PATCH` | `/api/clips/{id}` | read / edit copy or trim (`start_s`, `end_s`) |
| `GET` / `PATCH` | `/api/jobs/{id}/brief` | read / correct the brief (subject, audience, niche, promise, tone); PATCH rewrites copy |
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
- Cancelling a job mid-render leaves unrendered clips as "pending"; re-run the job to finish them.
  Re-render and trim are refused while the job itself is still processing.
- Platform duration limits in `platforms.json` are conservative as of October 2026: Shorts and
  Reels 3 min, TikTok 10 min, Facebook Reels 3 min. Check the upload screen in each app if a
  limit matters; they change without notice, and some accounts get longer caps.
- Scoring weights learned from feedback are stored in the database and override
  `scoring.json`; reset them from the header button or `POST /api/feedback/reset`.
