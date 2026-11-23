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
    font: str = os.getenv("CLIP_FONT", "Arial Black")
    hook_sec: float = _float("CLIP_HOOK_SEC", 3.5)
    # crop = fill the frame with a tracked 9:16 window; blur = whole frame + blurred backdrop;
    # auto = crop when faces are found, blur otherwise (screen shares, gameplay, slides).
    layout: str = os.getenv("CLIP_LAYOUT", "auto")

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
            "caption_style": self.caption_style,
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
