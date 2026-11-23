"""Getting a source video onto disk: URL download or local upload."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Callable

from .config import Settings
from .utils import ToolError, log, video_info

Progress = Callable[[float, str], None]


def download(url: str, dest_dir: Path, settings: Settings, progress: Progress | None = None) -> Path:
    """Download a public video URL with yt-dlp and return the media path."""
    try:
        from yt_dlp import YoutubeDL
    except ImportError as exc:  # pragma: no cover
        raise ToolError("yt-dlp is not installed. Run: pip install yt-dlp") from exc

    dest_dir.mkdir(parents=True, exist_ok=True)
    template = str(dest_dir / "source.%(ext)s")

    def hook(data: dict) -> None:
        if progress is None:
            return
        if data.get("status") == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            done = data.get("downloaded_bytes") or 0
            pct = (done / total * 100.0) if total else 0.0
            speed = (data.get("speed") or 0) / 1024 / 1024
            progress(min(99.0, pct), f"Downloading {pct:.0f}% ({speed:.1f} MB/s)")
        elif data.get("status") == "finished":
            progress(99.0, "Download finished, merging streams")

    opts: dict = {
        "format": (
            "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/"
            "b[height<=1080][ext=mp4]/"
            "bv*[height<=1080]+ba/b[height<=1080]/b"
        ),
        "outtmpl": template,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "retries": 3,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 4,
        "socket_timeout": 30,
        "restrictfilenames": True,
        "progress_hooks": [hook],
    }
    if settings.cookies_from_browser:
        # e.g. CLIP_COOKIES_FROM_BROWSER=chrome  (fixes "Sign in to confirm you're not a bot")
        opts["cookiesfrombrowser"] = (settings.cookies_from_browser,)

    log(f"[ingest] downloading {url}")
    meta: dict = {}
    try:
        with YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=True)
            if isinstance(data, dict):
                if data.get("entries"):
                    data = data["entries"][0]
                meta = {
                    "title": data.get("title") or "",
                    "uploader": data.get("uploader") or "",
                    "webpage_url": data.get("webpage_url") or url,
                    "duration": data.get("duration"),
                }
    except Exception as exc:
        raise ToolError(
            f"Download failed: {exc}\n"
            "If YouTube asked for a sign-in, set CLIP_COOKIES_FROM_BROWSER=chrome "
            "(or edge/firefox) in .env and retry, or upload the file instead."
        ) from exc

    if meta:
        (dest_dir / "source.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    candidates = sorted(
        (p for p in dest_dir.glob("source.*") if p.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov", ".m4a"}),
        key=lambda p: p.stat().st_size,
        reverse=True,
    )
    if not candidates:
        raise ToolError("Download finished but no media file was produced.")

    media = candidates[0]
    if media.suffix.lower() != ".mp4":
        remuxed = dest_dir / "source.mp4"
        from .utils import run

        run(["ffmpeg", "-y", "-i", str(media), "-c", "copy", str(remuxed)])
        media.unlink(missing_ok=True)
        media = remuxed

    info = video_info(media)
    log(f"[ingest] {media.name}: {info['width']}x{info['height']}, {info['duration']:.1f}s")
    return media


def import_file(src: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / f"source{src.suffix.lower() or '.mp4'}"
    if src.resolve() == target.resolve():
        return target
    shutil.copyfile(src, target)
    return target
