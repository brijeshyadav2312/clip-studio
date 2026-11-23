"""Face-aware vertical reframing.

Samples the clip, finds faces, and produces a smoothed horizontal crop path.
The path is written as an ffmpeg `sendcmd` script so the crop follows the
active speaker without a per-frame Python render loop.
"""

from __future__ import annotations

from pathlib import Path

from .config import DATA_DIR, Settings
from .utils import clamp, log

SAMPLE_FPS = 4.0
EMA = 0.25
DEADBAND_PX = 10
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
                self.yunet = cv2.FaceDetectorYN_create(str(model), "", (640, 360), 0.6, 0.3, 5000)
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

    def detect(self, frame) -> list[tuple[int, int, int, int]]:
        """Return face boxes in the coordinate space of `frame`."""
        cv2 = self.cv2
        h, w = frame.shape[:2]
        boxes: list[tuple[int, int, int, int]] = []

        if self.kind == "yunet":
            self.yunet.setInputSize((w, h))
            _, faces = self.yunet.detect(frame)
            if faces is not None:
                for face in faces:
                    x, y, fw, fh = (int(v) for v in face[:4])
                    if fw > 8 and fh > 8:
                        boxes.append((x, y, fw, fh))
            return boxes

        if self.kind == "haar":
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            for cascade in self.cascades:
                found = cascade.detectMultiScale(gray, scaleFactor=1.12, minNeighbors=5, minSize=(36, 36))
                for (x, y, fw, fh) in found:
                    boxes.append((int(x), int(y), int(fw), int(fh)))
                if boxes:
                    break
        return boxes


def _pick_center(faces, crop_w_src: float, prev_x: float | None) -> float | None:
    """Return the crop-centre in source pixels, preferring a group of faces."""
    if not faces:
        return None
    by_area = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    union_left = min(f[0] for f in by_area)
    union_right = max(f[0] + f[2] for f in by_area)
    if (union_right - union_left) <= crop_w_src * 0.92:
        return (union_left + union_right) / 2.0
    if prev_x is not None:
        # Keep tracking whoever we were already on.
        by_area.sort(key=lambda f: abs((f[0] + f[2] / 2) - prev_x))
    x, _, w, _ = by_area[0]
    return x + w / 2.0


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

    crop_h_src = float(src_h)
    crop_w_src = src_h * ratio
    scale = 1920.0 / src_h
    sw = int(round(src_w * scale / 2) * 2)
    crop_w, crop_h = 1080, 1920

    # Already at (or narrower than) the target ratio: nothing to crop horizontally.
    if src_ratio <= ratio * 1.02:
        return {"mode": "blur", "crop_w": src_w, "crop_h": src_h, "scaled_w": sw,
                "samples": [], "face_ratio": 0.0, "reason": "source is already vertical"}

    samples: list[tuple[float, int]] = []
    hits = 0
    frames = 0
    prev_x: float | None = None
    smooth_x: float | None = None

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
            if w > 640:
                small = cv2.resize(frame, (640, int(h * 640 / w)), interpolation=cv2.INTER_AREA)
                factor = w / 640.0
            else:
                small = frame
                factor = 1.0
            faces = [(int(x * factor), int(y * factor), int(fw * factor), int(fh * factor))
                     for (x, y, fw, fh) in detector.detect(small)]
            if faces:
                hits += 1

            center = _pick_center(faces, crop_w_src, prev_x)
            if center is None:
                center = prev_x if prev_x is not None else src_w / 2.0
            prev_x = center

            if smooth_x is None:
                smooth_x = center
            else:
                smooth_x = smooth_x + EMA * (center - smooth_x)

            x = clamp(smooth_x * scale - crop_w / 2.0, 0, sw - crop_w)
            samples.append((t, int(x)))

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

    # Deadband + even pixels to stop micro-jitter.
    cleaned: list[tuple[float, int]] = []
    last = None
    for t, x in samples:
        if last is not None and abs(x - last) < DEADBAND_PX:
            x = last
        x = int(x // 2 * 2)
        cleaned.append((round(t, 3), x))
        last = x

    log(f"[reframe] {clip_start:.1f}s-{clip_end:.1f}s faces in {face_ratio * 100:.0f}% of frames -> {mode}")
    return {
        "mode": mode,
        "crop_w": crop_w,
        "crop_h": crop_h,
        "scaled_w": sw,
        "samples": cleaned,
        "face_ratio": round(face_ratio, 3),
        "reason": f"faces in {face_ratio * 100:.0f}% of sampled frames",
    }


def write_sendcmd(samples: list[tuple[float, int]], path: Path) -> Path:
    """Write an ffmpeg sendcmd script that moves the crop window over time."""
    lines = [f"{t:.3f} [enter] crop x {x};" for t, x in samples]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def static_x(samples: list[tuple[float, int]], fallback: int = 0) -> int:
    if not samples:
        return fallback
    values = sorted(x for _, x in samples)
    return values[len(values) // 2]
