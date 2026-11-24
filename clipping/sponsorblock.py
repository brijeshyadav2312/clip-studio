"""SponsorBlock integration: skip sponsorship / promo / intro / outro segments.

Queries the public SponsorBlock API (https://sponsor.ajay.app) for crowdsourced
skip segments of a YouTube video. Returns time ranges that the clipping pipeline
treats as "do not use" so highlights never start inside, or cut through, an ad
read, sponsor mention, intro, or outro.

Only applies to YouTube URLs (we need the video ID). Local uploads have no
crowdsourced database, so they are left untouched.

Categories supported by the API:
  sponsor            - paid sponsorship / ad read
  selfpromo          - creator promoting their own merch/channel
  intro              - channel intro / logo animation
  outro              - end screen / subscribe reminder
  interaction        - "like and subscribe" calls to action
  music_offtopic     - unrelated music playing
  preview            - "coming up next" recaps
  poi_filler         - filler / dead air

Usage:
    from .sponsorblock import fetch_skip_segments, video_id_from_url
    vid = video_id_from_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    segs = fetch_skip_segments(vid, categories="sponsor,selfpromo,intro,outro")
    # segs -> [{"start": 12.0, "end": 45.0, "category": "sponsor"}, ...]
"""

from __future__ import annotations

import json
import re
import urllib.parse
from typing import Any

import requests

from .utils import log

API_BASE = "https://sponsor.ajay.app/api"

# Categories we treat as skippable promos by default.
DEFAULT_CATEGORIES = "sponsor,selfpromo,intro,outro,interaction,music_offtopic"

CHAPTER_PROMO_PATTERN = re.compile(
    r"\b(sponsor|sponsored|sponsorship|ad\b|advertisement|promo|promot|commercial|partner|patreon|merch|discount|coupon|affiliate|membership|course|programme|program\b|intro\b|outro\b|credits|subscribe)\b",
    re.IGNORECASE,
)

TRANSCRIPT_PROMO_PATTERNS = [
    re.compile(r"(sponsored by|sponsor of today|sponsor of this video|a word from our sponsor|thanks to .{1,30} for sponsoring)", re.IGNORECASE),
    re.compile(r"(check out the link|link in the description|link in the pinned comment|link is in the description|link below|link in bio)", re.IGNORECASE),
    re.compile(r"(use code|use my code|discount code|promo code)", re.IGNORECASE),
    re.compile(r"(patreon\.com|merch store|buy my merch|check out my merch)", re.IGNORECASE),
    re.compile(r"(subscribe to the channel|hit the bell icon|hit the subscribe button|smash that subscribe button|don't forget to like and subscribe)", re.IGNORECASE),
    re.compile(r"(kmin saktion|comment section|description mein|link par click|link de rakha|link pr krie|apply now|enroll in|channel ko subscribe|bell icon)", re.IGNORECASE),
]


def video_id_from_url(url: str) -> str | None:
    """Extract a YouTube video ID from a watch / shorts / youtu.be / embed URL."""
    if not url:
        return None
    try:
        parsed = urllib.parse.urlparse(url.strip())
        host = (parsed.netloc or "").lower()
        if "youtu.be" in host:
            path_part = parsed.path.strip("/")
            return path_part.split("/")[0] if path_part else None
        if "youtube.com" in host or "youtube-nocookie.com" in host:
            qs = urllib.parse.parse_qs(parsed.query)
            if qs.get("v"):
                return qs["v"][0]
            # Playlist mixes: list=RD<video_id>
            lst = qs.get("list", [""])[0]
            if lst.startswith("RD") and len(lst) > 2:
                return lst[2:]
            # Shorts / embed / /v/
            for prefix in ("/shorts/", "/embed/", "/v/"):
                if parsed.path.startswith(prefix):
                    parts = parsed.path.strip("/").split("/")
                    if len(parts) >= 2:
                        return parts[1]
    except Exception:
        pass
    return None


def _video_id_from_meta(meta: dict | None) -> str | None:
    """Best-effort video ID from yt-dlp metadata (id field or webpage_url)."""
    if not meta:
        return None
    vid = meta.get("id") or meta.get("video_id")
    if vid:
        return vid
    return video_id_from_url(meta.get("webpage_url") or "")


def fetch_skip_segments(
    video_id: str,
    categories: str | list[str] = DEFAULT_CATEGORIES,
    timeout: int = 15,
) -> list[dict[str, Any]]:
    """Fetch skip segments from the SponsorBlock API.

    Returns a list of dicts: {"start": float, "end": float, "category": str}.
    Returns an empty list on any error (network, missing video, bad JSON) so the
    pipeline never fails because SponsorBlock is unreachable.
    """
    if not video_id:
        return []

    # SponsorBlock API requires categories formatted as a JSON array string
    if isinstance(categories, str):
        try:
            loaded = json.loads(categories)
            if isinstance(loaded, list):
                cats = loaded
            else:
                cats = [c.strip() for c in categories.split(",") if c.strip()]
        except Exception:
            cats = [c.strip() for c in categories.split(",") if c.strip()]
    elif isinstance(categories, (list, tuple, set)):
        cats = list(categories)
    else:
        cats = ["sponsor", "selfpromo", "intro", "outro", "interaction", "music_offtopic"]

    url = f"{API_BASE}/skipSegments"
    params = {"videoID": video_id, "categories": json.dumps(cats)}
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        if resp.status_code != 200:
            if resp.status_code != 404:
                log(f"[sponsorblock] API returned {resp.status_code} for {video_id}")
            return []
        data = resp.json()
    except Exception as exc:
        log(f"[sponsorblock] request failed for {video_id}: {exc}")
        return []

    segments: list[dict[str, Any]] = []
    if not isinstance(data, list):
        return segments
    for item in data:
        try:
            seg = item.get("segment") or []
            if len(seg) != 2:
                continue
            start, end = float(seg[0]), float(seg[1])
            if end <= start:
                continue
            segments.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "category": str(item.get("category") or "unknown"),
                "video_id": video_id,
            })
        except (TypeError, ValueError):
            continue
    log(f"[sponsorblock] {video_id}: {len(segments)} skip segment(s)")
    return segments


def chapters_to_skip_segments(chapters: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Convert promotional / sponsor / intro chapters from video metadata into skip segments."""
    if not chapters:
        return []
    skip: list[dict[str, Any]] = []
    for c in chapters:
        title = str(c.get("title") or "")
        if CHAPTER_PROMO_PATTERN.search(title):
            try:
                start = float(c.get("start_time", 0.0))
                end = float(c.get("end_time", 0.0))
                if end > start:
                    skip.append({
                        "start": round(start, 3),
                        "end": round(end, 3),
                        "category": "chapter_sponsor",
                        "title": title,
                    })
            except (TypeError, ValueError):
                continue
    if skip:
        log(f"[sponsorblock] detected {len(skip)} sponsor/promo segment(s) from video chapters")
    return skip


def detect_transcript_promos(segments: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Detect spoken sponsor reads and calls to action directly from transcript segments."""
    if not segments:
        return []
    raw_hits: list[dict[str, Any]] = []
    for s in segments:
        text = str(s.get("text") or "")
        if any(pat.search(text) for pat in TRANSCRIPT_PROMO_PATTERNS):
            start = float(s.get("start", 0.0))
            end = float(s.get("end", 0.0))
            if end > start:
                raw_hits.append({
                    "start": max(0.0, start - 3.0),
                    "end": end + 25.0,
                    "category": "transcript_promo",
                    "text": text,
                })

    if not raw_hits:
        return []

    # Merge nearby promo segments (gaps <= 15 seconds are part of the same ad pitch)
    merged: list[dict[str, Any]] = []
    current_start = raw_hits[0]["start"]
    current_end = raw_hits[0]["end"]
    for hit in raw_hits[1:]:
        if hit["start"] - current_end <= 15.0:
            current_end = max(current_end, hit["end"])
        else:
            merged.append({
                "start": round(max(0.0, current_start - 2.0), 3),
                "end": round(current_end + 2.0, 3),
                "category": "transcript_promo",
            })
            current_start = hit["start"]
            current_end = hit["end"]
    merged.append({
        "start": round(max(0.0, current_start - 2.0), 3),
        "end": round(current_end + 2.0, 3),
        "category": "transcript_promo",
    })
    log(f"[sponsorblock] detected {len(merged)} sponsor/promo segment(s) from transcript speech")
    return merged


def merge_skip_segments(*lists_of_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Combine and merge skip segments from multiple sources (API, chapters, transcript)."""
    all_segs = [s for lst in lists_of_segments if lst for s in lst]
    if not all_segs:
        return []
    sorted_segs = sorted(all_segs, key=lambda s: s["start"])
    merged: list[dict[str, Any]] = [sorted_segs[0]]
    for s in sorted_segs[1:]:
        prev = merged[-1]
        if s["start"] <= prev["end"] + 1.0:
            prev["end"] = max(prev["end"], s["end"])
            if s.get("category") and prev.get("category") != s.get("category"):
                prev["category"] = f"{prev.get('category')}+{s.get('category')}"
        else:
            merged.append(s)
    return merged


def trim_skip_overlap(
    start: float,
    end: float,
    skip_segments: list[dict[str, Any]],
    min_sec: float = 15.0,
) -> tuple[float, float]:
    """Trim clip boundaries so they cleanly stop before or start after a skip segment."""
    if not skip_segments or end <= start:
        return start, end
    for seg in skip_segments:
        s, e = seg["start"], seg["end"]
        # Clip ends inside the sponsor segment -> trim end to start of sponsor
        if start < s and s < end <= e + 2.0:
            if s - start >= min_sec:
                end = s
        # Clip starts inside the sponsor/intro segment -> trim start to end of sponsor
        elif s - 2.0 <= start < e and e < end:
            if end - e >= min_sec:
                start = e
    return round(start, 3), round(end, 3)


def overlaps_skip(
    start: float,
    end: float,
    skip_segments: list[dict[str, Any]],
    limit_sec: float = 1.0,
) -> tuple[bool, str | None]:
    """Return (True, category) if [start, end] overlaps a skip segment by more than limit_sec.

    Default limit is 1.0 second (strict zero tolerance so no ad reads bleed into clips).
    """
    if not skip_segments:
        return False, None
    for seg in skip_segments:
        s, e = seg["start"], seg["end"]
        overlap = min(end, e) - max(start, s)
        if overlap > limit_sec:
            return True, seg.get("category")
    return False, None
