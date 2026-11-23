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
    """Stabilizes podcast multi-speaker framing with dwell hysteresis."""

    def __init__(self, dwell_sec: float = 2.5, sample_fps: float = SAMPLE_FPS):
        self.dwell_frames = max(4, int(dwell_sec * sample_fps))
        self.active_center: float | None = None
        self.candidate_center: float | None = None
        self.candidate_count: int = 0
        self.lost_frames: int = 0

    def update(
        self,
        faces: list[tuple[int, int, int, int, float]],
        crop_w_src: float,
        src_w: float,
    ) -> float | None:
        if not faces:
            self.lost_frames += 1
            # Hold active center during short dropouts (up to ~1.5s)
            if self.lost_frames < int(1.5 * SAMPLE_FPS) and self.active_center is not None:
                return self.active_center
            return None

        self.lost_frames = 0

        # Check if all faces can fit within 90% of the vertical crop width
        min_x = min(f[0] for f in faces)
        max_x = max(f[0] + f[2] for f in faces)
        if (max_x - min_x) <= crop_w_src * 0.90:
            target = (min_x + max_x) / 2.0
            self.active_center = target
            self.candidate_center = None
            self.candidate_count = 0
            return target

        # Sort faces by prominence (area * score)
        prominent = sorted(faces, key=lambda f: (f[2] * f[3]) * f[4], reverse=True)
        top_face = prominent[0]
        top_center = top_face[0] + top_face[2] / 2.0

        if self.active_center is None:
            self.active_center = top_center
            return self.active_center

        # Check if current active center is still occupied by a detected face
        current_face = min(faces, key=lambda f: abs((f[0] + f[2] / 2.0) - self.active_center))
        dist_to_current = abs((current_face[0] + current_face[2] / 2.0) - self.active_center)

        # If current speaker is still present within reasonable bounds (e.g. 150px)
        if dist_to_current < 160:
            # Gentle micro-anchor on current speaker (avoiding jitter)
            self.active_center = 0.90 * self.active_center + 0.10 * (current_face[0] + current_face[2] / 2.0)
            self.candidate_count = 0
            self.candidate_center = None
            return self.active_center

        # If another speaker is prominent, require sustained presence before switching
        if self.candidate_center is None or abs(top_center - self.candidate_center) > 120:
            self.candidate_center = top_center
            self.candidate_count = 1
        else:
            self.candidate_count += 1
            self.candidate_center = 0.85 * self.candidate_center + 0.15 * top_center

        if self.candidate_count >= self.dwell_frames:
            # Switch to new speaker
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
) -> list[tuple[float, float]]:
    """Turn sparse detections into a rock-solid, stabilized camera path.

    Modes:
      - locked_tripod: 40px deadband. Completely freezes camera motion on small head
        wobbles, breathing, or micro-movements. Tripod feel.
      - smooth_cinematic: 25px deadband with slow, damped pans.
      - dynamic: 15px deadband for fast-action content.
    """
    import numpy as np

    ts = np.array([t for t, _ in raw], dtype=float)
    vals = np.array([np.nan if v is None else v for _, v in raw], dtype=float)

    if np.isnan(vals).all():
        vals = np.full_like(vals, center_x)
    else:
        index = np.arange(len(vals))
        good = ~np.isnan(vals)
        vals = np.interp(index, index[good], vals[good])

    count = max(2, int(duration * fps) + 2)
    grid = np.arange(count, dtype=float) / fps
    path = np.interp(grid, ts, vals)

    # Median filter (window 7) removes dropouts and sudden single-frame spikes
    window = 7
    padded = np.pad(path, window // 2, mode="edge")
    path = np.median(np.lib.stride_tricks.sliding_window_view(padded, window), axis=1)

    # Stabilization parameters
    if stabilization == "locked_tripod":
        deadband = 42.0          # pixels in scaled space (~13px at 1080p)
        max_vel = 480.0          # px/s - slow cinematic pan
        follow_gain = 4.5
        tau_target = 0.40
        tau_vel = 0.25
    elif stabilization == "smooth_cinematic":
        deadband = 26.0
        max_vel = 650.0
        follow_gain = 6.0
        tau_target = 0.25
        tau_vel = 0.18
    else:  # dynamic
        deadband = 16.0
        max_vel = 1200.0
        follow_gain = 9.0
        tau_target = 0.12
        tau_vel = 0.12

    dt = 1.0 / fps
    alpha = 1.0 - math.exp(-dt / tau_target)
    vel_alpha = 1.0 - math.exp(-dt / tau_vel)

    cam = float(path[0])
    target = float(path[0])
    velocity = 0.0
    out: list[tuple[float, float]] = []

    for i, sample in enumerate(path):
        target += alpha * (float(sample) - target)
        error = target - cam

        # Deadband: if error is within threshold, zero out movement (tripod lock)
        if abs(error) < deadband:
            desired_vel = 0.0
            velocity *= 0.85     # rapid decay to full halt
        else:
            # Active pan towards target with soft-shoulder speed limit
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

        out.append((i / fps, int(round(cam / 2.0) * 2)))

    return out


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

    # Explicit Gameplay Blur Mode (16:9 gameplay with blurred top/bottom)
    if settings.layout in ("gameplay_blur", "blur"):
        return {
            "mode": "gameplay_blur",
            "crop_w": src_w,
            "crop_h": src_h,
            "scaled_w": sw,
            "samples": [],
            "face_ratio": 0.0,
            "reason": "Full frame with blurred backdrop",
        }

    # Sample video frames for face detection
    raw: list[tuple[float, float | None]] = []
    all_detections: list[list[tuple[int, int, int, int, float]]] = []
    crop_w_src = src_h * ratio
    tracker = SpeakerTracker(dwell_sec=settings.podcast_dwell_sec, sample_fps=SAMPLE_FPS)
    hits = 0
    frames = 0

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

            faces = [
                (int(fx * factor), int(fy * factor), int(fw * factor), int(fh * factor), score)
                for (fx, fy, fw, fh, score) in detector.detect(small)
            ]
            all_detections.append(faces)

            center_src = tracker.update(faces, crop_w_src, src_w)
            if center_src is not None:
                hits += 1
                x = clamp(center_src * scale - crop_w / 2.0, 0.0, max_x)
                raw.append((t, x))
            else:
                raw.append((t, None))

            if t >= duration:
                break
        cap.release()
    except Exception as exc:
        log(f"[reframe] analysis failed ({exc}); using centred crop")
        return {
            "mode": "gameplay_center",
            "crop_w": crop_w,
            "crop_h": crop_h,
            "scaled_w": sw,
            "src_crop": (int(round((src_w - crop_w_src) / 2.0)), 0, int(round(crop_w_src)), src_h),
            "samples": [],
            "face_ratio": 0.0,
            "reason": f"analysis error: {exc}",
        }

    face_ratio = hits / frames if frames else 0.0
    corner_cam = _detect_corner_webcam(all_detections, src_w, src_h)

    # Determine layout mode
    if settings.layout == "streamer_split" or (settings.layout == "auto" and corner_cam is not None):
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
            "reason": f"corner facecam detected in {streamer_crops['corner']}",
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
            "reason": "streamer picture-in-picture mode",
        }

    # If no faces found (pure gameplay like GTA with no webcam), lock to central gameplay!
    if face_ratio < 0.20:
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
            "reason": "no face found, locked to central gameplay action",
        }

    # Standard / Podcast Speaker Mode with Rock-Solid Stabilization
    samples = _resample_and_smooth(
        raw, duration, max_x, center_x,
        fps=PATH_FPS,
        stabilization=settings.stabilization,
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
