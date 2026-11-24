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


def overlaps_skip(
    start: float,
    end: float,
    skip_segments: list[dict[str, Any]],
    limit: float = 0.30,
) -> tuple[bool, str | None]:
    """Return (True, category) if [start, end] overlaps a skip segment beyond `limit`.

    `limit` is the fraction of the *shorter* of (clip, skip segment) that may
    overlap before the clip is considered tainted by a promo.
    """
    if not skip_segments:
        return False, None
    clip_dur = max(0.001, end - start)
    for seg in skip_segments:
        s, e = seg["start"], seg["end"]
        seg_dur = max(0.001, e - s)
        overlap = min(end, e) - max(start, s)
        if overlap <= 0:
            continue
        shorter = min(clip_dur, seg_dur)
        if overlap / shorter > limit:
            return True, seg.get("category")
    return False, None
