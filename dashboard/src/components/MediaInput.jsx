import React, { useState, useRef } from 'react';
import { Upload, Link2, FileVideo, X, ChevronDown, Sparkles, Sliders, Shield, Cookie, Check } from 'lucide-react';

const SUPPORTED_PLATFORMS = ['YouTube', 'Twitch', 'Kick', 'TikTok', 'X / Twitter', 'Vimeo', 'Facebook', 'Direct MP4'];

export default function MediaInput({ onProcess, isProcessing, onUploadCookies, cookieStatus }) {
  const [mode, setMode] = useState('url'); // 'url' | 'file'
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [aspect, setAspect] = useState('9:16');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const cookieFileRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMode('file');
    }
  };

  const handleCookieSelect = (e) => {
    const f = e.target.files?.[0];
    if (f && onUploadCookies) {
      onUploadCookies(f);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isProcessing) return;

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

    if (mode === 'file' && file) {
      onProcess({ type: 'file', payload: file, options });
    } else if (mode === 'url' && url.trim()) {
      onProcess({ type: 'url', payload: url.trim(), options });
    }
  };

  const canSubmit = mode === 'file' ? !!file : !!url.trim();

  return (
    <div className="card p-5 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex gap-6 mb-6 border-b border-rule">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center gap-2 pb-3 px-1 -mb-px border-b-2 text-sm font-medium transition-colors ${
            mode === 'url' ? 'text-ink border-brass' : 'text-muted border-transparent hover:text-ink2'
          }`}
        >
          <Link2 size={16} className={mode === 'url' ? 'text-brass' : ''} />
          Video URL
        </button>
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`flex items-center gap-2 pb-3 px-1 -mb-px border-b-2 text-sm font-medium transition-colors ${
            mode === 'file' ? 'text-ink border-brass' : 'text-muted border-transparent hover:text-ink2'
          }`}
        >
          <Upload size={16} className={mode === 'file' ? 'text-brass' : ''} />
          Upload File
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Input Field Area */}
        {mode === 'url' ? (
          <div>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/... paste YouTube, Twitch, or video link"
                className="input-field pr-12 text-base"
                required={mode === 'url'}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {/* Platforms row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="eyebrow mr-1">Supported:</span>
              {SUPPORTED_PLATFORMS.map((p) => (
                <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-paper3 text-muted border border-rule">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-card p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-brass bg-paper' : 'border-rule2 hover:border-brass hover:bg-paper'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('videoFileInput')?.click()}
          >
            <input
              id="videoFileInput"
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3 text-ok">
                <FileVideo size={22} className="shrink-0 text-brass" />
                <span className="font-medium text-ink truncate max-w-sm">{file.name}</span>
                <span className="readout text-muted">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="p-1 text-muted hover:text-danger rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto mb-3 text-brass" size={24} />
                <p className="text-ink font-medium">Click to select video or drag and drop</p>
                <p className="readout text-muted mt-1">MP4, MOV, WEBM, MKV · Unlimited file size</p>
              </div>
            )}
          </div>
        )}

        {/* Output Aspect Ratio Visual Cards */}
        <div>
          <label className="eyebrow block mb-2">Output Format & Aspect Ratio</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '9:16', label: '9:16', name: 'Vertical Short', hint: 'Shorts · Reels · TikTok', w: 18, h: 32 },
              { value: '1:1', label: '1:1', name: 'Square Post', hint: 'Feed Posts · Instagram', w: 26, h: 26 },
              { value: '16:9', label: '16:9', name: 'Horizontal', hint: 'Keep Landscape Original', w: 34, h: 20 },
            ].map((f) => {
              const active = aspect === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setAspect(f.value)}
                  className={`p-3.5 rounded-input border flex flex-col items-center gap-2 transition-all ${
                    active ? 'border-brass bg-brass/10 text-ink shadow-lg shadow-brass/10' : 'border-rule text-muted hover:border-rule2 bg-paper'
                  }`}
                >
                  <span
                    className="rounded-[3px] border-2 transition-colors"
                    style={{
                      width: `${f.w}px`,
                      height: `${f.h}px`,
                      borderColor: active ? 'var(--color-accent)' : 'var(--color-rule-2)',
                      backgroundColor: active ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent',
                    }}
                  />
                  <div className="text-center">
                    <span className="block font-mono text-xs font-semibold text-ink">{f.label}</span>
                    <span className="block text-[11px] text-muted">{f.hint}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Options Accordion */}
        <div className="border-t border-rule pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full py-2 text-xs font-mono uppercase tracking-wider text-muted hover:text-ink transition-colors"
          >
            <span className="flex items-center gap-2 text-ink font-semibold">
              <Sliders size={14} className="text-brass" />
              Studio Customization Options (Subtitles, Layouts, 10 Streamer Controls)
            </span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-rule space-y-5 text-sm animate-fade">
              {/* Clips Length & Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="eyebrow block mb-1">Clips Count</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={numClips}
                    onChange={(e) => setNumClips(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="eyebrow block mb-1">Min Length (Sec)</label>
                  <input
                    type="number"
                    min="8"
                    max="120"
                    value={minSec}
                    onChange={(e) => setMinSec(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="eyebrow block mb-1">Max Length (Sec)</label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={maxSec}
                    onChange={(e) => setMaxSec(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Subtitles & Whisper Model */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="eyebrow block mb-1">Subtitle Script / Hinglish</label>
                  <select
                    value={subtitleScript}
                    onChange={(e) => setSubtitleScript(e.target.value)}
                    className="input-field"
                  >
                    <option value="auto">Auto (Hinglish for Hindi/Urdu, English for English)</option>
                    <option value="hinglish">Hinglish (Hindi in English Latin script)</option>
                    <option value="en_translate">Translate to English</option>
                    <option value="hi">Hindi (Devanagari script)</option>
                    <option value="original">Original Spoken</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1">Caption Visual Style</label>
                  <select
                    value={captionStyle}
                    onChange={(e) => setCaptionStyle(e.target.value)}
                    className="input-field"
                  >
                    <option value="wordpop">WordPop (Yellow active word punch)</option>
                    <option value="glow">Neon Glow Subtitle</option>
                    <option value="karaoke">Karaoke Gradient</option>
                    <option value="clean">Clean Minimalist</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1">Whisper Model Engine</label>
                  <select
                    value={whisperModel}
                    onChange={(e) => setWhisperModel(e.target.value)}
                    className="input-field"
                  >
                    <option value="base">Base (Fastest ~15s, 74M)</option>
                    <option value="small">Small (Balanced accuracy, 244M)</option>
                    <option value="medium">Medium (Top accuracy for accents, 769M)</option>
                  </select>
                </div>
              </div>

              {/* Layout Mode & Stabilization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="eyebrow block mb-1">Reframing Layout Preset</label>
                  <select
                    value={layout}
                    onChange={(e) => setLayout(e.target.value)}
                    className="input-field"
                  >
                    <option value="auto">Auto (Smart Dynamic: Face-crop + Landscape for Charts/Slides)</option>
                    <option value="dynamic_landscape">Dynamic Landscape (Full Landscape on Charts/Slides)</option>
                    <option value="fit_blur">Smart Fit + Ambient Blur (100% Full Landscape)</option>
                    <option value="crop">Speaker Crop (Vertical Face Track)</option>
                    <option value="streamer_split">Streamer Split (Webcam Top + Gameplay Bottom)</option>
                    <option value="gameplay_center">Gameplay Center Action (Vehicle / Crosshair / GTA 6)</option>
                    <option value="gameplay_blur">Gameplay Full Frame + Blurred Backdrop</option>
                    <option value="streamer_pip">Streamer Picture-in-Picture</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1">Camera Motion & Stability</label>
                  <select
                    value={stabilization}
                    onChange={(e) => setStabilization(e.target.value)}
                    className="input-field"
                  >
                    <option value="locked_tripod">Tripod Lock (Zero Shivering - Rock solid)</option>
                    <option value="smooth_cinematic">Smooth Cinematic Pan</option>
                    <option value="dynamic">Dynamic Tracking</option>
                  </select>
                </div>
              </div>

              {/* 10 Streamer & Gaming Controls */}
              <div className="border border-rule rounded-input p-4 bg-paper space-y-3">
                <span className="eyebrow text-brass block">10 Streamer & Gaming Customization Controls</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">1. Gameplay Action Focus</label>
                    <select value={streamerGameFocus} onChange={(e) => setStreamerGameFocus(e.target.value)} className="input-field text-xs">
                      <option value="center">Center (GTA 6 Vehicle / Crosshair)</option>
                      <option value="center_low">Center Low (Third-Person Car)</option>
                      <option value="center_high">Center High (FPS Crosshair)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">2. Split Ratio</label>
                    <select value={streamerSplitRatio} onChange={(e) => setStreamerSplitRatio(e.target.value)} className="input-field text-xs">
                      <option value="35_65">35% Face / 65% Game</option>
                      <option value="30_70">30% Face / 70% Game</option>
                      <option value="50_50">50% Equal Split</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">3. Facecam Position</label>
                    <select value={streamerCamPos} onChange={(e) => setStreamerCamPos(e.target.value)} className="input-field text-xs">
                      <option value="auto">Auto-Detect Webcam</option>
                      <option value="top-left">Top-Left Corner</option>
                      <option value="top-right">Top-Right Corner</option>
                      <option value="bottom-right">Bottom-Right Corner</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">4. Glow Divider Line</label>
                    <select value={streamerDivider} onChange={(e) => setStreamerDivider(e.target.value)} className="input-field text-xs">
                      <option value="glow">Neon Glow Line</option>
                      <option value="subtle">Subtle 2px Border</option>
                      <option value="none">Seamless (No Line)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">5. Theme Accent Color</label>
                    <select value={streamerTheme} onChange={(e) => setStreamerTheme(e.target.value)} className="input-field text-xs">
                      <option value="purple_cyan">Cyber Purple (#7c5cff)</option>
                      <option value="cyan">Neon Mint (#21d4a0)</option>
                      <option value="gold">Sunset Gold (#ffca62)</option>
                      <option value="red">Crimson Red (#ff5c72)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">6. Streamer Handle Watermark</label>
                    <input
                      type="text"
                      placeholder="e.g. @your_channel"
                      value={streamerTag}
                      onChange={(e) => setStreamerTag(e.target.value)}
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* YouTube Cookies & Authentication */}
              <div className="border border-rule rounded-input p-4 bg-paper flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Cookie size={20} className="text-brass shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-ink">YouTube Bot Verification & Cookies</p>
                    <p className="text-[11px] text-muted">Bypass YouTube sign-in challenges by passing your exported session cookies.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={cookieFileRef}
                    type="file"
                    accept=".txt"
                    onChange={handleCookieSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cookieFileRef.current?.click()}
                    className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Upload size={13} />
                    Upload cookies.txt
                  </button>
                  {cookieStatus?.has_cookies && (
                    <span className="pill pill-ok text-xs">Active</span>
                  )}
                </div>
              </div>

              {/* Profanity and Custom Hook */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="eyebrow block mb-1">Custom Top-of-Screen Hook Headline</label>
                  <input
                    type="text"
                    placeholder="Leave empty for AI auto-generated hook"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="censorCheck"
                    checked={censor}
                    onChange={(e) => setCensor(e.target.checked)}
                    className="w-4 h-4 accent-brass"
                  />
                  <label htmlFor="censorCheck" className="text-xs text-ink cursor-pointer">
                    Mute and mask profanity words automatically
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={!canSubmit || isProcessing}
            className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3.5 shadow-xl"
          >
            <Sparkles size={18} />
            <span>{isProcessing ? 'Processing Clips…' : 'Make Clips'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
