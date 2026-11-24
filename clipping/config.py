"""Configuration for the local clipping tool."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

try:  # optional, but nice: .env next to the project
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:  # pragma: no cover
    pass

DATA_DIR = Path(os.getenv("CLIP_DATA_DIR", str(ROOT / "data"))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_ai_config() -> dict:
    p = DATA_DIR / "ai_config.json"
    if p.exists():
        try:
            import json
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_ai_config(cfg: dict) -> None:
    p = DATA_DIR / "ai_config.json"
    import json
    p.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass
class Settings:
    # Output
    num_clips: int = _int("CLIP_NUM", 5)
    min_sec: float = _float("CLIP_MIN_SEC", 20)
    max_sec: float = _float("CLIP_MAX_SEC", 60)
    target_sec: float = _float("CLIP_TARGET_SEC", 40)
    aspect: str = os.getenv("CLIP_ASPECT", "9:16")
    fps: int = _int("CLIP_FPS", 30)
    crf: int = _int("CLIP_CRF", 20)
    preset: str = os.getenv("CLIP_PRESET", "veryfast")
    caption_style: str = os.getenv("CLIP_CAPTION_STYLE", "wordpop")
    caption_position: str = os.getenv("CLIP_CAPTION_POSITION", "auto")
    subtitle_script: str = os.getenv("CLIP_SUBTITLE_SCRIPT", "auto")
    font: str = os.getenv("CLIP_FONT", "Arial Black")
    hook_sec: float = _float("CLIP_HOOK_SEC", 3.5)
    # Layout & reframing
    # auto | fit_blur | crop | blur | streamer_split | streamer_pip | gameplay_center | gameplay_blur
    layout: str = os.getenv("CLIP_LAYOUT", "auto")
    # Camera motion / stabilization: locked_tripod | smooth_cinematic | dynamic
    stabilization: str = os.getenv("CLIP_STABILIZATION", "locked_tripod")
    # Podcast multi-speaker dwell time in seconds before switching camera to another face
    podcast_dwell_sec: float = _float("CLIP_PODCAST_DWELL_SEC", 2.5)

    # Streamer / Gaming Customization (10 options)
    # 1. Split ratio: 35_65 (cam 35%/game 65%), 30_70, 40_60, 50_50
    streamer_split_ratio: str = os.getenv("CLIP_STREAMER_SPLIT", "35_65")
    # 2. Camera position detection: auto | top-left | top-right | bottom-left | bottom-right
    streamer_cam_pos: str = os.getenv("CLIP_STREAMER_CAM_POS", "auto")
    # 3. Camera zoom level: 1.0 (wide) | 1.15 (standard) | 1.35 (close) | 1.5 (tight)
    streamer_cam_zoom: float = _float("CLIP_STREAMER_CAM_ZOOM", 1.15)
    # 4. Gameplay focal alignment: center (GTA car/crosshair) | center_low | center_high | action_track
    streamer_game_focus: str = os.getenv("CLIP_STREAMER_GAME_FOCUS", "center")
    # 5. Divider style: glow | subtle | none
    streamer_divider: str = os.getenv("CLIP_STREAMER_DIVIDER", "glow")
    # 6. Streamer tag / handle overlay: e.g. "@streamer"
    streamer_tag: str = os.getenv("CLIP_STREAMER_TAG", "")
    # 7. Cam shape: rect | rounded | circle
    streamer_cam_shape: str = os.getenv("CLIP_STREAMER_CAM_SHAPE", "rect")
    # 8. Background fill: blur | dark | black
    streamer_bg: str = os.getenv("CLIP_STREAMER_BG", "blur")
    # 9. Divider color theme: purple_cyan | gold | cyan | red | white
    streamer_theme: str = os.getenv("CLIP_STREAMER_THEME", "purple_cyan")
    # 10. PiP scale & placement (when layout is streamer_pip): small | medium | large
    streamer_pip_size: str = os.getenv("CLIP_STREAMER_PIP_SIZE", "medium")

    # Caption look (customizer overrides, applied on first render too).
    # font/size/colours mirror the customizer payload; empty = preset default.
    caption_font: str = os.getenv("CLIP_CAPTION_FONT", "")
    caption_font_size: int = _int("CLIP_CAPTION_FONT_SIZE", 0)
    caption_primary_color: str = os.getenv("CLIP_CAPTION_PRIMARY_COLOR", "")
    caption_active_color: str = os.getenv("CLIP_CAPTION_ACTIVE_COLOR", "")
    caption_outline: int = _int("CLIP_CAPTION_OUTLINE", 0)
    caption_uppercase: str = os.getenv("CLIP_CAPTION_UPPERCASE", "")  # "", "1", "0"
    caption_margin_v: int = _int("CLIP_CAPTION_MARGIN_V", 0)

    # ASR
    # "small" keeps CPU renders practical but garbles proper nouns; "medium"
    # is noticeably more accurate and still fits in ~8 GB RAM on int8.
    whisper_model: str = os.getenv("WHISPER_MODEL", "medium")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")
    whisper_compute: str = os.getenv("WHISPER_COMPUTE", "int8")
    whisper_threads: int = _int("WHISPER_THREADS", max(1, (os.cpu_count() or 4) - 1))
    # Optional forced-alignment refinement (stable-ts) for sub-100ms word timestamps.
    # Set to "1" to enable when stable-ts is installed; falls back to Whisper native timestamps otherwise.
    force_align: bool = os.getenv("CLIP_FORCE_ALIGN", "0") == "1"
    # Drop words whose ASR probability is below this (0.0 = keep everything).
    whisper_min_prob: float = _float("WHISPER_MIN_PROB", "0.25")

    # Sponsor / ad skipping (YouTube via SponsorBlock public API).
    skip_sponsors: bool = os.getenv("CLIP_SKIP_SPONSORS", "1") == "1"
    sponsor_categories: str = os.getenv(
        "CLIP_SPONSOR_CATEGORIES",
        "sponsor,selfpromo,intro,outro,interaction,music_offtopic",
    )
    # When a clip would overlap a skipped segment by more than this fraction, drop it.
    sponsor_overlap_limit: float = _float("CLIP_SPONSOR_OVERLAP_LIMIT", "0.30")

    # Highlight ranking
    llm_provider: str = field(default_factory=lambda: (
        load_ai_config().get("provider") or os.getenv(
            "LLM_PROVIDER",
            "gemini" if (load_ai_config().get("gemini_api_key") or os.getenv("GEMINI_API_KEY")) else (
                "openai" if (load_ai_config().get("openai_api_key") or os.getenv("OPENAI_API_KEY")) else "heuristic"
            ),
        )
    ))
    gemini_api_key: str = field(default_factory=lambda: load_ai_config().get("gemini_api_key") or os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = field(default_factory=lambda: load_ai_config().get("gemini_model") or os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    openai_api_key: str = field(default_factory=lambda: load_ai_config().get("openai_api_key") or os.getenv("OPENAI_API_KEY", ""))
    openai_model: str = field(default_factory=lambda: load_ai_config().get("openai_model") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    llm_timeout: int = _int("LLM_TIMEOUT", 120)

    # Behaviour
    keep_temp: bool = os.getenv("CLIP_KEEP_TEMP", "0") == "1"
    cookies_from_browser: str = os.getenv("CLIP_COOKIES_FROM_BROWSER", "")
    cookie_file: str = os.getenv("CLIP_COOKIE_FILE", "")

    def ratio(self) -> float:
        try:
            a, b = self.aspect.split(":")
            return float(a) / float(b)
        except Exception:
            return 9 / 16

    def as_dict(self) -> dict:
        return {
            "num_clips": self.num_clips,
            "min_sec": self.min_sec,
            "max_sec": self.max_sec,
            "layout": self.layout,
            "stabilization": self.stabilization,
            "podcast_dwell_sec": self.podcast_dwell_sec,
            "streamer_split_ratio": self.streamer_split_ratio,
            "streamer_cam_pos": self.streamer_cam_pos,
            "streamer_cam_zoom": self.streamer_cam_zoom,
            "streamer_game_focus": self.streamer_game_focus,
            "streamer_divider": self.streamer_divider,
            "streamer_tag": self.streamer_tag,
            "streamer_cam_shape": self.streamer_cam_shape,
            "streamer_bg": self.streamer_bg,
            "streamer_theme": self.streamer_theme,
            "streamer_pip_size": self.streamer_pip_size,
            "caption_style": self.caption_style,
            "caption_position": self.caption_position,
            "subtitle_script": self.subtitle_script,
            "whisper_model": self.whisper_model,
            "force_align": self.force_align,
            "whisper_min_prob": self.whisper_min_prob,
            "skip_sponsors": self.skip_sponsors,
            "sponsor_categories": self.sponsor_categories,
            "sponsor_overlap_limit": self.sponsor_overlap_limit,
            "llm_provider": self.llm_provider,
            "cookies_from_browser": self.cookies_from_browser,
            "cookie_file": self.cookie_file,
        }


def settings_for(**overrides) -> Settings:
    """Build a Settings object with per-job overrides (ignores None values)."""
    base = Settings()
    for key, value in overrides.items():
        if value is None or not hasattr(base, key):
            continue
        current = getattr(base, key)
        try:
            if isinstance(current, bool):
                setattr(base, key, bool(value))
            elif isinstance(current, int):
                setattr(base, key, int(value))
            elif isinstance(current, float):
                setattr(base, key, float(value))
            else:
                setattr(base, key, str(value))
        except (TypeError, ValueError):
            continue
    return base
