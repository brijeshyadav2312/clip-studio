"""ffmpeg rendering: crop/blur layout, caption burn-in, audio normalisation."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from .config import Settings
from .utils import ToolError, log, run

ENCODER = os.getenv("CLIP_ENCODER", "libx264")


def _filter_path(path: Path, cwd: Path) -> str:
    """libass/filter paths must be relative to cwd and use forward slashes."""
    try:
        rel = path.resolve().relative_to(cwd.resolve())
        return rel.as_posix()
    except ValueError:
        return path.resolve().as_posix().replace(":", "\\:")


def _audio_chain(has_audio: bool, muted: list[tuple[float, float]], duration: float) -> str:
    if has_audio:
        chain = "[0:a]loudnorm=I=-16:TP=-1.5:LRA=11"
    else:
        chain = f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f},asetpts=N/SR/TB"
    if muted:
        expr = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in muted)
        chain += f",volume=volume=0:enable='{expr}'"
    chain += ",aresample=48000[a]"
    return chain


def render_clip(
    source: Path,
    out_path: Path,
    work_dir: Path,
    start: float,
    end: float,
    info: dict,
    settings: Settings,
    ass_path: Path,
    plan: dict,
    sendcmd_path: Path | None = None,
    muted: list[tuple[float, float]] | None = None,
) -> Path:
    duration = max(0.5, end - start)
    muted = muted or []
    ass = _filter_path(ass_path, work_dir)
    fps = settings.fps

    if plan["mode"] == "crop" and sendcmd_path is not None:
        sw = plan.get("scaled_w") or 1080
        video = (
            f"[0:v]scale={sw}:1920:flags=lanczos,"
            f"sendcmd=f={_filter_path(sendcmd_path, work_dir)},"
            f"crop={plan['crop_w']}:{plan['crop_h']}:0:0,"
            f"subtitles={ass},fps={fps},format=yuv420p[v]"
        )
    else:
        video = (
            "[0:v]split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,gblur=sigma=28[bgb];"
            "[fg]scale=1080:-2:flags=lanczos[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,subtitles={ass},fps={fps},format=yuv420p[v]"
        )

    graph = f"{video};{_audio_chain(info.get('has_audio', True), muted, duration)}"

    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source.resolve()),
        "-filter_complex", graph,
        "-map", "[v]", "-map", "[a]",
        "-c:v", ENCODER,
    ]
    if ENCODER == "libx264":
        cmd += ["-preset", settings.preset, "-crf", str(settings.crf), "-profile:v", "high"]
    else:
        cmd += ["-preset", "p5", "-cq", str(settings.crf), "-b:v", "0"]
    cmd += [
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart",
        "-shortest",
        str(out_path.resolve()),
    ]

    try:
        run(cmd, cwd=work_dir, timeout=60 * 30)
    except ToolError as exc:
        if plan["mode"] == "crop" and sendcmd_path is not None:
            log("[render] dynamic crop failed, retrying with a static crop")
            static = dict(plan)
            static["samples"] = []
            return render_clip(
                source, out_path, work_dir, start, end, info, settings,
                ass_path, static, None, muted,
            )
        raise exc

    if not out_path.exists() or out_path.stat().st_size < 1024:
        raise ToolError(f"Render produced no usable output for {out_path.name}")
    return out_path


def srt_from_words(words: list[dict], start: float, end: float, out_path: Path) -> Path:
    from .utils import srt_time

    lines: list[str] = []
    index = 1
    chunk: list[dict] = []

    def flush() -> None:
        nonlocal index, chunk
        if not chunk:
            return
        text = " ".join(w["word"] for w in chunk).strip()
        if not text:
            chunk = []
            return
        a = max(0.0, chunk[0]["start"] - start)
        b = max(a + 0.2, chunk[-1]["end"] - start)
        lines.extend([str(index), f"{srt_time(a)} --> {srt_time(b)}", text, ""])
        index += 1
        chunk = []

    for word in words:
        if word["end"] <= start or word["start"] >= end:
            continue
        chunk.append(word)
        if len(chunk) >= 7 or word["word"][-1:] in ".!?":
            flush()
    flush()
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def check_tools() -> list[str]:
    problems: list[str] = []
    if shutil.which("ffmpeg") is None:
        problems.append("ffmpeg is not on PATH")
    if shutil.which("ffprobe") is None:
        problems.append("ffprobe is not on PATH")
    return problems
