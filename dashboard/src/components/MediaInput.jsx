import React, { useState, useRef } from 'react';
import {
  Upload,
  UploadCloud,
  Link2,
  FileVideo,
  X,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  Shield,
  Cookie,
  Check,
  Smartphone,
  Square,
  Tv,
  Youtube,
  Instagram,
  ArrowRight,
} from 'lucide-react';

export default function MediaInput({ onProcess, isProcessing, onUploadCookies, cookieStatus }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'url'
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [aspect, setAspect] = useState('9:16');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(true);

  // Advanced Options State
  const [numClips, setNumClips] = useState(5);
  const [minSec, setMinSec] = useState(20);
  const [maxSec, setMaxSec] = useState(60);
  const [layout, setLayout] = useState('auto');
  const [stabilization, setStabilization] = useState('locked_tripod');
  const [captionStyle, setCaptionStyle] = useState('wordpop');
  const [captionPosition, setCaptionPosition] = useState('auto');
  const [subtitleScript, setSubtitleScript] = useState('auto');
  const [whisperModel, setWhisperModel] = useState('base');
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState('');
  const [streamerGameFocus, setStreamerGameFocus] = useState('center');
  const [streamerSplitRatio, setStreamerSplitRatio] = useState('35_65');
  const [streamerCamPos, setStreamerCamPos] = useState('auto');
  const [streamerCamZoom, setStreamerCamZoom] = useState(1.15);
  const [streamerDivider, setStreamerDivider] = useState('glow');
  const [streamerTheme, setStreamerTheme] = useState('purple_cyan');
  const [streamerTag, setStreamerTag] = useState('');
  const [streamerCamShape, setStreamerCamShape] = useState('rect');
  const [streamerBg, setStreamerBg] = useState('blur');
  const [censor, setCensor] = useState(false);
  const [hook, setHook] = useState('');

  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMode('upload');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isProcessing) return;
    if (!rightsConfirmed) return;

    const options = {
      num_clips: Number(numClips) || 5,
      min_sec: Number(minSec) || 20,
      max_sec: Number(maxSec) || 60,
      aspect,
      layout,
      stabilization,
      caption_style: captionStyle,
      caption_position: captionPosition,
      subtitle_script: subtitleScript,
      whisper_model: whisperModel,
      cookies_from_browser: cookiesFromBrowser,
      streamer_game_focus: streamerGameFocus,
      streamer_split_ratio: streamerSplitRatio,
      streamer_cam_pos: streamerCamPos,
      streamer_cam_zoom: Number(streamerCamZoom) || 1.15,
      streamer_divider: streamerDivider,
      streamer_theme: streamerTheme,
      streamer_tag: streamerTag.trim(),
      streamer_cam_shape: streamerCamShape,
      streamer_bg: streamerBg,
      censor,
      hook: hook.trim() || null,
    };

    if (mode === 'upload' && file) {
      onProcess({ type: 'file', payload: file, options });
    } else if (mode === 'url' && url.trim()) {
      onProcess({ type: 'url', payload: url.trim(), options });
    }
  };

  const canSubmit = (mode === 'upload' ? !!file : !!url.trim()) && rightsConfirmed;

  return (
    <div className="w-full h-full flex flex-col justify-between select-none">
      {/* Main Two-Column Full Page Grid */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pb-4"
      >
        {/* ========================================================= */}
        {/* LEFT COLUMN: Output Format, Advanced Options, CTA button  */}
        {/* Scrollable ONLY when advanced options are expanded        */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between h-full min-h-0 overflow-y-auto custom-scrollbar pr-1 lg:pr-3 space-y-4">
          <div className="space-y-4">
            {/* Header: OUTPUT FORMAT | 9:16 Selected */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-mono tracking-widest text-muted uppercase font-bold">
                OUTPUT FORMAT
              </span>
              <span className="text-xs font-mono font-bold text-[#ba6238]">
                {aspect} Selected
              </span>
            </div>

            {/* 3 Format Selection Cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* 9:16 Card */}
              <button
                type="button"
                onClick={() => setAspect('9:16')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
                  aspect === '9:16'
                    ? 'border-[#ba6238] bg-[#ba6238]/10 shadow-[0_0_15px_rgba(186,98,56,0.15)] ring-1 ring-[#ba6238]/50'
                    : 'border-rule bg-[#0e1015] hover:border-rule2 hover:bg-paper2/60'
                }`}
              >
                <div
                  className={`w-5 h-7 border-2 rounded-[4px] flex items-center justify-center mb-1.5 transition-colors ${
                    aspect === '9:16' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                >
                  <div
                    className={`w-1 h-1 rounded-full ${
                      aspect === '9:16' ? 'bg-[#ba6238]' : 'bg-muted'
                    }`}
                  />
                </div>
                <span
                  className={`text-sm font-bold block tracking-wide truncate max-w-full ${
                    aspect === '9:16' ? 'text-[#ba6238]' : 'text-ink'
                  }`}
                >
                  9:16
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full font-mono mt-0.5">
                  Shorts · Reels
                </span>
              </button>

              {/* 1:1 Card */}
              <button
                type="button"
                onClick={() => setAspect('1:1')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
                  aspect === '1:1'
                    ? 'border-[#ba6238] bg-[#ba6238]/10 shadow-[0_0_15px_rgba(186,98,56,0.15)] ring-1 ring-[#ba6238]/50'
                    : 'border-rule bg-[#0e1015] hover:border-rule2 hover:bg-paper2/60'
                }`}
              >
                <div
                  className={`w-6 h-6 border-2 rounded-[4px] flex items-center justify-center mb-1.5 transition-colors ${
                    aspect === '1:1' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                />
                <span
                  className={`text-sm font-bold block tracking-wide truncate max-w-full ${
                    aspect === '1:1' ? 'text-[#ba6238]' : 'text-ink'
                  }`}
                >
                  1:1
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full font-mono mt-0.5">
                  Feed posts
                </span>
              </button>

              {/* 16:9 Card */}
              <button
                type="button"
                onClick={() => setAspect('16:9')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
                  aspect === '16:9'
                    ? 'border-[#ba6238] bg-[#ba6238]/10 shadow-[0_0_15px_rgba(186,98,56,0.15)] ring-1 ring-[#ba6238]/50'
                    : 'border-rule bg-[#0e1015] hover:border-rule2 hover:bg-paper2/60'
                }`}
              >
                <div
                  className={`w-7 h-5 border-2 rounded-[4px] flex items-center justify-center mb-1.5 transition-colors ${
                    aspect === '16:9' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                />
                <span
                  className={`text-sm font-bold block tracking-wide truncate max-w-full ${
                    aspect === '16:9' ? 'text-[#ba6238]' : 'text-ink'
                  }`}
                >
                  16:9
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full font-mono mt-0.5">
                  Landscape
                </span>
              </button>
            </div>

            {/* Advanced Options Accordion */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-rule bg-[#0e1015] hover:border-rule2 hover:bg-paper2/60 text-ink text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal size={16} className="text-[#ba6238] shrink-0" />
                  <span className="font-semibold text-xs sm:text-sm">Advanced Options</span>
                </div>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 text-muted ${
                    showAdvanced ? 'rotate-180 text-ink' : ''
                  }`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 rounded-2xl border border-rule bg-[#0e1015] space-y-3.5 animate-fade text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-muted block mb-1 font-mono text-[11px] truncate">
                        Subtitle Language / Script
                      </label>
                      <select
                        value={subtitleScript}
                        onChange={(e) => setSubtitleScript(e.target.value)}
                        className="w-full bg-paper2 border border-rule rounded-xl p-2.5 text-xs text-ink focus:border-[#ba6238] focus:outline-none cursor-pointer"
                      >
                        <option value="auto">Auto (Detect Hindi/English)</option>
                        <option value="hinglish">Hinglish (Roman English script)</option>
                        <option value="english">English (Strict English)</option>
                        <option value="hindi">Hindi (Devanagari)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-muted block mb-1 font-mono text-[11px] truncate">
                        Caption Animation Style
                      </label>
                      <select
                        value={captionStyle}
                        onChange={(e) => setCaptionStyle(e.target.value)}
                        className="w-full bg-paper2 border border-rule rounded-xl p-2.5 text-xs text-ink focus:border-[#ba6238] focus:outline-none cursor-pointer"
                      >
                        <option value="wordpop">WordPop (Yellow dynamic pop)</option>
                        <option value="karaoke">Karaoke (Gradient reveal)</option>
                        <option value="minimal">Minimal (Clean subtitle strip)</option>
                        <option value="none">No Subtitles</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-muted block mb-1 font-mono text-[11px] truncate">
                        Camera Stabilization
                      </label>
                      <select
                        value={stabilization}
                        onChange={(e) => setStabilization(e.target.value)}
                        className="w-full bg-paper2 border border-rule rounded-xl p-2.5 text-xs text-ink focus:border-[#ba6238] focus:outline-none cursor-pointer"
                      >
                        <option value="locked_tripod">Locked Tripod (Zero Jitter)</option>
                        <option value="smooth_pan">Smooth Dynamic Pan</option>
                        <option value="disabled">Center Static Crop</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-muted text-[11px] font-mono mb-1">
                        <span>Clips Count</span>
                        <span className="text-[#ba6238] font-bold">{numClips}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={numClips}
                        onChange={(e) => setNumClips(Number(e.target.value))}
                        className="w-full accent-[#ba6238] mt-1 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-muted text-[11px] font-mono mb-1">
                        <span>Max Duration</span>
                        <span className="text-[#ba6238] font-bold">{maxSec}s</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="90"
                        step="5"
                        value={maxSec}
                        onChange={(e) => setMaxSec(Number(e.target.value))}
                        className="w-full accent-[#ba6238] mt-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-muted block mb-1 font-mono text-[11px] truncate">
                      Custom Highlight Focus Hook (Optional)
                    </label>
                    <input
                      type="text"
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      placeholder="e.g. Focus on AI discussion, market trends, high emotion..."
                      className="w-full bg-paper2 border border-rule rounded-xl p-2.5 text-xs text-ink focus:border-[#ba6238] focus:outline-none placeholder:text-muted/60 truncate"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom of Left Column: Rights Checkbox & Main CTA Button */}
          <div className="space-y-3 pt-2">
            {/* Rights Confirmation Checkbox */}
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="rightsCheck"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-rule text-[#ba6238] focus:ring-0 focus:outline-none accent-[#ba6238] cursor-pointer shrink-0"
              />
              <label
                htmlFor="rightsCheck"
                className="text-xs text-muted leading-snug cursor-pointer select-none"
              >
                I confirm I own this content or have the rights to process it. See our{' '}
                <span className="text-ink underline hover:text-[#ba6238]">Terms</span> and{' '}
                <span className="text-ink underline hover:text-[#ba6238]">Privacy Policy</span>.
              </label>
            </div>

            {/* Generate Viral Shorts Button */}
            <button
              type="submit"
              disabled={!canSubmit || isProcessing}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
                canSubmit && !isProcessing
                  ? 'bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#ba6238] text-white hover:brightness-110 shadow-lg shadow-[#ba6238]/20 cursor-pointer'
                  : 'bg-paper3 text-muted border border-rule cursor-not-allowed opacity-60'
              }`}
            >
              <span className="truncate">
                {isProcessing ? 'Analyzing & Generating Shorts…' : 'Generate Viral Shorts'}
              </span>
              {!isProcessing && <ArrowRight size={17} className="shrink-0" />}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Input Source (Upload / URL) - Completely FIXED */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between h-full min-h-0 overflow-hidden lg:border-l lg:border-rule lg:pl-8 space-y-4">
          <div className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* Header: INPUT SOURCE | [ Upload File ] [ Video URL ] */}
            <div className="flex items-center justify-between pb-1 shrink-0">
              <span className="text-[11px] font-mono tracking-widest text-muted uppercase font-bold">
                INPUT SOURCE
              </span>

              <div className="flex items-center gap-1.5 bg-[#0e1015] p-1 rounded-2xl border border-rule">
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                    mode === 'upload'
                      ? 'bg-paper2 text-ink border border-rule shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Upload size={13} className={mode === 'upload' ? 'text-[#ba6238]' : 'text-muted'} />
                  <span className="truncate">Upload File</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('url')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                    mode === 'url'
                      ? 'bg-paper2 text-ink border border-rule shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Link2 size={13} className={mode === 'url' ? 'text-[#ba6238]' : 'text-muted'} />
                  <span className="truncate">Video URL</span>
                </button>
              </div>
            </div>

            {/* Main Interactive Box: Dropzone or URL Input (Fills remaining height) */}
            <div className="flex-1 min-h-0 flex flex-col">
              {mode === 'upload' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 min-h-[220px] border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    file
                      ? 'border-[#ba6238] bg-[#ba6238]/10'
                      : 'border-rule hover:border-[#ba6238]/60 bg-[#0e1015] hover:bg-paper2/40 group'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.mov,.mkv,.webm"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                  />

                  {file ? (
                    <div className="flex flex-col items-center text-center gap-2 max-w-full">
                      <div className="w-12 h-12 rounded-2xl bg-[#ba6238]/20 border border-[#ba6238]/40 flex items-center justify-center text-[#ba6238]">
                        <FileVideo size={24} />
                      </div>
                      <div className="font-semibold text-ink text-sm sm:text-base max-w-md truncate w-full px-2">
                        {file.name}
                      </div>
                      <div className="readout text-muted text-xs font-mono truncate">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB · Ready for processing
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-xs text-[#ba6238] hover:underline flex items-center gap-1 cursor-pointer font-medium mt-1"
                      >
                        <X size={13} /> Change video file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2.5 max-w-full px-4">
                      {/* Cloud Upload Icon inside Orange Styled Container */}
                      <div className="w-14 h-14 rounded-2xl bg-[#ba6238]/15 border border-[#ba6238]/30 flex items-center justify-center text-[#ba6238] group-hover:scale-105 transition-transform">
                        <UploadCloud size={28} />
                      </div>

                      <p className="text-ink text-sm sm:text-base font-semibold truncate max-w-full">
                        Click to upload or drag &amp; drop video
                      </p>

                      <p className="readout text-[11px] text-muted tracking-wider uppercase font-mono truncate max-w-full">
                        MP4, MOV, WEBM UP TO 500MB · AT LEAST 45S LONG
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-[220px] rounded-2xl border border-rule bg-[#0e1015] p-6 flex flex-col justify-center space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted block font-mono">
                      Enter YouTube, Twitch, Kick, or direct video URL:
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-paper2 border border-rule focus:border-[#ba6238] rounded-xl py-3 pl-4 pr-10 text-sm text-ink placeholder:text-muted/60 focus:outline-none transition-colors"
                      />
                      {url && (
                        <button
                          type="button"
                          onClick={() => setUrl('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded hover:bg-paper3 transition-colors cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted truncate pr-2">
                      Supports YouTube, Twitch, Kick, Vimeo, TikTok
                    </span>
                    {navigator.clipboard && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) setUrl(text);
                          } catch (err) {
                            // ignore
                          }
                        }}
                        className="text-[#ba6238] hover:underline font-medium cursor-pointer shrink-0 font-mono"
                      >
                        Paste from clipboard
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine Status & Resolution Bar */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-rule shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-muted text-xs">Engine Ready</span>
            </div>

            <span className="font-mono text-muted text-xs">1080p · 60fps support</span>
          </div>
        </div>
      </form>

      {/* ========================================================= */}
      {/* BOTTOM FOOTER BAR: Optimized for short-form algorithms    */}
      {/* ========================================================= */}
      <div className="pt-3 border-t border-rule flex flex-col sm:flex-row items-center justify-between gap-3 text-muted text-xs shrink-0">
        <span className="font-mono text-xs text-muted">
          Optimized for short-form algorithms:
        </span>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
            <Youtube size={15} className="text-red-500 shrink-0" />
            <span className="font-medium text-xs">YouTube</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
            <Instagram size={14} className="text-pink-500 shrink-0" />
            <span className="font-medium text-xs">Instagram</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
            <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
            <span className="font-medium text-xs">TikTok</span>
          </div>
        </div>
      </div>
    </div>
  );
}
