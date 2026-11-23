"""Smoke test for the HTTP API: upload a file, poll, print the manifest."""

import json
import sys
import time
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8000"
video = Path(sys.argv[1] if len(sys.argv) > 1 else "test/moving.mp4")

for _ in range(60):
    try:
        health = requests.get(f"{BASE}/api/health", timeout=2)
        break
    except requests.RequestException:
        time.sleep(1)
else:
    raise SystemExit("server did not start")

print("health:", health.status_code, health.text)
print("config:", json.dumps(requests.get(f"{BASE}/api/config", timeout=5).json(), indent=2))

with video.open("rb") as handle:
    res = requests.post(
        f"{BASE}/api/jobs/upload",
        files={"file": (video.name, handle, "video/mp4")},
        data={"num_clips": "1", "min_sec": "15", "max_sec": "20", "caption_style": "hormozi"},
        timeout=300,
    )
res.raise_for_status()
job_id = res.json()["id"]
print("job:", job_id)

for _ in range(240):
    job = requests.get(f"{BASE}/api/jobs/{job_id}", timeout=5).json()
    print(f"  {job['status']:12s} {job.get('progress', 0):5.1f}%  {job.get('message')}")
    if job["status"] in ("done", "error"):
        break
    time.sleep(2)

print("final status:", job["status"], job.get("error"))
for clip in job.get("clips", []):
    print("  clip:", clip["video"], clip["duration"], "s")
    media = requests.get(f"{BASE}/media/{job_id}/{clip['video']}", timeout=30)
    print("  media:", media.status_code, len(media.content), "bytes")
