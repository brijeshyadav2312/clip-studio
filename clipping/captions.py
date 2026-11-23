"""Animated word-level captions rendered as ASS (burned in by ffmpeg/libass)."""

from __future__ import annotations

from pathlib import Path

from .config import Settings
from .utils import ass_time

PROFANITY = {
    "fuck", "fucking", "fucked", "fucker", "shit", "shitty", "bullshit", "bitch",
    "asshole", "damn", "dammit", "cunt", "dick", "piss", "bastard", "slut", "whore",
}

STYLES = {
    # name: fontsize, uppercase, active colour, max words, max chars/line
    "wordpop": {"size": 70, "upper": True, "active": "&H0000FFFF&", "words": 4, "chars": 17, "pop": True},
    "karaoke": {"size": 68, "upper": False, "active": "&H0000FFFF&", "words": 5, "chars": 19, "pop": False},
    "hormozi": {"size": 104, "upper": True, "active": "&H0000FF00&", "words": 2, "chars": 13, "pop": True},
    "clean": {"size": 58, "upper": False, "active": None, "words": 8, "chars": 26, "pop": False},
}

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{outline},3,2,70,70,300,1
Style: Clean,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3,2,2,80,80,280,1
Style: Hook,{font},72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,3,16,0,8,60,60,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _escape(text: str) -> str:
    return (
        text.replace("\\", "/")
        .replace("{", "(")
        .replace("}", ")")
        .replace("\r", " ")
        .replace("\n", " ")
        .strip()
    )


def _wrap(words: list[str], max_chars: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:3] or [""]


def _groups(words: list[dict], style: dict) -> list[list[dict]]:
    groups: list[list[dict]] = []
    current: list[dict] = []
    start = None
    for word in words:
        if start is None:
            start = word["start"]
        current.append(word)
        duration = word["end"] - start
        punctuation = word["word"][-1:] in ".!?,;:"
        too_many = len(current) >= style["words"]
        too_long = duration >= 2.6
        if punctuation or too_many or too_long:
            groups.append(current)
            current = []
            start = None
    if current:
        groups.append(current)
    return groups


def build(
    words: list[dict],
    clip_start: float,
    clip_end: float,
    settings: Settings,
    out_path: Path,
    hook: str | None = None,
    censor: bool = False,
) -> tuple[Path, list[tuple[float, float]]]:
    """Write an .ass file for the clip. Returns (path, muted_ranges)."""
    style_name = settings.caption_style if settings.caption_style in STYLES else "wordpop"
    style = STYLES[style_name]
    clip_duration = max(0.1, clip_end - clip_start)

    local: list[dict] = []
    for word in words:
        if word["end"] <= clip_start or word["start"] >= clip_end:
            continue
        text = _escape(word["word"])
        if not text:
            continue
        if censor and text.lower().strip(".,!?") in PROFANITY:
            text = text[0] + "*" * max(2, len(text) - 1)
        local.append({
            "start": max(0.0, word["start"] - clip_start),
            "end": max(0.0, min(clip_duration, word["end"] - clip_start)),
            "word": text,
            "muted": censor and word["word"].lower().strip(".,!?") in PROFANITY,
        })

    muted = [(w["start"], w["end"]) for w in local if w.get("muted")]

    outline = 8 if style_name != "clean" else 3
    font = settings.font or "Arial Black"
    header = HEADER.format(font=font, size=style["size"], outline=outline)

    events: list[str] = []
    if hook:
        hook_text = _escape(hook.upper() if style["upper"] else hook)
        lines = _wrap(hook_text.split(), 18)
        text = "\\N".join(lines)
        end = min(clip_duration, settings.hook_sec)
        events.append(
            f"Dialogue: 0,{ass_time(0)},{ass_time(end)},Hook,,0,0,0,,"
            f"{{\\fad(180,250)}}{text}"
        )

    for group in _groups(local, style):
        group_end = min(clip_duration, max(w["end"] for w in group))
        texts = [w["word"].upper() if style["upper"] else w["word"] for w in group]
        lines = _wrap(texts, style["chars"])
        plain = "\\N".join(lines)

        if style_name == "clean" or not style["active"]:
            events.append(
                f"Dialogue: 0,{ass_time(group[0]['start'])},{ass_time(group_end)},Clean,,0,0,0,,{plain}"
            )
            continue

        active = style["active"]
        for i, word in enumerate(group):
            start = word["start"]
            end = group[i + 1]["start"] if i + 1 < len(group) else group_end
            if end - start < 0.05:
                end = start + 0.08
            # Rebuild the group text with the active word highlighted.
            parts = []
            for j, other in enumerate(group):
                token = other["word"].upper() if style["upper"] else other["word"]
                if j == i:
                    parts.append(f"{{\\1c{active}\\b1}}{token}{{\\1c&H00FFFFFF&\\b1}}")
                else:
                    parts.append(token)
            # Re-wrap using visible text lengths (tags are invisible to libass).
            visible = [w["word"].upper() if style["upper"] else w["word"] for w in group]
            line_breaks = _wrap(visible, style["chars"])
            if len(line_breaks) > 1:
                first_count = len(line_breaks[0].split())
                parts = parts[:first_count] + ["\\N"] + parts[first_count:]
            text = " ".join(parts).replace(" \\N ", "\\N").replace("\\N ", "\\N")
            anim = ""
            if style["pop"] and i == 0:
                anim = "{\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}"
            events.append(
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{anim}{text}"
            )

    out_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_path, muted
