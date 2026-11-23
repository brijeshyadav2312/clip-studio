"""Command line interface: python -m clipping.cli <url-or-file> [options]"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from . import pipeline
from .config import DATA_DIR, Settings, settings_for
from .utils import ToolError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="clip",
        description="Turn a long video into vertical captioned shorts.",
    )
    parser.add_argument("source", help="YouTube URL or path to a local video file")
    parser.add_argument("--clips", type=int, default=None, help="number of clips (default 5)")
    parser.add_argument("--min", dest="min_sec", type=float, default=None, help="minimum clip seconds")
    parser.add_argument("--max", dest="max_sec", type=float, default=None, help="maximum clip seconds")
    parser.add_argument("--layout", choices=["auto", "crop", "blur"], default=None)
    parser.add_argument("--style", choices=["wordpop", "karaoke", "hormozi", "clean"], default=None)
    parser.add_argument("--censor", action="store_true", help="mask and mute profanity")
    parser.add_argument("--hook", default=None, help="force this on-screen hook text")
    parser.add_argument("--out", default=None, help="output folder (default data/jobs/<timestamp>)")
    args = parser.parse_args(argv)

    settings = settings_for(
        num_clips=args.clips,
        min_sec=args.min_sec,
        max_sec=args.max_sec,
        layout=args.layout,
        caption_style=args.style,
    )

    job_dir = Path(args.out) if args.out else DATA_DIR / "jobs" / time.strftime("cli-%Y%m%d-%H%M%S")
    job_dir.mkdir(parents=True, exist_ok=True)

    source = args.source
    url = None
    upload = None
    if source.lower().startswith(("http://", "https://")):
        url = source
    else:
        upload = Path(source).expanduser()
        if not upload.exists():
            print(f"File not found: {upload}", file=sys.stderr)
            return 2

    last = {"pct": -1.0}

    def report(status: str, pct: float, message: str) -> None:
        if abs(pct - last["pct"]) < 0.4 and status != "done":
            return
        last["pct"] = pct
        bar = int(pct / 100 * 28)
        print(f"\r[{'#' * bar}{'.' * (28 - bar)}] {pct:5.1f}%  {message[:60]:<60}", end="", flush=True)

    print(f"Output: {job_dir}")
    try:
        manifest = pipeline.process(job_dir, settings, report=report, url=url, upload=upload,
                                    hook_override=args.hook, censor=args.censor)
    except ToolError as exc:
        print(f"\nFailed: {exc}", file=sys.stderr)
        return 1

    print("\n")
    for clip in manifest.get("clips", []):
        print(f"  {clip['id']}  {clip['duration']:5.1f}s  score {clip['score']:3d}  {clip['title']}")
        print(f"        {job_dir / clip['video']}")
    print(f"\n{len(manifest.get('clips', []))} clips in {job_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
