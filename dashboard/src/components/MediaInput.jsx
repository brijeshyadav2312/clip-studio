import React, { useState, useRef } from 'react';
import {
  Upload,
  Link2,
  FileVideo,
  X,
  ChevronDown,
  Sparkles,
  Sliders,
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
    <div className="w-full max-w-2xl mx-auto h-full flex flex-col justify-center items-center py-2 px-2 select-none">
      <div className="card p-4 sm:p-5 border border-rule2 bg-[#0e1015] rounded-2xl w-full">
        {/* Top Tabs */}
        <div className="flex gap-6 mb-3.5 border-b border-rule">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center gap-2 pb-2.5 px-1 -mb-px border-b-2 text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              mode === 'upload'
                ? 'text-ink border-[#ba6238]'
                : 'text-muted border-transparent hover:text-ink'
            }`}
          >
            <Upload size={14} className={mode === 'upload' ? 'text-[#ba6238]' : 'text-muted'} />
            <span className="truncate">Upload File</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center gap-2 pb-2.5 px-1 -mb-px border-b-2 text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              mode === 'url'
                ? 'text-ink border-[#ba6238]'
                : 'text-muted border-transparent hover:text-ink'
            }`}
          >
            <Link2 size={14} className={mode === 'url' ? 'text-[#ba6238]' : 'text-muted'} />
            <span className="truncate">Video URL</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Main Input Area */}
          {mode === 'upload' ? (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  file
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule hover:border-[#ba6238]/60 hover:bg-paper2/50 group'
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
                  <div className="flex flex-col items-center text-center gap-1.5 max-w-full">
                    <div className="w-9 h-9 rounded-lg bg-[#ba6238]/20 border border-[#ba6238]/40 flex items-center justify-center text-[#ba6238]">
                      <FileVideo size={20} />
                    </div>
                    <div className="font-semibold text-ink text-xs sm:text-sm max-w-md truncate w-full px-2">
                      {file.name}
                    </div>
                    <div className="readout text-muted text-[10.5px] font-mono truncate">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB · Ready for processing
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-[11px] text-[#ba6238] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <X size={12} /> Change video file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-1.5 max-w-full">
                    <div className="w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted group-hover:text-[#ba6238] group-hover:border-[#ba6238]/40 transition-colors bg-paper2">
                      <Upload size={15} />
                    </div>
                    <p className="text-ink text-xs sm:text-sm font-medium truncate max-w-full px-2">
                      Click to upload or drag & drop video
                    </p>
                    <p className="readout text-[10px] text-muted tracking-wider uppercase font-mono truncate max-w-full px-2">
                      MP4, MOV, WEBM up to 500MB · At least 45s long
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube, Twitch, Kick, or direct video URL…"
                  className="w-full bg-paper2 border border-rule focus:border-[#ba6238] rounded-xl py-2.5 pl-3.5 pr-10 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none transition-colors"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded hover:bg-paper3 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="text-muted truncate min-w-0 pr-2">
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
                    className="text-[#ba6238] hover:underline font-medium cursor-pointer shrink-0"
                  >
                    Paste from clipboard
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OUTPUT FORMAT Selection Cards (Compact Single-Page Layout) */}
          <div className="space-y-2 pt-0.5">
            <label className="readout block text-center text-[10px] tracking-widest text-muted uppercase font-mono">
              OUTPUT FORMAT
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {/* 9:16 Card */}
              <button
                type="button"
                onClick={() => setAspect('9:16')}
                className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl border transition-colors text-center cursor-pointer ${
                  aspect === '9:16'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-4 h-6 border-2 rounded-[3px] flex items-center justify-center mb-1 transition-colors ${
                    aspect === '9:16' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                >
                  <div className={`w-1 h-1 rounded-full ${aspect === '9:16' ? 'bg-[#ba6238]' : 'bg-muted'}`} />
                </div>
                <span className={`text-xs font-semibold block tracking-wide truncate max-w-full ${aspect === '9:16' ? 'text-[#ba6238]' : 'text-ink'}`}>
                  9:16
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full">
                  Shorts · Reels · TikTok
                </span>
              </button>

              {/* 1:1 Card */}
              <button
                type="button"
                onClick={() => setAspect('1:1')}
                className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl border transition-colors text-center cursor-pointer ${
                  aspect === '1:1'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-5 h-5 border-2 rounded-[3px] flex items-center justify-center mb-1 transition-colors ${
                    aspect === '1:1' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                />
                <span className={`text-xs font-semibold block tracking-wide truncate max-w-full ${aspect === '1:1' ? 'text-[#ba6238]' : 'text-ink'}`}>
                  1:1
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full">
                  Feed posts
                </span>
              </button>

              {/* 16:9 Card */}
              <button
                type="button"
                onClick={() => setAspect('16:9')}
                className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl border transition-colors text-center cursor-pointer ${
                  aspect === '16:9'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-6 h-4 border-2 rounded-[3px] flex items-center justify-center mb-1 transition-colors ${
                    aspect === '16:9' ? 'border-[#ba6238]' : 'border-muted'
                  }`}
                />
                <span className={`text-xs font-semibold block tracking-wide truncate max-w-full ${aspect === '16:9' ? 'text-[#ba6238]' : 'text-ink'}`}>
                  16:9
                </span>
                <span className="text-[10px] text-muted block truncate max-w-full">
                  Landscape · YouTube
                </span>
              </button>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
              />
              <span>Advanced Options</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl border border-rule bg-paper2/80 space-y-2.5 animate-fade text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-muted block mb-1 text-[11px] truncate">Subtitle Language / Script</label>
                    <select
                      value={subtitleScript}
                      onChange={(e) => setSubtitleScript(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-lg p-2 text-xs text-ink focus:border-[#ba6238] focus:outline-none"
                    >
                      <option value="auto">Auto (Detect Hindi/English)</option>
                      <option value="hinglish">Hinglish (Roman English script)</option>
                      <option value="english">English (Strict English)</option>
                      <option value="hindi">Hindi (Devanagari)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-muted block mb-1 text-[11px] truncate">Caption Animation Style</label>
                    <select
                      value={captionStyle}
                      onChange={(e) => setCaptionStyle(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-lg p-2 text-xs text-ink focus:border-[#ba6238] focus:outline-none"
                    >
                      <option value="wordpop">WordPop (Yellow dynamic pop)</option>
                      <option value="karaoke">Karaoke (Gradient reveal)</option>
                      <option value="minimal">Minimal (Clean subtitle strip)</option>
                      <option value="none">No Subtitles</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-muted block mb-1 text-[11px] truncate">Camera Stabilization</label>
                    <select
                      value={stabilization}
                      onChange={(e) => setStabilization(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-lg p-2 text-xs text-ink focus:border-[#ba6238] focus:outline-none"
                    >
                      <option value="locked_tripod">Locked Tripod (Zero Jitter)</option>
                      <option value="smooth_pan">Smooth Dynamic Pan</option>
                      <option value="disabled">Center Static Crop</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-muted block mb-1 text-[11px] truncate">Clips Count: {numClips}</label>
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
                    <label className="text-muted block mb-1 text-[11px] truncate">Max Duration: {maxSec}s</label>
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
                  <label className="text-muted block mb-1 text-[11px] truncate">Custom Highlight Focus (Optional)</label>
                  <input
                    type="text"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    placeholder="e.g. Focus on AI discussion or high emotion moments…"
                    className="w-full bg-paper border border-rule rounded-lg p-2 text-xs text-ink focus:border-[#ba6238] focus:outline-none truncate"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rights Confirmation Checkbox */}
          <div className="flex items-start gap-2 pt-0.5">
            <input
              type="checkbox"
              id="rightsCheck"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-rule text-[#ba6238] focus:ring-0 focus:outline-none accent-[#ba6238] cursor-pointer shrink-0"
            />
            <label htmlFor="rightsCheck" className="text-[11px] text-muted leading-tight cursor-pointer select-none">
              I confirm I own this content or have the rights to process it. See our <span className="text-ink underline hover:text-[#ba6238]">Terms</span> and{' '}
              <span className="text-ink underline hover:text-[#ba6238]">Privacy Policy</span>.
            </label>
          </div>

          {/* Generate Clips Button */}
          <div>
            <button
              type="submit"
              disabled={!canSubmit || isProcessing}
              className={`w-full py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm tracking-wider transition-colors flex items-center justify-center gap-2 ${
                canSubmit && !isProcessing
                  ? 'bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] text-white hover:brightness-110 cursor-pointer'
                  : 'bg-paper3 text-muted border border-rule cursor-not-allowed opacity-60'
              }`}
            >
              <span className="truncate">{isProcessing ? 'Analyzing & Generating Shorts…' : 'Generate Viral Shorts'}</span>
              {!isProcessing && <ArrowRight size={15} className="shrink-0" />}
            </button>
          </div>
        </form>
      </div>

      {/* Platform Icons (Compact row, fits on single screen) */}
      <div className="flex items-center justify-center gap-7 mt-3 text-muted text-xs">
        <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
          <Youtube size={15} className="text-red-500 shrink-0" />
          <span className="font-medium truncate text-[11px]">YouTube</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
          <Instagram size={14} className="text-pink-500 shrink-0" />
          <span className="font-medium truncate text-[11px]">Instagram</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-default">
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
          <span className="font-medium truncate text-[11px]">TikTok</span>
        </div>
      </div>
    </div>
  );
}
