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
    <div className="w-full max-w-3xl mx-auto py-8 px-4">
      <div className="card p-7 sm:p-9 shadow-2xl relative border border-rule2 bg-[#0e1015]/95 backdrop-blur-2xl transition-all duration-300 rounded-2xl">
        {/* Top Tabs (Matching Reference Image 1) */}
        <div className="flex gap-8 mb-7 border-b border-rule">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center gap-2.5 pb-3.5 px-1 -mb-px border-b-2 text-sm font-semibold lowercase tracking-wide transition-all duration-200 cursor-pointer ${
              mode === 'upload'
                ? 'text-ink border-brass'
                : 'text-muted border-transparent hover:text-ink2'
            }`}
          >
            <Upload size={16} className={mode === 'upload' ? 'text-brass' : 'text-muted'} />
            <span>upload file</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center gap-2.5 pb-3.5 px-1 -mb-px border-b-2 text-sm font-semibold lowercase tracking-wide transition-all duration-200 cursor-pointer ${
              mode === 'url'
                ? 'text-ink border-brass'
                : 'text-muted border-transparent hover:text-ink2'
            }`}
          >
            <Link2 size={16} className={mode === 'url' ? 'text-brass' : 'text-muted'} />
            <span>video url</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Main Input Area */}
          {mode === 'upload' ? (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  file
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/5'
                    : 'border-rule hover:border-brass/60 hover:bg-paper2/60 group'
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
                  <div className="flex flex-col items-center text-center gap-3 animate-fade">
                    <div className="w-14 h-14 rounded-2xl bg-brass/20 border border-brass/40 flex items-center justify-center text-brass shadow-md">
                      <FileVideo size={28} />
                    </div>
                    <div className="font-semibold text-ink text-base max-w-md truncate">{file.name}</div>
                    <div className="readout text-muted text-xs">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB · Ready for AI clipping
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="mt-2 text-xs text-brass hover:underline flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <X size={13} /> Choose a different video file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-rule flex items-center justify-center text-muted group-hover:text-brass group-hover:border-brass/40 group-hover:scale-105 transition-all duration-200 bg-paper2 shadow-sm">
                      <Upload size={20} />
                    </div>
                    <p className="text-ink text-base font-medium">click to upload or drag and drop</p>
                    <p className="readout text-xs text-muted tracking-wider uppercase font-mono">
                      MP4, MOV UP TO 500MB · AT LEAST 45S LONG
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube, Twitch, Kick, or direct video URL…"
                  className="w-full bg-paper2 border border-rule focus:border-brass rounded-card py-4 pl-5 pr-12 text-sm sm:text-base text-ink placeholder:text-muted/60 focus:outline-none transition-all duration-200 shadow-inner"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1.5 rounded-input hover:bg-paper3 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="text-muted">Supports YouTube, Twitch, Kick, Vimeo, TikTok, etc.</span>
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
                    className="text-brass hover:underline font-medium cursor-pointer"
                  >
                    paste from clipboard
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OUTPUT FORMAT Selection Cards (Matching Reference Image 1) */}
          <div className="space-y-3 pt-1">
            <label className="readout block text-center text-xs tracking-widest text-muted uppercase font-mono">
              OUTPUT FORMAT
            </label>

            <div className="grid grid-cols-3 gap-3.5">
              {/* 9:16 Card */}
              <button
                type="button"
                onClick={() => setAspect('9:16')}
                className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-200 text-center cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  aspect === '9:16'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-6 h-9 border-2 rounded-[4px] flex items-center justify-center mb-3 transition-colors ${
                    aspect === '9:16' ? 'border-brass' : 'border-muted'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      aspect === '9:16' ? 'bg-brass' : 'bg-muted'
                    }`}
                  />
                </div>
                <span
                  className={`text-sm font-semibold block tracking-wide ${
                    aspect === '9:16' ? 'text-brass' : 'text-ink'
                  }`}
                >
                  9:16
                </span>
                <span className="text-xs text-muted block mt-1">Shorts · Reels · TikTok</span>
              </button>

              {/* 1:1 Card */}
              <button
                type="button"
                onClick={() => setAspect('1:1')}
                className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-200 text-center cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  aspect === '1:1'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-8 h-8 border-2 rounded-[4px] flex items-center justify-center mb-3 transition-colors ${
                    aspect === '1:1' ? 'border-brass' : 'border-muted'
                  }`}
                />
                <span
                  className={`text-sm font-semibold block tracking-wide ${
                    aspect === '1:1' ? 'text-brass' : 'text-ink'
                  }`}
                >
                  1:1
                </span>
                <span className="text-xs text-muted block mt-1">Feed posts</span>
              </button>

              {/* 16:9 Card */}
              <button
                type="button"
                onClick={() => setAspect('16:9')}
                className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-200 text-center cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  aspect === '16:9'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:border-rule2 hover:bg-paper2'
                }`}
              >
                <div
                  className={`w-9 h-6 border-2 rounded-[4px] flex items-center justify-center mb-3 transition-colors ${
                    aspect === '16:9' ? 'border-brass' : 'border-muted'
                  }`}
                />
                <span
                  className={`text-sm font-semibold block tracking-wide ${
                    aspect === '16:9' ? 'text-brass' : 'text-ink'
                  }`}
                >
                  16:9
                </span>
                <span className="text-xs text-muted block mt-1">Keep landscape · YouTube</span>
              </button>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronDown
                size={15}
                className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}
              />
              <span>advanced options</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 p-5 rounded-2xl border border-rule bg-paper2/80 space-y-4 animate-fade text-xs">
                {/* Row 1: Subtitle script & style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-muted block mb-1.5 font-medium">Subtitle Language / Script</label>
                    <select
                      value={subtitleScript}
                      onChange={(e) => setSubtitleScript(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-input p-2.5 text-ink focus:border-brass focus:outline-none"
                    >
                      <option value="auto">Auto (Detect Hindi/English)</option>
                      <option value="hinglish">Hinglish (Roman English script for Hindi/Mix)</option>
                      <option value="english">English (Strict English)</option>
                      <option value="hindi">Hindi (Devanagari)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-muted block mb-1.5 font-medium">Caption Animation Style</label>
                    <select
                      value={captionStyle}
                      onChange={(e) => setCaptionStyle(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-input p-2.5 text-ink focus:border-brass focus:outline-none"
                    >
                      <option value="wordpop">WordPop (Yellow dynamic pop)</option>
                      <option value="karaoke">Karaoke (Gradient reveal)</option>
                      <option value="minimal">Minimal (Clean subtitle strip)</option>
                      <option value="none">No Subtitles</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Camera framing & Clips count */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-muted block mb-1.5 font-medium">Camera Stabilization</label>
                    <select
                      value={stabilization}
                      onChange={(e) => setStabilization(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-input p-2.5 text-ink focus:border-brass focus:outline-none"
                    >
                      <option value="locked_tripod">Locked Tripod (Zero Jitter)</option>
                      <option value="smooth_pan">Smooth Dynamic Pan</option>
                      <option value="disabled">Center Static Crop</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-muted block mb-1.5 font-medium">Number of Clips: {numClips}</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={numClips}
                      onChange={(e) => setNumClips(Number(e.target.value))}
                      className="w-full accent-brass mt-2 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-muted block mb-1.5 font-medium">Max Duration: {maxSec}s</label>
                    <input
                      type="range"
                      min="15"
                      max="90"
                      step="5"
                      value={maxSec}
                      onChange={(e) => setMaxSec(Number(e.target.value))}
                      className="w-full accent-brass mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Row 3: Custom Hook / Prompt */}
                <div>
                  <label className="text-muted block mb-1.5 font-medium">Custom Highlight Prompt / Focus (Optional)</label>
                  <input
                    type="text"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    placeholder="e.g. Focus on AI bubble discussion or high emotional moments…"
                    className="w-full bg-paper border border-rule rounded-input p-2.5 text-ink focus:border-brass focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rights Confirmation Checkbox (Matching Reference Image 1) */}
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="rightsCheck"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-rule text-brass focus:ring-0 focus:outline-none accent-brass cursor-pointer"
            />
            <label htmlFor="rightsCheck" className="text-xs text-muted leading-relaxed cursor-pointer select-none">
              I confirm I own this content or have the rights to process it. I am responsible for any content I submit.
              See our <span className="text-ink underline hover:text-brass">Terms</span> and{' '}
              <span className="text-ink underline hover:text-brass">Privacy Policy</span>.
            </label>
          </div>

          {/* Terracotta / Burnt Copper Generate Clips Button (Matching Reference Image 1) */}
          <div>
            <button
              type="submit"
              disabled={!canSubmit || isProcessing}
              className={`w-full py-4 px-8 rounded-2xl font-semibold text-sm tracking-wider transition-all duration-300 lowercase shadow-xl flex items-center justify-center gap-2 ${
                canSubmit && !isProcessing
                  ? 'bg-gradient-to-r from-[#ba6238] via-[#a8522a] to-[#8d421e] text-white hover:brightness-110 hover:shadow-2xl hover:shadow-[#ba6238]/30 active:scale-[0.99] cursor-pointer'
                  : 'bg-paper3 text-muted border border-rule cursor-not-allowed opacity-60'
              }`}
            >
              <span>{isProcessing ? 'analyzing & generating clips…' : 'generate clips'}</span>
              {!isProcessing && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>

      {/* Platform Icons (Matching Reference Image 1 Bottom: YouTube | Instagram | TikTok) */}
      <div className="flex items-center justify-center gap-10 mt-8 text-muted text-xs sm:text-sm">
        <div className="flex items-center gap-2 hover:text-ink transition-colors cursor-default">
          <Youtube size={17} className="text-red-500" />
          <span>YouTube</span>
        </div>
        <div className="flex items-center gap-2 hover:text-ink transition-colors cursor-default">
          <Instagram size={16} className="text-pink-500" />
          <span>Instagram</span>
        </div>
        <div className="flex items-center gap-2 hover:text-ink transition-colors cursor-default">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
          <span>TikTok</span>
        </div>
      </div>
    </div>
  );
}
