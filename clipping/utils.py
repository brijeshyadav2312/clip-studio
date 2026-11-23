"""Small shared helpers."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable, Sequence


class ToolError(RuntimeError):
    pass


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes and terminal artifacts from text."""
    if not text:
        return ""
    # Strip \x1b[...] or \033[...]
    clean = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", text)
    # Strip double bracket artifacts like [][0;31m
    clean = re.sub(r"\[\]\[[0-9;]*[a-zA-Z]", "", clean)
    return clean.strip()


def run(cmd: Sequence[str], *, cwd: Path | None = None, timeout: int | None = None) -> subprocess.CompletedProcess:
    """Run a command and raise a readable error on failure."""
    proc = subprocess.run(
        [str(c) for c in cmd],
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-12:]
        raise ToolError(f"Command failed ({proc.returncode}): {' '.join(str(c) for c in cmd)}\n" + "\n".join(tail))
    return proc


def ffprobe(path: Path) -> dict[str, Any]:
    proc = run([
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ])
    return json.loads(proc.stdout)


def video_info(path: Path) -> dict[str, Any]:
    data = ffprobe(path)
    duration = float(data.get("format", {}).get("duration") or 0.0)
    width = height = 0
    fps = 30.0
    has_audio = False
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video" and not width:
            width = int(stream.get("width") or 0)
            height = int(stream.get("height") or 0)
            rate = stream.get("avg_frame_rate") or "30/1"
            try:
                num, den = rate.split("/")
                fps = float(num) / float(den) if float(den) else 30.0
            except Exception:
                fps = 30.0
        elif stream.get("codec_type") == "audio":
            has_audio = True
    if not width or not height:
        raise ToolError(f"Could not read video dimensions from {path.name}")
    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "has_audio": has_audio,
    }


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def even(value: int) -> int:
    return value if value % 2 == 0 else value - 1


def slug(text: str, limit: int = 60) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return (text[:limit].strip("-") or "clip")


def ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:05.2f}"


def srt_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis == 1000:
        secs += 1
        millis = 0
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_json(path: Path, data: Any) -> None:
    """Atomic write on Windows/POSIX with fallback to avoid file locking collisions."""
    import uuid
    content = json.dumps(data, indent=2, ensure_ascii=False)
    tmp = path.with_suffix(f".tmp-{uuid.uuid4().hex}")
    try:
        tmp.write_text(content, encoding="utf-8")
        for _ in range(6):
            try:
                import os
                os.replace(tmp, path)
                return
            except (PermissionError, OSError):
                time.sleep(0.02)
        try:
            path.write_text(content, encoding="utf-8")
        except Exception:
            pass
    except Exception as exc:
        log(f"[utils] write_json warning for {path.name}: {exc}")
    finally:
        try:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
        except Exception:
            pass


def read_json(path: Path, retries: int = 5) -> Any:
    """Safe read with retries to tolerate concurrent writes on Windows."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                raise ValueError("Empty file read")
            return json.loads(raw)
        except (PermissionError, json.JSONDecodeError, ValueError) as exc:
            last_err = exc
            time.sleep(0.03 * (attempt + 1))
    if last_err:
        raise last_err
    return {}


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def segments_to_srt(segments: Iterable[dict], path: Path, offset: float = 0.0) -> None:
    lines: list[str] = []
    for i, seg in enumerate(segments, 1):
        start = max(0.0, float(seg["start"]) - offset)
        end = max(start + 0.2, float(seg["end"]) - offset)
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        lines += [str(i), f"{srt_time(start)} --> {srt_time(end)}", text, ""]
    path.write_text("\n".join(lines), encoding="utf-8")
