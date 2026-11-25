"""Animated word-level captions rendered as ASS (burned in by ffmpeg/libass).

Hardened against:
  * overflowing the frame (hard line/char limits, long-word splitting)
  * meaningless symbol/garbage captions
  * out-of-order or zero-duration word timings
"""

from __future__ import annotations

import re
from pathlib import Path

from .config import Settings
from .utils import ass_time

PROFANITY = {
    "fuck", "fucking", "fucked", "fucker", "shit", "shitty", "bullshit", "bitch",
    "asshole", "damn", "dammit", "cunt", "dick", "piss", "bastard", "slut", "whore",
}

STYLES = {
    # name: fontsize, uppercase, active colour, max words, max chars/line, pop animation
    "wordpop": {"size": 70, "upper": True, "active": "&H0000FFFF&", "words": 4, "chars": 17, "pop": True,
                "outline": 8, "shadow": 3, "pill": False, "pill_color": "#000000", "pill_alpha": 0.55,
                "letter": 0, "line": 1.06},
    "karaoke": {"size": 68, "upper": False, "active": "&H0000FFFF&", "words": 5, "chars": 19, "pop": False,
                "outline": 6, "shadow": 2, "pill": True, "pill_color": "#000000", "pill_alpha": 0.55,
                "letter": 0, "line": 1.12},
    "hormozi": {"size": 104, "upper": True, "active": "&H0000FF00&", "words": 2, "chars": 13, "pop": True,
                "outline": 12, "shadow": 5, "pill": False, "pill_color": "#000000", "pill_alpha": 0.55,
                "letter": 0, "line": 1.0},
    "clean": {"size": 58, "upper": False, "active": None, "words": 8, "chars": 26, "pop": False,
              "outline": 3, "shadow": 2, "pill": True, "pill_color": "#000000", "pill_alpha": 0.5,
              "letter": 0, "line": 1.18},
    "neon": {"size": 76, "upper": True, "active": "&H00FFFF00&", "words": 3, "chars": 16, "pop": True,
             "outline": 9, "shadow": 7, "pill": True, "pill_color": "#0B0B1A", "pill_alpha": 0.65,
             "letter": 1, "line": 1.06},
    "boxed": {"size": 68, "upper": True, "active": "&H0000D7FF&", "words": 3, "chars": 15, "pop": False,
              "outline": 6, "shadow": 0, "pill": False, "pill_color": "#000000", "pill_alpha": 0.55,
              "letter": 0, "line": 1.06},
    "beast": {"size": 94, "upper": True, "active": "&H0000FFFF&", "words": 2, "chars": 12, "pop": True,
              "outline": 14, "shadow": 6, "pill": False, "pill_color": "#000000", "pill_alpha": 0.55,
              "letter": 0, "line": 1.0},
    "comic": {"size": 86, "upper": True, "active": "&H0000FF00&", "words": 3, "chars": 14, "pop": True,
              "outline": 12, "shadow": 8, "pill": False, "pill_color": "#000000", "pill_alpha": 0.55,
              "letter": 0, "line": 1.02},
}


def hex_to_ass_color(hex_color: str, alpha: int = 0) -> str:
    """Convert CSS hex color (#RRGGBB) to ASS color format (&HAABBGGRR&)."""
    if not hex_color:
        return "&H00FFFFFF&"
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = h[0:2], h[2:4], h[4:6]
        return f"&H{alpha:02X}{b.upper()}{g.upper()}{r.upper()}&"
    if hex_color.startswith("&H") and hex_color.endswith("&"):
        return hex_color
    return "&H00FFFFFF&"

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},{primary},{primary},&H00000000,&H80000000,-1,0,0,0,100,100,{letter},0,1,{outline},{shadow},2,70,70,{margin_v},1
Style: Clean,{font},{size},{primary},{primary},&H00000000,&H64000000,0,0,0,0,100,100,{letter},0,1,{outline},{shadow},2,80,80,{margin_v_clean},1
Style: Hook,{font},72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,3,16,0,8,60,60,{margin_hook},1
Style: Pill,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

_SYMBOL_ONLY = re.compile(r"^[\W_]{1,}$")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def _escape(text: str) -> str:
    text = _CONTROL_CHARS.sub(" ", text)
    return (
        text.replace("\\", "/")
        .replace("{", "(")
        .replace("}", ")")
        .replace("\r", " ")
        .replace("\n", " ")
        .strip()
    )


def _split_long_word(word: str, max_chars: int) -> list[str]:
    """Split a word longer than max_chars so it never overflows a single line."""
    if len(word) <= max_chars:
        return [word]
    return [word[i:i + max_chars] for i in range(0, len(word), max_chars)]


def _wrap(words: list[str], max_chars: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in words:
        for piece in _split_long_word(word, max_chars):
            candidate = f"{current} {piece}".strip() if current else piece
            if current and len(candidate) > max_chars:
                lines.append(current)
                current = piece
            else:
                current = candidate
    if current:
        lines.append(current)
    return lines[:3] or [""]


def ass_to_hex(value: str | None, fallback: str = "#FFFFFF") -> str:
    """Convert an ASS colour (&HAABBGGRR&) to a CSS hex string."""
    if not value or not value.startswith("&H"):
        return fallback
    raw = value.strip("&").lstrip("H") or "00FFFFFF"
    raw = raw.rjust(8, "0")
    aa, bb, gg, rr = raw[0:2], raw[2:4], raw[4:6], raw[6:8]
    if aa.upper() == "FF":  # fully transparent in ASS terms
        return fallback
    return f"#{rr.upper()}{gg.upper()}{bb.upper()}"


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


def _wrap_word_objs(words: list[dict], max_chars: int) -> list[list[dict]]:
    """Wrap whole word objects into at most three lines, never splitting a word.

    This is the single source of truth for line breaks: the burned ASS and the
    editor preview both read the resulting lines, so they cannot drift apart.
    """
    lines: list[list[dict]] = []
    current: list[dict] = []
    length = 0
    for word in words:
        size = len(word["word"])
        if current and length + 1 + size > max_chars:
            lines.append(current)
            current = [word]
            length = size
        else:
            length = length + 1 + size if current else size
            current.append(word)
    if current:
        lines.append(current)
    return lines[:3] or [[]]


def apply_word_overrides(words: list[dict], overrides: dict | None) -> list[dict]:
    """Apply user text edits keyed by a word's absolute start time.

    Empty overrides delete the word. This is shared by the burn, the SRT writer
    and the editor plan so all three agree after a transcript edit.
    """
    if not overrides:
        return words
    out: list[dict] = []
    for word in words:
        key = f"{float(word.get('start', 0)):.3f}"
        if key in overrides:
            text = _escape(str(overrides[key] or ""))
            if not text:
                continue
            word = {**word, "word": text}
        out.append(word)
    return out


def plan_captions(
    words: list[dict],
    clip_start: float,
    clip_end: float,
    settings: Settings,
    custom_options: dict | None = None,
    layout: str = "auto",
    censor: bool = False,
    hook: str | None = None,
) -> dict:
    """Resolve style, position, grouping and line breaks for one clip.

    ``build()`` writes ASS from this plan and the API returns it to the editor,
    so the preview and the burned render use identical timings and layout.
    """
    custom = custom_options or {}
    style_name = custom.get("caption_style") or getattr(settings, "caption_style", "wordpop")
    if style_name not in STYLES:
        style_name = "wordpop"
    style = dict(STYLES[style_name])

    def _int_opt(key: str, lo: int, hi: int) -> None:
        if custom.get(key) is None:
            return
        try:
            style[key] = max(lo, min(hi, int(custom[key])))
        except (TypeError, ValueError):
            pass

    def _float_opt(key: str, lo: float, hi: float, dest: str | None = None) -> None:
        if custom.get(key) is None:
            return
        try:
            style[dest or key] = max(lo, min(hi, float(custom[key])))
        except (TypeError, ValueError):
            pass

    if custom.get("font_size"):
        try:
            style["size"] = max(24, min(200, int(custom["font_size"])))
        except (TypeError, ValueError):
            pass
    if custom.get("uppercase") is not None:
        style["upper"] = bool(custom["uppercase"])
    _int_opt("words", 1, 8)
    _int_opt("chars", 6, 40)
    _int_opt("outline", 0, 30)
    _int_opt("shadow", 0, 30)
    _float_opt("letter_spacing", -5.0, 10.0, "letter")
    _float_opt("line_height", 0.8, 1.8, "line")
    _float_opt("pill_alpha", 0.0, 0.95)
    if custom.get("pop") is not None:
        style["pop"] = bool(custom["pop"])
    if custom.get("pill") is not None:
        style["pill"] = bool(custom["pill"])
    if custom.get("pill_color"):
        style["pill_color"] = str(custom["pill_color"])

    active_hex = ass_to_hex(style.get("active")) if style.get("active") else None
    if "active_color" in custom:
        if custom["active_color"]:
            style["active"] = hex_to_ass_color(custom["active_color"])
            active_hex = custom["active_color"]
        else:
            # An explicit empty string means "no active-word highlight".
            style["active"] = None
            active_hex = None

    primary_hex = custom.get("primary_color") or "#FFFFFF"
    primary_color = hex_to_ass_color(primary_hex)
    font = custom.get("font") or getattr(settings, "font", None) or "Arial Black"
    outline = int(style.get("outline", 8))
    shadow = int(style.get("shadow", 3))
    overrides = custom.get("word_overrides") or {}

    clip_duration = max(0.1, clip_end - clip_start)

    local: list[dict] = []
    for word in words:
        if word["end"] <= clip_start or word["start"] >= clip_end:
            continue
        raw = word.get("word", "")
        if not raw or _SYMBOL_ONLY.match(raw.strip()):
            continue
        abs_start = float(word["start"])
        override = overrides.get(f"{abs_start:.3f}")
        if override is not None:
            text = _escape(str(override))
            if not text:
                continue
        else:
            text = _escape(raw)
            if not text:
                continue
        censored = censor and text.lower().strip(".,!?") in PROFANITY
        if censored:
            text = text[0] + "*" * max(2, len(text) - 1)
        start = max(0.0, abs_start - clip_start)
        end = max(0.0, min(clip_duration, float(word["end"]) - clip_start))
        if end <= start:
            end = min(clip_duration, start + 0.08)
        local.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "word": text,
            "abs_start": round(abs_start, 3),
            "muted": censored,
        })

    deduped: list[dict] = []
    for w in local:
        if deduped and deduped[-1]["word"] == w["word"] and abs(deduped[-1]["end"] - w["start"]) < 0.02:
            deduped[-1]["end"] = w["end"]
            continue
        deduped.append(w)
    local = deduped

    muted = [(w["start"], w["end"]) for w in local if w.get("muted")]

    pos = custom.get("caption_position") or getattr(settings, "caption_position", "auto")
    if custom.get("margin_v") is not None:
        margin_v = int(custom["margin_v"])
        margin_v_clean = max(50, margin_v - 20)
        margin_hook = 150
    elif pos == "top":
        margin_v = 1500
        margin_v_clean = 1480
        margin_hook = 180
    elif pos == "divider" or (pos == "auto" and layout == "streamer_split"):
        margin_v = 780
        margin_v_clean = 760
        margin_hook = 180
    elif pos == "middle":
        margin_v = 860
        margin_v_clean = 840
        margin_hook = 150
    elif pos == "bottom" or (pos == "auto" and layout != "streamer_split"):
        if layout in ("fit_blur", "dynamic_landscape"):
            margin_v = 260
            margin_v_clean = 240
        else:
            margin_v = 300
            margin_v_clean = 280
        margin_hook = 150
    else:
        margin_v = 300
        margin_v_clean = 280
        margin_hook = 150

    # Active-word treatment, shared by the burn and the preview: the boxed style
    # is a black word inside a thick yellow stroke (a marker smear), everything
    # else is a coloured word inside the normal black stroke.
    active_fill_hex = active_hex or primary_hex
    active_stroke_hex = "#000000"
    active_stroke = outline
    if style.get("active") and style_name == "boxed":
        active_fill_hex = "#000000"
        active_stroke_hex = custom.get("active_color") or "#FFE600"
        active_stroke = max(outline + 8, 16)

    groups: list[dict] = []
    for group in _groups(local, style):
        lines = _wrap_word_objs(group, style["chars"])
        groups.append({
            "start": group[0]["start"],
            "end": min(clip_duration, max(w["end"] for w in group)),
            "lines": [[dict(w) for w in line] for line in lines if line],
        })

    hook_text = None
    if hook:
        hook_text = _escape(hook.upper() if style["upper"] else hook)
        hook_text = "\\N".join(_wrap(hook_text.split(), 18))

    return {
        "style_name": style_name,
        "style": style,
        "font": font,
        "size": int(style["size"]),
        "outline": outline,
        "shadow": shadow,
        "letter_spacing": float(style.get("letter", 0)),
        "line_height": float(style.get("line", 1.06)),
        "pill": bool(style.get("pill")),
        "pill_color": style.get("pill_color", "#000000"),
        "pill_alpha": float(style.get("pill_alpha", 0.55)),
        "pill_pad": max(8, round(int(style["size"]) * 0.16)),
        "words": int(style["words"]),
        "chars": int(style["chars"]),
        "uppercase": bool(style["upper"]),
        "primary": primary_color,
        "primary_hex": primary_hex,
        "active": style.get("active"),
        "active_hex": active_hex,
        "active_fill_hex": active_fill_hex,
        "active_stroke_hex": active_stroke_hex,
        "active_stroke": active_stroke,
        "pop": bool(style.get("pop")) and bool(style.get("active")),
        "margin_v": margin_v,
        "margin_v_clean": margin_v_clean,
        "margin_hook": margin_hook,
        "duration": round(clip_duration, 3),
        "hook": hook_text,
        "hook_end": round(min(clip_duration, getattr(settings, "hook_sec", 3.2)), 3),
        "groups": groups,
        "muted": muted,
    }


def _tagged_lines(lines: list[list[dict]], active_flat: int, plan: dict) -> str:
    """Group text with line breaks, the active word carrying its own fill/stroke."""
    active_tag = (
        f"{{\\1c{hex_to_ass_color(plan['active_fill_hex'])}"
        f"\\3c{hex_to_ass_color(plan['active_stroke_hex'])}"
        f"\\bord{plan['active_stroke']}\\b1}}"
    )
    restore_tag = (
        f"{{\\1c{plan['primary']}\\3c&H000000&\\bord{plan['outline']}\\b1}}"
    )
    upper = plan["uppercase"]
    out: list[str] = []
    flat = 0
    for line in lines:
        tokens: list[str] = []
        for word in line:
            token = word["word"].upper() if upper else word["word"]
            if flat == active_flat:
                tokens.append(f"{active_tag}{token}{restore_tag}")
            else:
                tokens.append(token)
            flat += 1
        out.append(" ".join(tokens))
    return "\\N".join(out)


def _plain_lines(lines: list[list[dict]], upper: bool) -> str:
    return "\\N".join(
        " ".join(w["word"].upper() if upper else w["word"] for w in line)
        for line in lines
    )


def _rounded_rect_path(width: int, height: int, radius: int = 22) -> str:
    r = max(0, min(radius, width // 2, height // 2))
    k = round(r * 0.5523)
    return (
        f"m {r} 0 l {width - r} 0 "
        f"b {width - r + k} 0 {width} {r - k} {width} {r} "
        f"l {width} {height - r} "
        f"b {width} {height - r + k} {width - r + k} {height} {width - r} {height} "
        f"l {r} {height} "
        f"b {r - k} {height} 0 {height - r + k} 0 {height - r} "
        f"l 0 {r} "
        f"b 0 {r - k} {r - k} 0 {r} 0"
    )


def _pill_event(group: dict, plan: dict) -> str:
    """A rounded, semi-transparent plate drawn behind a caption group."""
    lines = group["lines"]
    longest = max((len(" ".join(w["word"] for w in line)) for line in lines), default=0)
    width = max(180, min(1000, round(longest * plan["size"] * 0.5 + plan["pill_pad"] * 2)))
    height = max(
        48,
        round(len(lines) * plan["size"] * plan["line_height"] + plan["pill_pad"] * 2),
    )
    # Bottom-anchored at the caption baseline + padding, extending upward.
    y = max(0, 1920 - int(plan["margin_v"]) + plan["pill_pad"])
    alpha = round((1.0 - max(0.0, min(1.0, plan["pill_alpha"]))) * 255)
    fill = hex_to_ass_color(plan["pill_color"], 0)
    path = _rounded_rect_path(width, height, radius=max(10, plan["pill_pad"] + 6))
    return (
        f"Dialogue: 0,{ass_time(group['start'])},{ass_time(group['end'])},Pill,,0,0,0,,"
        f"{{\\an2\\pos(540,{y})\\p1\\bord0\\shad0\\1c{fill}\\alpha&H{alpha:02X}&}}"
        f"{path}{{\\p0}}"
    )


def build(
    words: list[dict],
    clip_start: float,
    clip_end: float,
    settings: Settings,
    out_path: Path,
    hook: str | None = None,
    censor: bool = False,
    layout: str = "auto",
    custom_options: dict | None = None,
) -> tuple[Path, list[tuple[float, float]]]:
    plan = plan_captions(
        words, clip_start, clip_end, settings,
        custom_options=custom_options, layout=layout, censor=censor, hook=hook,
    )
    style_name = plan["style_name"]
    primary_color = plan["primary"]
    active = plan["active"]

    header = HEADER.format(
        font=plan["font"],
        size=plan["size"],
        outline=plan["outline"],
        shadow=plan["shadow"],
        letter=plan["letter_spacing"],
        primary=primary_color,
        margin_v=plan["margin_v"],
        margin_v_clean=plan["margin_v_clean"],
        margin_hook=plan["margin_hook"],
    )

    events: list[str] = []
    if plan["hook"]:
        events.append(
            f"Dialogue: 0,{ass_time(0)},{ass_time(plan['hook_end'])},Hook,,0,0,0,,"
            f"{{\\fad(180,250)}}{plan['hook']}"
        )

    for group in plan["groups"]:
        lines = group["lines"]
        flat_words = [word for line in lines for word in line]
        plain = _plain_lines(lines, plan["uppercase"])

        # Pill/background is one rounded plate per caption group, under the text.
        if plan["pill"]:
            events.append(_pill_event(group, plan))

        if style_name == "clean" or not active:
            events.append(
                f"Dialogue: 0,{ass_time(group['start'])},{ass_time(group['end'])},Clean,,0,0,0,,{plain}"
            )
            continue

        for i, word in enumerate(flat_words):
            start = word["start"]
            end = flat_words[i + 1]["start"] if i + 1 < len(flat_words) else group["end"]
            if end - start < 0.05:
                end = start + 0.08
            text = _tagged_lines(lines, i, plan)
            anim = ""
            if plan["pop"] and i == 0:
                anim = "{\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}"
            events.append(
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{anim}{text}"
            )

    out_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_path, plan["muted"]


def caption_plan(words: list[dict], clip_start: float, clip_end: float, settings: Settings,
                 custom_options: dict | None = None, layout: str = "auto",
                 censor: bool = False, hook: str | None = None) -> dict:
    """Plan plus per-word upper-cased text, ready to serialise for the editor."""
    plan = plan_captions(
        words, clip_start, clip_end, settings,
        custom_options=custom_options, layout=layout, censor=censor, hook=hook,
    )
    upper = plan["uppercase"]
    for group in plan["groups"]:
        for line in group["lines"]:
            for word in line:
                word["text"] = word["word"].upper() if upper else word["word"]
                word.pop("muted", None)
                word.pop("upper", None)
    plan.pop("style", None)
    plan.pop("primary", None)
    plan.pop("active", None)
    plan.pop("muted", None)
    return plan
