"""Finding the good 30-60 second moments inside a long video.

Two rankers:
  * LLM   - chunked transcript windows, structured JSON, deduped globally.
  * heuristic - windowed sentence scoring (no API key needed, works offline).

Both return clips snapped to real sentence/word boundaries so nothing starts
mid-word.
"""

from __future__ import annotations

import math
import re
from typing import Iterable

from .config import Settings
from .llm import complete_json, log_provider, provider_available
from .sponsorblock import overlaps_skip
from .utils import clamp, log, slug
from .transcribe import transcript_text

WINDOW_SEC = 480.0
WINDOW_OVERLAP = 30.0

# Strong sentence-terminal punctuation. Clips ending here feel "complete".
TERMINAL = (".", "!", "?", "…", '"', "”", "’")
# A clip that starts with one of these is almost always mid-thought / filler.
WEAK_OPENERS = (
    "so", "and", "but", "yeah", "okay", "um", "uh", "like", "right", "well",
    "you know", "i mean", "basically", "actually", "anyway", "right",
)
# Pronouns / demonstratives that make no sense without prior context.
CONTEXT_DEPS = {"they", "it", "this", "that", "these", "those", "he", "she", "its", "his", "her", "them"}


SYSTEM_PROMPT = """You are a senior short-form video editor who cuts podcasts, interviews \
and tutorials into viral YouTube Shorts, TikToks and Instagram Reels.

You are given a timestamped transcript of PART of a longer video. Pick the moments that \
would work as standalone vertical clips.

A great clip:
- starts with a hook: a bold claim, a question, a number, a confession, or mid-action tension
- is self-contained: a viewer with zero context understands it
- has a payoff: an insight, punchline, twist, or concrete takeaway
- runs roughly MIN_SEC to MAX_SEC seconds (hard limits)
- ends on a complete thought, never mid-sentence
- avoids intros, sponsor reads, housekeeping, rambling setup, and "link in the description"

Score honestly. 90+ = would stop my scroll. 60-75 = solid. Below 55 = filler.

Return JSON only, exactly this shape:
{"clips": [{"start": "HH:MM:SS", "end": "HH:MM:SS", "title": "...", "hook": "...", "score": 0-100, "reason": "..."}]}

Rules:
- "start"/"end" must be copied from the timestamps in the transcript.
- "title" is 3-7 words, plain text, no hashtags, no quotes.
- "hook" is the on-screen text for the first 3 seconds: max 6 words, punchy, no hashtags.
- Never return overlapping clips.
- Return at most COUNT clips, best first. Return an empty list if nothing qualifies.
"""


# ---------------------------------------------------------------- utilities

def _parse_time(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    match = re.match(r"^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$", text)
    if match:
        hours = int(match.group(1) or 0)
        return hours * 3600 + int(match.group(2)) * 60 + float(match.group(3))
    try:
        return float(text)
    except ValueError as exc:
        raise ValueError(f"Cannot parse timestamp: {value!r}") from exc


def _fmt(seconds: float) -> str:
    seconds = max(0, int(seconds))
    return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def _ends_on_terminal(text: str) -> bool:
    return bool(text) and text.strip()[-1:] in TERMINAL


def _starts_weak(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    first = t.split(" ", 1)[0].lower().strip(",.\"'")
    if first in WEAK_OPENERS or first in CONTEXT_DEPS:
        return True
    return t[:1].islower()


def _words_in(segments: list[dict], start: float, end: float) -> list[dict]:
    out: list[dict] = []
    for seg in segments:
        if seg["end"] <= start or seg["start"] >= end:
            continue
        out.extend(seg.get("words") or [])
    return out


def _trim_to_words(start: float, end: float, segments: list[dict], min_sec: float) -> tuple[float, float]:
    """Clamp a raw range onto word boundaries so we never cut mid-word."""
    words = _words_in(segments, start - 3, end + 3)
    if not words:
        return start, end
    starts = [w["start"] for w in words if abs(w["start"] - start) < 4.0]
    ends = [w["end"] for w in words if abs(w["end"] - end) < 4.0]
    if starts:
        start = min(starts, key=lambda t: abs(t - start))
    if ends:
        end = min(ends, key=lambda t: abs(t - end))
    if end - start < min_sec:
        later = [w["end"] for w in words if w["end"] > end]
        if later:
            end = min(later, key=lambda t: abs(t - (start + min_sec)))
    return start, end


def _snap_to_segments(
    start: float, end: float, segments: list[dict], settings: Settings
) -> tuple[float, float] | None:
    """Grow/shrink a raw clip onto whole transcript segments (sentence-ish units).

    Prefers starting on a fresh thought and ending on a sentence terminal so the
    clip feels self-contained instead of mid-sentence.
    """
    if end <= start:
        return None
    first = None
    last = None
    for i, seg in enumerate(segments):
        if seg["end"] > start and first is None:
            first = i
        if seg["start"] < end:
            last = i
    if first is None or last is None or last < first:
        return None

    # Never start on a dangling connector / pronoun / weak opener.
    filler = ("so", "and", "but", "yeah", "okay", "um", "uh", "like", "right")
    while last > first:
        head = segments[first]["text"].strip().lower()
        if any(head.startswith(f + " ") or head == f for f in filler) and len(segments[first]["text"]) < 90:
            first += 1
        elif _starts_weak(segments[first]["text"]) and len(segments[first]["text"]) < 90:
            first += 1
        else:
            break

    start_t = segments[first]["start"]
    end_t = segments[last]["end"]

    # Try to end on a sentence terminal for a complete feeling.
    if last > first and not _ends_on_terminal(segments[last]["text"]):
        for k in range(last, first, -1):
            if _ends_on_terminal(segments[k]["text"]):
                end_t = segments[k]["end"]
                last = k
                break

    # Grow to the minimum length.
    while end_t - start_t < settings.min_sec and last + 1 < len(segments):
        last += 1
        end_t = segments[last]["end"]

    # Shrink to the maximum length, preferring to cut at a sentence terminal.
    while end_t - start_t > settings.max_sec and last > first:
        last -= 1
        end_t = segments[last]["end"]
    if end_t - start_t > settings.max_sec:
        # A single long segment: cut at a word boundary instead.
        words = segments[first].get("words") or []
        target = start_t + settings.max_sec
        ends = [w["end"] for w in words if w["end"] <= target]
        if ends:
            end_t = ends[-1]
        else:
            return None

    if end_t - start_t < settings.min_sec * 0.7:
        return None
    return round(start_t, 3), round(end_t, 3)


def _dedupe(clips: list[dict], limit: int) -> list[dict]:
    kept: list[dict] = []
    for clip in sorted(clips, key=lambda c: c["score"], reverse=True):
        clash = False
        for other in kept:
            overlap = min(clip["end"], other["end"]) - max(clip["start"], other["start"])
            shorter = min(clip["end"] - clip["start"], other["end"] - other["start"])
            if overlap > 0.2 * shorter:
                clash = True
                break
        if not clash:
            kept.append(clip)
        if len(kept) >= limit:
            break
    return sorted(kept, key=lambda c: c["start"])


# ---------------------------------------------------------------- LLM ranker

def _windows(segments: list[dict]) -> list[list[dict]]:
    if not segments:
        return []
    total_end = segments[-1]["end"]
    windows: list[list[dict]] = []
    start = 0.0
    while start < total_end:
        end = start + WINDOW_SEC
        chunk = [s for s in segments if s["end"] > start and s["start"] < end]
        if chunk:
            windows.append(chunk)
        if end >= total_end:
            break
        start = end - WINDOW_OVERLAP
    return windows


def _llm_clips(transcript: dict, settings: Settings, progress=None,
               skip_segments: list[dict] | None = None) -> list[dict]:
    segments = transcript["segments"]
    windows = _windows(segments)
    per_window = max(2, math.ceil(settings.num_clips / max(1, len(windows))) + 1)
    log_provider(settings)
    found: list[dict] = []

    for index, window in enumerate(windows, 1):
        if progress:
            progress((index - 1) / len(windows) * 100.0, f"Ranking highlights ({index}/{len(windows)})")
        text = "\n".join(
            f"[{_fmt(s['start'])}] {s['text']}" for s in window
        )
        user = (
            f"Transcript part {index} of {len(windows)}.\n"
            f"MIN_SEC={settings.min_sec:.0f} MAX_SEC={settings.max_sec:.0f} "
            f"COUNT={per_window}\n\n{text}"
        )
        try:
            data = complete_json(SYSTEM_PROMPT, user, settings)
        except Exception as exc:
            log(f"[llm] window {index} failed: {exc}")
            continue

        items = data.get("clips", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            continue
        for item in items:
            try:
                start = _parse_time(item["start"])
                end = _parse_time(item["end"])
            except (KeyError, ValueError, TypeError):
                continue
            snapped = _snap_to_segments(start, end, segments, settings)
            if not snapped:
                continue
            start, end = snapped

            # Never return a clip that sits inside a sponsor / promo segment.
            if skip_segments:
                tainted, _cat = overlaps_skip(start, end, skip_segments, limit=settings.sponsor_overlap_limit)
                if tainted:
                    continue

            title = str(item.get("title") or "").strip()
            hook = str(item.get("hook") or "").strip()
            try:
                score = float(item.get("score", 60))
            except (TypeError, ValueError):
                score = 60.0
            found.append({
                "start": start,
                "end": end,
                "duration": round(end - start, 2),
                "score": int(clamp(score, 1, 100)),
                "title": title or "Untitled clip",
                "hook": hook,
                "reason": str(item.get("reason") or "").strip(),
                "source": "llm",
            })

    return found


# ------------------------------------------------------------ heuristic ranker

CURIOSITY = {
    "secret", "mistake", "mistakes", "truth", "nobody", "everyone", "never", "always",
    "actually", "biggest", "worst", "best", "hardest", "wrong", "problem", "why", "how",
    "because", "but", "warning", "stop", "free", "money", "million", "dollar", "years",
    "learned", "changed", "failed", "failure", "regret", "advice", "framework", "step",
    "first", "one", "only", "most", "huge", "insane", "crazy", "simple", "proven",
}


def _score_window(text: str, duration: float, settings: Settings) -> float:
    words = re.findall(r"[a-zA-Z']+", text.lower())
    if len(words) < 12:
        return 0.0
    score = 50.0
    lower = text.lower()

    hits = sum(1 for w in set(words) if w in CURIOSITY)
    score += min(14.0, hits * 2.2)
    if re.search(r"\b(how|why|what|when|should|can|do you|did you)\b", lower):
        score += 6.0
    if "?" in text:
        score += 4.0
    if re.search(r"\d", text):
        score += 5.0
    if re.search(r"\b(\d+|one|two|three|ten|hundred|thousand|million)\s+(percent|x|times|years|steps|things|rules|reasons|ways)\b", lower):
        score += 5.0
    if re.search(r"\b(i|we)\s+(learned|realized|discovered|found|made|lost|built|spent)\b", lower):
        score += 5.0
    if "!" in text:
        score += 2.0

    # Completeness: a clip that ends on a full thought feels self-contained.
    if _ends_on_terminal(text):
        score += 4.0
    elif text.strip().endswith(","):
        score -= 3.0

    # Information density: numbers + proper-noun-like words suggest concrete content.
    info_density = len(re.findall(r"\d", text)) + len(re.findall(r"\b[A-Z][a-z]+\b", text))
    score += clamp((info_density - 3) * 1.0, -3.0, 6.0)

    # Energy: words per second of speech.
    wps = len(words) / max(1.0, duration)
    score += clamp((wps - 2.2) * 8.0, -6.0, 8.0)

    # The opening sentence is what decides whether anyone watches at all.
    first = _sentences(text)[0]
    score += clamp(_sentence_strength(first) * 1.4, -8.0, 14.0)
    if len(re.findall(r"[a-zA-Z']+", first)) < 4:
        score -= 5.0

    # Length sweet spot.
    delta = abs(duration - settings.target_sec)
    score -= min(12.0, delta * 0.35)

    # Weak openings / mid-thought starts.
    head = " ".join(words[:4])
    if re.match(r"^(so|and|but|yeah|okay|um|uh|like|right|well)\b", head):
        score -= 6.0
    if _starts_weak(text):
        score -= 8.0

    # Promo / housekeeping language.
    if re.search(r"\b(subscribe|sponsor|patreon|link in the description|like and|hit the bell|check out my)\b", lower):
        score -= 20.0

    return clamp(score, 1.0, 99.0)


def _boundary_scores(segments: list[dict]) -> tuple[list[float], list[float]]:
    """Bonus/penalty for starting or ending a clip on a given segment.

    Real clips start after a pause at a fresh thought, not mid-sentence.
    """
    start_bonus: list[float] = []
    end_bonus: list[float] = []
    terminal = (".", "!", "?", "…", '"', "”")
    for i, seg in enumerate(segments):
        text = seg["text"].strip()
        sb = 0.0
        eb = 0.0
        if i == 0:
            sb += 4.0
        else:
            prev = segments[i - 1]
            prev_text = prev["text"].strip()
            if prev_text.endswith(terminal):
                sb += 7.0
            if seg["start"] - prev["end"] > 0.4:
                sb += 3.0
            first = text.split(" ", 1)[0].lower().strip(",.")
            # "They ...", "It ...", "This ..." only make sense with the previous line.
            if first in {"they", "it", "this", "that", "these", "those", "he", "she", "its", "his", "her"}:
                sb -= 10.0
            elif first in {"so", "and", "but", "now", "okay", "well"}:
                sb -= 6.0
            elif text[:1].islower():
                sb -= 9.0
        if text.endswith(terminal):
            eb += 7.0
        elif text.endswith(","):
            eb -= 3.0
        if "?" in text:
            eb += 2.0
        start_bonus.append(sb)
        end_bonus.append(eb)
    return start_bonus, end_bonus


def _heuristic_clips(transcript: dict, settings: Settings, progress=None,
                     skip_segments: list[dict] | None = None) -> list[dict]:
    segments = transcript["segments"]
    log("[rank] scoring windows heuristically")
    start_bonus, end_bonus = _boundary_scores(segments)
    candidates: list[dict] = []

    for i in range(len(segments)):
        for j in range(i, len(segments)):
            duration = segments[j]["end"] - segments[i]["start"]
            if duration < settings.min_sec * 0.8:
                continue
            if duration > settings.max_sec:
                break
            start, end = segments[i]["start"], segments[j]["end"]

            # Skip clips that sit inside a sponsor / promo segment.
            if skip_segments:
                tainted, _cat = overlaps_skip(start, end, skip_segments, limit=settings.sponsor_overlap_limit)
                if tainted:
                    continue

            text = " ".join(s["text"] for s in segments[i : j + 1]).strip()
            score = _score_window(text, duration, settings) + start_bonus[i] + end_bonus[j]
            candidates.append({
                "start": start,
                "end": end,
                "duration": round(duration, 2),
                "score": int(clamp(score, 1, 99)),
                "title": _title_from(text),
                "hook": _hook_from(text),
                "reason": "Heuristic: hook words, numbers, energy and length fit.",
                "source": "heuristic",
            })

    if not candidates:
        # Very short source: use everything.
        start, end = segments[0]["start"], segments[-1]["end"]
        text = " ".join(s["text"] for s in segments)
        return [{
            "start": start,
            "end": end,
            "duration": round(end - start, 2),
            "score": 60,
            "title": _title_from(text),
            "hook": _hook_from(text),
            "reason": "Whole video (too short to split).",
            "source": "heuristic",
        }]

    return candidates


def _sentences(text: str) -> list[str]:
    parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    return parts or [text.strip()]


def _sentence_strength(sentence: str) -> float:
    words = re.findall(r"[a-zA-Z']+", sentence.lower())
    if len(words) < 3:
        return -5.0
    score = sum(2.0 for w in set(words) if w in CURIOSITY)
    if "?" in sentence:
        score += 4.0
    if re.search(r"\d", sentence):
        score += 3.0
    if re.match(r"^(so|and|but|yeah|okay|um|uh|like|right|well)\b", sentence.lower()):
        score -= 4.0
    return score


def _title_from(text: str) -> str:
    best = max(_sentences(text), key=_sentence_strength)
    # Prefer the first clause of a long sentence.
    clause = best.split(",")[0].strip()
    if len(clause.split()) >= 3 and len(clause.split()) <= 9:
        best = clause
    words = best.split()
    title = " ".join(words[:8]).strip(" .,!?:;\"'")
    if len(title.split()) < 3:
        title = " ".join(text.split()[:7]).strip(" .,!?:;\"'")
    return title or "Highlight"


def _hook_from(text: str) -> str:
    best = max(_sentences(text), key=_sentence_strength)
    words = [w for w in best.split() if w][:6]
    return " ".join(words).strip(" .,!?:;\"'").upper()


# ------------------------------------------------------------------ public

def select_clips(transcript: dict, settings: Settings, progress=None,
                 skip_segments: list[dict] | None = None) -> list[dict]:
    duration = float(transcript.get("duration") or 0.0)
    segments = transcript.get("segments") or []
    if not segments:
        return []

    # Short sources: the whole thing is the clip.
    if duration <= max(settings.max_sec, 90):
        start, end = segments[0]["start"], segments[-1]["end"]
        # Even a short source should not be a sponsor read.
        if skip_segments:
            tainted, _cat = overlaps_skip(start, end, skip_segments, limit=settings.sponsor_overlap_limit)
            if tainted:
                return []
        text = " ".join(s["text"] for s in segments)
        clips = [{
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 2),
            "score": 80,
            "title": _title_from(text),
            "hook": _hook_from(text),
            "reason": "Short source: used the full video.",
            "source": "passthrough",
        }]
    else:
        clips = []
        if provider_available(settings):
            try:
                clips = _llm_clips(transcript, settings, progress, skip_segments=skip_segments)
            except Exception as exc:
                log(f"[llm] ranking failed, falling back to heuristic: {exc}")
                clips = []

        if len(clips) < max(1, settings.num_clips // 2):
            if progress:
                progress(50.0, "Ranking highlights (heuristic)")
            clips += _heuristic_clips(transcript, settings, progress, skip_segments=skip_segments)

        clips = _dedupe(clips, settings.num_clips)

    # Final defense-in-depth: drop any clip still overlapping a skip segment.
    if skip_segments:
        before = len(clips)
        clips = [c for c in clips if not overlaps_skip(c["start"], c["end"], skip_segments, limit=settings.sponsor_overlap_limit)[0]]
        if before != len(clips):
            log(f"[rank] dropped {before - len(clips)} clip(s) overlapping sponsor segments")

    for i, clip in enumerate(clips, 1):
        clip["id"] = f"clip{i:02d}"
        clip["slug"] = f"{i:02d}-{slug(clip['title'], 40)}"
    if progress:
        progress(100.0, f"Selected {len(clips)} clips")
    log(f"[rank] {len(clips)} clips: " + ", ".join(f"{c['start']:.0f}-{c['end']:.0f}s ({c['score']})" for c in clips))
    return clips
