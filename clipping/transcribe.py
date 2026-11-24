"""Speech-to-text with word-level timestamps (faster-whisper, CPU friendly).

Improvements over raw Whisper output:
  * word-level probability filtering (drop low-confidence garbage words)
  * timestamp sanitization (monotonic, min/max duration, gap repair)
  * script/garbage cleanup (drop repeated symbols, meaningless fragments)
  * optional stable-ts forced-alignment refinement for sub-100ms sync
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Callable

from .config import Settings
from .utils import ToolError, log, read_json, run, write_json

Progress = Callable[[float, str], None]

_MODEL_CACHE: dict[tuple[str, str, str], object] = {}

# A "word" that is mostly symbols / punctuation / garbage is meaningless as a caption.
_SYMBOL_ONLY = re.compile(r"^[\W_]+$")
# Repeated punctuation runs like "!!!", "???", "....", "^^^".
_REPEATED_SYMBOLS = re.compile(r"([\W_])\1{3,}")
# A token that is pure garbage after normalization (e.g. leftover Urdu codepoints).
_GARBAGE_TOKEN = re.compile(r"^[^\w\s]{2,}$")

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


def _clean_word_text(text: str) -> str:
    """Remove garbage / meaningless symbols from a single word.

    - Collapse runs of repeated punctuation (``!!!`` -> ``!``)
    - Drop tokens that are purely symbols
    - Strip surrounding quotes, brackets, and markdown symbols while preserving interior
      apostrophes and natural sentence-ending punctuation (.,!?) so highlights sentence
      boundaries and terminal snapping work properly.
    """
    if not text:
        return ""
    t = _REPEATED_SYMBOLS.sub(r"\1", text).strip()
    if not t:
        return ""
    # Pure-symbol token -> meaningless.
    if _SYMBOL_ONLY.match(t) or _GARBAGE_TOKEN.match(t):
        return ""
    # Strip quotes, brackets, and markdown wrappers.
    t = t.strip("\"'()[]{}<>~`*_#")
    # Strip leading punctuation runs like ",word" or "-word"
    t = t.lstrip(".,!?:;-")
    return t


def _sanitize_words(words: list[dict], min_prob: float) -> list[dict]:
    """Filter and clean word-level timestamps.

    Rules:
      * drop words below the ASR probability threshold
      * drop garbage / symbol-only tokens
      * enforce monotonic start times (repair tiny backwards steps)
      * clamp each word to [min 0.08s, max 3.0s] duration
      * remove exact-duplicate words
    """
    cleaned: list[dict] = []
    last_end = -1.0
    seen = set()
    for w in words:
        prob = float(w.get("probability", 1.0))
        if prob < min_prob:
            continue
        text = _clean_word_text(w.get("word", ""))
        if not text:
            continue
        start = float(w["start"])
        end = float(w["end"])
        if end <= start:
            end = start + 0.08
        # Monotonic repair: never go backwards in time.
        if start < last_end - 0.02:
            start = last_end
            if end <= start:
                end = start + 0.08
        # Clamp duration.
        if end - start > 3.0:
            end = start + 3.0
        if end - start < 0.08:
            end = start + 0.08
        key = (round(start, 3), text.lower())
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "word": text,
            "probability": round(prob, 3),
        })
        last_end = end
    return cleaned


def _sanitize_segments(segments: list[dict]) -> list[dict]:
    """Ensure segment boundaries are sane and segment text matches its words."""
    clean: list[dict] = []
    last_end = -1.0
    for seg in segments:
        words = seg.get("words") or []
        if not words:
            continue
        text = " ".join(w["word"] for w in words).strip()
        if not text:
            continue
        start = max(0.0, float(words[0]["start"]))
        end = max(start + 0.1, float(words[-1]["end"]))
        # Monotonic segment repair.
        if start < last_end - 0.05:
            start = last_end
            if end <= start:
                end = start + 0.1
        clean.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "text": text,
            "words": words,
        })
        last_end = end
    return clean


def _maybe_force_align(audio: Path, transcript: dict, settings: Settings) -> dict:
    """Optionally refine word timestamps with stable-ts forced alignment.

    stable-ts re-aligns the transcript against the audio signal, fixing Whisper's
    native timestamp drift (~1s) down to sub-100ms. Only runs when
    ``CLIP_FORCE_ALIGN=1`` and stable-ts is installed; otherwise the transcript is
    returned unchanged.
    """
    if not settings.force_align:
        return transcript
    try:
        import stable_whisper  # type: ignore
    except ImportError:
        log("[asr] CLIP_FORCE_ALIGN=1 but stable-ts is not installed; using Whisper native timestamps")
        return transcript

    try:
        model = stable_whisper.load_faster_whisper_model(
            settings.whisper_model,
            device=settings.whisper_device if settings.whisper_device != "auto" else "cpu",
            compute_type=settings.whisper_compute,
        )
        result = model.align(
            transcript,
            str(audio),
        )
        # stable_whisper returns a Result object; convert back to our dict shape.
        segments = []
        for seg in result.segments:
            words = []
            for w in seg.words or []:
                words.append({
                    "start": round(float(w.start), 3),
                    "end": round(float(w.end), 3),
                    "word": str(w.word),
                    "probability": round(float(w.probability), 3),
                })
            text = " ".join(w["word"] for w in words).strip() or seg.text
            segments.append({
                "start": round(float(seg.start), 3),
                "end": round(float(seg.end), 3),
                "text": text,
                "words": words,
            })
        data = dict(transcript)
        data["segments"] = _sanitize_segments(segments)
        data["aligned"] = True
        log(f"[asr] stable-ts alignment complete ({len(segments)} segments)")
        return data
    except Exception as exc:
        log(f"[asr] stable-ts alignment failed ({exc}); using Whisper native timestamps")
        return transcript


def _polish_transcript_llm(segments: list[dict], settings: Settings, title: str = "") -> list[dict]:
    """Contextual semantic and typo correction pass using LLM (OpusClip/Descript architecture).

    Corrects phonetically misheard proper nouns, transliteration errors, and homophones
    while keeping the segment timestamps synchronized.
    """
    from .llm import complete_json, provider_available
    if not provider_available(settings) or not segments:
        return segments

    chunk_size = 20
    polished_segments = [dict(s) for s in segments]

    system_prompt = (
        "You are a professional subtitling editor at OpusClip/Descript level.\n"
        "Your task is to fix speech-to-text typos, misheard words, and bad transliterations "
        "in a video transcript without changing the meaning or sentence timing.\n"
        f"Video title / context: {title or 'Short form video'}\n\n"
        "Rules:\n"
        "1. Fix obvious phonetic misinterpretations and proper nouns (names, brands, characters, movies).\n"
        "2. For Hinglish/Hindi written in Latin script: use natural, readable phonetic spelling.\n"
        "3. Do NOT add, remove, or summarize sentences. Keep the exact same number of items.\n"
        "4. Return JSON only: {\"items\": [\"corrected text 0\", \"corrected text 1\", ...]}"
    )

    for i in range(0, len(segments), chunk_size):
        chunk = segments[i : i + chunk_size]
        items_payload = "\n".join(f"{idx}: {s['text']}" for idx, s in enumerate(chunk))
        user_prompt = f"Correct these transcript segments:\n\n{items_payload}"
        try:
            data = complete_json(system_prompt, user_prompt, settings)
            corrected_list = (
                data.get("items") if isinstance(data, dict) else (data if isinstance(data, list) else None)
            )
            if isinstance(corrected_list, list) and len(corrected_list) == len(chunk):
                for sub_idx, corr_text in enumerate(corrected_list):
                    corr_str = str(corr_text).strip()
                    if not corr_str:
                        continue
                    global_idx = i + sub_idx
                    orig_words = polished_segments[global_idx].get("words") or []
                    new_words_list = corr_str.split()

                    polished_segments[global_idx]["text"] = corr_str

                    if len(orig_words) == len(new_words_list):
                        for w_obj, new_w in zip(orig_words, new_words_list):
                            w_obj["word"] = new_w
                    elif orig_words and new_words_list:
                        seg_start = orig_words[0]["start"]
                        seg_end = orig_words[-1]["end"]
                        total_dur = max(0.1, seg_end - seg_start)
                        w_dur = total_dur / len(new_words_list)
                        new_words_objs = []
                        for w_i, nw in enumerate(new_words_list):
                            ws = round(seg_start + w_i * w_dur, 3)
                            we = round(min(seg_end, ws + w_dur), 3)
                            new_words_objs.append({
                                "start": ws,
                                "end": we,
                                "word": nw,
                                "probability": 1.0,
                            })
                        polished_segments[global_idx]["words"] = new_words_objs
                log(f"[asr] LLM transcript polish applied to segments {i+1}-{min(len(segments), i+chunk_size)}")
        except Exception as exc:
            log(f"[asr] LLM transcript polish skipped for chunk {i}: {exc}")
            continue

    return polished_segments


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
    title: str = "",
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
    lang_param = None
    if mode in ("hinglish", "auto"):
        initial_prompt = (
            (f"Context: {title}. " if title else "")
            + "Yeh video Hindi aur English (Hinglish) mein hai. "
            "Please transcribe dialogue accurately in clean Latin script (Hinglish / English words). "
            "Proper nouns, names, characters, dialogues in English alphabet."
        )
    elif mode == "en_translate":
        initial_prompt = (f"Context: {title}. " if title else "") + "Transcribe and translate all spoken dialogue into natural, fluent English."
    elif mode == "hi":
        lang_param = "hi"
        initial_prompt = (f"संदर्भ: {title}। " if title else "") + "यह वीडियो हिंदी में है। कृपया शुद्ध देवनागरी लिपि में लिखें।"
    elif mode == "en":
        lang_param = "en"
        initial_prompt = (f"Context: {title}. " if title else "") + "English dialogue and speech with proper spelling and capitalization."

    hotwords = None
    if title:
        clean_title = re.sub(r"[^\w\s]", " ", title)
        title_words = [w for w in clean_title.split() if len(w) > 2]
        if title_words:
            hotwords = " ".join(title_words[:12])

    segments_iter, info = model.transcribe(
        str(audio),
        language=lang_param,
        task=task,
        initial_prompt=initial_prompt,
        hotwords=hotwords,
        beam_size=5,
        best_of=5,
        patience=1.0,
        repetition_penalty=1.15,
        no_speech_threshold=0.5,
        compression_ratio_threshold=2.4,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
        word_timestamps=True,
        condition_on_previous_text=False,
        temperature=0.0,
    )

    total = float(getattr(info, "duration", 0.0) or 0.0)
    segments: list[dict] = []
    min_prob = float(getattr(settings, "whisper_min_prob", 0.25) or 0.25)
    for seg in segments_iter:
        words = []
        for w in seg.words or []:
            text = (w.word or "").strip()
            if not text:
                continue
            text = normalize_script_word(text, mode=mode)
            words.append({
                "start": round(float(w.start), 3),
                "end": round(float(w.end), 3),
                "word": text,
                "probability": round(float(getattr(w, "probability", 1.0) or 1.0), 3),
            })
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

    # Clean + sanitize: drop low-confidence/garbage words, repair monotonic timestamps.
    for seg in segments:
        seg["words"] = _sanitize_words(seg["words"], min_prob)
    segments = _sanitize_segments(segments)

    # Semantic typo & phonetic polishing pass (OpusClip / Descript standard)
    segments = _polish_transcript_llm(segments, settings, title=title)

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
        "aligned": False,
    }
    # Optional forced-alignment refinement (fixes Whisper timestamp drift).
    data = _maybe_force_align(audio, data, settings)
    write_json(cache, data)
    words = sum(len(s["words"]) for s in data["segments"])
    log(f"[asr] {len(data['segments'])} segments, {words} words, language={data['language']}, aligned={data.get('aligned', False)}")
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
