# Clip Studio

Turns a long video (30–90 minutes) into vertical, captioned shorts — locally, with no
subscription. Paste a YouTube URL or upload a file, get 20–60 second 9:16 clips with
animated word-level captions, a tracked crop that follows the speaker, and an optional
on-screen hook.

```
long video ─► download ─► Whisper transcript ─► highlight ranking ─► reframe plan
                                                                          │
        MP4 + SRT + thumbnail  ◄── ffmpeg render (captions, loudness) ◄────┘
```

## Quick start

```powershell
.\run.cmd
```

That creates the virtualenv, installs dependencies, and opens <http://127.0.0.1:8000>.

First run also downloads the Whisper model (~140 MB for `base`).

Command line instead of the web UI:

```powershell
.\clip.cmd "https://www.youtube.com/watch?v=XXXXXXXXXXX" --clips 6 --style hormozi
.\clip.cmd "C:\Videos\podcast.mp4" --clips 3 --min 25 --max 50 --layout crop
```

Output lands in `data\jobs\<job>\clips\`.

## What it does

| Stage | Implementation | Notes |
|---|---|---|
| Ingest | yt-dlp (URL) or file upload | 1080p max, remuxed to mp4 |
| Transcript | faster-whisper, word timestamps, VAD | CPU-friendly (`int8`), 90+ languages |
| Highlight ranking | Gemini / OpenAI, chunked 8-minute windows with dedupe | Falls back to a heuristic ranker with no API key |
| Reframe | Haar face detection at 4 fps → smoothed crop path → ffmpeg `sendcmd` | Follows the active speaker; switches to blurred backdrop when there are no faces |
| Captions | ASS/libass, 4 styles, per-word highlight | Burned in at 1080×1920 |
| Audio | EBU R128 loudness normalisation | Optional profanity mute |
| Output | H.264 MP4 (faststart) + SRT + JPG thumbnail | Ready for Shorts / Reels / TikTok |

## Options

Set these in `.env` (copy `.env.example`) or per job in the UI.

| Setting | Default | Meaning |
|---|---|---|
| `CLIP_NUM` | 5 | clips to produce |
| `CLIP_MIN_SEC` / `CLIP_MAX_SEC` | 20 / 60 | hard clip length limits |
| `CLIP_LAYOUT` | auto | `auto` (crop when faces are found, else blur), `crop`, `blur` |
| `CLIP_CAPTION_STYLE` | wordpop | `wordpop`, `karaoke`, `hormozi`, `clean` |
| `WHISPER_MODEL` | base | `tiny` … `large-v3`; bigger = better and slower |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | — | enables AI highlight selection |

### AI ranking (optional but recommended)

Without a key the tool uses a heuristic scorer (hook words, numbers, speech density,
length fit). It works, but it cannot understand meaning. A Gemini key costs a fraction
of a cent per video and noticeably improves clip choice:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### If YouTube blocks the download

YouTube sometimes demands a sign-in for datacenter/bot traffic. Point the tool at your
browser's cookies:

```
CLIP_COOKIES_FROM_BROWSER=chrome
```

Or just use the **Upload file** tab.

## Layouts

* **crop** — fills the 9:16 frame and tracks the speaker's face. Best for talking heads,
  podcasts, interviews.
* **blur** — keeps the whole frame and pads it with a blurred copy. Best for screen
  recordings, gameplay, slides, two-person wide shots.
* **auto** — samples the clip; uses crop only when faces are present in at least
  60% of frames. Slides, screencasts and wide shots fall back to blur so nothing gets
  cut off.

## Project layout

```
clipping/
  app.py         FastAPI app + job endpoints
  pipeline.py    job orchestration and manifest
  ingest.py      yt-dlp download / upload import
  transcribe.py  faster-whisper wrapper (cached)
  highlights.py  LLM + heuristic clip selection, dedupe, snapping
  reframe.py     face tracking -> crop path -> sendcmd
  captions.py    ASS caption generation (4 styles)
  render.py      ffmpeg filter graphs, SRT, thumbnails
  cli.py         command line entry point
static/index.html  single-page UI (no build step)
data/jobs/<id>/    source, transcript.json, clips.json, clips/*.mp4
```

Every job keeps `transcript.json` and `job.json`, so you can re-run ranking or
re-render without transcribing again.

## Performance (no GPU, 8-core CPU)

| Source | Transcribe | Rank | Render | Total |
|---|---|---|---|---|
| 30 min | ~3–5 min | ~2 s (heuristic) / ~15 s (LLM) | ~4–6 min for 5 clips | ~8–12 min |
| 90 min | ~9–15 min | ~5 s / ~40 s | ~4–6 min for 5 clips | ~15–22 min |

`WHISPER_MODEL=small` improves accuracy at roughly 2.5× the transcription time. With a
CUDA GPU, set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE=float16` for a 10–20× speedup.

## Troubleshooting

**"Sign in to confirm you're not a bot"** — set `CLIP_COOKIES_FROM_BROWSER`, or upload the file.

**No speech detected** — the audio track is missing or is music only. Whisper needs dialogue.

**Clips start mid-sentence** — the ranker snaps to Whisper segments; with `base` those are
less accurate. Try `WHISPER_MODEL=small`.

**Captions look wrong / missing glyphs** — set `CLIP_FONT` to a font installed on Windows
(e.g. `Impact`, `Arial`, `Montserrat` if installed).

**Crop keeps cutting off a second person** — force `--layout blur` for wide two-person shots.

## Rights

Only process video you own or are licensed to use. Downloading third-party YouTube
content with yt-dlp is against YouTube's Terms of Service, and reposting someone else's
video can be demonetised under YouTube's reused-content policy even with permission.
This tool is intended for your own channel's long-form content.
