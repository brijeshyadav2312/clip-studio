import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  MoveVertical,
  Type,
  Scissors,
  Crop,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  FileText,
  Flame,
  Check,
  Palette,
  Film,
  ChevronDown,
  Layers,
  Zap,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

const PRESETS = [
  {
    id: 'hormozi',
    name: 'Hormozi 3D Pop',
    desc: '1-2 words, massive 3D scale pop, thick black stroke outline',
    font: 'Impact',
    fontSize: 84,
    primaryColor: '#FFFFFF',
    activeColor: '#00FF66',
    uppercase: true,
    wordsPerGroup: 2,
    badge: 'Viral',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'boxed',
    name: 'Boxed Highlighter',
    desc: 'Angled yellow marker box on active words, glass pill backdrop',
    font: 'Arial Black',
    fontSize: 66,
    primaryColor: '#FFFFFF',
    activeColor: '#000000',
    boxColor: '#FFE600',
    uppercase: true,
    wordsPerGroup: 3,
    badge: 'High Retention',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'neon',
    name: 'Cyberpunk Neon',
    desc: 'Futuristic glowing card container with cyan/magenta bloom',
    font: 'Impact',
    fontSize: 74,
    primaryColor: '#00FFFF',
    activeColor: '#FF00FF',
    uppercase: true,
    wordsPerGroup: 3,
    badge: 'Trending',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'karaoke',
    name: 'Karaoke Glow',
    desc: 'Words smoothly light up into warm gold in a frosted dark pill',
    font: 'Montserrat',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    activeColor: '#FFDD00',
    uppercase: false,
    wordsPerGroup: 4,
    badge: 'Lyric Style',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
  {
    id: 'comic',
    name: 'Comic Cartoon',
    desc: 'Cartoon pop styling with 4px ink border and bouncy sticker tilt',
    font: 'Trebuchet MS',
    fontSize: 76,
    primaryColor: '#FFF01F',
    activeColor: '#FF2A6D',
    uppercase: true,
    wordsPerGroup: 3,
    badge: 'Playful',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    id: 'beast',
    name: 'MrBeast Punch',
    desc: 'Energetic gold punch zoom snapping on every spoken word',
    font: 'Impact',
    fontSize: 88,
    primaryColor: '#FFFFFF',
    activeColor: '#FFD700',
    uppercase: true,
    wordsPerGroup: 2,
    badge: 'Punchy',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'clean',
    name: 'Cinematic Minimal',
    desc: 'Understated frosted glass pill with elegant sans typography',
    font: 'Rubik',
    fontSize: 54,
    primaryColor: '#FFFFFF',
    activeColor: '#F59E0B',
    uppercase: false,
    wordsPerGroup: 5,
    badge: 'Clean',
    badgeColor: 'bg-white/10 text-white/80 border-white/20',
  },
];

const FONTS = [
  'Arial Black',
  'Impact',
  'Montserrat',
  'Rubik',
  'Oswald',
  'Trebuchet MS',
  'sans-serif',
];

const SWATCHES = [
  '#FFFFFF',
  '#00FF66',
  '#FFDD00',
  '#00E5FF',
  '#FF2A6D',
  '#FFAA00',
  '#A855F7',
  '#000000',
];

export default function CustomizerView({
  jobs = [],
  activeJob = null,
  selectedClipInfo = null,
  onNavigateToGenerator,
}) {
  // Aggregate all available clips across current job and history
  const allClips = useMemo(() => {
    const list = [];
    // 1. Current active job clips first
    if (activeJob && Array.isArray(activeJob.clips)) {
      activeJob.clips.forEach((c) => {
        list.push({ ...c, jobId: activeJob.id });
      });
    }
    // 2. All finished jobs clips
    if (Array.isArray(jobs)) {
      jobs.forEach((j) => {
        if (j.id === activeJob?.id) return;
        if (Array.isArray(j.clips)) {
          j.clips.forEach((c) => {
            list.push({ ...c, jobId: j.id });
          });
        }
      });
    }
    return list;
  }, [jobs, activeJob]);

  // Determine which clip to select by default (latest generated clip)
  const [currentClip, setCurrentClip] = useState(() => {
    if (selectedClipInfo?.clip) {
      return { ...selectedClipInfo.clip, jobId: selectedClipInfo.jobId || selectedClipInfo.clip.jobId };
    }
    return allClips[0] || null;
  });

  // When selectedClipInfo changes from parent (e.g. user clicked Edit on a card)
  useEffect(() => {
    if (selectedClipInfo?.clip) {
      setCurrentClip({
        ...selectedClipInfo.clip,
        jobId: selectedClipInfo.jobId || selectedClipInfo.clip.jobId,
      });
    } else if (!currentClip && allClips.length > 0) {
      setCurrentClip(allClips[0]);
    }
  }, [selectedClipInfo, allClips]);

  // Video element and playback state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Cache-buster for the burned export download link.
  const [burnedAt, setBurnedAt] = useState(0);
  const [duration, setDuration] = useState(30);
  const [isMuted, setIsMuted] = useState(false);

  // Inspector active tab: 'presets' | 'placement' | 'typography' | 'hook' | 'framing'
  const [activeTab, setActiveTab] = useState('presets');

  // Caption plan from the server: the same grouping, line breaks and timings
  // the export burns, so the preview is what you get.
  const [captionPlan, setCaptionPlan] = useState(null);
  const [planState, setPlanState] = useState('idle'); // idle | loading | error
  const [planError, setPlanError] = useState(null);
  // Caption-free master state: the editor can only overlay text on a clean video.
  const [cleanState, setCleanState] = useState('idle'); // idle | preparing | ready | unavailable
  const [cleanError, setCleanError] = useState(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const frameRef = useRef(null);
  const playedOnceRef = useRef(false);

  // Live customization parameters (Changes update INSTANTLY in the video overlay)
  const [captionStyle, setCaptionStyle] = useState('hormozi');
  const [captionPosition, setCaptionPosition] = useState('bottom');
  const [verticalPercent, setVerticalPercent] = useState(18); // % from bottom
  const [font, setFont] = useState('Impact');
  const [fontSize, setFontSize] = useState(82);
  const [primaryColor, setPrimaryColor] = useState('#FFFFFF');
  const [activeColor, setActiveColor] = useState('#00FF66');
  const [uppercase, setUppercase] = useState(true);
  const [hook, setHook] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [framing, setFraming] = useState('crop');

  // One source of truth for where captions sit. 1920 is the export height, so
  // these numbers are read straight off the same grid the burn uses.
  const marginV = useMemo(() => {
    if (captionPosition === 'top') return 1500;
    if (captionPosition === 'divider') return 780;
    if (captionPosition === 'middle') return 860;
    if (captionPosition === 'bottom') return 300;
    return Math.round((verticalPercent / 100) * 1920);
  }, [captionPosition, verticalPercent]);

  // Sent to the caption planner; identical to what the export sends, which is
  // what keeps the preview and the burned file in agreement.
  const styleRequest = useMemo(() => ({
    caption_style: captionStyle,
    caption_position: captionPosition,
    margin_v: marginV,
    font,
    font_size: fontSize,
    primary_color: primaryColor,
    active_color: activeColor,
    uppercase,
    hook,
  }), [captionStyle, captionPosition, marginV, font, fontSize, primaryColor, activeColor, uppercase, hook]);


  // Burn-in export state (optional)
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Synchronize clip metadata into state when currentClip changes
  useEffect(() => {
    if (!currentClip) return;
    setHook(currentClip.hook || '');
    setTrimStart(currentClip.start || 0);
    setTrimEnd(currentClip.end || (currentClip.start || 0) + (currentClip.duration || 30));
    setDuration(currentClip.duration || ((currentClip.end || 0) - (currentClip.start || 0)) || 30);
    if (currentClip.reframe?.mode) setFraming(currentClip.reframe.mode);
    if (currentClip.caption_style) {
      const match = PRESETS.find((p) => p.id === currentClip.caption_style);
      if (match) applyPreset(match);
    }

  }, [currentClip]);

  // 1. Make sure this clip has a caption-free master. Older clips were rendered
  //    with captions burned in; overlaying a new style on them showed both.
  useEffect(() => {
    if (!currentClip) return;
    const jobId = currentClip.jobId;
    const clipSlug = currentClip.slug || String(currentClip.filename).replace(/\.mp4$/i, '');
    if (!jobId || !clipSlug) {
      setCleanState('unavailable');
      return;
    }
    if (currentClip.clean_url) {
      setCleanState('ready');
      setCleanError(null);
      return;
    }
    let cancelled = false;
    setCleanState('preparing');
    setCleanError(null);
    fetch(`/api/jobs/${jobId}/clips/${clipSlug}/clean`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Could not prepare the caption-free preview');
        if (cancelled) return;
        if (data.clip) setCurrentClip({ ...data.clip, jobId });
        setCleanState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setCleanError(err.message);
        setCleanState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [currentClip?.slug, currentClip?.jobId, currentClip?.clean_url]);

  // 2. Keep the video clock frame-accurate. `timeupdate` fires ~4x a second,
  //    which made word highlights visibly trail the audio.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) setCurrentTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    if (isPlaying) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // 3. Measure the frame so caption type is sized against the 1080px export grid.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 0;
      if (w) setFrameWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentClip]);

  // 4. Ask the server for caption events whenever the style changes.
  useEffect(() => {
    if (!currentClip || cleanState !== 'ready') return;
    const jobId = currentClip.jobId;
    const clipSlug = currentClip.slug || String(currentClip.filename).replace(/\.mp4$/i, '');
    if (!jobId || !clipSlug) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPlanState('loading');
      fetch(`/api/jobs/${jobId}/clips/${clipSlug}/caption-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(styleRequest),
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || 'Could not build caption preview');
          setCaptionPlan(data);
          setPlanState('idle');
          setPlanError(null);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setPlanError(err.message);
          setPlanState('error');
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentClip?.slug, currentClip?.jobId, cleanState, styleRequest]);

  const rawFilename = currentClip?.filename || `${currentClip?.slug || 'clip'}.mp4`;
  const filename = rawFilename.endsWith('.mp4') ? rawFilename : `${rawFilename}.mp4`;
  const srtFilename = filename.replace(/\.mp4$/i, '.srt');
  const resolvedJobId = currentClip?.jobId || '';
  // Preview the caption-free master when available; captions come only from the
  // live overlay, so changing the style never shows an old burn underneath.
  const rawClean = currentClip?.clean_url || currentClip?.clean_video || '';
  const previewUrl = rawClean
    ? (rawClean.startsWith('http') || rawClean.startsWith('/media')
        ? rawClean
        : `/media/${resolvedJobId}/${rawClean}`)
    : '';
  const rawVideo = currentClip?.url || currentClip?.video || '';
  const burnedUrl = rawVideo.startsWith('http') || rawVideo.startsWith('/media')
    ? rawVideo
    : `/media/${resolvedJobId}/${currentClip?.video || `clips/${filename}`}`;
  const videoUrl = previewUrl || burnedUrl;
  const rawSrt = currentClip?.srt_url || currentClip?.srt || '';
  const srtUrl = rawSrt.startsWith('http') || rawSrt.startsWith('/media')
    ? rawSrt
    : `/media/${resolvedJobId}/${currentClip?.srt || `clips/${srtFilename}`}`;

  // Time update listener
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  // Preset switch
  const applyPreset = (preset) => {
    setCaptionStyle(preset.id);
    setFont(preset.font);
    setFontSize(preset.fontSize);
    setPrimaryColor(preset.primaryColor);
    setActiveColor(preset.activeColor);
    setUppercase(preset.uppercase);
  };

  const handleReset = () => {
    applyPreset(PRESETS[0]);
    setCaptionPosition('bottom');
    setVerticalPercent(18);
    setHook(currentClip?.hook || '');
  };

  // Export / Burn-in MP4
  const handleExportBurnedIn = async () => {
    if (!currentClip) return;
    setIsExporting(true);
    setExportMessage(null);
    const clipSlug = currentClip.slug || String(currentClip.filename).replace(/\.mp4$/i, '');
    const jobId = currentClip.jobId;

    const payload = {
      caption_style: captionStyle,
      caption_position: captionPosition,
      margin_v: marginV,
      font: font,
      font_size: fontSize,
      primary_color: primaryColor,
      active_color: activeColor,
      uppercase: uppercase,
      hook: hook,
      start: trimStart,
      end: trimEnd,
      framing: framing,
    };

    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipSlug}/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Export failed');
      // Bump the burned file's URL so the browser drops the cached old render.
      setBurnedAt(Date.now());
      setCurrentClip(data.clip);
      setExportMessage('✓ Burned-in MP4 exported successfully!');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setExportMessage(`⚠️ ${err.message || 'Error exporting'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Active caption event + active word, straight from the server plan.
  const activeGroup = useMemo(() => {
    if (!captionPlan?.groups?.length) return null;
    return (
      captionPlan.groups.find(
        (grp) => currentTime >= grp.start - 0.03 && currentTime < grp.end + 0.06
      ) || null
    );
  }, [captionPlan, currentTime]);

  const activeWords = useMemo(() => {
    if (!activeGroup) return null;
    const flat = activeGroup.lines.flat();
    let activeIdx = flat.findIndex((w) => currentTime >= w.start - 0.02 && currentTime < w.end);
    if (activeIdx < 0) activeIdx = 0;
    return { flat, activeIdx };
  }, [activeGroup, currentTime]);

  // Export sizes are authored on a 1080px-wide frame; scale them to the preview.
  const captionSize = captionPlan && frameWidth
    ? Math.max(7, (captionPlan.size * frameWidth) / 1080)
    : 0;
  const captionOutline = captionPlan && frameWidth
    ? Math.max(0.8, (captionPlan.outline * frameWidth) / 1080)
    : 0;

  // Fall back to shrinking a line that would overflow the frame (missing font
  // or an unusually long word), instead of letting it spill over the edges.
  const captionTextRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    setFitScale(1);
  }, [activeGroup?.start, captionSize, captionPlan?.font]);
  useEffect(() => {
    const node = captionTextRef.current;
    const frame = frameRef.current;
    if (!node || !frame || !captionSize) return;
    const available = frame.clientWidth * 0.94;
    const used = node.scrollWidth;
    if (used > available && used > 0) {
      const next = Math.max(0.55, (available / used) * fitScale);
      if (next < fitScale - 0.01) setFitScale(next);
    }
  }, [activeGroup, captionSize, captionPlan?.font, fitScale]);

  // If no clips exist anywhere in the app
  if (!currentClip) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-paper2 border border-rule flex items-center justify-center text-muted">
          <Film size={28} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-ink">No Generated Clips Available</h3>
          <p className="text-xs text-muted leading-relaxed">
            Generate your first vertical short clip to start customizing styles, placement, and subtitles in real time.
          </p>
        </div>
        {onNavigateToGenerator && (
          <button
            type="button"
            onClick={onNavigateToGenerator}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] text-white text-xs font-bold shadow-lg transition-all hover:brightness-110 cursor-pointer"
          >
            Create New Short
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      {/* Top Studio Control Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-rule bg-[#0d0f14] flex items-center justify-between shrink-0 gap-3">
        {/* Left: Active Short Selector Dropdown */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider hidden sm:inline">
            Active Short:
          </span>

          <div className="relative">
            <select
              value={currentClip.filename || currentClip.slug}
              onChange={(e) => {
                const found = allClips.find(
                  (c) => (c.filename || c.slug) === e.target.value
                );
                if (found) setCurrentClip(found);
              }}
              className="appearance-none bg-paper2 hover:bg-paper3 border border-rule focus:border-[#ba6238] rounded-xl py-1.5 pl-3 pr-8 text-xs font-semibold text-white focus:outline-none transition-colors cursor-pointer max-w-[220px] sm:max-w-xs truncate"
            >
              {allClips.map((c, i) => (
                <option key={i} value={c.filename || c.slug} className="bg-[#141822]">
                  {c.title || c.hook || c.filename || `Clip #${i + 1}`} ({Math.round(c.duration || 30)}s)
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>

          <span className="pill pill-ok text-[11px] font-mono font-semibold hidden md:inline-flex items-center gap-1">
            <Zap size={11} /> 100% Live Mode (Instant)
          </span>
        </div>

        {/* Right: Quick Reset & Download Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-paper2 hover:bg-paper3 border border-rule text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to default settings"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <a
            href={`${burnedUrl}${burnedUrl.includes('?') ? '&' : '?'}v=${burnedAt}`}
            download={filename}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ba6238] to-[#d47345] hover:from-[#c96a3d] hover:to-[#df7d4f] text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download this MP4 short"
          >
            <Download size={13} />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Main Studio Split Workbench */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center: Interactive 9:16 Video Player with Live Caption Overlay */}
        <div className="w-full lg:w-[48%] xl:w-[45%] p-4 sm:p-6 bg-[#07090d] flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-rule relative overflow-hidden">
          {/* 9:16 Portrait Canvas Frame */}
          <div
            ref={frameRef}
            className="relative aspect-[9/16] w-full max-w-[300px] h-auto sm:max-w-none sm:h-[420px] md:h-[480px] lg:h-[520px] max-h-full rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl flex items-center justify-center group"
          >
            <video
              ref={videoRef}
              src={videoUrl}
              preload="auto"
              loop
              muted={isMuted}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              className="w-full h-full object-cover cursor-pointer"
            />

            {/* Hook headline: same box, size and offset as the burn */}
            {cleanState === 'ready' && captionPlan?.hook && currentTime < captionPlan.hook_end && (
              <div
                className="absolute inset-x-0 z-30 pointer-events-none flex justify-center px-2"
                style={{ top: `${(captionPlan.margin_hook / 1920) * 100}%` }}
              >
                <p
                  className="text-center text-white"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    fontFamily: `"${captionPlan.font}", Impact, "Arial Black", sans-serif`,
                    fontWeight: 900,
                    fontSize: `${Math.max(8, (72 * frameWidth) / 1080)}px`,
                    lineHeight: 1.12,
                    padding: `${Math.max(2, frameWidth * 0.012)}px ${Math.max(4, frameWidth * 0.02)}px`,
                    maxWidth: '92%',
                  }}
                >
                  {captionPlan.hook.split('\\N').map((part, i) => (
                    <span key={i} className="block">
                      {part}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {/* Preparing / unavailable notice */}
            {cleanState === 'preparing' && (
              <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
                <div className="flex items-center gap-2 rounded-lg bg-black/85 px-3 py-2 text-[11px] text-amber-200 border border-amber-400/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Building a caption-free preview…
                </div>
              </div>
            )}
            {cleanState === 'unavailable' && (
              <div className="absolute inset-x-0 bottom-3 z-30 px-3">
                <div className="rounded-lg bg-black/90 px-3 py-2 text-[11px] leading-snug text-amber-200 border border-amber-400/30">
                  {cleanError || 'No caption-free preview for this clip.'} Re-run the job to edit its captions.
                </div>
              </div>
            )}
            {planState === 'loading' && cleanState === 'ready' && (
              <div className="absolute top-0 inset-x-0 z-30 p-3 flex justify-center pointer-events-none">
                <span className="rounded-md bg-black/80 px-2.5 py-1 text-[10px] text-white/80 whitespace-nowrap">
                  Updating captions…
                </span>
              </div>
            )}
            {planState === 'error' && (
              <div className="absolute inset-x-0 bottom-3 z-30 px-3">
                <div className="rounded-lg bg-red-950/90 px-3 py-2 text-[11px] text-red-200 border border-red-500/40">
                  {planError}
                </div>
              </div>
            )}

            {/* LIVE CAPTION OVERLAY - rendered from the same plan the export burns */}
            {cleanState === 'ready' && captionPlan && activeGroup && captionSize > 0 && (
              <div
                className="absolute inset-x-0 z-20 pointer-events-none flex justify-center"
                style={{ bottom: `${(captionPlan.margin_v / 1920) * 100}%` }}
              >
                <div
                  key={activeGroup.start}
                  ref={captionTextRef}
                  className="caption-pop"
                  style={{
                    maxWidth: '94%',
                    textAlign: 'center',
                    fontFamily: `"${captionPlan.font}", Impact, "Arial Black", sans-serif`,
                    fontWeight: 900,
                    fontSize: `${captionSize * fitScale}px`,
                    lineHeight: 1.04,
                    letterSpacing: '0.01em',
                    color: captionPlan.primary_hex,
                    WebkitTextStroke: `${captionOutline}px #000000`,
                    paintOrder: 'stroke fill',
                    textShadow: `0 ${captionOutline * 0.7}px 0 #000000`,
                  }}
                >
                  {activeGroup.lines.map((line, li) => {
                    const offset = activeGroup.lines
                      .slice(0, li)
                      .reduce((n, l) => n + l.length, 0);
                    return (
                      <div
                        key={li}
                        className="flex items-center justify-center"
                        style={{ gap: `${captionSize * fitScale * 0.26}px` }}
                      >
                        {line.map((word, wi) => {
                          const isActive = activeWords && offset + wi === activeWords.activeIdx;
                          return (
                            <span
                              key={`${word.start}-${wi}`}
                              style={{
                                color: isActive
                                  ? captionPlan.active_fill_hex
                                  : captionPlan.primary_hex,
                                WebkitTextStroke: `${Math.max(
                                  0.8,
                                  ((isActive
                                    ? captionPlan.active_stroke
                                    : captionPlan.outline) * frameWidth) / 1080
                                )}px ${isActive ? captionPlan.active_stroke_hex : '#000000'}`,
                                whiteSpace: 'nowrap',
                                transition: 'color 90ms linear',
                              }}
                            >
                              {word.text}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Center Play Overlay Icon */}
            {!isPlaying && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/50 transition-colors cursor-pointer z-10"
              >
                <div className="w-14 h-14 rounded-full bg-black/70 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform">
                  <Play size={24} className="fill-white ml-0.5" />
                </div>
              </div>
            )}

            {/* Corner Audio Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/80 hover:text-white transition-all z-30 cursor-pointer"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>

          {/* Video Scrub Timeline */}
          <div className="w-full max-w-[320px] mt-3.5 space-y-1.5">
            <input
              type="range"
              min="0"
              max={duration || 30}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#ba6238]"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {currentTime.toFixed(1)}s
              </span>
              <span>{duration.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* Right Column: Studio Inspector Panel with Live Tabs */}
        <div className="w-full lg:w-[52%] xl:w-[55%] flex flex-col bg-[#0f1218] overflow-hidden">
          {/* Sub-Tabs Nav */}
          <div className="flex items-center gap-1 p-2 sm:p-3 border-b border-rule bg-[#131720] overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'presets', label: 'Caption Styles', icon: Sparkles },
              { id: 'placement', label: 'Placement', icon: MoveVertical },
              { id: 'typography', label: 'Style & Color', icon: Type },
              { id: 'hook', label: 'Hook & Headline', icon: Flame },
              { id: 'framing', label: 'Framing', icon: Crop },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    active
                      ? 'bg-[#a8542c] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Inspector Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* TAB 1: PRESETS (Truly Distinct Visual Styles) */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#ba6238]" />
                    <span>Choose Caption Visual Preset</span>
                  </h3>
                  <span className="text-[11px] text-white/50">Changes apply live</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESETS.map((p) => {
                    const isSelected = captionStyle === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#a8542c]/15 border-[#ba6238] ring-1 ring-[#ba6238]'
                            : 'bg-[rgba(255,255,255,0.03)] hover:bg-white/[0.07] border-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2 min-w-0">
                              <span className="truncate">{p.name}</span>
                              {isSelected && <Check size={14} className="text-[#ba6238] stroke-[3] shrink-0" />}
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${p.badgeColor}`}>
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/60 mt-1 leading-snug">{p.desc}</p>
                        </div>

                        {/* Distinct Visual Preview Snippet */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-wrap items-center justify-center gap-2 text-xs font-black overflow-hidden">
                          {p.id === 'hormozi' && (
                            <>
                              <span className="text-white" style={{ WebkitTextStroke: '1px black' }}>YOU</span>
                              <span className="text-[#00FF66] scale-110 -rotate-2" style={{ WebkitTextStroke: '1px black' }}>CANNOT</span>
                              <span className="text-white" style={{ WebkitTextStroke: '1px black' }}>LOSE</span>
                            </>
                          )}
                          {p.id === 'boxed' && (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-black/60 text-white">THE</span>
                              <span className="px-2 py-0.5 rounded bg-[#FFE600] text-black font-black -rotate-2">SECRET</span>
                              <span className="px-1.5 py-0.5 rounded bg-black/60 text-white">IS</span>
                            </>
                          )}
                          {p.id === 'neon' && (
                            <span className="text-cyan-300 font-extrabold text-shadow-[0_0_8px_#00ffff]">
                              CYBER <span className="text-fuchsia-400 text-shadow-[0_0_12px_#ff00ff]">FUTURE</span>
                            </span>
                          )}
                          {p.id === 'karaoke' && (
                            <>
                              <span className="text-white/40">Watch</span>
                              <span className="text-yellow-400 font-bold underline">this right</span>
                              <span className="text-white/40">now</span>
                            </>
                          )}
                          {p.id === 'comic' && (
                            <span className="text-yellow-300 font-black" style={{ WebkitTextStroke: '1.5px black' }}>
                              BOOM! <span className="text-rose-500">POW</span>
                            </span>
                          )}
                          {p.id === 'beast' && (
                            <span className="text-white font-black" style={{ WebkitTextStroke: '1.5px black' }}>
                              100 MILLION <span className="text-[#FFD700]">DOLLARS</span>
                            </span>
                          )}
                          {p.id === 'clean' && (
                            <span className="inline-flex items-center justify-center whitespace-nowrap leading-normal text-white/80 font-medium px-3 py-1 rounded-full bg-white/10 text-[11px]">
                              Cinematic subtitle flow
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: PLACEMENT */}
            {activeTab === 'placement' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Caption Placement & Safe Zones
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    Select standard social media safe zones or slide to any vertical height
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'bottom', label: 'Bottom (18%)', desc: 'Standard lower third', pct: 18 },
                    { id: 'middle', label: 'Middle (48%)', desc: 'Center of screen', pct: 48 },
                    { id: 'divider', label: 'Divider (40%)', desc: 'Under streamer split', pct: 40 },
                    { id: 'top', label: 'Top (82%)', desc: 'Headline position', pct: 82 },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => {
                        setCaptionPosition(pos.id);
                        setVerticalPercent(pos.pct);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        captionPosition === pos.id
                          ? 'bg-[#a8542c]/20 border-[#ba6238] text-white font-bold ring-1 ring-[#ba6238]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-semibold">{pos.label}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{pos.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Continuous Vertical Position</span>
                    <span className="font-mono text-[#ba6238] font-bold">{verticalPercent}% from bottom</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="85"
                    value={verticalPercent}
                    onChange={(e) => {
                      setVerticalPercent(parseInt(e.target.value, 10));
                      setCaptionPosition('custom');
                    }}
                    className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#ba6238]"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 font-mono">
                    <span>10% (Bottom)</span>
                    <span>48% (Center)</span>
                    <span>85% (Top)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TYPOGRAPHY & COLORS */}
            {activeTab === 'typography' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                      Font Family
                    </label>
                    <select
                      value={font}
                      onChange={(e) => setFont(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-[#ba6238]"
                    >
                      {FONTS.map((f) => (
                        <option key={f} value={f} className="bg-[#141822] text-white">
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-white uppercase tracking-wider">
                      <span>Font Size</span>
                      <span className="font-mono text-[#ba6238]">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="44"
                      max="108"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      className="w-full h-2 mt-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#ba6238]"
                    />
                  </div>
                </div>

                {/* Color Palettes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Active Highlight Color */}
                  <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Palette size={13} className="text-[#ba6238]" />
                        <span>Active Highlight Color</span>
                      </label>
                      <span className="text-[11px] font-mono text-white/60">{activeColor}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setActiveColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                            activeColor.toUpperCase() === hex.toUpperCase()
                              ? 'border-white scale-110 shadow-lg ring-2 ring-[#ba6238]'
                              : 'border-white/20 hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Base Text Color */}
                  <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Palette size={13} className="text-white/60" />
                        <span>Base Text Color</span>
                      </label>
                      <span className="text-[11px] font-mono text-white/60">{primaryColor}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SWATCHES.slice(0, 5).map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setPrimaryColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                            primaryColor.toUpperCase() === hex.toUpperCase()
                              ? 'border-white scale-110 shadow-lg ring-2 ring-white/50'
                              : 'border-white/20 hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Uppercase Switch */}
                <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">UPPERCASE Text</p>
                    <p className="text-[11px] text-white/50">
                      Force all words into clean capital letters for high readability
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUppercase(!uppercase)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      uppercase ? 'bg-[#a8542c]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        uppercase ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: HOOK & HEADLINE */}
            {activeTab === 'hook' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Flame size={13} className="text-[#ba6238]" />
                    <span>Opening Hook Headline</span>
                  </label>
                  <p className="text-xs text-white/50">
                    High-contrast headline badge that flashes at the top during the first 3 seconds
                  </p>
                  <input
                    type="text"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    placeholder="e.g. Wait until you see the ending..."
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-[#ba6238]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-white">Hook Preview</span>
                  <div className="p-3 rounded-xl bg-black/70 border border-white/15 text-center">
                    <p className="text-xs font-black text-white uppercase tracking-wider line-clamp-2">
                      {hook || 'YOUR HOOK HEADLINE WILL DISPLAY HERE'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FRAMING */}
            {activeTab === 'framing' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Video Framing Mode
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    Select how the video is framed into 9:16 vertical portrait
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'crop',
                      title: 'Smart Face-Track Crop',
                      desc: 'AI tracks active speakers and centers 9:16 frame dynamically',
                    },
                    {
                      id: 'dynamic_landscape',
                      title: 'Hybrid Smart Fit',
                      desc: 'Crops faces when talking, auto-fits wide landscape views',
                    },
                    {
                      id: 'fit_blur',
                      title: 'Fit with Blurred Background',
                      desc: 'Full 16:9 frame centered with soft blurred bars top and bottom',
                    },
                    {
                      id: 'streamer_split',
                      title: 'Streamer Split Screen',
                      desc: 'Webcam facecam stacked on top, gameplay action below',
                    },
                  ].map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setFraming(f.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        framing === f.id
                          ? 'bg-[#a8542c]/20 border-[#ba6238] text-white ring-1 ring-[#ba6238]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <h4 className="text-xs font-bold flex items-center justify-between">
                        <span>{f.title}</span>
                        {framing === f.id && <Check size={14} className="text-[#ba6238]" />}
                      </h4>
                      <p className="text-[11px] text-white/50 mt-1 leading-snug">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optional Burn-in status banner */}
          {exportMessage && (
            <div className="px-5 py-2.5 bg-emerald-500/20 border-t border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <span>{exportMessage}</span>
            </div>
          )}

          {/* Bottom Export & Download Bar */}
          <div className="p-4 border-t border-rule bg-[#131720] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <a
                href={videoUrl}
                download={filename}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download MP4 video"
              >
                <Download size={13} />
                <span>Download MP4</span>
              </a>

              <a
                href={srtUrl}
                download={srtFilename}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                title="Download Subtitles (.SRT)"
              >
                SRT
              </a>
            </div>

            {/* Optional one-click button to bake custom subtitles into the MP4 file */}
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportBurnedIn}
              className="px-4 py-2 rounded-xl bg-[#a8542c]/20 hover:bg-[#a8542c]/30 border border-[#ba6238]/50 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Permanently bake customized ASS subtitles into the MP4"
            >
              {isExporting ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-[#ba6238]" />
                  <span>Baking Subtitles (3s)...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} className="text-[#ba6238]" />
                  <span>Export Burned-In MP4</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
