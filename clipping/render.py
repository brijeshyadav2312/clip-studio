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
    clean_out: Path | None = None,
    burn: bool = True,
) -> Path:
    """Render a trimmed, reframed clip with captions burned in.

    When ``clean_out`` is given, a caption-free master with identical trim and
    framing is written in the same ffmpeg pass. The editor previews that master
    and draws captions as a live overlay, so a style change never shows the
    previous burn underneath; burned captions exist only in ``out_path``.

    ``burn=False`` writes only the clean master (used to backfill a missing
    master for a clip that was rendered before clean masters existed).
    """
    duration = max(0.5, end - start)
    muted = muted or []
    ass = _filter_path(ass_path, work_dir) if ass_path is not None else ""
    fps = settings.fps

    if plan["mode"] == "crop" and sendcmd_path is not None:
        sw = plan.get("scaled_w") or 1080
        # Seed the crop with the first path position so frame 0 never flashes at x=0.
        x0 = int(plan.get("samples")[0][1]) if plan.get("samples") else 0
        pre = (
            f"[0:v]scale={sw}:1920:flags=lanczos,"
            f"sendcmd=f={_filter_path(sendcmd_path, work_dir)},"
            f"crop={plan['crop_w']}:{plan['crop_h']}:{x0}:0[vpre]"
        )
    elif plan["mode"] == "dynamic_landscape":
        intervals = plan.get("landscape_intervals", [])
        enable_expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in intervals) if intervals else "0"
        sw = plan.get("scaled_w") or 1080
        x0 = int(plan.get("samples")[0][1]) if plan.get("samples") else 0
        sendcmd_cmd = f",sendcmd=f={_filter_path(sendcmd_path, work_dir)}" if sendcmd_path else ""

        crop_chain = f"scale={sw}:1920:flags=lanczos{sendcmd_cmd},crop={plan['crop_w']}:{plan['crop_h']}:{x0}:0[crop_str]"
        fit_chain = (
            "split=2[bgin][fgin];"
            "[bgin]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[bg_blur];"
            "[fgin]scale=1080:608:flags=lanczos[fg_fit];"
            "[bg_blur][fg_fit]overlay=0:656[fit_str]"
        )
        pre = (
            f"[0:v]split=2[in_c][in_f];"
            f"[in_c]{crop_chain};"
            f"[in_f]{fit_chain};"
            f"[crop_str][fit_str]overlay=0:0:enable='{enable_expr}'[vpre]"
        )
    elif plan["mode"] == "gameplay_center":
        gx, gy, gw, gh = plan.get("src_crop", (0, 0, 1080, 1920))
        pre = (
            f"[0:v]crop={gw}:{gh}:{gx}:{gy},"
            f"scale=1080:1920:flags=lanczos[vpre]"
        )
    elif plan["mode"] == "streamer_split":
        s = plan["streamer"]
        cx, cy, cw, ch = s["cam_crop"]
        gx, gy, gw, gh = s["game_crop"]
        top_h = s["top_h"]
        bot_h = s["bot_h"]
        divider = settings.streamer_divider
        tag = (settings.streamer_tag or "").strip()

        theme_colors = {
            "purple_cyan": "0x7c5cff",
            "cyan": "0x21d4a0",
            "gold": "0xffca62",
            "red": "0xff5c72",
            "white": "0xffffff",
        }
        accent = theme_colors.get(settings.streamer_theme, "0x7c5cff")

        filters = [
            "[0:v]split=2[in_cam][in_game]",
            f"[in_cam]crop={cw}:{ch}:{cx}:{cy},scale=1080:{top_h}:flags=lanczos[cam]",
            f"[in_game]crop={gw}:{gh}:{gx}:{gy},scale=1080:{bot_h}:flags=lanczos[game]",
            "[cam][game]vstack=inputs=2[stacked]",
        ]
        curr = "stacked"

        if divider == "glow":
            filters.append(f"[{curr}]drawbox=x=0:y={top_h - 2}:w=1080:h=4:color={accent}@0.95:t=fill[div]")
            curr = "div"
        elif divider == "subtle":
            filters.append(f"[{curr}]drawbox=x=0:y={top_h - 1}:w=1080:h=2:color=0xffffff@0.35:t=fill[div]")
            curr = "div"

        if tag:
            clean_tag = tag.replace(":", "\\:").replace("'", "")
            filters.append(
                f"[{curr}]drawtext=text='{clean_tag}':fontsize=24:fontcolor=white:box=1:boxcolor=black@0.70:boxborderw=6:x=(w-text_w)/2:y={top_h - 16}[tagged]"
            )
            curr = "tagged"

        filters.append(f"[{curr}][vpre]")
        pre = ";".join(filters)
    elif plan["mode"] == "streamer_pip":
        s = plan["streamer"]
        cx, cy, cw, ch = s["cam_crop"]
        gx, gy, gw, gh = s["game_crop"]
        corner = s["corner"]
        pip_w = 340
        pip_h = 240
        margin = 24
        pos_x = margin if "left" in corner else (1080 - pip_w - margin)
        pos_y = (1920 - pip_h - 180) if "bottom" in corner else (margin + 120)

        theme_colors = {
            "purple_cyan": "0x7c5cff",
            "cyan": "0x21d4a0",
            "gold": "0xffca62",
            "red": "0xff5c72",
            "white": "0xffffff",
        }
        accent = theme_colors.get(settings.streamer_theme, "0x7c5cff")

        pre = (
            f"[0:v]split=2[in_game][in_cam];"
            f"[in_game]crop={gw}:{gh}:{gx}:{gy},scale=1080:1920:flags=lanczos[bg];"
            f"[in_cam]crop={cw}:{ch}:{cx}:{cy},scale={pip_w}:{pip_h}:flags=lanczos,"
            f"drawbox=x=0:y=0:w={pip_w}:h={pip_h}:color={accent}@0.95:t=3[pip];"
            f"[bg][pip]overlay={pos_x}:{pos_y}[vpre]"
        )
    else:  # gameplay_blur / blur
        pre = (
            "[0:v]split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,gblur=sigma=28[bgb];"
            "[fg]scale=1080:-2:flags=lanczos[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[vpre]"
        )

    # Caption burn-in happens on its own branch; the clean master branch never
    # touches the subtitles filter, so no old style can linger under a new one.
    parts = [pre]
    audio = _audio_chain(info.get("has_audio", True), muted, duration)
    if clean_out is not None and burn:
        parts += [
            "[vpre]split=2[vsub][vcln]",
            f"[vsub]subtitles={ass},fps={fps},format=yuv420p[v]",
            f"[vcln]fps={fps},format=yuv420p[vclean]",
        ]
        audio += ";[a]asplit=2[a1][a2]"
        maps = [("[v]", out_path, "[a1]"), ("[vclean]", clean_out, "[a2]")]
    elif clean_out is not None:
        parts.append(f"[vpre]fps={fps},format=yuv420p[vclean]")
        maps = [("[vclean]", clean_out, "[a]")]
    else:
        parts.append(f"[vpre]subtitles={ass},fps={fps},format=yuv420p[v]")
        maps = [("[v]", out_path, "[a]")]
    graph = ";".join(parts) + ";" + audio

    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source.resolve()),
        "-filter_complex", graph,
    ]
    codec = ["-c:v", ENCODER]
    if ENCODER == "libx264":
        codec += ["-preset", settings.preset, "-crf", str(settings.crf), "-profile:v", "high"]
    else:
        codec += ["-preset", "p5", "-cq", str(settings.crf), "-b:v", "0"]
    out_opts = [
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart",
        "-shortest",
    ]
    for v_label, out, a_label in maps:
        cmd += ["-map", v_label, "-map", a_label, *codec, *out_opts, str(out.resolve())]

    try:
        run(cmd, cwd=work_dir, timeout=60 * 30)
    except ToolError as exc:
        if plan["mode"] == "crop" and sendcmd_path is not None:
            log("[render] dynamic crop failed, retrying with a static crop")
            static = dict(plan)
            static["samples"] = []
            return render_clip(
                source, out_path, work_dir, start, end, info, settings,
                ass_path, static, None, muted, clean_out=clean_out, burn=burn,
            )
        raise exc

    if not burn:
        if clean_out is None or not clean_out.exists() or clean_out.stat().st_size < 1024:
            raise ToolError(f"Render produced no usable output for {clean_out.name if clean_out else 'clean master'}")
        return clean_out
    if not out_path.exists() or out_path.stat().st_size < 1024:
        raise ToolError(f"Render produced no usable output for {out_path.name}")
    if clean_out is not None and (not clean_out.exists() or clean_out.stat().st_size < 1024):
        log(f"[render] clean master not produced for {clean_out.name}")
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
