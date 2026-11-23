"""Speech-to-text with word-level timestamps (faster-whisper, CPU friendly)."""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from .config import Settings
from .utils import ToolError, log, read_json, run, write_json

Progress = Callable[[float, str], None]

_MODEL_CACHE: dict[tuple[str, str, str], object] = {}


def _device(settings: Settings) -> str:
    if settings.whisper_device != "auto":
        return settings.whisper_device
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _load_model(settings: Settings):
    model_name = settings.whisper_model or "base"
    key = (model_name, _device(settings), settings.whisper_compute)
    if key not in _MODEL_CACHE:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover
            raise ToolError("faster-whisper is not installed. Run: pip install faster-whisper") from exc

        device, compute = key[1], key[2]
        log(f"[asr] loading {model_name} on {device}/{compute}")
        try:
            _MODEL_CACHE[key] = WhisperModel(
                model_name,
                device=device,
                compute_type=compute,
                cpu_threads=settings.whisper_threads,
            )
        except Exception as exc:
            if model_name != "base":
                log(f"[asr] failed to load '{model_name}' ({exc}); gracefully falling back to 'base' model")
                fallback_key = ("base", device, compute)
                if fallback_key not in _MODEL_CACHE:
                    _MODEL_CACHE[fallback_key] = WhisperModel(
                        "base",
                        device=device,
                        compute_type=compute,
                        cpu_threads=settings.whisper_threads,
                    )
                return _MODEL_CACHE[fallback_key]
            raise
    return _MODEL_CACHE[key]


def extract_audio(video: Path, dest: Path) -> Path:
    run([
        "ffmpeg", "-y", "-i", str(video),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(dest),
    ])
    return dest


def transcribe(
    video: Path,
    work_dir: Path,
    settings: Settings,
    progress: Progress | None = None,
    force: bool = False,
) -> dict:
    """Return {'language', 'duration', 'segments': [...]} with word timings.

    The transcript is cached in work_dir/transcript.json so re-renders are instant.
    """
    cache = work_dir / "transcript.json"
    if cache.exists() and not force:
        data = read_json(cache)
        log(f"[asr] using cached transcript ({len(data.get('segments', []))} segments)")
        return data

    audio = work_dir / "audio.wav"
    if not audio.exists():
        if progress:
            progress(0.0, "Extracting audio")
        extract_audio(video, audio)

    model = _load_model(settings)
    if progress:
        progress(2.0, f"Transcribing with {settings.whisper_model}")

    segments_iter, info = model.transcribe(
        str(audio),
        language=None,
        task="transcribe",
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
        word_timestamps=True,
        condition_on_previous_text=False,
        temperature=0.0,
    )

    total = float(getattr(info, "duration", 0.0) or 0.0)
    segments: list[dict] = []
    for seg in segments_iter:
        words = []
        for w in seg.words or []:
            text = (w.word or "").strip()
            if not text:
                continue
            words.append({"start": round(float(w.start), 3), "end": round(float(w.end), 3), "word": text})
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append({
            "start": round(float(seg.start), 3),
            "end": round(float(seg.end), 3),
            "text": text,
            "words": words,
        })
        if progress and total:
            progress(min(99.0, float(seg.end) / total * 100.0), f"Transcribing {float(seg.end) / total * 100:.0f}%")

    if not segments:
        raise ToolError(
            "No speech was detected in this video. Check that the file has an audio track "
            "with dialogue, or try a different source."
        )

    data = {
        "language": getattr(info, "language", "") or "",
        "language_probability": round(float(getattr(info, "language_probability", 0.0) or 0.0), 3),
        "duration": total or segments[-1]["end"],
        "model": settings.whisper_model,
        "segments": segments,
    }
    write_json(cache, data)
    words = sum(len(s["words"]) for s in segments)
    log(f"[asr] {len(segments)} segments, {words} words, language={data['language']}")
    if progress:
        progress(100.0, "Transcription done")
    return data


def transcript_text(transcript: dict, max_chars: int | None = None) -> str:
    """Plain text with [hh:mm:ss] markers, used for LLM prompts and previews."""
    lines: list[str] = []
    for seg in transcript.get("segments", []):
        t = int(seg["start"])
        lines.append(f"[{t // 3600:02d}:{(t % 3600) // 60:02d}:{t % 60:02d}] {seg['text']}")
    text = "\n".join(lines)
    if max_chars and len(text) > max_chars:
        text = text[:max_chars]
    return text
