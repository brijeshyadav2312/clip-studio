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
  const [duration, setDuration] = useState(30);
  const [isMuted, setIsMuted] = useState(false);

  // Inspector active tab: 'presets' | 'placement' | 'typography' | 'hook' | 'framing'
  const [activeTab, setActiveTab] = useState('presets');

  // Words for live subtitle rendering
  const [words, setWords] = useState([]);
  const [loadingWords, setLoadingWords] = useState(false);

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

    // Fetch word timestamps for this clip
    let isMounted = true;
    setLoadingWords(true);
    const clipSlug = currentClip.slug || String(currentClip.filename).replace(/\.mp4$/i, '');
    const jobId = currentClip.jobId;

    fetch(`/api/jobs/${jobId}/clips/${clipSlug}/words`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.words)) {
          setWords(data.words);
        } else {
          setWords([]);
        }
      })
      .catch(() => {
        if (isMounted) setWords([]);
      })
      .finally(() => {
        if (isMounted) setLoadingWords(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentClip]);

  const rawFilename = currentClip?.filename || `${currentClip?.slug || 'clip'}.mp4`;
  const filename = rawFilename.endsWith('.mp4') ? rawFilename : `${rawFilename}.mp4`;
  const srtFilename = filename.replace(/\.mp4$/i, '.srt');
  const resolvedJobId = currentClip?.jobId || '';
  const rawVideo = currentClip?.url || currentClip?.video || '';
  const videoUrl = rawVideo.startsWith('http') || rawVideo.startsWith('/media')
    ? rawVideo
    : `/media/${resolvedJobId}/${currentClip?.video || `clips/${filename}`}`;
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

    let margin_v = Math.round((verticalPercent / 100) * 1920);
    if (captionPosition === 'top') margin_v = 1500;
    else if (captionPosition === 'divider') margin_v = 780;
    else if (captionPosition === 'middle') margin_v = 860;
    else if (captionPosition === 'bottom') margin_v = 300;

    const payload = {
      caption_style: captionStyle,
      caption_position: captionPosition,
      margin_v: margin_v,
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
      setCurrentClip(data.clip);
      setExportMessage('✓ Burned-in MP4 exported successfully!');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setExportMessage(`⚠️ ${err.message || 'Error exporting'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Compute active caption group based on current video timestamp
  const activeCaptionGroup = useMemo(() => {
    if (!words || words.length === 0) {
      // Fallback: If no word timings exist, generate dynamic mock subtitle from hook/title
      const text = currentClip?.title || currentClip?.hook || 'Clip Studio Live Subtitles';
      const mockWords = text.split(' ').map((w, idx) => ({
        word: w,
        start: idx * 0.45,
        end: idx * 0.45 + 0.45,
      }));
      const cycleTime = currentTime % (mockWords.length * 0.45 || 3);
      return mockWords.filter((w) => cycleTime >= w.start - 0.1 && cycleTime <= w.end + 0.5);
    }

    const currentPreset = PRESETS.find((p) => p.id === captionStyle) || PRESETS[0];
    const maxWords = currentPreset.wordsPerGroup || 3;

    const groups = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length >= maxWords || (w.word && /[.!?]$/.test(w.word))) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length > 0) groups.push(cur);

    const active = groups.find((grp) => {
      const gStart = grp[0].start;
      const gEnd = grp[grp.length - 1].end;
      return currentTime >= gStart - 0.05 && currentTime <= gEnd + 0.15;
    });

    return active || null;
  }, [words, currentTime, captionStyle, currentClip]);

  // Position style calculation
  const positionStyle = useMemo(() => {
    if (captionPosition === 'top') {
      return { top: '15%', transform: 'translate(-50%, 0)' };
    }
    if (captionPosition === 'middle') {
      return { top: '48%', transform: 'translate(-50%, -50%)' };
    }
    if (captionPosition === 'divider') {
      return { top: '40%', transform: 'translate(-50%, 0)' };
    }
    if (captionPosition === 'bottom') {
      return { bottom: '18%', transform: 'translate(-50%, 0)' };
    }
    return { bottom: `${verticalPercent}%`, transform: 'translate(-50%, 0)' };
  }, [captionPosition, verticalPercent]);

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
            href={videoUrl}
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
          <div className="relative aspect-[9/16] h-[340px] sm:h-[420px] md:h-[480px] lg:h-[520px] max-h-full rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl flex items-center justify-center group">
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

            {/* Hook Headline Overlay (First 3.2s) */}
            {hook && currentTime < 3.2 && (
              <div className="absolute top-4 left-3 right-3 z-30 pointer-events-none animate-in fade-in duration-150">
                <div className="bg-black/85 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 text-center shadow-2xl">
                  <p className="text-xs sm:text-sm font-black text-white tracking-wide uppercase line-clamp-2">
                    {hook}
                  </p>
                </div>
              </div>
            )}

            {/* LIVE DYNAMIC CAPTION OVERLAY (7 Truly Distinct Visual Styles) */}
            {activeCaptionGroup && activeCaptionGroup.length > 0 && (
              <div
                className="absolute left-1/2 w-[90%] z-20 pointer-events-none transition-all duration-150 text-center"
                style={positionStyle}
              >
                {/* 1. HORMOZI 3D POP STYLE */}
                {captionStyle === 'hormozi' && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    {activeCaptionGroup.map((w, idx) => {
                      const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                      return (
                        <span
                          key={idx}
                          className="inline-block transition-transform duration-100 font-black"
                          style={{
                            fontSize: `${Math.max(18, Math.round(fontSize * 0.3))}px`,
                            color: isActive ? activeColor : primaryColor,
                            WebkitTextStroke: '2.5px #000000',
                            textShadow: isActive
                              ? '0 5px 0 #000, 0 10px 16px rgba(0,0,0,0.9)'
                              : '0 4px 0 #000, 0 8px 12px rgba(0,0,0,0.8)',
                            transform: isActive ? 'scale(1.3) rotate(-3deg)' : 'scale(1)',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 2. BOXED MARKER / HIGHLIGHTER STYLE */}
                {captionStyle === 'boxed' && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-2"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    {activeCaptionGroup.map((w, idx) => {
                      const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                      return (
                        <span
                          key={idx}
                          className={`inline-block transition-all duration-100 ${
                            isActive
                              ? 'bg-[#FFE600] text-black px-3.5 py-1 rounded-xl font-black shadow-2xl scale-110 -rotate-2 border-2 border-black'
                              : 'bg-black/75 text-white px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10 shadow-lg font-bold'
                          }`}
                          style={{
                            fontSize: `${Math.max(16, Math.round(fontSize * 0.26))}px`,
                          }}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 3. CYBERPUNK NEON GLOW STYLE */}
                {captionStyle === 'neon' && (
                  <div
                    className="inline-block px-4 py-2 rounded-2xl bg-[#0a0f1e]/80 border-2 border-cyan-400/80 shadow-[0_0_25px_rgba(0,255,255,0.4)] backdrop-blur-md"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                      {activeCaptionGroup.map((w, idx) => {
                        const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                        return (
                          <span
                            key={idx}
                            className="inline-block transition-transform duration-100 font-black"
                            style={{
                              fontSize: `${Math.max(16, Math.round(fontSize * 0.28))}px`,
                              color: isActive ? activeColor : primaryColor,
                              textShadow: isActive
                                ? `0 0 15px ${activeColor}, 0 0 30px ${activeColor}, 0 2px 4px #000`
                                : `0 0 10px ${primaryColor}, 0 2px 4px #000`,
                              transform: isActive ? 'scale(1.15)' : 'scale(1)',
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. KARAOKE GLOW STYLE */}
                {captionStyle === 'karaoke' && (
                  <div
                    className="inline-block px-5 py-2.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 shadow-2xl"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                      {activeCaptionGroup.map((w, idx) => {
                        const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                        return (
                          <span
                            key={idx}
                            className="inline-block transition-all duration-100"
                            style={{
                              fontSize: `${Math.max(15, Math.round(fontSize * 0.25))}px`,
                              color: isActive ? activeColor : primaryColor,
                              opacity: isActive ? 1 : 0.45,
                              fontWeight: isActive ? 900 : 600,
                              textShadow: isActive ? `0 0 12px ${activeColor}` : 'none',
                              transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. COMIC POP-ART STYLE */}
                {captionStyle === 'comic' && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1"
                    style={{
                      fontFamily: 'Comic Sans MS, cursive, sans-serif',
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    {activeCaptionGroup.map((w, idx) => {
                      const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                      return (
                        <span
                          key={idx}
                          className="inline-block transition-transform duration-100 font-black"
                          style={{
                            fontSize: `${Math.max(17, Math.round(fontSize * 0.29))}px`,
                            color: isActive ? activeColor : primaryColor,
                            WebkitTextStroke: '3px #000000',
                            textShadow: '3px 3px 0 #000000',
                            transform: isActive ? 'scale(1.25) rotate(4deg)' : 'scale(1)',
                          }}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 6. MRBEAST PUNCH STYLE */}
                {captionStyle === 'beast' && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5"
                    style={{
                      fontFamily: 'Impact',
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    {activeCaptionGroup.map((w, idx) => {
                      const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                      return (
                        <span
                          key={idx}
                          className="inline-block transition-transform duration-75 font-black uppercase"
                          style={{
                            fontSize: `${Math.max(19, Math.round(fontSize * 0.32))}px`,
                            color: isActive ? activeColor : primaryColor,
                            WebkitTextStroke: '3px #000000',
                            textShadow: '0 5px 12px #000000',
                            transform: isActive ? 'scale(1.22)' : 'scale(1)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 7. CINEMATIC MINIMAL STYLE */}
                {captionStyle === 'clean' && (
                  <div
                    className="inline-block px-5 py-2 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white font-medium shadow-2xl"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-x-2">
                      {activeCaptionGroup.map((w, idx) => {
                        const isActive = currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;
                        return (
                          <span
                            key={idx}
                            className={`inline-block transition-colors ${
                              isActive ? 'text-amber-400 font-bold underline underline-offset-4' : 'text-white/80'
                            }`}
                            style={{
                              fontSize: `${Math.max(14, Math.round(fontSize * 0.23))}px`,
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                      ? 'bg-[#ba6238] text-white shadow-md'
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
                            ? 'bg-[#ba6238]/15 border-[#ba6238] ring-1 ring-[#ba6238]'
                            : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <span>{p.name}</span>
                              {isSelected && <Check size={14} className="text-[#ba6238] stroke-[3]" />}
                            </h4>
                            <p className="text-[11px] text-white/60 mt-0.5 leading-snug">{p.desc}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${p.badgeColor}`}>
                            {p.badge}
                          </span>
                        </div>

                        {/* Distinct Visual Preview Snippet */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center gap-2 text-xs font-black">
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
                            <span className="text-white/80 font-medium px-3 py-1 rounded-full bg-white/10 text-[11px]">
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
                          ? 'bg-[#ba6238]/20 border-[#ba6238] text-white font-bold ring-1 ring-[#ba6238]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-semibold">{pos.label}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{pos.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
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
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
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
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
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
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
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
                      uppercase ? 'bg-[#ba6238]' : 'bg-white/20'
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

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
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
                          ? 'bg-[#ba6238]/20 border-[#ba6238] text-white ring-1 ring-[#ba6238]'
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
              className="px-4 py-2 rounded-xl bg-[#ba6238]/20 hover:bg-[#ba6238]/30 border border-[#ba6238]/50 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
