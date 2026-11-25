"""Local web app: paste a YouTube URL or upload a file, get vertical clips."""

from __future__ import annotations

import os
import shutil
import tempfile
import threading
import time
import uuid
import json as pyjson
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from yt_dlp import YoutubeDL

from . import pipeline
from .config import DATA_DIR, FONTS_DIR, ROOT, Settings, settings_for
from .llm import provider_available
from .render import check_tools
from .utils import ToolError, read_json, strip_ansi, video_info, write_json

JOBS_DIR = DATA_DIR / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = ROOT / "static"
DIST_DIR = STATIC_DIR / "dist"

app = FastAPI(title="Clip Studio", version="1.0")


@app.on_event("startup")
def clean_stale_jobs():
    """Mark any leftover uncompleted jobs from previous server runs as cancelled/error."""
    try:
        for p in JOBS_DIR.glob("*/job.json"):
            try:
                data = read_json(p)
                if data.get("status") in {"queued", "downloading", "transcribing", "ranking", "rendering"}:
                    data["status"] = "error"
                    data["error"] = "Process was terminated or server restarted"
                    data["message"] = "Process was interrupted (server restarted)"
                    data["updated"] = int(time.time())
                    write_json(p, data)
            except Exception:
                pass
    except Exception:
        pass


@app.get("/health")
def root_health() -> dict:
    return {"ok": True, "status": "healthy"}


@app.get("/api/fonts")
def list_caption_fonts() -> dict:
    """Caption fonts bundled for the editor and libass burn-in."""
    files = {
        "Anton": "Anton-Regular.ttf",
        "Archivo Black": "ArchivoBlack-Regular.ttf",
        "Bebas Neue": "BebasNeue-Regular.ttf",
        "Poppins": "Poppins-Bold.ttf",
        "Montserrat": "Montserrat-Variable.ttf",
        "Rubik": "Rubik-Variable.ttf",
        "Oswald": "Oswald-Variable.ttf",
    }
    fonts = []
    for name, filename in files.items():
        path = FONTS_DIR / filename
        if path.exists():
            fonts.append({"name": name, "file": filename, "url": f"/caption-fonts/{filename}"})
    return {"fonts": fonts}

app.mount("/media", StaticFiles(directory=str(JOBS_DIR)), name="media")
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
if (DIST_DIR / "fonts").exists():
    app.mount("/fonts", StaticFiles(directory=str(DIST_DIR / "fonts")), name="fonts")
if FONTS_DIR.exists():
    app.mount("/caption-fonts", StaticFiles(directory=str(FONTS_DIR)), name="caption-fonts")

POOL = ThreadPoolExecutor(max_workers=int(os.getenv("CLIP_WORKERS", "1")), thread_name_prefix="clip")
LOCK = threading.Lock()
JOB_CACHE: dict[str, dict] = {}


class JobRequest(BaseModel):
    url: str | None = None
    num_clips: int | None = Field(default=None, ge=1, le=20)
    min_sec: float | None = Field(default=None, ge=8, le=180)
    max_sec: float | None = Field(default=None, ge=10, le=300)
    layout: str | None = None
    caption_style: str | None = None
    stabilization: str | None = None
    streamer_split_ratio: str | None = None
    streamer_cam_pos: str | None = None
    streamer_cam_zoom: float | None = None
    streamer_game_focus: str | None = None
    streamer_divider: str | None = None
    streamer_tag: str | None = None
    streamer_cam_shape: str | None = None
    streamer_bg: str | None = None
    streamer_theme: str | None = None
    caption_position: str | None = None
    caption_font: str | None = None
    caption_font_size: int | None = Field(default=None, ge=20, le=200)
    caption_primary_color: str | None = None
    caption_active_color: str | None = None
    caption_outline: int | None = Field(default=None, ge=0, le=12)
    caption_uppercase: bool | None = None
    caption_margin_v: int | None = Field(default=None, ge=0, le=500)
    subtitle_script: str | None = None
    whisper_model: str | None = None
    force_align: bool | None = None
    whisper_min_prob: float | None = None
    skip_sponsors: bool | None = None
    sponsor_categories: str | None = None
    sponsor_overlap_limit: float | None = None
    cookies_from_browser: str | None = None
    cookie_file: str | None = None
    censor: bool = False
    hook: str | None = None
    title: str | None = None


class UrlInfoRequest(BaseModel):
    url: str


# In-memory LRU / TTL cache for video metadata (1 hour TTL)
_URL_INFO_CACHE: dict[str, tuple[float, dict]] = {}


def _get_cached_url_info(url: str) -> dict | None:
    now = time.time()
    if url in _URL_INFO_CACHE:
        ts, data = _URL_INFO_CACHE[url]
        if now - ts < 3600:
            return data
        del _URL_INFO_CACHE[url]
    return None


def _set_cached_url_info(url: str, data: dict):
    # Maintain cache size <= 200 items
    if len(_URL_INFO_CACHE) > 200:
        oldest_key = min(_URL_INFO_CACHE.keys(), key=lambda k: _URL_INFO_CACHE[k][0])
        del _URL_INFO_CACHE[oldest_key]
    _URL_INFO_CACHE[url] = (time.time(), data)


@app.post("/api/info")
def fetch_url_info(req: UrlInfoRequest) -> dict:
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Empty URL provided")

    # Fast client-side URL syntax validation
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid URL protocol. Must start with https:// or http://")

    # Check cache first for 0ms instant response
    cached = _get_cached_url_info(url)
    if cached:
        return cached

    # Fast check for direct video files (.mp4, .webm, .mov, .m4v, .mkv)
    parsed_path = urllib.parse.urlparse(url).path.lower()
    if any(parsed_path.endswith(ext) for ext in (".mp4", ".webm", ".mov", ".m4v", ".mkv")):
        try:
            head_req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(head_req, timeout=4) as resp:
                content_type = resp.headers.get("Content-Type", "")
                content_len = int(resp.headers.get("Content-Length", 0))
                filename = Path(parsed_path).name or "Direct Video Stream"
                size_mb = f"{content_len / (1024 * 1024):.1f} MB" if content_len > 0 else "Direct Media"
                result = {
                    "ok": True,
                    "title": filename,
                    "uploader": f"Direct Stream ({size_mb})",
                    "duration": 0,
                    "thumbnail": "",
                    "view_count": None,
                    "webpage_url": url,
                }
                _set_cached_url_info(url, result)
                return result
        except Exception:
            pass

    # Normalize YouTube URLs (including playlist mixes like list=RD<video_id>, shorts, youtu.be, music.youtube)
    normalized_yt_url = url
    if any(domain in url.lower() for domain in ("youtube.com", "youtu.be", "youtube-nocookie.com")):
        try:
            parsed = urllib.parse.urlparse(url)
            qs = urllib.parse.parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                normalized_yt_url = f"https://www.youtube.com/watch?v={qs['v'][0]}"
            elif qs.get("list", [""])[0].startswith("RD") and len(qs.get("list", [""])[0]) > 2:
                normalized_yt_url = f"https://www.youtube.com/watch?v={qs['list'][0][2:]}"
            elif "youtu.be" in parsed.netloc and parsed.path.strip("/"):
                normalized_yt_url = f"https://www.youtube.com/watch?v={parsed.path.strip('/')}"
            elif any(parsed.path.startswith(p) for p in ("/shorts/", "/embed/", "/v/")):
                parts = parsed.path.strip("/").split("/")
                if len(parts) >= 2:
                    normalized_yt_url = f"https://www.youtube.com/watch?v={parts[1]}"
        except Exception:
            pass

    # Fast-path for YouTube via official public oEmbed (50-100ms response, zero rate-limit)
    if any(domain in normalized_yt_url.lower() for domain in ("youtube.com", "youtu.be")):
        try:
            oe_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(normalized_yt_url)}&format=json"
            oe_req = urllib.request.Request(oe_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(oe_req, timeout=4) as resp:
                oe_data = pyjson.loads(resp.read().decode())
                thumb = oe_data.get("thumbnail_url") or ""
                # Try higher resolution thumbnail if hqdefault
                if "hqdefault.jpg" in thumb:
                    thumb = thumb.replace("hqdefault.jpg", "maxresdefault.jpg")
                result = {
                    "ok": True,
                    "title": oe_data.get("title") or "YouTube Video",
                    "uploader": oe_data.get("author_name") or "YouTube Creator",
                    "duration": 0,
                    "thumbnail": thumb,
                    "view_count": None,
                    "webpage_url": normalized_yt_url,
                }
                _set_cached_url_info(url, result)
                if normalized_yt_url != url:
                    _set_cached_url_info(normalized_yt_url, result)
                return result
        except Exception:
            pass

    # Fast-path for Vimeo via oEmbed (50-100ms)
    if "vimeo.com" in url.lower():
        try:
            voe_url = f"https://vimeo.com/api/oembed.json?url={urllib.parse.quote(url)}"
            with urllib.request.urlopen(voe_url, timeout=4) as resp:
                voe_data = pyjson.loads(resp.read().decode())
                result = {
                    "ok": True,
                    "title": voe_data.get("title") or "Vimeo Video",
                    "uploader": voe_data.get("author_name") or "Vimeo Creator",
                    "duration": voe_data.get("duration") or 0,
                    "thumbnail": voe_data.get("thumbnail_url") or "",
                    "view_count": None,
                    "webpage_url": url,
                }
                _set_cached_url_info(url, result)
                return result
        except Exception:
            pass

    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 8,
        "extract_flat": False,
        "extractor_args": {"youtube": {"player_client": ["android", "ios", "mweb"]}},
    }
    node_exe = shutil.which("node")
    if node_exe:
        opts["js_runtimes"] = {"node": {"path": node_exe}}
        opts["remote_components"] = ["ejs:github"]
    cookie_candidate = None
    if (DATA_DIR / "cookies.txt").exists():
        cookie_candidate = DATA_DIR / "cookies.txt"
    elif (ROOT / "cookies.txt").exists():
        cookie_candidate = ROOT / "cookies.txt"
    if cookie_candidate:
        opts["cookiefile"] = str(cookie_candidate)

    try:
        with YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
            if isinstance(data, dict):
                if data.get("entries"):
                    data = data["entries"][0]
                result = {
                    "ok": True,
                    "title": data.get("title") or "Untitled Video",
                    "uploader": data.get("uploader") or data.get("channel") or "Unknown Channel",
                    "duration": data.get("duration") or 0,
                    "thumbnail": data.get("thumbnail") or "",
                    "view_count": data.get("view_count"),
                    "webpage_url": data.get("webpage_url") or url,
                }
                _set_cached_url_info(url, result)
                return result
            raise HTTPException(status_code=400, detail="Could not read video information from this URL")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch video details: {str(exc).splitlines()[0]}"
        )



def _job_path(job_id: str) -> Path:
    path = JOBS_DIR / job_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    return path


def _normalize_clips(job_id: str, clips: list[dict], check_exists: bool = False) -> list[dict]:
    normalized = []
    job_dir = JOBS_DIR / job_id
    for c in (clips or []):
        if not isinstance(c, dict):
            continue
        c_copy = c.copy()
        c_copy["jobId"] = job_id
        video_path = c.get("video") or ""
        fname = c.get("filename") or (Path(video_path).name if video_path else f"{c.get('slug', 'clip')}.mp4")
        c_copy["filename"] = fname

        if check_exists:
            v1 = job_dir / video_path if video_path else None
            v2 = job_dir / "clips" / fname
            if not ((v1 and v1.exists()) or (v2 and v2.exists())):
                continue

        if "url" not in c_copy:
            c_copy["url"] = f"/media/{job_id}/{video_path}" if video_path else f"/media/{job_id}/clips/{fname}"
        if "srt_url" not in c_copy:
            srt_path = c.get("srt") or (f"clips/{Path(fname).stem}.srt" if video_path else "")
            c_copy["srt_url"] = f"/media/{job_id}/{srt_path}" if srt_path else ""
        if "clean_url" not in c_copy:
            clean_path = c.get("clean_video")
            if not clean_path:
                candidate = job_dir / "clips" / f"{Path(fname).stem}.clean.mp4"
                if candidate.exists():
                    clean_path = f"clips/{candidate.name}"
                    c_copy["clean_video"] = clean_path
            if clean_path:
                c_copy["clean_url"] = f"/media/{job_id}/{clean_path}"
        if "clean_url" not in c_copy:
            c_copy["clean_url"] = None
        if "thumb_url" not in c_copy and c.get("thumb"):
            c_copy["thumb_url"] = f"/media/{job_id}/{c.get('thumb')}"
        normalized.append(c_copy)
    return normalized


def _read_job(job_id: str) -> dict:
    data = None
    with LOCK:
        if job_id in JOB_CACHE:
            data = JOB_CACHE[job_id].copy()
    if data is None:
        path = _job_path(job_id) / "job.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Job not found")
        try:
            data = read_json(path)
        except Exception as exc:
            with LOCK:
                if job_id in JOB_CACHE:
                    data = JOB_CACHE[job_id].copy()
            if data is None:
                raise HTTPException(status_code=500, detail=f"Failed to read job state: {exc}")
        with LOCK:
            JOB_CACHE[job_id] = data

    data["clips"] = _normalize_clips(job_id, data.get("clips") or [])
    if "source" in data and isinstance(data["source"], dict):
        if not data["source"].get("thumbnail") and (JOBS_DIR / job_id / "poster.jpg").exists():
            data["source"]["thumbnail"] = f"/media/{job_id}/poster.jpg"
        if not data["source"].get("video_url") and data["source"].get("file") and (JOBS_DIR / job_id / data["source"]["file"]).exists():
            data["source"]["video_url"] = f"/media/{job_id}/{data['source']['file']}"
    return data


def _run(job_id: str, settings: Settings, url: str | None, upload: Path | None,
         hook: str | None, censor: bool, title: str | None) -> None:
    job_dir = JOBS_DIR / job_id

    def on_report(status: str, pct: float, message: str, manifest: dict | None = None) -> None:
        with LOCK:
            if job_id in JOB_CACHE and JOB_CACHE[job_id].get("status") == "cancelled":
                return
            if manifest:
                JOB_CACHE[job_id] = manifest.copy()
            elif job_id in JOB_CACHE:
                JOB_CACHE[job_id]["status"] = status
                JOB_CACHE[job_id]["progress"] = pct
                JOB_CACHE[job_id]["message"] = message
                JOB_CACHE[job_id]["updated"] = int(time.time())

    try:
        pipeline.process(
            job_dir, settings, report=on_report, url=url, upload=upload,
            hook_override=hook, censor=censor,
        )
    except Exception as exc:
        err_msg = strip_ansi(str(exc))
        with LOCK:
            if job_id in JOB_CACHE:
                JOB_CACHE[job_id]["status"] = "error"
                JOB_CACHE[job_id]["error"] = err_msg
                JOB_CACHE[job_id]["message"] = err_msg.splitlines()[0][:300]
    finally:
        if upload is not None:
            upload.unlink(missing_ok=True)


def _start(settings: Settings, url: str | None, upload: Path | None,
           hook: str | None, censor: bool, title: str | None) -> str:
    job_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
    job_dir = pipeline.new_job_dir(job_id)
    manifest = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": "Queued",
        "created": int(time.time()),
        "url": url,
        "title": title,
        "options": settings.as_dict() | {"censor": censor},
        "clips": [],
    }
    with LOCK:
        JOB_CACHE[job_id] = manifest.copy()
    write_json(job_dir / "job.json", manifest)
    POOL.submit(_run, job_id, settings, url, upload, hook, censor, title)
    return job_id


@app.get("/")
def index():
    # Serve the React Vite dashboard (built to static/dist by `vite build`).
    if not (DIST_DIR / "index.html").exists():
        raise HTTPException(
            status_code=503,
            detail="Frontend not built. Run `vite build` in the dashboard folder.",
        )
    return FileResponse(DIST_DIR / "index.html")


@app.get("/api/config")
def config() -> dict:
    base = Settings()
    return {
        "defaults": base.as_dict(),
        "llm": {
            "provider": base.llm_provider,
            "ready": provider_available(base),
        },
        "problems": check_tools(),
        "data_dir": str(DATA_DIR),
    }


@app.get("/api/jobs")
def list_jobs() -> list[dict]:
    jobs: list[dict] = []
    # Collect jobs from disk and cache
    all_job_dirs = {p.parent.name: p for p in JOBS_DIR.glob("*/job.json")}
    with LOCK:
        for jid in list(JOB_CACHE.keys()):
            if jid not in all_job_dirs:
                all_job_dirs[jid] = JOBS_DIR / jid / "job.json"

    for job_id, path in sorted(all_job_dirs.items(), key=lambda item: item[1].stat().st_mtime if item[1].exists() else time.time(), reverse=True)[:50]:
        data = None
        with LOCK:
            if job_id in JOB_CACHE:
                data = JOB_CACHE[job_id]
        if data is None and path.exists():
            try:
                data = read_json(path)
            except Exception:
                continue
        if not data:
            continue
        clips_data = _normalize_clips(data.get("id", job_id), data.get("clips") or [], check_exists=True)
        jobs.append({
            "id": data.get("id", job_id),
            "status": data.get("status", "unknown"),
            "progress": data.get("progress", 0),
            "message": data.get("message", ""),
            "title": data.get("title") or (data.get("source") or {}).get("title"),
            "created": data.get("created"),
            "clips": clips_data,
            "clips_count": len(clips_data),
            "duration": (data.get("source") or {}).get("duration"),
        })
    return jobs


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    return _read_job(job_id)


@app.delete("/api/jobs")
def delete_all_jobs() -> dict:
    """Delete all jobs and their output files."""
    deleted = []
    with LOCK:
        JOB_CACHE.clear()
        for path in list(JOBS_DIR.iterdir()):
            if path.is_dir():
                try:
                    pipeline.delete_job(path)
                    deleted.append(path.name)
                except Exception as exc:
                    log(f"[jobs] failed to delete {path}: {exc}")
    return {"deleted_count": len(deleted), "deleted_ids": deleted}


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    path = _job_path(job_id)
    with LOCK:
        JOB_CACHE.pop(job_id, None)
        pipeline.delete_job(path)
    return {"deleted": job_id}


@app.post("/api/jobs")
def create_job(req: JobRequest) -> dict:
    url = (req.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Please enter a valid YouTube URL.")
    if req.max_sec and req.min_sec and req.max_sec <= req.min_sec:
        raise HTTPException(status_code=400, detail="max_sec must be greater than min_sec")
    settings = settings_for(
        num_clips=req.num_clips, min_sec=req.min_sec, max_sec=req.max_sec,
        layout=req.layout, caption_style=req.caption_style,
        stabilization=req.stabilization,
        streamer_split_ratio=req.streamer_split_ratio,
        streamer_cam_pos=req.streamer_cam_pos,
        streamer_cam_zoom=req.streamer_cam_zoom,
        streamer_game_focus=req.streamer_game_focus,
        streamer_divider=req.streamer_divider,
        streamer_tag=req.streamer_tag,
        streamer_cam_shape=req.streamer_cam_shape,
        streamer_bg=req.streamer_bg,
        streamer_theme=req.streamer_theme,
        caption_position=req.caption_position,
        caption_font=req.caption_font,
        caption_font_size=req.caption_font_size,
        caption_primary_color=req.caption_primary_color,
        caption_active_color=req.caption_active_color,
        caption_outline=req.caption_outline,
        caption_uppercase=("1" if req.caption_uppercase else "0") if req.caption_uppercase is not None else None,
        caption_margin_v=req.caption_margin_v,
        subtitle_script=req.subtitle_script,
        whisper_model=req.whisper_model,
        force_align=req.force_align,
        whisper_min_prob=req.whisper_min_prob,
        skip_sponsors=req.skip_sponsors,
        sponsor_categories=req.sponsor_categories,
        sponsor_overlap_limit=req.sponsor_overlap_limit,
    )
    job_id = _start(settings, url, None, req.hook, req.censor, req.title)
    return {"id": job_id}


@app.post("/api/jobs/upload")
async def create_upload_job(
    file: UploadFile = File(...),
    num_clips: int | None = Form(default=None),
    min_sec: float | None = Form(default=None),
    max_sec: float | None = Form(default=None),
    layout: str | None = Form(default=None),
    caption_style: str | None = Form(default=None),
    stabilization: str | None = Form(default=None),
    streamer_split_ratio: str | None = Form(default=None),
    streamer_cam_pos: str | None = Form(default=None),
    streamer_cam_zoom: float | None = Form(default=None),
    streamer_game_focus: str | None = Form(default=None),
    streamer_divider: str | None = Form(default=None),
    streamer_tag: str | None = Form(default=None),
    streamer_cam_shape: str | None = Form(default=None),
    streamer_bg: str | None = Form(default=None),
    streamer_theme: str | None = Form(default=None),
    caption_position: str | None = Form(default=None),
    caption_font: str | None = Form(default=None),
    caption_font_size: int | None = Form(default=None, ge=20, le=200),
    caption_primary_color: str | None = Form(default=None),
    caption_active_color: str | None = Form(default=None),
    caption_outline: int | None = Form(default=None, ge=0, le=12),
    caption_uppercase: bool | None = Form(default=None),
    caption_margin_v: int | None = Form(default=None, ge=0, le=500),
    subtitle_script: str | None = Form(default=None),
    whisper_model: str | None = Form(default=None),
    force_align: bool | None = Form(default=None),
    whisper_min_prob: float | None = Form(default=None),
    skip_sponsors: bool | None = Form(default=None),
    sponsor_categories: str | None = Form(default=None),
    sponsor_overlap_limit: float | None = Form(default=None),
    censor: bool = Form(default=False),
    hook: str | None = Form(default=None),
    title: str | None = Form(default=None),
) -> dict:
    suffix = Path(file.filename or "upload.mp4").suffix or ".mp4"
    if suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".ts"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    tmp = Path(tempfile.gettempdir()) / f"clip-upload-{uuid.uuid4().hex}{suffix}"
    with tmp.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    if tmp.stat().st_size < 1024:
        tmp.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Upload was empty")

    try:
        info = video_info(tmp)
    except ToolError as exc:
        tmp.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Unreadable video: {exc}") from exc
    if info["duration"] < 5:
        tmp.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Video is shorter than 5 seconds")

    settings = settings_for(
        num_clips=num_clips, min_sec=min_sec, max_sec=max_sec,
        layout=layout, caption_style=caption_style,
        stabilization=stabilization,
        streamer_split_ratio=streamer_split_ratio,
        streamer_cam_pos=streamer_cam_pos,
        streamer_cam_zoom=streamer_cam_zoom,
        streamer_game_focus=streamer_game_focus,
        streamer_divider=streamer_divider,
        streamer_tag=streamer_tag,
        streamer_cam_shape=streamer_cam_shape,
        streamer_bg=streamer_bg,
        streamer_theme=streamer_theme,
        caption_position=caption_position,
        caption_font=caption_font,
        caption_font_size=caption_font_size,
        caption_primary_color=caption_primary_color,
        caption_active_color=caption_active_color,
        caption_outline=caption_outline,
        caption_uppercase=("1" if caption_uppercase else "0") if caption_uppercase is not None else None,
        caption_margin_v=caption_margin_v,
        subtitle_script=subtitle_script,
        whisper_model=whisper_model,
        force_align=force_align,
        whisper_min_prob=whisper_min_prob,
        skip_sponsors=skip_sponsors,
        sponsor_categories=sponsor_categories,
        sponsor_overlap_limit=sponsor_overlap_limit,
    )
    job_id = _start(settings, None, tmp, hook, censor, title or file.filename)
    return {"id": job_id, "duration": info["duration"]}


@app.get("/api/health")
def health() -> dict:
    problems = check_tools()
    return JSONResponse(
        status_code=200 if not problems else 503,
        content={"ok": not problems, "problems": problems, "jobs_dir": str(JOBS_DIR)},
    )


@app.post("/api/cookies")
async def upload_cookies(file: UploadFile = File(...)):
    dest = DATA_DIR / "cookies.txt"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"ok": True, "size": dest.stat().st_size}


@app.get("/api/cookies")
def get_cookies_status() -> dict:
    p1 = DATA_DIR / "cookies.txt"
    p2 = ROOT / "cookies.txt"
    found = p1.exists() or p2.exists()
    size = (p1 if p1.exists() else p2).stat().st_size if found else 0
    return {"has_cookies": found, "size": size}


@app.delete("/api/cookies")
def delete_cookies() -> dict:
    for p in (DATA_DIR / "cookies.txt", ROOT / "cookies.txt"):
        if p.exists():
            p.unlink(missing_ok=True)
    return {"ok": True}


from .config import load_ai_config, save_ai_config


@app.get("/api/ai")
def get_ai():
    cfg = load_ai_config()
    current_settings = Settings()
    return {
        "provider": current_settings.llm_provider,
        "has_gemini": bool(current_settings.gemini_api_key),
        "has_openai": bool(current_settings.openai_api_key),
        "gemini_api_key": cfg.get("gemini_api_key", ""),
        "openai_api_key": cfg.get("openai_api_key", ""),
        "gemini_model": current_settings.gemini_model,
        "openai_model": current_settings.openai_model,
    }


class AIConfigRequest(BaseModel):
    provider: str
    gemini_api_key: str | None = None
    openai_api_key: str | None = None
    gemini_model: str | None = None
    openai_model: str | None = None


@app.get("/v1/models")
def list_models():
    """OpenAI-compatible models endpoint.

    Some browser extensions / AI tooling probe for ``/v1/models`` expecting an
    OpenAI-shaped response. Return our configured providers so callers get a
    proper 200 instead of a 404.
    """
    cfg = load_ai_config()
    settings = Settings()
    models = []
    if settings.gemini_api_key or cfg.get("gemini_api_key"):
        models.append({
            "id": settings.gemini_model,
            "object": "model",
            "owned_by": "google",
        })
    if settings.openai_api_key or cfg.get("openai_api_key"):
        models.append({
            "id": settings.openai_model,
            "object": "model",
            "owned_by": "openai",
        })
    models.append({
        "id": "heuristic",
        "object": "model",
        "owned_by": "local",
    })
    return {"object": "list", "data": models}


@app.post("/api/ai")
def set_ai(req: AIConfigRequest):
    cfg = load_ai_config()
    cfg["provider"] = req.provider
    if req.gemini_api_key is not None:
        cfg["gemini_api_key"] = req.gemini_api_key.strip()
    if req.openai_api_key is not None:
        cfg["openai_api_key"] = req.openai_api_key.strip()
    if req.gemini_model is not None:
        cfg["gemini_model"] = req.gemini_model.strip()
    if req.openai_model is not None:
        cfg["openai_model"] = req.openai_model.strip()
    save_ai_config(cfg)
    return {"ok": True, "provider": cfg["provider"]}


@app.delete("/api/jobs/{job_id}/clips/{filename}")
def delete_clip(job_id: str, filename: str):
    path = _job_path(job_id)
    # Check both root and clips/ folder
    for folder in (path, path / "clips"):
        f1 = folder / filename
        if f1.exists():
            f1.unlink(missing_ok=True)
        f2 = folder / (Path(filename).stem + ".srt")
        if f2.exists():
            f2.unlink(missing_ok=True)
        f3 = folder / (Path(filename).stem + ".ass")
        if f3.exists():
            f3.unlink(missing_ok=True)
        f4 = folder / (Path(filename).stem + ".jpg")
        if f4.exists():
            f4.unlink(missing_ok=True)

    with LOCK:
        job = _read_job(job_id)
        job["clips"] = [
            c for c in job.get("clips", [])
            if c.get("filename") != filename
            and Path(c.get("video", "")).name != filename
            and c.get("slug") != Path(filename).stem
        ]
        JOB_CACHE[job_id] = job
        write_json(path / "job.json", job)
    return {"ok": True, "deleted": filename}


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    path = JOBS_DIR / job_id
    with LOCK:
        if job_id in JOB_CACHE:
            JOB_CACHE[job_id]["status"] = "cancelled"
            JOB_CACHE[job_id]["message"] = "Cancelled by user"
    if path.exists():
        try:
            pipeline.delete_job(path)
        except Exception:
            pass
    with LOCK:
        JOB_CACHE.pop(job_id, None)
    return {"ok": True, "cancelled": job_id}


class ClipCustomizeRequest(BaseModel):
    caption_style: str | None = None
    caption_position: str | None = None
    margin_v: int | None = None
    font: str | None = None
    font_size: int | None = None
    primary_color: str | None = None
    active_color: str | None = None
    uppercase: bool | None = None
    hook: str | None = None
    start: float | None = None
    end: float | None = None
    censor: bool | None = None
    framing: str | None = None
    # Rich caption styling (editor "Style" panel)
    outline: int | None = None
    shadow: int | None = None
    pop: bool | None = None
    pill: bool | None = None
    pill_color: str | None = None
    pill_alpha: float | None = None
    words: int | None = None
    chars: int | None = None
    letter_spacing: float | None = None
    line_height: float | None = None
    # Word-level text edits keyed by the word's absolute start time, e.g. "42.310".
    word_overrides: dict[str, str] | None = None


@app.get("/api/jobs/{job_id}/clips/{clip_identifier}/words")
def get_clip_words_endpoint(job_id: str, clip_identifier: str):
    path = _job_path(job_id)
    try:
        data = pipeline.get_clip_words(path, clip_identifier)
        return data
    except ToolError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/jobs/{job_id}/clips/{clip_identifier}/editor-state")
def save_editor_state_endpoint(job_id: str, clip_identifier: str, payload: dict):
    """Autosave the editor's style/trim/text state (no re-render)."""
    path = _job_path(job_id)
    try:
        updated_clip = pipeline.save_editor_state(path, clip_identifier, payload)
    except ToolError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    with LOCK:
        if job_id in JOB_CACHE:
            job = JOB_CACHE[job_id]
            for i, c in enumerate(job.get("clips") or []):
                if c.get("slug") == updated_clip.get("slug"):
                    job["clips"][i] = updated_clip
                    break
    return {"ok": True}


@app.post("/api/jobs/{job_id}/clips/{clip_identifier}/clean")
def ensure_clean_endpoint(job_id: str, clip_identifier: str):
    """Make sure the clip has a caption-free master the editor can preview."""
    path = _job_path(job_id)
    try:
        updated_clip = pipeline.ensure_clean_master(path, clip_identifier)
    except ToolError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not build the caption-free preview: {exc}")
    with LOCK:
        if job_id in JOB_CACHE:
            job = JOB_CACHE[job_id]
            for i, c in enumerate(job.get("clips") or []):
                if c.get("slug") == updated_clip.get("slug"):
                    job["clips"][i] = updated_clip
                    break
    norm = _normalize_clips(job_id, [updated_clip])
    return {"ok": True, "clip": norm[0] if norm else updated_clip}


@app.post("/api/jobs/{job_id}/clips/{clip_identifier}/caption-plan")
def caption_plan_endpoint(job_id: str, clip_identifier: str, req: ClipCustomizeRequest):
    """Caption events for the editor, from the same planner that burns them."""
    path = _job_path(job_id)
    opts = {k: v for k, v in req.dict().items() if v is not None}
    try:
        return pipeline.clip_caption_plan(path, clip_identifier, opts)
    except ToolError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/jobs/{job_id}/clips/{clip_identifier}/customize")
def customize_clip_endpoint(job_id: str, clip_identifier: str, req: ClipCustomizeRequest):
    path = _job_path(job_id)
    opts = {k: v for k, v in req.dict().items() if v is not None}
    try:
        updated_clip = pipeline.customize_clip(path, clip_identifier, opts)
        with LOCK:
            if job_id in JOB_CACHE:
                job = JOB_CACHE[job_id]
                for i, c in enumerate(job.get("clips") or []):
                    if (
                        c.get("slug") == clip_identifier
                        or c.get("filename") == clip_identifier
                        or Path(c.get("video", "")).name == clip_identifier
                    ):
                        job["clips"][i] = updated_clip
                        break
        norm_clips = _normalize_clips(job_id, [updated_clip])
        return {"ok": True, "clip": norm_clips[0] if norm_clips else updated_clip}
    except ToolError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to customize clip: {exc}")

