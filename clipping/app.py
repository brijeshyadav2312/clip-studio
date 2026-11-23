"""Local web app: paste a YouTube URL or upload a file, get vertical clips."""

from __future__ import annotations

import os
import shutil
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import pipeline
from .config import DATA_DIR, ROOT, Settings, settings_for
from .llm import provider_available
from .render import check_tools
from .utils import ToolError, read_json, strip_ansi, video_info, write_json

JOBS_DIR = DATA_DIR / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = ROOT / "static"
DIST_DIR = STATIC_DIR / "dist"

app = FastAPI(title="Clip Studio", version="1.0")
app.mount("/media", StaticFiles(directory=str(JOBS_DIR)), name="media")
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

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
    subtitle_script: str | None = None
    whisper_model: str | None = None
    cookies_from_browser: str | None = None
    cookie_file: str | None = None
    censor: bool = False
    hook: str | None = None
    title: str | None = None


def _job_path(job_id: str) -> Path:
    path = JOBS_DIR / job_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    return path


def _read_job(job_id: str) -> dict:
    with LOCK:
        if job_id in JOB_CACHE:
            return JOB_CACHE[job_id].copy()
    path = _job_path(job_id) / "job.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        data = read_json(path)
    except Exception as exc:
        with LOCK:
            if job_id in JOB_CACHE:
                return JOB_CACHE[job_id].copy()
        raise HTTPException(status_code=500, detail=f"Failed to read job state: {exc}")
    with LOCK:
        JOB_CACHE[job_id] = data
    return data


def _run(job_id: str, settings: Settings, url: str | None, upload: Path | None,
         hook: str | None, censor: bool, title: str | None) -> None:
    job_dir = JOBS_DIR / job_id

    def on_report(status: str, pct: float, message: str, manifest: dict | None = None) -> None:
        with LOCK:
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
    if (DIST_DIR / "index.html").exists():
        return FileResponse(DIST_DIR / "index.html")
    return FileResponse(STATIC_DIR / "index.html")


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
        jobs.append({
            "id": data.get("id", job_id),
            "status": data.get("status", "unknown"),
            "progress": data.get("progress", 0),
            "message": data.get("message", ""),
            "title": data.get("title") or (data.get("source") or {}).get("title"),
            "created": data.get("created"),
            "clips": len(data.get("clips") or []),
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
        for path in JOBS_DIR.iterdir():
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
        subtitle_script=req.subtitle_script,
        whisper_model=req.whisper_model,
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
    subtitle_script: str | None = Form(default=None),
    whisper_model: str | None = Form(default=None),
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
        subtitle_script=subtitle_script,
        whisper_model=whisper_model,
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
