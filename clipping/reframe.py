"""Face-aware vertical reframing with a smooth, per-frame camera path.

Pipeline:
  1. Detect faces at 8 fps and turn each detection into a desired crop centre.
  2. Fill detection gaps, median-filter away single-frame spikes.
  3. Resample to output frame rate and drive a damped "camera" with a velocity
     limit, so the crop pans instead of snapping.
  4. Emit one ffmpeg `sendcmd` instruction per output frame: the crop moves by a
     fraction of a pixel at 1080p, which reads as a smooth pan.
"""

from __future__ import annotations

import math
from pathlib import Path

from .config import DATA_DIR, Settings
from .utils import clamp, log

SAMPLE_FPS = 8.0          # face detection rate
PATH_FPS = 30.0           # crop instructions per second (output frame rate)
DETECT_WIDTH = 640        # frames are downscaled to this width for detection
MIN_FACE_SCORE = 0.7

TARGET_TAU = 0.08         # seconds: low-pass on the detected centre
VELOCITY_TAU = 0.10       # seconds: how fast the camera reaches cruise speed
FOLLOW_GAIN = 14.0        # camera px/s per px of error
MAX_VELOCITY = 2400.0     # px/s in the scaled frame (≈760 px/s at 1080p output)

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
    """YuNet (OpenCV >= 4.5.4) with a Haar fallback for older OpenCV builds."""

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


def _pick_center(
    faces: list[tuple[int, int, int, int, float]],
    crop_w_src: float,
    prev_x: float | None,
) -> float | None:
    """Crop centre in source pixels, preferring the group of faces we can fit."""
    if not faces:
        return None

    # Weight by area * confidence: the closest, largest, clearest face wins.
    faces = sorted(faces, key=lambda f: f[2] * f[3] * f[4], reverse=True)
    union_left = min(f[0] for f in faces)
    union_right = max(f[0] + f[2] for f in faces)
    if (union_right - union_left) <= crop_w_src * 0.9:
        return (union_left + union_right) / 2.0

    if prev_x is not None:
        faces = sorted(faces, key=lambda f: abs((f[0] + f[2] / 2) - prev_x))
    x, _, w, _, _ = faces[0]
    return x + w / 2.0


def _resample_and_smooth(
    raw: list[tuple[float, float | None]],
    duration: float,
    max_x: float,
    center_x: float,
    fps: float = PATH_FPS,
) -> list[tuple[float, float]]:
    """Turn sparse detections into a dense, smooth crop path."""
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

    # Median filter removes one-frame detection spikes without adding lag.
    window = 5
    padded = np.pad(path, window // 2, mode="edge")
    path = np.median(np.lib.stride_tricks.sliding_window_view(padded, window), axis=1)

    # Damped camera: low-pass the target, then follow it with limited velocity.
    dt = 1.0 / fps
    alpha = 1.0 - math.exp(-dt / TARGET_TAU)
    vel_alpha = 1.0 - math.exp(-dt / VELOCITY_TAU)
    cam = float(path[0])
    target = float(path[0])
    velocity = 0.0
    out: list[tuple[float, float]] = []

    for i, sample in enumerate(path):
        target += alpha * (float(sample) - target)
        error = target - cam
        desired = clamp(FOLLOW_GAIN * error, -MAX_VELOCITY, MAX_VELOCITY)
        velocity += vel_alpha * (desired - velocity)
        cam += velocity * dt
        if cam <= 0.0:
            cam = 0.0
            velocity = 0.0
        elif cam >= max_x:
            cam = max_x
            velocity = 0.0
        # Even pixels keep the yuv420p chroma aligned; 2 scaled px ≈ 0.6 output px.
        out.append((i / fps, int(round(cam / 2.0) * 2)))

    return out


def plan(
    video: Path,
    clip_start: float,
    clip_end: float,
    info: dict,
    settings: Settings,
) -> dict:
    """Analyse one clip and return a reframing plan."""
    src_w, src_h = int(info["width"]), int(info["height"])
    ratio = settings.ratio()
    duration = max(0.1, clip_end - clip_start)
    src_ratio = src_w / src_h

    scale = 1920.0 / src_h
    sw = int(round(src_w * scale / 2) * 2)
    crop_w, crop_h = 1080, 1920
    max_x = max(0.0, sw - crop_w)
    center_x = max_x / 2.0

    # Already at (or narrower than) the target ratio: nothing to crop horizontally.
    if src_ratio <= ratio * 1.02:
        return {"mode": "blur", "crop_w": src_w, "crop_h": src_h, "scaled_w": sw,
                "samples": [], "face_ratio": 0.0, "reason": "source is already vertical"}

    crop_w_src = src_h * ratio
    raw: list[tuple[float, float | None]] = []
    hits = 0
    frames = 0
    prev_center: float | None = None

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
                factor = w / DETECT_WIDTH
            else:
                small = frame
                factor = 1.0

            faces = [(int(x * factor), int(y * factor), int(fw * factor), int(fh * factor), score)
                     for (x, y, fw, fh, score) in detector.detect(small)]
            center_src = _pick_center(faces, crop_w_src, prev_center)
            if center_src is not None:
                hits += 1
                prev_center = center_src
                x = clamp(center_src * scale - crop_w / 2.0, 0.0, max_x)
                raw.append((t, x))
            else:
                raw.append((t, None))

            if t >= duration:
                break
        cap.release()
    except Exception as exc:  # pragma: no cover - analysis is best effort
        log(f"[reframe] analysis failed ({exc}); using centred crop")
        return {"mode": "crop", "crop_w": crop_w, "crop_h": crop_h, "scaled_w": sw,
                "samples": [], "face_ratio": 0.0, "reason": f"analysis error: {exc}"}

    face_ratio = hits / frames if frames else 0.0
    mode = "crop"
    if settings.layout == "blur":
        mode = "blur"
    elif settings.layout == "auto" and face_ratio < 0.6:
        # A clip that spends a lot of time on slides, screencasts or wide shots is
        # safer in blur mode: cropping those frames cuts the content in half.
        mode = "blur"

    samples = _resample_and_smooth(raw, duration, max_x, center_x)
    steps = [abs(samples[i + 1][1] - samples[i][1]) for i in range(len(samples) - 1)]
    biggest = max(steps) if steps else 0

    log(
        f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s faces in {face_ratio * 100:.0f}% "
        f"of frames -> {mode}, path {len(samples)} frames, max step {biggest:.0f}px"
    )
    return {
        "mode": mode,
        "crop_w": crop_w,
        "crop_h": crop_h,
        "scaled_w": sw,
        "samples": samples,
        "target": [(round(t, 3), round(x, 1)) for t, x in raw if x is not None],
        "face_ratio": round(face_ratio, 3),
        "reason": f"faces in {face_ratio * 100:.0f}% of sampled frames",
    }


def write_sendcmd(samples: list[tuple[float, int]], path: Path) -> Path:
    """Write an ffmpeg sendcmd script that moves the crop window every frame.

    Timestamps are written with microsecond precision and nudged a hair early.
    Millisecond rounding makes a command land one frame late every few frames,
    which shows up as a visible stutter.
    """
    lines = []
    for t, x in samples:
        stamp = max(0.0, float(t) - 1e-4)
        lines.append(f"{stamp:.6f} [enter] crop x {x};")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def static_x(samples: list[tuple[float, int]], fallback: int = 0) -> int:
    if not samples:
        return fallback
    values = sorted(x for _, x in samples)
    return values[len(values) // 2]
