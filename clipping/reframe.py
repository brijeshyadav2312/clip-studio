"""Face-aware vertical reframing and streamer/gaming layout engine.

Features:
  1. Rock-solid podcast stabilization: deadband prevents shivering, dwell timer prevents
     rapid ping-pong switching between multiple speakers.
  2. Streamer/Gaming engine: detects corner webcam vs central gameplay action (cars,
     player, crosshairs in GTA 6 / FPS) and generates split-screen (webcam top, gameplay bottom),
     PiP, or pure gameplay center crops.
  3. Cinematic camera smoothing: damped velocity integration with zero micro-jitter.
"""

from __future__ import annotations

import math
from pathlib import Path

from .config import DATA_DIR, Settings
from .utils import clamp, log

SAMPLE_FPS = 8.0          # face detection rate
PATH_FPS = 30.0           # crop instructions per second (output frame rate)
DETECT_WIDTH = 640        # frames downscaled for fast detection
MIN_FACE_SCORE = 0.65     # confidence threshold for face detection

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
MODEL_DIR = DATA_DIR / "models"
YUNET_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"


def _download_yunet() -> Path | None:
    if YUNET_PATH.exists() and YUNET_PATH.stat().st_size > 100_000:
        return YUNET_PATH
    try:
        import requests

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        log("[reframe] downloading face detector (~340 KB, one time)")
        resp = requests.get(YUNET_URL, timeout=60, allow_redirects=True)
        resp.raise_for_status()
        if len(resp.content) < 100_000:
            raise RuntimeError("model download was truncated")
        YUNET_PATH.write_bytes(resp.content)
        return YUNET_PATH
    except Exception as exc:
        log(f"[reframe] could not fetch the YuNet face model: {exc}")
        return None


class FaceDetector:
    """YuNet (OpenCV >= 4.5.4) with Haar fallback."""

    def __init__(self) -> None:
        import cv2

        self.cv2 = cv2
        self.kind = "none"
        self.yunet = None
        self.cascades = []

        model = _download_yunet()
        if model is not None and hasattr(cv2, "FaceDetectorYN_create"):
            try:
                self.yunet = cv2.FaceDetectorYN_create(
                    str(model), "", (DETECT_WIDTH, 360), MIN_FACE_SCORE, 0.3, 5000
                )
                self.kind = "yunet"
            except Exception as exc:
                log(f"[reframe] YuNet init failed: {exc}")

        if self.yunet is None and hasattr(cv2, "CascadeClassifier"):
            base = getattr(cv2, "data", None)
            folder = getattr(base, "haarcascades", "") if base else ""
            if folder:
                for name in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"):
                    cascade = cv2.CascadeClassifier(folder + name)
                    if not cascade.empty():
                        self.cascades.append(cascade)
                if self.cascades:
                    self.kind = "haar"
        log(f"[reframe] detector: {self.kind}")

    def detect(self, frame) -> list[tuple[int, int, int, int, float]]:
        """Return (x, y, w, h, score) boxes in the coordinate space of `frame`."""
        cv2 = self.cv2
        h, w = frame.shape[:2]
        boxes: list[tuple[int, int, int, int, float]] = []

        if self.kind == "yunet":
            self.yunet.setInputSize((w, h))
            _, faces = self.yunet.detect(frame)
            if faces is not None:
                for face in faces:
                    x, y, fw, fh = (int(v) for v in face[:4])
                    score = float(face[-1])
                    if fw > 8 and fh > 8 and score >= MIN_FACE_SCORE:
                        boxes.append((x, y, fw, fh, score))
            return boxes

        if self.kind == "haar":
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            for cascade in self.cascades:
                found = cascade.detectMultiScale(gray, scaleFactor=1.12, minNeighbors=5, minSize=(36, 36))
                for (x, y, fw, fh) in found:
                    boxes.append((int(x), int(y), int(fw), int(fh), 1.0))
                if boxes:
                    break
        return boxes


class SpeakerTracker:
    """Stabilizes subject framing for vertical reframing.

    Key design decisions (from AutoFlip / OpusClip subject-tracking research):
      * Track ONE subject at a time. Never average two faces -- that centers the
        crop in the gap between people and cuts both of them off.
      * Main character = largest, most confident face (closest to camera gets
        the biggest area weight), with a mild horizontal center bias.
      * Temporal persistence: hold the current speaker unless a clearly more
        prominent face is present for a sustained dwell window. Prevents
        jittery ping-pong when two people trade short lines.
      * Gentle exponential pull toward the current face center to kill micro
        jitter while still following real movement.
    """

    def __init__(self, dwell_sec: float = 2.5, sample_fps: float = SAMPLE_FPS):
        self.dwell_frames = max(4, int(dwell_sec * sample_fps))
        self.active_center: float | None = None
        self.candidate_center: float | None = None
        self.candidate_count: int = 0
        self.lost_frames: int = 0

    def _score_face(
        self,
        face: tuple[int, int, int, int, float],
        src_w: float,
    ) -> float:
        """Prominence score for a single face.

        Larger / closer faces dominate (main character). A gentle center bias
        prefers the face nearer the frame midline, which is usually the subject.
        """
        x, y, w, h, score = face
        area = float(w * h)
        cx = x + w / 2.0
        center_bias = 1.0 - abs(cx - src_w / 2.0) / max(src_w / 2.0, 1.0)
        # area * confidence, blended with center bias (70% size, 30% center)
        return area * float(score) * (0.70 + 0.30 * center_bias)

    def update(
        self,
        faces: list[tuple[int, int, int, int, float]],
        crop_w_src: float,
        src_w: float,
    ) -> float | None:
        """Return the best single subject's horizontal center (source pixels)."""
        if not faces:
            self.lost_frames += 1
            # Hold the last subject through brief dropouts (~1.5s) so a blink or
            # momentary occlusion doesn't yank the crop away.
            hold = int(1.5 * SAMPLE_FPS)
            if self.lost_frames < hold and self.active_center is not None:
                return self.active_center
            return None

        self.lost_frames = 0

        # Pick the single most prominent face -- never average multiple faces.
        best = max(faces, key=lambda f: self._score_face(f, src_w))
        top_center = best[0] + best[2] / 2.0

        # If the dominant face is very large, it's a solo main character: lock tight.
        if best[2] * best[3] > (src_w * src_w) * 0.06:
            self.candidate_center = None
            self.candidate_count = 0

        if self.active_center is None:
            self.active_center = top_center
            return self.active_center

        # Current speaker still present nearby? Stay on them with a gentle pull.
        dist_to_current = abs(top_center - self.active_center)
        if dist_to_current < 200:
            self.active_center = 0.88 * self.active_center + 0.12 * top_center
            self.candidate_center = None
            self.candidate_count = 0
            return self.active_center

        # A different, prominent face appeared -- require sustained presence
        # before switching speakers (avoids flicker on short interjections).
        if self.candidate_center is None or abs(top_center - self.candidate_center) > 110:
            self.candidate_center = top_center
            self.candidate_count = 1
        else:
            self.candidate_count += 1
            self.candidate_center = 0.85 * self.candidate_center + 0.15 * top_center

        if self.candidate_count >= self.dwell_frames:
            self.active_center = self.candidate_center
            self.candidate_center = None
            self.candidate_count = 0

        return self.active_center


def _resample_and_smooth(
    raw: list[tuple[float, float | None]],
    duration: float,
    max_x: float,
    center_x: float,
    fps: float = PATH_FPS,
    stabilization: str = "locked_tripod",
    scene_changes: list[float] | None = None,
) -> list[tuple[float, float]]:
    """Turn sparse detections into a rock-solid, stabilized camera path.

    Modes:
      - locked_tripod: 40px deadband. Completely freezes camera motion on small head
        wobbles, breathing, or micro-movements. Tripod feel.
      - smooth_cinematic: 25px deadband with slow, damped pans.
      - dynamic: 15px deadband for fast-action content.

    ``scene_changes`` are hard-cut timestamps. The path is processed per segment so
    the crop can jump instantly at a cut instead of drifting across an unrelated
    scene into a graph or different speaker.
    """
    import numpy as np

    scene_changes = scene_changes or []
    ts = np.array([t for t, _ in raw], dtype=float)
    vals = np.array([np.nan if v is None else v for _, v in raw], dtype=float)

    if np.isnan(vals).all():
        interpolated = np.full_like(vals, center_x)
    else:
        index = np.arange(len(vals))
        good = ~np.isnan(vals)
        interpolated = np.interp(index, index[good], vals[good])

    # Stabilization parameters
    if stabilization == "locked_tripod":
        deadband, max_vel, follow_gain, tau_target, tau_vel = 42.0, 480.0, 4.5, 0.40, 0.25
    elif stabilization == "smooth_cinematic":
        deadband, max_vel, follow_gain, tau_target, tau_vel = 26.0, 650.0, 6.0, 0.25, 0.18
    else:  # dynamic
        deadband, max_vel, follow_gain, tau_target, tau_vel = 16.0, 1200.0, 9.0, 0.12, 0.12

    dt = 1.0 / fps
    alpha = 1.0 - math.exp(-dt / tau_target)
    vel_alpha = 1.0 - math.exp(-dt / tau_vel)
    window = 7

    def _smooth_chunk(t0: float, t1: float) -> list[tuple[float, int]]:
        """Smooth one scene-contiguous chunk [t0, t1]; returns stabilized (t, x) samples."""
        if t1 <= t0:
            return []
        count = max(2, int((t1 - t0) * fps) + 2)
        grid = np.arange(count, dtype=float) / fps
        grid = grid[grid <= (t1 - t0 + 1e-6)]
        if grid.size == 0:
            grid = np.array([0.0])
        # Interpolate chunk values onto the local grid (offset by chunk start).
        path = np.interp(grid + t0, ts, interpolated)
        # Median filter removes dropouts / spikes.
        if path.size >= window:
            padded = np.pad(path, window // 2, mode="edge")
            path = np.median(
                np.lib.stride_tricks.sliding_window_view(padded, window), axis=1
            )

        cam = float(path[0])
        target = float(path[0])
        velocity = 0.0
        out: list[tuple[float, int]] = []
        for g, sample in zip(grid, path):
            target += alpha * (float(sample) - target)
            error = target - cam
            if abs(error) < deadband:
                desired_vel = 0.0
                velocity *= 0.85
            else:
                effective_error = error - math.copysign(deadband * 0.7, error)
                desired_vel = clamp(follow_gain * effective_error, -max_vel, max_vel)
            velocity += vel_alpha * (desired_vel - velocity)
            cam += velocity * dt
            if cam <= 0.0:
                cam = 0.0
                velocity = 0.0
            elif cam >= max_x:
                cam = max_x
                velocity = 0.0
            out.append((round(t0 + float(g), 3), int(round(cam / 2.0) * 2)))
        return out

    # Split at scene changes so the crop jumps at hard cuts instead of drifting across them.
    breaks = [0.0]
    for sc in scene_changes:
        if 0.0 < sc < duration:
            breaks.append(sc)
    breaks.append(duration)
    breaks = sorted(set(breaks))

    samples: list[tuple[float, int]] = []
    for b_i in range(len(breaks) - 1):
        samples.extend(_smooth_chunk(breaks[b_i], breaks[b_i + 1]))

    # Deduplicate / clamp to [0, duration] and ensure monotonic time.
    samples = sorted(samples, key=lambda p: p[0])
    deduped: list[tuple[float, int]] = []
    for t, x in samples:
        if t > duration + 1e-6:
            continue
        if deduped and abs(t - deduped[-1][0]) < 1e-6:
            deduped[-1] = (t, x)
        else:
            deduped.append((t, x))
    return deduped





def _detect_corner_webcam(
    detections: list[list[tuple[int, int, int, int, float]]],
    src_w: int,
    src_h: int,
) -> dict | None:
    """Determine if there is a webcam facecam in one of the 4 screen corners."""
    corner_counts = {"top-left": 0, "top-right": 0, "bottom-left": 0, "bottom-right": 0}
    corner_boxes: dict[str, list[tuple[int, int, int, int]]] = {
        "top-left": [], "top-right": [], "bottom-left": [], "bottom-right": []
    }
    total_detections = 0

    for frame_faces in detections:
        for (x, y, w, h, score) in frame_faces:
            total_detections += 1
            # Webcam faces are small to medium (< 35% of screen width)
            if w > src_w * 0.38 or h > src_h * 0.45:
                continue

            cx = (x + w / 2.0) / src_w
            cy = (y + h / 2.0) / src_h

            if cx < 0.35 and cy < 0.45:
                corner = "top-left"
            elif cx > 0.65 and cy < 0.45:
                corner = "top-right"
            elif cx < 0.35 and cy > 0.55:
                corner = "bottom-left"
            elif cx > 0.65 and cy > 0.55:
                corner = "bottom-right"
            else:
                continue

            corner_counts[corner] += 1
            corner_boxes[corner].append((x, y, w, h))

    if not total_detections:
        return None

    # Check if any corner holds >= 45% of all face detections
    best_corner, count = max(corner_counts.items(), key=lambda item: item[1])
    if count >= max(4, int(total_detections * 0.40)):
        boxes = corner_boxes[best_corner]
        # Average face box
        avg_x = sum(b[0] for b in boxes) / len(boxes)
        avg_y = sum(b[1] for b in boxes) / len(boxes)
        avg_w = sum(b[2] for b in boxes) / len(boxes)
        avg_h = sum(b[3] for b in boxes) / len(boxes)
        return {
            "corner": best_corner,
            "face_box": (avg_x, avg_y, avg_w, avg_h),
            "detections": count,
        }
    return None


def _compute_streamer_crops(
    src_w: int,
    src_h: int,
    cam_info: dict | None,
    settings: Settings,
) -> dict:
    """Compute crop coordinates for facecam and gameplay (focusing on vehicle/action)."""
    # 1. Webcam crop
    zoom = max(0.8, min(2.5, settings.streamer_cam_zoom))
    corner = settings.streamer_cam_pos if settings.streamer_cam_pos != "auto" else (
        cam_info["corner"] if cam_info else "top-right"
    )

    if cam_info:
        fx, fy, fw, fh = cam_info["face_box"]
        fcx = fx + fw / 2.0
        fcy = fy + fh / 2.0
    else:
        # Default corner webcam positions if no face model
        if corner == "top-left":
            fcx, fcy = src_w * 0.15, src_h * 0.20
        elif corner == "top-right":
            fcx, fcy = src_w * 0.85, src_h * 0.20
        elif corner == "bottom-left":
            fcx, fcy = src_w * 0.15, src_h * 0.80
        else:
            fcx, fcy = src_w * 0.85, src_h * 0.80
        fw, fh = src_w * 0.18, src_h * 0.25

    # Webcam target aspect ratio is 16:9 or 9:16 banner
    cam_crop_h = min(src_h * 0.45, (fh * 2.8) / zoom)
    cam_crop_w = cam_crop_h * (1080.0 / 672.0)  # matching 35_65 split proportion
    if cam_crop_w > src_w * 0.50:
        cam_crop_w = src_w * 0.50
        cam_crop_h = cam_crop_w * (672.0 / 1080.0)

    cam_x = clamp(fcx - cam_crop_w / 2.0, 0, src_w - cam_crop_w)
    cam_y = clamp(fcy - cam_crop_h / 2.0, 0, src_h - cam_crop_h)

    # 2. Gameplay crop: Lock onto central vehicle / player / action (GTA 6 fix!)
    game_focus = settings.streamer_game_focus
    # For 16:9 gameplay to vertical 9:16 or split ratio:
    # In streamer_split with bottom 65% height, aspect is 1080 : 1248 ≈ 0.865
    split_ratios = {
        "35_65": (672, 1248),
        "30_70": (576, 1344),
        "40_60": (768, 1152),
        "50_50": (960, 960),
    }
    top_h, bot_h = split_ratios.get(settings.streamer_split_ratio, (672, 1248))
    game_target_aspect = 1080.0 / bot_h

    # Gameplay crop width and height in source pixels
    game_h = src_h
    game_w = game_h * game_target_aspect
    if game_w > src_w:
        game_w = src_w
        game_h = game_w / game_target_aspect

    # Horizontal alignment: car/character is in the center
    game_x = clamp((src_w - game_w) / 2.0, 0, src_w - game_w)

    # Vertical alignment based on focus option:
    if game_focus == "center_low":
        # Vehicle camera in driving/GTA where road and car are low
        game_y = clamp(src_h - game_h, 0, src_h - game_h)
    elif game_focus == "center_high":
        game_y = 0.0
    else:  # "center" or "action_track" default
        game_y = clamp((src_h - game_h) / 2.0, 0, src_h - game_h)

    return {
        "corner": corner,
        "cam_crop": (int(round(cam_x)), int(round(cam_y)), int(round(cam_crop_w)), int(round(cam_crop_h))),
        "game_crop": (int(round(game_x)), int(round(game_y)), int(round(game_w)), int(round(game_h))),
        "top_h": top_h,
        "bot_h": bot_h,
    }


def detect_wide_content(small_frame) -> bool:
    """Detect if on-screen text, title cards, slides, or graphics extend into the 9:16 margins.

    Combines three signals so we don't miss graphs/charts/slides:
      * Canny edge density in the left/right margins (typography strokes, diagrams)
      * Gray-level variance in the margins (buttons, cards, boxes, arrows)
      * Saturation / colour variance (infographics often use flat brand colours)
    Returns True when the content spills outside what a centred 9:16 crop would show.
    """
    import cv2
    import numpy as np

    h, w = small_frame.shape[:2]
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY) if len(small_frame.shape) == 3 else small_frame
    crop_w = int(h * (9.0 / 16.0))
    margin_w = max(10, (w - crop_w) // 2)
    if margin_w <= 0:
        return False

    # 1) Edge density in the outer margins (typography strokes, diagram lines).
    edges = cv2.Canny(gray, 30, 100)
    left_density = float(np.count_nonzero(edges[:, :margin_w])) / float(h * margin_w)
    right_density = float(np.count_nonzero(edges[:, w - margin_w:])) / float(h * margin_w)

    # 2) Variance in the margins (non-uniform boxes/cards/arrows).
    left_var = float(np.var(gray[:, :margin_w]))
    right_var = float(np.var(gray[:, w - margin_w:]))

    # 3) Colour saturation variance (infographics / brand slides pop in colour).
    hsv = cv2.cvtColor(small_frame, cv2.COLOR_BGR2HSV) if len(small_frame.shape) == 3 else None
    sat_var = 0.0
    if hsv is not None:
        sat = hsv[:, :, 1].astype(np.float32)
        left_sat = float(np.var(sat[:, :margin_w]))
        right_sat = float(np.var(sat[:, w - margin_w:]))
        sat_var = max(left_sat, right_sat)

    wide = (
        left_density > 0.0022 or right_density > 0.0022 or
        left_var > 130 or right_var > 130 or
        sat_var > 900
    )
    return bool(wide)


def detect_text_regions(small_frame) -> list[tuple[float, float, float, float]]:
    """Find approximate on-screen text regions as normalized [x0, y0, x1, y1] in [0,1].

    Uses MSER (Maximally Stable Extremal Regions) which is tuned to catch
    stable text-like blobs, plus a threshold pass for high-contrast captions.
    Returns a list of bounding boxes; caller decides how to use them.
    """
    import cv2
    import numpy as np

    h, w = small_frame.shape[:2]
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY) if len(small_frame.shape) == 3 else small_frame
    regions: list[tuple[float, float, float, float]] = []

    try:
        mser = cv2.MSER_create(_delta=3, _min_area=25, _max_area=h * w * 0.30)
        bboxes, _ = mser.detectRegions(gray)
        for (x, y, fw, fh) in bboxes:
            # Text-like: wider than tall, not huge, not a single pixel line.
            if fw < 8 or fh < 6:
                continue
            if fh > fw * 3.0:  # tall thin strokes aren't words
                continue
            regions.append((x / w, y / h, (x + fw) / w, (y + fh) / h))
    except Exception:
        pass

    # Merge overlapping / neighbouring boxes into a few coarse zones.
    if not regions:
        return regions
    zones: list[list[float]] = []
    for x0, y0, x1, y1 in sorted(regions):
        placed = False
        for zone in zones:
            if x0 <= zone[2] + 0.05 and zone[0] <= x1 + 0.05 and y0 <= zone[3] + 0.05 and zone[1] <= y1 + 0.05:
                zone[0] = min(zone[0], x0)
                zone[1] = min(zone[1], y0)
                zone[2] = max(zone[2], x1)
                zone[3] = max(zone[3], y1)
                placed = True
                break
        if not placed:
            zones.append([x0, y0, x1, y1])
    return [(z[0], z[1], z[2], z[3]) for z in zones]


def detect_scene_changes(samples_gray: list, fps: float = 30.0, threshold: float = 0.35) -> list[float]:
    """Detect hard cuts between consecutive downsampled frames.

    Returns timestamps (seconds) where a scene change occurs, so the crop path
    can be reset instead of drifting across an unrelated cut.
    """
    import numpy as np

    changes: list[float] = []
    if len(samples_gray) < 2:
        return changes
    prev = None
    for i, g in enumerate(samples_gray):
        if prev is not None:
            diff = float(np.mean(np.abs(g.astype(np.float32) - prev.astype(np.float32)))) / 255.0
            if diff > threshold:
                changes.append(i / fps)
        prev = g
    return changes


def _find_landscape_intervals(samples: list[tuple[float, bool]], min_dur: float = 0.8) -> list[tuple[float, float]]:
    """Group consecutive landscape/graph/slide frames into continuous intervals [start_sec, end_sec]."""
    if not samples:
        return []
    intervals = []
    in_block = False
    block_start = 0.0
    for t, is_land in samples:
        if is_land and not in_block:
            in_block = True
            block_start = t
        elif not is_land and in_block:
            in_block = False
            if (t - block_start) >= min_dur:
                intervals.append((round(block_start, 2), round(t, 2)))
    if in_block and samples:
        if (samples[-1][0] - block_start) >= min_dur:
            intervals.append((round(block_start, 2), round(samples[-1][0], 2)))

    # Merge intervals separated by small gap <= 0.6s
    merged: list[tuple[float, float]] = []
    for s, e in intervals:
        if merged and (s - merged[-1][1]) <= 0.6:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    return merged


def plan(
    video: Path,
    clip_start: float,
    clip_end: float,
    info: dict,
    settings: Settings,
) -> dict:
    """Analyse clip and return layout instructions with podcast stabilization and streamer view."""
    src_w, src_h = int(info["width"]), int(info["height"])
    ratio = settings.ratio()
    duration = max(0.1, clip_end - clip_start)
    src_ratio = src_w / src_h

    scale = 1920.0 / src_h
    sw = int(round(src_w * scale / 2) * 2)
    crop_w, crop_h = 1080, 1920
    max_x = max(0.0, sw - crop_w)
    center_x = max_x / 2.0

    # Explicit Gameplay Center Mode (GTA 6 / Racing / FPS vehicle focus)
    if settings.layout == "gameplay_center":
        crop_w_src = src_h * ratio
        gx = max(0.0, (src_w - crop_w_src) / 2.0)
        return {
            "mode": "gameplay_center",
            "crop_w": crop_w,
            "crop_h": crop_h,
            "scaled_w": sw,
            "src_crop": (int(round(gx)), 0, int(round(crop_w_src)), src_h),
            "samples": [],
            "face_ratio": 0.0,
            "reason": "Locked central gameplay focus (vehicle / character)",
        }

    # Explicit Smart Fit / Blur Mode (100% on-screen text, slides, and graphics preserved)
    if settings.layout in ("fit_blur", "smart_fit", "gameplay_blur", "blur"):
        return {
            "mode": "fit_blur",
            "crop_w": src_w,
            "crop_h": src_h,
            "scaled_w": sw,
            "samples": [],
            "face_ratio": 0.0,
            "reason": "Preserved full frame with ambient blur (text & graphics safe)",
        }

    # Sample video frames for face and wide content detection
    raw: list[tuple[float, float | None]] = []
    all_detections: list[list[tuple[int, int, int, int, float]]] = []
    landscape_samples: list[tuple[float, bool]] = []
    crop_w_src = src_h * ratio
    tracker = SpeakerTracker(dwell_sec=settings.podcast_dwell_sec, sample_fps=SAMPLE_FPS)
    hits = 0
    wide_hits = 0
    frames = 0
    # Per-frame text zones (normalized [x0,y0,x1,y1]) so the crop can protect on-screen text.
    text_zones: list[list[tuple[float, float, float, float]]] = []
    # Downsampled grayscale frames for scene-change detection.
    gray_samples: list = []
    scene_changes: list[float] = []

    try:
        import cv2

        detector = FaceDetector()
        if detector.kind == "none":
            raise RuntimeError("no face detector available")

        cap = cv2.VideoCapture(str(video))
        if not cap.isOpened():
            raise RuntimeError("could not open video")
        cap.set(cv2.CAP_PROP_POS_MSEC, clip_start * 1000.0)
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step = 1.0 / SAMPLE_FPS
        next_t = 0.0
        index = 0

        while True:
            if not cap.grab():
                break
            t = index / src_fps
            index += 1
            if t + 1e-6 < next_t:
                continue
            next_t += step
            ok, frame = cap.retrieve()
            if not ok:
                continue

            frames += 1
            h, w = frame.shape[:2]
            if w > DETECT_WIDTH:
                small = cv2.resize(frame, (DETECT_WIDTH, int(h * DETECT_WIDTH / w)), interpolation=cv2.INTER_AREA)
                factor = w / float(DETECT_WIDTH)
            else:
                small = frame
                factor = 1.0

            is_wide = detect_wide_content(small)
            if is_wide:
                wide_hits += 1

            # Capture text/graph regions so the crop window can be biased to include them.
            zones = detect_text_regions(small) if is_wide else []
            text_zones.append(zones)

            # Downsampled grayscale for scene-change detection.
            g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            g = cv2.resize(g, (160, 90), interpolation=cv2.INTER_AREA)
            gray_samples.append(g)

            faces = [
                (int(fx * factor), int(fy * factor), int(fw * factor), int(fh * factor), score)
                for (fx, fy, fw, fh, score) in detector.detect(small)
            ]
            all_detections.append(faces)

            # Frame is landscape visual if no face detected OR wide graphics/slides span into margins
            frame_is_landscape = (len(faces) == 0) or is_wide
            landscape_samples.append((t, frame_is_landscape))

            center_src = tracker.update(faces, crop_w_src, src_w)
            if center_src is not None:
                hits += 1
                x = clamp(center_src * scale - crop_w / 2.0, 0.0, max_x)
                raw.append((t, x))
            else:
                # No face: if on-screen text/graph was detected, bias the crop to
                # keep it inside the 9:16 window instead of centering blindly.
                x = None
                if text_zones and text_zones[-1]:
                    # Use the largest text zone (most likely the headline/graph).
                    zone = max(text_zones[-1], key=lambda z: (z[2] - z[0]) * (z[3] - z[1]))
                    tx = (zone[0] + zone[2]) / 2.0  # normalized center in source frame
                    text_center_src = tx * src_w
                    x = clamp(text_center_src * scale - crop_w / 2.0, 0.0, max_x)
                raw.append((t, x))

            if t >= duration:
                break
        cap.release()
    except Exception as exc:
        log(f"[reframe] analysis failed ({exc}); using safe fit_blur")
        return {
            "mode": "fit_blur",
            "crop_w": src_w,
            "crop_h": src_h,
            "scaled_w": sw,
            "samples": [],
            "face_ratio": 0.0,
            "wide_ratio": 0.0,
            "reason": f"analysis fallback: {exc}",
        }

    face_ratio = hits / frames if frames else 0.0
    wide_ratio = wide_hits / frames if frames else 0.0
    corner_cam = _detect_corner_webcam(all_detections, src_w, src_h)

    # Scene changes: reset the crop path at hard cuts so we never drift across an
    # unrelated cut into a graph or different speaker.
    scene_changes = detect_scene_changes(gray_samples, fps=SAMPLE_FPS)

    # Dynamic landscape intervals: detect segments where graphics, slides, or B-roll appear
    landscape_intervals = _find_landscape_intervals(landscape_samples, min_dur=0.8)
    total_landscape_dur = sum(e - s for s, e in landscape_intervals)
    landscape_ratio = total_landscape_dur / duration if duration else 0.0

    # Determine layout mode
    # 1. Explicit layout selections:
    if settings.layout == "streamer_split":
        streamer_crops = _compute_streamer_crops(src_w, src_h, corner_cam, settings)
        log(
            f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s streamer mode enabled "
            f"(corner: {streamer_crops['corner']}, split: {settings.streamer_split_ratio})"
        )
        return {
            "mode": "streamer_split",
            "crop_w": crop_w,
            "crop_h": crop_h,
            "scaled_w": sw,
            "streamer": streamer_crops,
            "face_ratio": round(face_ratio, 3),
            "wide_ratio": round(wide_ratio, 3),
            "reason": f"streamer split mode (cam {streamer_crops['corner']})",
        }

    if settings.layout == "streamer_pip":
        streamer_crops = _compute_streamer_crops(src_w, src_h, corner_cam, settings)
        return {
            "mode": "streamer_pip",
            "crop_w": crop_w,
            "crop_h": crop_h,
            "scaled_w": sw,
            "streamer": streamer_crops,
            "face_ratio": round(face_ratio, 3),
            "wide_ratio": round(wide_ratio, 3),
            "reason": "streamer picture-in-picture mode",
        }

    if settings.layout == "gameplay_center":
        crop_w_src = src_h * ratio
        gx = max(0.0, (src_w - crop_w_src) / 2.0)
        return {
            "mode": "gameplay_center",
            "crop_w": crop_w,
            "crop_h": crop_h,
            "scaled_w": sw,
            "src_crop": (int(round(gx)), 0, int(round(crop_w_src)), src_h),
            "samples": [],
            "face_ratio": round(face_ratio, 3),
            "wide_ratio": round(wide_ratio, 3),
            "reason": "Explicit gameplay_center layout: locked to center action (vehicle / crosshair)",
        }

    if settings.layout in ("fit_blur", "blur", "gameplay_blur"):
        return {
            "mode": "fit_blur",
            "crop_w": src_w,
            "crop_h": src_h,
            "scaled_w": sw,
            "samples": [],
            "face_ratio": round(face_ratio, 3),
            "wide_ratio": round(wide_ratio, 3),
            "reason": f"Explicit layout: {settings.layout}",
        }

    # 2. Smart Content-Aware Auto-Detection Mode:
    if settings.layout == "auto":
        # A. Gaming Streamer Auto-Detection (webcam in corner)
        if corner_cam is not None:
            streamer_crops = _compute_streamer_crops(src_w, src_h, corner_cam, settings)
            log(
                f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s auto-detected gaming streamer "
                f"(webcam: {streamer_crops['corner']}, split: {settings.streamer_split_ratio})"
            )
            return {
                "mode": "streamer_split",
                "crop_w": crop_w,
                "crop_h": crop_h,
                "scaled_w": sw,
                "streamer": streamer_crops,
                "face_ratio": round(face_ratio, 3),
                "wide_ratio": round(wide_ratio, 3),
                "reason": f"Auto-detected streamer webcam in {streamer_crops['corner']}",
            }

        # B. Pure Presentation / Full Slide / 100% Graph video.
        # Only letterbox when faces are essentially absent and the clip is dominated
        # by wide visuals -- a 16:9 graph cannot fit 9:16 without cropping it off,
        # so preserving it full-frame (fit_blur) is the lesser evil.
        if landscape_ratio >= 0.60 and face_ratio < 0.08:
            log(
                f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s full presentation/graph video "
                f"(landscape: {landscape_ratio*100:.0f}%, faces: {face_ratio*100:.0f}%) -> fit_blur"
            )
            return {
                "mode": "fit_blur",
                "crop_w": src_w,
                "crop_h": src_h,
                "scaled_w": sw,
                "samples": [],
                "face_ratio": round(face_ratio, 3),
                "wide_ratio": round(wide_ratio, 3),
                "reason": f"Full landscape presentation / infographic / slide video ({int(landscape_ratio*100)}%)",
            }

        # C. DYNAMIC SMART REFRAMING: Speaker on camera + Graph/Slide/Chart cutaways!
        # Automatically detects when a video cuts to a full-screen chart, diagram, or slide
        # and dynamically displays full landscape (fit_blur) so the entire visual is visible!
        if landscape_intervals and 0.05 <= landscape_ratio < 0.70:
            samples = _resample_and_smooth(
                raw, duration, max_x, center_x,
                fps=PATH_FPS,
                stabilization=settings.stabilization,
                scene_changes=scene_changes,
            )
            log(
                f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s dynamic reframing: "
                f"{len(landscape_intervals)} graph/slide cutaways ({total_landscape_dur:.1f}s) -> dynamic_landscape"
            )
            return {
                "mode": "dynamic_landscape",
                "crop_w": crop_w,
                "crop_h": crop_h,
                "scaled_w": sw,
                "samples": samples,
                "landscape_intervals": landscape_intervals,
                "face_ratio": round(face_ratio, 3),
                "wide_ratio": round(wide_ratio, 3),
                "reason": f"Dynamic reframing: {len(landscape_intervals)} graph/chart cutaways shown in full landscape",
            }

    # Standard / Podcast Speaker Mode with Rock-Solid Stabilization
    samples = _resample_and_smooth(
        raw, duration, max_x, center_x,
        fps=PATH_FPS,
        stabilization=settings.stabilization,
        scene_changes=scene_changes,
    )

    log(
        f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s faces in {face_ratio * 100:.0f}% "
        f"of frames -> stabilized crop ({settings.stabilization})"
    )

    return {
        "mode": "crop",
        "crop_w": crop_w,
        "crop_h": crop_h,
        "scaled_w": sw,
        "samples": samples,
        "target": [(round(t, 3), round(x, 1)) for t, x in raw if x is not None],
        "face_ratio": round(face_ratio, 3),
        "wide_ratio": round(wide_ratio, 3),
        "reason": f"stabilized crop ({settings.stabilization})",
    }


def write_sendcmd(samples: list[tuple[float, int]], path: Path) -> Path:
    """Write an ffmpeg sendcmd script that moves the crop window."""
    lines = []
    for t, x in samples:
        stamp = max(0.0, float(t) - 1e-4)
        lines.append(f"{stamp:.6f} [enter] crop x {x};")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path
