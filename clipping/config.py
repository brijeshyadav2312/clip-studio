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

    # ASR
    whisper_model: str = os.getenv("WHISPER_MODEL", "base")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")
    whisper_compute: str = os.getenv("WHISPER_COMPUTE", "int8")
    whisper_threads: int = _int("WHISPER_THREADS", max(1, (os.cpu_count() or 4) - 1))

    # Highlight ranking
    llm_provider: str = os.getenv(
        "LLM_PROVIDER",
        "gemini" if os.getenv("GEMINI_API_KEY") else ("openai" if os.getenv("OPENAI_API_KEY") else "heuristic"),
    )
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    llm_timeout: int = _int("LLM_TIMEOUT", 120)

    # Behaviour
    keep_temp: bool = os.getenv("CLIP_KEEP_TEMP", "0") == "1"
    cookies_from_browser: str = os.getenv("CLIP_COOKIES_FROM_BROWSER", "")

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
            "whisper_model": self.whisper_model,
            "llm_provider": self.llm_provider,
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
