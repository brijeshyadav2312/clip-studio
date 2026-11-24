"""Job orchestration: ingest -> transcribe -> rank -> reframe -> caption -> render."""

from __future__ import annotations

import shutil
import time
import traceback
from pathlib import Path
from typing import Callable

from . import captions, highlights, ingest, reframe, render, sponsorblock, transcribe
from .config import DATA_DIR, Settings
from .utils import ToolError, log, read_json, video_info, write_json

Report = Callable[[str, float, str], None]


def _clip_dir(job_dir: Path) -> Path:
    path = job_dir / "clips"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _thumb(source: Path, out: Path, at: float, work_dir: Path) -> None:
    from .utils import run

    try:
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{at:.3f}", "-i", str(source.resolve()),
            "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4",
            str(out.resolve()),
        ], cwd=work_dir, timeout=60)
    except ToolError as exc:
        log(f"[thumb] {exc}")


def process(
    job_dir: Path,
    settings: Settings,
    report: Report | None = None,
    url: str | None = None,
    upload: Path | None = None,
    hook_override: str | None = None,
    censor: bool = False,
) -> dict:
    job_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = job_dir / "job.json"
    manifest: dict = {}
    if manifest_path.exists():
        try:
            manifest = read_json(manifest_path)
        except Exception:
            manifest = {}
    manifest.setdefault("id", job_dir.name)
    manifest.setdefault("created", int(time.time()))
    manifest.update({"status": "running", "error": None, "clips": []})

    def save(status: str, pct: float, message: str) -> None:
        manifest["status"] = status
        manifest["progress"] = round(pct, 1)
        manifest["message"] = message
        manifest["updated"] = int(time.time())
        write_json(manifest_path, manifest)
        if report:
            try:
                report(status, pct, message, manifest)
            except TypeError:
                report(status, pct, message)

    try:
        # 1. Ingest ---------------------------------------------------------
        if upload is not None:
            save("downloading", 2, "Importing upload")
            source = ingest.import_file(upload, job_dir)
        elif url:
            source = ingest.download(
                url, job_dir, settings,
                progress=lambda pct, msg: save("downloading", 2 + pct * 0.08, msg),
            )
        else:
            existing = job_dir / "source.mp4"
            if not existing.exists():
                raise ToolError("No input given and no downloaded source found.")
            source = existing

        info = video_info(source)
        meta: dict = {}
        sidecar = job_dir / "source.json"
        if sidecar.exists():
            try:
                meta = read_json(sidecar)
            except Exception:
                meta = {}
        title = manifest.get("title") or meta.get("title") or (
            Path(url).name if url else source.stem
        )
        # Extract a fast video poster frame if available
        poster = job_dir / "poster.jpg"
        thumb_link = meta.get("thumbnail") or ""
        if not poster.exists() and source.exists():
            try:
                render.run_ffmpeg(["-ss", "00:00:01", "-i", str(source), "-vframes", "1", "-q:v", "3", str(poster), "-y"])
                if poster.exists():
                    thumb_link = f"/media/{job_dir.name}/poster.jpg"
            except Exception:
                pass

        manifest["title"] = title
        manifest["source"] = {
            "file": source.name,
            "title": title,
            "url": url or meta.get("webpage_url"),
            "uploader": meta.get("uploader"),
            "duration": round(info["duration"], 2),
            "width": info["width"],
            "height": info["height"],
            "fps": round(info["fps"], 2),
            "thumbnail": thumb_link,
            "video_url": f"/media/{job_dir.name}/{source.name}" if source.exists() else "",
        }

        # 1b. Sponsor / promo skip segments (SponsorBlock, YouTube only).
        skip_segments: list[dict] = []
        if settings.skip_sponsors and url:
            vid = sponsorblock.video_id_from_url(meta.get("webpage_url") or url or "")
            if vid:
                skip_segments = sponsorblock.fetch_skip_segments(
                    vid, categories=settings.sponsor_categories
                )
                manifest["skip_segments"] = skip_segments
        if skip_segments:
            log(f"[pipeline] {len(skip_segments)} sponsor/promo segment(s) will be avoided")

        save("transcribing", 10, "Reading media")

        # 2. Transcribe -----------------------------------------------------
        transcript = transcribe.transcribe(
            source, job_dir, settings,
            progress=lambda pct, msg: save("transcribing", 10 + pct * 0.35, msg),
        )
        manifest["language"] = transcript.get("language")
        save("ranking", 46, "Finding the best moments")

        # 3. Rank -----------------------------------------------------------
        clips = highlights.select_clips(
            transcript, settings,
            progress=lambda pct, msg: save("ranking", 46 + pct * 0.08, msg),
            skip_segments=skip_segments,
        )
        if not clips:
            raise ToolError("No usable clips were found in this video.")
        manifest["clips"] = clips

        # 4. Render ---------------------------------------------------------
        clip_dir = _clip_dir(job_dir)
        rf_dir = job_dir / "rf"
        rf_dir.mkdir(exist_ok=True)
        total = len(clips)
        for index, clip in enumerate(clips):
            base = 54 + (index / total) * 45
            save("rendering", base, f"Rendering clip {index + 1}/{total}")

            start, end = clip["start"], clip["end"]
            words = highlights._words_in(transcript["segments"], start, end)

            plan = reframe.plan(source, start, end, info, settings)
            ass_path, muted = captions.build(
                words, start, end, settings,
                clip_dir / f"{clip['slug']}.ass",
                hook=hook_override or clip.get("hook") or None,
                censor=censor,
                layout=plan.get("mode", "auto"),
            )
            render.srt_from_words(words, start, end, clip_dir / f"{clip['slug']}.srt")
            sendcmd = None
            if plan["mode"] in ("crop", "dynamic_landscape") and plan.get("samples"):
                sendcmd = reframe.write_sendcmd(plan["samples"], rf_dir / f"{clip['slug']}.txt")

            out = clip_dir / f"{clip['slug']}.mp4"
            render.render_clip(
                source, out, job_dir, start, end, info, settings,
                ass_path, plan, sendcmd, muted,
            )

            thumb = clip_dir / f"{clip['slug']}.jpg"
            _thumb(source, thumb, start + min(1.0, (end - start) / 3), job_dir)

            clip["video"] = f"clips/{out.name}"
            clip["srt"] = f"clips/{Path(ass_path).stem}.srt"
            clip["thumb"] = f"clips/{thumb.name}" if thumb.exists() else None
            clip["reframe"] = {"mode": plan["mode"], "face_ratio": plan.get("face_ratio", 0)}
            manifest["clips"] = clips
            save("rendering", base + (45 / total) * 0.9, f"Rendered clip {index + 1}/{total}")

        if not settings.keep_temp:
            for junk in ("audio.wav",):
                (job_dir / junk).unlink(missing_ok=True)

        manifest["status"] = "done"
        manifest["progress"] = 100
        manifest["message"] = f"{len(clips)} clips ready"
        manifest["updated"] = int(time.time())
        write_json(manifest_path, manifest)
        if report:
            try:
                report("done", 100, manifest["message"], manifest)
            except TypeError:
                report("done", 100, manifest["message"])
        return manifest

    except Exception as exc:
        manifest["status"] = "error"
        manifest["error"] = str(exc)
        manifest["message"] = str(exc).splitlines()[0][:300]
        manifest["updated"] = int(time.time())
        write_json(manifest_path, manifest)
        log("[job] failed:\n" + traceback.format_exc())
        if report:
            try:
                report("error", manifest.get("progress", 0), manifest["message"], manifest)
            except TypeError:
                report("error", manifest.get("progress", 0), manifest["message"])
        raise


def new_job_dir(job_id: str) -> Path:
    path = DATA_DIR / "jobs" / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_job(job_dir: Path) -> None:
    if not job_dir.exists():
        return

    def _handle_remove_readonly(func, path, exc):
        import stat
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    for _ in range(3):
        try:
            shutil.rmtree(job_dir, onerror=_handle_remove_readonly)
            break
        except Exception:
            time.sleep(0.05)
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
