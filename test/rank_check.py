"""Print the heuristic ranking for an existing transcript (fast iteration)."""

import json
import sys

from clipping import highlights
from clipping.config import settings_for

transcript = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "data/jobs/test1/transcript.json", encoding="utf-8"))
clips = highlights.select_clips(transcript, settings_for(num_clips=3, min_sec=15, max_sec=45), progress=None)
for clip in clips:
    print(f"{clip['start']:6.1f}-{clip['end']:6.1f}  score {clip['score']:3d}  {clip['title']}")
    print(f"        hook: {clip['hook']}")
