"""Speech-to-text with word-level timestamps (faster-whisper, CPU friendly)."""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from .config import Settings
from .utils import ToolError, log, read_json, run, write_json

Progress = Callable[[float, str], None]

_MODEL_CACHE: dict[tuple[str, str, str], object] = {}

# Transliteration mappings for script consistency
DEV_VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
}
DEV_MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h',
}
DEV_CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh',
    'स': 's', 'ह': 'h', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z',
    'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
}

URDU_WORDS = {
    'کیا': 'kya', 'آپ': 'aap', 'ہیں': 'hain', 'ہے': 'hai', 'کہ': 'ki',
    'اس': 'us', 'ایک': 'ek', 'دن': 'din', 'میں': 'mein', 'مارکیٹ': 'market',
    'اسٹاک': 'stock', 'سٹاک': 'stock', 'نے': 'ne', 'اور': 'aur', 'نہیں': 'nahin',
    'کیونکہ': 'kyunki', 'کیوں': 'kyun', 'کا': 'ka', 'کی': 'ki', 'کے': 'ke',
    'کو': 'ko', 'سے': 'se', 'تھا': 'tha', 'تھی': 'thi', 'تھے': 'the',
    'کر': 'kar', 'رہا': 'raha', 'رہی': 'rahi', 'رہے': 'rahe', 'بات': 'baat',
    'پیسہ': 'paisa', 'پیسے': 'paise', 'لوگ': 'log', 'ببل': 'bubble',
    'فٹے': 'fate', 'فٹےگا': 'fatega', 'یا': 'ya', 'تو': 'to', 'بھی': 'bhi',
    'سب': 'sab', 'کچھ': 'kuch', 'وہ': 'woh', 'یہ': 'yeh', 'ان': 'un',
    'اب': 'ab', 'جب': 'jab', 'تب': 'tab', 'پھر': 'phir', 'اگر': 'agar',
    'مگر': 'magar', 'لیکن': 'lekin', 'ساتھ': 'saath', 'اپنا': 'apna',
    'اپنے': 'apne', 'अपनी': 'apni', 'بہت': 'bahut', 'زیادہ': 'zyada',
    'کم': 'kam', 'اچھا': 'achha', 'اچھے': 'achhe', 'اچھی': 'achhi',
    'بڑا': 'bada', 'بڑے': 'bade', 'بڑی': 'badi', 'چھوٹا': 'chhota',
    'کام': 'kaam', 'نام': 'naam', 'ٹائم': 'time', 'ویڈیو': 'video',
}

URDU_CHARS = {
    'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
    'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
    'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
    'ہ': 'h', 'ھ': 'h', 'ی': 'i', 'ے': 'e', 'ء': '', 'ئ': 'i', 'ؤ': 'o',
}


def normalize_script_word(word: str, mode: str = "auto") -> str:
    """Normalize a single word to guarantee consistent script without random Urdu/Devanagari mixing."""
    if not word:
        return ""
    clean_w = word.strip(".,!?:;'\"()[]{}")
    prefix = word[:len(word) - len(word.lstrip(".,!?:;'\"()[]{}"))]
    suffix = word[len(word.rstrip(".,!?:;'\"()[]{}")):]

    has_urdu = any(0x0600 <= ord(c) <= 0x06FF or 0xFB50 <= ord(c) <= 0xFEFC for c in clean_w)
    has_dev = any(0x0900 <= ord(c) <= 0x097F for c in clean_w)

    to_hinglish = mode in ("hinglish", "auto")

    if not has_urdu and (not has_dev or not to_hinglish):
        return word

    # 1. Check Urdu exact dictionary
    if clean_w in URDU_WORDS:
        return f"{prefix}{URDU_WORDS[clean_w]}{suffix}"

    # 2. Character-level phonetic conversion to Roman/Hinglish
    res = []
    i = 0
    n = len(clean_w)
    while i < n:
        c = clean_w[i]
        code = ord(c)
        if 0x0600 <= code <= 0x06FF or 0xFB50 <= code <= 0xFEFC:
            res.append(URDU_CHARS.get(c, ''))
        elif 0x0900 <= code <= 0x097F and to_hinglish:
            if c in DEV_VOWELS:
                res.append(DEV_VOWELS[c])
            elif c in DEV_MATRAS:
                res.append(DEV_MATRAS[c])
            elif c in DEV_CONSONANTS:
                res.append(DEV_CONSONANTS[c])
                next_c = clean_w[i+1] if i + 1 < n else ''
                next_code = ord(next_c) if next_c else 0
                if next_c and not (0x093E <= next_code <= 0x094D) and next_c != ' ':
                    res.append('a')
            elif c == '्':
                pass
            else:
                pass
        else:
            res.append(c)
        i += 1
    return f"{prefix}{''.join(res)}{suffix}"


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

    mode = getattr(settings, "subtitle_script", "auto")
    task = "translate" if mode == "en_translate" else "transcribe"
    initial_prompt = None
    if mode in ("hinglish", "auto"):
        initial_prompt = (
            "Yeh video Hindi aur English (Hinglish) mein hai. "
            "Please transcribe in consistent Latin script (Hinglish and English only), without Urdu or Arabic script."
        )
    elif mode == "en_translate":
        initial_prompt = "Transcribe and translate all spoken dialogue into natural, fluent English."
    elif mode == "hi":
        initial_prompt = "यह वीडियो हिंदी में है। कृपया शुद्ध देवनागरी लिपि में लिखें।"

    segments_iter, info = model.transcribe(
        str(audio),
        language=None,
        task=task,
        initial_prompt=initial_prompt,
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
            text = normalize_script_word(text, mode=mode)
            words.append({"start": round(float(w.start), 3), "end": round(float(w.end), 3), "word": text})
        seg_text = " ".join(w["word"] for w in words) if words else normalize_script_word((seg.text or "").strip(), mode=mode)
        if not seg_text:
            continue
        segments.append({
            "start": round(float(seg.start), 3),
            "end": round(float(seg.end), 3),
            "text": seg_text,
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
