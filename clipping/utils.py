"""Small shared helpers."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence


class ToolError(RuntimeError):
    pass


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
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


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
