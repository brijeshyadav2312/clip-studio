"""Getting a source video onto disk: URL download or local upload."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Callable

from .config import DATA_DIR, ROOT, Settings
from .utils import ToolError, log, strip_ansi, video_info

Progress = Callable[[float, str], None]


def download(url: str, dest_dir: Path, settings: Settings, progress: Progress | None = None) -> Path:
    """Download a public video URL with yt-dlp and return the media path."""
    try:
        from yt_dlp import YoutubeDL
    except ImportError as exc:  # pragma: no cover
        raise ToolError("yt-dlp is not installed. Run: pip install yt-dlp") from exc

    dest_dir.mkdir(parents=True, exist_ok=True)
    template = str(dest_dir / "source.%(ext)s")

    import time
    last_hook_time = 0.0

    def hook(data: dict) -> None:
        nonlocal last_hook_time
        if progress is None:
            return
        now = time.time()
        if data.get("status") == "downloading":
            if now - last_hook_time < 0.4:
                return
            last_hook_time = now
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            done = data.get("downloaded_bytes") or 0
            pct = (done / total * 100.0) if total else 0.0
            speed = (data.get("speed") or 0) / 1024 / 1024
            progress(min(99.0, pct), f"Downloading {pct:.0f}% ({speed:.1f} MB/s)")
        elif data.get("status") == "finished":
            progress(99.0, "Download finished, merging streams")

    # Normalize YouTube URLs (including playlist mixes like list=RD<video_id>, shorts, youtu.be)
    if any(domain in url.lower() for domain in ("youtube.com", "youtu.be")):
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(url.strip())
            qs = urllib.parse.parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                url = f"https://www.youtube.com/watch?v={qs['v'][0]}"
            elif qs.get("list", [""])[0].startswith("RD") and len(qs.get("list", [""])[0]) > 2:
                url = f"https://www.youtube.com/watch?v={qs['list'][0][2:]}"
            elif "youtu.be" in parsed.netloc and parsed.path.strip("/"):
                url = f"https://www.youtube.com/watch?v={parsed.path.strip('/')}"
            elif any(parsed.path.startswith(p) for p in ("/shorts/", "/embed/", "/v/")):
                parts = parsed.path.strip("/").split("/")
                if len(parts) >= 2:
                    url = f"https://www.youtube.com/watch?v={parts[1]}"
        except Exception:
            pass

    opts: dict = {
        "format": "bv*+ba/b/best",
        "format_sort": ["res:1080", "ext:mp4:m4a"],
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
        "extractor_args": {"youtube": {"player_client": ["android", "ios", "mweb"]}},
    }

    # Enable Node.js JS runtime and challenge solver for modern YouTube extraction
    node_exe = shutil.which("node")
    if node_exe:
        opts["js_runtimes"] = {"node": {"path": node_exe}}
        opts["remote_components"] = ["ejs:github"]

    # Check for cookies file (explicitly configured, or in data/cookies.txt, or root cookies.txt)
    cookie_candidate = None
    if settings.cookie_file and Path(settings.cookie_file).exists():
        cookie_candidate = Path(settings.cookie_file)
    elif (DATA_DIR / "cookies.txt").exists():
        cookie_candidate = DATA_DIR / "cookies.txt"
    elif (ROOT / "cookies.txt").exists():
        cookie_candidate = ROOT / "cookies.txt"

    if cookie_candidate:
        log(f"[ingest] using cookie file: {cookie_candidate}")
        opts["cookiefile"] = str(cookie_candidate)
    elif settings.cookies_from_browser and settings.cookies_from_browser.lower() not in {"", "none", "auto"}:
        # e.g. CLIP_COOKIES_FROM_BROWSER=chrome | edge | firefox | brave
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
                    "thumbnail": data.get("thumbnail") or "",
                }
    except Exception as exc:
        raw_msg = strip_ansi(str(exc))
        if "requested format is not available" in raw_msg.lower():
            log(f"[ingest] strict format unavailable, falling back to any available format: {raw_msg}")
            fallback_opts = dict(opts)
            fallback_opts["format"] = "b/bv*+ba/best"
            fallback_opts.pop("format_sort", None)
            try:
                with YoutubeDL(fallback_opts) as fallback_ydl:
                    data = fallback_ydl.extract_info(url, download=True)
                    if isinstance(data, dict):
                        if data.get("entries"):
                            data = data["entries"][0]
                        meta = {
                            "title": data.get("title") or "",
                            "uploader": data.get("uploader") or "",
                            "webpage_url": data.get("webpage_url") or url,
                            "duration": data.get("duration"),
                        }
            except Exception as fallback_exc:
                raw_fallback = strip_ansi(str(fallback_exc))
                if "confirm you're not a bot" in raw_fallback.lower() or "sign in to confirm" in raw_fallback.lower():
                    raise ToolError(
                        "YouTube Bot Protection: YouTube requires bot verification for this URL.\n\n"
                        "To continue:\n"
                        "1. Switch to the 'Upload file' tab above to clip your video file directly without restrictions.\n"
                        "2. Or export your YouTube cookies as 'cookies.txt' and upload them in Customization Options."
                    ) from fallback_exc
                raise ToolError(f"Download failed: {raw_fallback}") from fallback_exc
        elif "confirm you're not a bot" in raw_msg.lower() or "sign in to confirm" in raw_msg.lower():
            raise ToolError(
                "YouTube Bot Protection: YouTube requires bot verification for this URL.\n\n"
                "To continue:\n"
                "1. Switch to the 'Upload file' tab above to clip your video file directly without restrictions.\n"
                "2. Or export your YouTube cookies as 'cookies.txt' and upload them in Customization Options."
            ) from exc
        else:
            raise ToolError(f"Download failed: {raw_msg}") from exc

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
