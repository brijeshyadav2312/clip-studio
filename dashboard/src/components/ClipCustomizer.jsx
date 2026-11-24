import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Type,
  MoveVertical,
  Scissors,
  Crop,
  Check,
  RefreshCw,
  Sliders,
  Volume2,
  VolumeX,
  ChevronRight,
  Palette,
  Layers,
  Flame,
} from 'lucide-react';

const PRESETS = [
  {
    id: 'hormozi',
    name: 'Hormozi',
    desc: 'High impact, 2 words, bold pop',
    font: 'Arial Black',
    fontSize: 82,
    primaryColor: '#FFFFFF',
    activeColor: '#00FF66',
    uppercase: true,
    badge: 'Trending',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'wordpop',
    name: 'WordPop',
    desc: 'Bouncy 3-4 words with yellow pop',
    font: 'Arial Black',
    fontSize: 68,
    primaryColor: '#FFFFFF',
    activeColor: '#FFDD00',
    uppercase: true,
    badge: 'Popular',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    desc: 'Smooth lyric-style word highlight',
    font: 'Montserrat',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    activeColor: '#00E5FF',
    uppercase: false,
    badge: 'Smooth',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    desc: 'Cyberpunk glow text effect',
    font: 'Impact',
    fontSize: 72,
    primaryColor: '#FFFFFF',
    activeColor: '#00FFFF',
    uppercase: true,
    badge: 'Vibrant',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  {
    id: 'boxed',
    name: 'Boxed Marker',
    desc: 'Highlighter box behind active words',
    font: 'Arial Black',
    fontSize: 66,
    primaryColor: '#000000',
    activeColor: '#FFDD00',
    uppercase: true,
    badge: 'Readable',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'beast',
    name: 'MrBeast',
    desc: 'Punchy massive yellow/gold kinetic',
    font: 'Impact',
    fontSize: 90,
    primaryColor: '#FFFFFF',
    activeColor: '#FFD700',
    uppercase: true,
    badge: 'Viral',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    id: 'clean',
    name: 'Clean Minimal',
    desc: 'Classic subtitle style, soft shadow',
    font: 'Rubik',
    fontSize: 54,
    primaryColor: '#FFFFFF',
    activeColor: '#FFFFFF',
    uppercase: false,
    badge: 'Minimal',
    badgeColor: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
];

const FONTS = [
  'Arial Black',
  'Impact',
  'Montserrat',
  'Rubik',
  'Oswald',
  'Trebuchet MS',
  'System Sans',
];

const SWATCHES = [
  '#FFFFFF',
  '#00FF66',
  '#FFDD00',
  '#00E5FF',
  '#FF3366',
  '#FFAA00',
  '#9933FF',
  '#000000',
];

export default function ClipCustomizer({
  clip,
  jobId,
  isOpen,
  onClose,
  onSave,
}) {
  if (!isOpen || !clip) return null;

  // Tabs: 'presets' | 'position' | 'typography' | 'trim' | 'framing'
  const [activeTab, setActiveTab] = useState('presets');

  // Video playback
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.duration || (clip.end - clip.start) || 30);
  const [isMuted, setIsMuted] = useState(false);

  // Words data for live 60fps caption preview
  const [words, setWords] = useState([]);
  const [loadingWords, setLoadingWords] = useState(false);

  // Customization state
  const [captionStyle, setCaptionStyle] = useState(clip.caption_style || 'wordpop');
  const [captionPosition, setCaptionPosition] = useState('bottom'); // 'bottom' | 'middle' | 'divider' | 'top' | 'custom'
  const [verticalPercent, setVerticalPercent] = useState(18); // % from bottom
  const [font, setFont] = useState('Arial Black');
  const [fontSize, setFontSize] = useState(68);
  const [primaryColor, setPrimaryColor] = useState('#FFFFFF');
  const [activeColor, setActiveColor] = useState('#FFDD00');
  const [uppercase, setUppercase] = useState(true);
  const [hook, setHook] = useState(clip.hook || '');
  const [trimStart, setTrimStart] = useState(clip.start || 0);
  const [trimEnd, setTrimEnd] = useState(clip.end || (clip.start + 30));
  const [framing, setFraming] = useState(clip.reframe?.mode || 'crop');
  const [censor, setCensor] = useState(false);

  // Saving / Re-rendering state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const videoUrl = clip.url || `/media/${jobId}/clips/${clip.filename}`;

  // Fetch word timings on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingWords(true);
    const clipSlug = clip.slug || String(clip.filename).replace(/\.mp4$/i, '');
    fetch(`/api/jobs/${jobId}/clips/${clipSlug}/words`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.words)) {
          setWords(data.words);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingWords(false);
      });

    return () => {
      isMounted = false;
    };
  }, [jobId, clip]);

  // Video time tracking
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

  // Preset Selection
  const applyPreset = (preset) => {
    setCaptionStyle(preset.id);
    setFont(preset.font);
    setFontSize(preset.fontSize);
    setPrimaryColor(preset.primaryColor);
    setActiveColor(preset.activeColor);
    setUppercase(preset.uppercase);
  };

  // Reset to defaults
  const handleReset = () => {
    applyPreset(PRESETS[1]); // WordPop default
    setCaptionPosition('bottom');
    setVerticalPercent(18);
    setHook(clip.hook || '');
    setTrimStart(clip.start || 0);
    setTrimEnd(clip.end || (clip.start + 30));
    setFraming(clip.reframe?.mode || 'crop');
    setCensor(false);
  };

  // Save / Re-render execution
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    const clipSlug = clip.slug || String(clip.filename).replace(/\.mp4$/i, '');

    // Convert % from bottom to ASS margin_v (PlayResY = 1920)
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
      censor: censor,
    };

    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipSlug}/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Re-rendering failed');
      }

      if (onSave) {
        onSave(data.clip);
      }
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Error customizing clip');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute live active words group for real-time preview
  const activeCaptionGroup = useMemo(() => {
    if (!words || words.length === 0) {
      return null;
    }
    // Group words into chunks of 3-4 words (or 2 for hormozi/beast)
    const maxWordsPerGroup = captionStyle === 'hormozi' || captionStyle === 'beast' ? 2 : 4;
    const groups = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length >= maxWordsPerGroup || (w.word && /[.!?]$/.test(w.word))) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length > 0) groups.push(cur);

    // Find group active at currentTime
    const currentGroup = groups.find((grp) => {
      const gStart = grp[0].start;
      const gEnd = grp[grp.length - 1].end;
      return currentTime >= gStart - 0.05 && currentTime <= gEnd + 0.15;
    });

    return currentGroup || null;
  }, [words, currentTime, captionStyle]);

  // Position style calculation for preview overlay
  const positionStyle = useMemo(() => {
    if (captionPosition === 'top') {
      return { top: '14%', transform: 'translate(-50%, 0)' };
    }
    if (captionPosition === 'middle') {
      return { top: '48%', transform: 'translate(-50%, -50%)' };
    }
    if (captionPosition === 'divider') {
      return { top: '50%', transform: 'translate(-50%, 0)' };
    }
    if (captionPosition === 'bottom') {
      return { bottom: '16%', transform: 'translate(-50%, 0)' };
    }
    // custom slider % from bottom
    return { bottom: `${verticalPercent}%`, transform: 'translate(-50%, 0)' };
  }, [captionPosition, verticalPercent]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1218] border border-white/10 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[880px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#141822]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ba6238] to-[#f28244] flex items-center justify-center text-white shadow-md">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>Customize Short</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono font-normal">
                  {clip.slug || 'clip'}
                </span>
              </h2>
              <p className="text-xs text-white/50 truncate">
                Tweak caption presets, placement, typography, and trim with live preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset all settings to default"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Body: 2 Columns */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: 9:16 Video Player with Interactive Live Overlay */}
          <div className="w-full md:w-[45%] lg:w-[42%] p-4 sm:p-5 bg-[#090b10] flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 relative overflow-hidden select-none">
            {/* 9:16 Portrait Canvas Frame */}
            <div className="relative aspect-[9/16] h-[340px] sm:h-[420px] md:h-[500px] max-h-full rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl flex items-center justify-center group">
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

              {/* Hook Headline Overlay Preview (First 3.2s) */}
              {hook && currentTime < 3.2 && (
                <div className="absolute top-4 left-3 right-3 z-30 pointer-events-none animate-in fade-in duration-150">
                  <div className="bg-black/85 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 text-center shadow-2xl">
                    <p className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase line-clamp-2">
                      {hook}
                    </p>
                  </div>
                </div>
              )}

              {/* Live Animated Caption Overlay */}
              {activeCaptionGroup && activeCaptionGroup.length > 0 && (
                <div
                  className="absolute left-1/2 w-[88%] z-20 pointer-events-none transition-all duration-150 text-center"
                  style={positionStyle}
                >
                  <div
                    className="inline-block px-3 py-1.5 rounded-xl transition-all"
                    style={{
                      fontFamily: font,
                      textTransform: uppercase ? 'uppercase' : 'none',
                      textShadow:
                        captionStyle === 'neon'
                          ? `0 0 10px ${activeColor}, 0 0 20px ${activeColor}, 0 2px 4px #000`
                          : captionStyle === 'clean'
                          ? '0 1px 3px rgba(0,0,0,0.8)'
                          : '0 2px 6px #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                      {activeCaptionGroup.map((w, idx) => {
                        const isActive =
                          currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1;

                        const isBoxed = captionStyle === 'boxed' && isActive;

                        return (
                          <span
                            key={idx}
                            className={`inline-block transition-transform duration-100 ${
                              isActive && (captionStyle === 'wordpop' || captionStyle === 'beast' || captionStyle === 'hormozi')
                                ? 'scale-110 font-black'
                                : 'font-extrabold'
                            } ${isBoxed ? 'px-2 py-0.5 rounded-md bg-amber-400 text-black shadow-md' : ''}`}
                            style={{
                              fontSize: `${Math.max(16, Math.round(fontSize * 0.28))}px`,
                              color: isBoxed
                                ? '#000000'
                                : isActive
                                ? activeColor
                                : primaryColor,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Center Play Icon (visible when paused) */}
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

            {/* Video Timeline & Scrub Controls */}
            <div className="w-full max-w-[320px] mt-3 space-y-1.5">
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
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {currentTime.toFixed(1)}s
                </span>
                <span>{duration.toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* Right Column: Customization Controls & Tabs */}
          <div className="w-full md:w-[55%] lg:w-[58%] flex flex-col bg-[#11141c] overflow-hidden">
            {/* Sub-Tabs Nav */}
            <div className="flex items-center gap-1 p-2 sm:p-3 border-b border-white/10 bg-[#141822] overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'presets'
                    ? 'bg-[#ba6238] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Sparkles size={13} />
                <span>Presets</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('position')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'position'
                    ? 'bg-[#ba6238] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <MoveVertical size={13} />
                <span>Placement</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('typography')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'typography'
                    ? 'bg-[#ba6238] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Type size={13} />
                <span>Style & Color</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('trim')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'trim'
                    ? 'bg-[#ba6238] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Scissors size={13} />
                <span>Hook & Trim</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('framing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'framing'
                    ? 'bg-[#ba6238] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Crop size={13} />
                <span>Framing</span>
              </button>
            </div>

            {/* Tab Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* TAB 1: PRESETS */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Flame size={14} className="text-[#ba6238]" />
                      <span>Select Caption Style</span>
                    </h3>
                    <span className="text-[11px] text-white/50">Click to apply instantly</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRESETS.map((p) => {
                      const isSelected = captionStyle === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => applyPreset(p)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-[#ba6238]/15 border-[#ba6238] ring-1 ring-[#ba6238]'
                              : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>{p.name}</span>
                                {isSelected && (
                                  <Check size={14} className="text-[#ba6238] stroke-[3]" />
                                )}
                              </h4>
                              <p className="text-[11px] text-white/60 mt-0.5">{p.desc}</p>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.badgeColor}`}
                            >
                              {p.badge}
                            </span>
                          </div>

                          {/* Mini Visual Preview Pill */}
                          <div className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center gap-1.5 text-xs font-black">
                            <span style={{ color: p.primaryColor }}>SAMPLE</span>
                            <span
                              style={{ color: p.activeColor }}
                              className="scale-105"
                            >
                              HIGHLIGHT
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: POSITION */}
              {activeTab === 'position' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Preset Positions
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      Choose standard platform-safe zones or fine-tune with the vertical slider
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'bottom', label: 'Bottom (Standard)', pct: 16 },
                      { id: 'middle', label: 'Middle (Centered)', pct: 48 },
                      { id: 'divider', label: 'Divider (Streamer)', pct: 40 },
                      { id: 'top', label: 'Top (Headline)', pct: 82 },
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
                            ? 'bg-[#ba6238]/20 border-[#ba6238] text-white font-bold'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-semibold">{pos.label}</p>
                      </button>
                    ))}
                  </div>

                  {/* Vertical Position Slider */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Fine-tune Vertical Offset (Y-Position)</span>
                      <span className="font-mono text-[#ba6238]">{verticalPercent}% from bottom</span>
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
                      <span>Bottom (10%)</span>
                      <span>Center (48%)</span>
                      <span>Top (85%)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TYPOGRAPHY & COLORS */}
              {activeTab === 'typography' && (
                <div className="space-y-5">
                  {/* Font Family & Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* Colors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Active Highlight Color */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Palette size={13} className="text-[#ba6238]" />
                          <span>Active Word Color</span>
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

                    {/* Primary Text Color */}
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

                  {/* Uppercase toggle */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">UPPERCASE All Captions</p>
                      <p className="text-[11px] text-white/50">
                        Force all subtitle words into capital letters for maximum readability
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

              {/* TAB 4: TRIM & HOOK */}
              {activeTab === 'trim' && (
                <div className="space-y-5">
                  {/* Headline Hook */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#ba6238]" />
                      <span>Opening Hook Headline</span>
                    </label>
                    <p className="text-xs text-white/50">
                      Bold top headline that hooks viewers during the first 3 seconds
                    </p>
                    <input
                      type="text"
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      placeholder="e.g. Wait until you see the ending..."
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-[#ba6238]"
                    />
                  </div>

                  {/* Start & End Trim */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Trim Clip Duration
                      </h4>
                      <span className="text-xs font-mono font-bold text-[#ba6238]">
                        Length: {(trimEnd - trimStart).toFixed(1)}s
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/60">Start (sec)</label>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            step="0.5"
                            value={trimStart}
                            onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-white/60">End (sec)</label>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            step="0.5"
                            value={trimEnd}
                            onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profanity Censor Toggle */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Censor Profanity</p>
                      <p className="text-[11px] text-white/50">
                        Automatically bleep and asterisk vulgar language in audio and captions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCensor(!censor)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        censor ? 'bg-[#ba6238]' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          censor ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: FRAMING */}
              {activeTab === 'framing' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Video Framing & Crop Mode
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      Choose how the original landscape video is reframed into 9:16 portrait
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
                      {
                        id: 'gameplay_center',
                        title: 'Center Fixed Crop',
                        desc: 'Static center 9:16 crop without camera motion',
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

            {/* Error banner if save fails */}
            {saveError && (
              <div className="px-5 py-2.5 bg-red-500/20 border-t border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <span>⚠️ {saveError}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/10 bg-[#141822] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ba6238] to-[#d47345] hover:from-[#c96a3d] hover:to-[#df7d4f] text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Re-rendering Clip (3-5s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Save & Re-render Clip</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
