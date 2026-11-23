import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Sliders,
  Type,
  Video,
  Shield,
  Cookie,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layout,
  Volume2,
} from 'lucide-react';

export default function SettingsView({
  cookieStatus,
  onUploadCookies,
  onDeleteCookies,
  sidebarPosition,
  setSidebarPosition,
}) {
  const [subtitleScript, setSubtitleScript] = useState(
    () => localStorage.getItem('clip_pref_script') || 'auto'
  );
  const [whisperModel, setWhisperModel] = useState(
    () => localStorage.getItem('clip_pref_whisper') || 'base'
  );
  const [stabilization, setStabilization] = useState(
    () => localStorage.getItem('clip_pref_stabilization') || 'locked_tripod'
  );
  const [defaultAspect, setDefaultAspect] = useState(
    () => localStorage.getItem('clip_pref_aspect') || '9:16'
  );
  const [captionStyle, setCaptionStyle] = useState(
    () => localStorage.getItem('clip_pref_caption_style') || 'wordpop'
  );
  const [streamerCamShape, setStreamerCamShape] = useState(
    () => localStorage.getItem('clip_pref_cam_shape') || 'rect'
  );
  const [streamerSplitRatio, setStreamerSplitRatio] = useState(
    () => localStorage.getItem('clip_pref_split_ratio') || '35_65'
  );
  const [browserCookies, setBrowserCookies] = useState(
    () => localStorage.getItem('clip_pref_browser_cookies') || ''
  );

  const [savedToast, setSavedToast] = useState(false);
  const cookieInputRef = useRef(null);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('clip_pref_script', subtitleScript);
    localStorage.setItem('clip_pref_whisper', whisperModel);
    localStorage.setItem('clip_pref_stabilization', stabilization);
    localStorage.setItem('clip_pref_aspect', defaultAspect);
    localStorage.setItem('clip_pref_caption_style', captionStyle);
    localStorage.setItem('clip_pref_cam_shape', streamerCamShape);
    localStorage.setItem('clip_pref_split_ratio', streamerSplitRatio);
    localStorage.setItem('clip_pref_browser_cookies', browserCookies);

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleCookieFile = (e) => {
    const f = e.target.files?.[0];
    if (f && onUploadCookies) {
      onUploadCookies(f);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-7 py-6 animate-fade">
      {/* Header */}
      <div className="border-b border-rule pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Settings size={26} className="text-brass" />
            <h1 className="text-xl sm:text-2xl font-semibold text-ink lowercase tracking-tight">
              settings & defaults
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1.5">
            Configure subtitle generation, camera framing, layout styles, and YouTube cookies.
          </p>
        </div>

        {savedToast && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-ok bg-ok/10 border border-ok/30 px-3.5 py-2 rounded-card animate-fade font-medium">
            <CheckCircle2 size={16} />
            <span>Preferences saved</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Subtitle & Language Customization */}
        <div className="card p-6 sm:p-7 border border-rule2 bg-[#0e1015] shadow-xl rounded-2xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-rule pb-3.5">
            <Type size={18} className="text-brass" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono">
              subtitles & transcription
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Default Subtitle Script
              </label>
              <select
                value={subtitleScript}
                onChange={(e) => setSubtitleScript(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="auto">Auto (Detect Hindi/English)</option>
                <option value="hinglish">Hinglish (Roman English script for Hindi/Mix)</option>
                <option value="english">English (Strict English)</option>
                <option value="hindi">Hindi (Devanagari script)</option>
              </select>
              <span className="text-[11px] text-muted block mt-1.5">
                Ensures consistency so spoken Hindi words are written in Roman alphabet if Hinglish is selected.
              </span>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Whisper AI Model
              </label>
              <select
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="base">base (Balanced speed & memory - Recommended)</option>
                <option value="tiny">tiny (Fastest, lower accuracy)</option>
                <option value="small">small (Higher accuracy)</option>
                <option value="medium">medium (Best multilingual transcription)</option>
              </select>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Caption Visual Style
              </label>
              <select
                value={captionStyle}
                onChange={(e) => setCaptionStyle(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="wordpop">WordPop (Yellow dynamic pop)</option>
                <option value="karaoke">Karaoke (Smooth gradient reveal)</option>
                <option value="minimal">Minimal (Clean subtitle strip)</option>
                <option value="none">Disabled (No burned-in subtitles)</option>
              </select>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Default Output Aspect Ratio
              </label>
              <select
                value={defaultAspect}
                onChange={(e) => setDefaultAspect(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="9:16">9:16 (Vertical Shorts / Reels / TikTok)</option>
                <option value="1:1">1:1 (Square Feed Post)</option>
                <option value="16:9">16:9 (Landscape YouTube)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Camera & Streamer Controls */}
        <div className="card p-6 sm:p-7 border border-rule2 bg-[#0e1015] shadow-xl rounded-2xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-rule pb-3.5">
            <Video size={18} className="text-brass" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono">
              camera tracking & streamer layout
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Camera Stabilization
              </label>
              <select
                value={stabilization}
                onChange={(e) => setStabilization(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="locked_tripod">Locked Tripod (Zero jitter)</option>
                <option value="smooth_pan">Smooth Dynamic Pan</option>
                <option value="disabled">Center Static Crop</option>
              </select>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Streamer Cam Shape
              </label>
              <select
                value={streamerCamShape}
                onChange={(e) => setStreamerCamShape(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="rect">Rounded Rectangle</option>
                <option value="circle">Circular Pip</option>
              </select>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-ink block mb-2">
                Split Screen Ratio
              </label>
              <select
                value={streamerSplitRatio}
                onChange={(e) => setStreamerSplitRatio(e.target.value)}
                className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
              >
                <option value="35_65">35% Cam / 65% Gameplay</option>
                <option value="50_50">50% Cam / 50% Content</option>
                <option value="25_75">25% Cam / 75% Screen</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: YouTube Cookies & Authentication */}
        <div className="card p-6 sm:p-7 border border-rule2 bg-[#0e1015] shadow-xl rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-rule pb-3.5">
            <div className="flex items-center gap-2.5">
              <Cookie size={18} className="text-brass" />
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono">
                youtube authentication & cookies
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {cookieStatus?.has_cookies ? (
                <span className="pill pill-ok text-xs font-mono font-semibold">
                  Cookies Active ({(cookieStatus.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <span className="pill pill-muted text-xs font-mono">No Cookies</span>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Upload your <code className="text-ink font-mono bg-paper3 px-1.5 py-0.5 rounded">cookies.txt</code> file to bypass YouTube bot challenges and download restricted or high-resolution videos seamlessly.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <input
              type="file"
              ref={cookieInputRef}
              accept=".txt"
              onChange={handleCookieFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cookieInputRef.current?.click()}
              className="px-4 py-2.5 bg-paper2 hover:bg-paper3 text-ink border border-rule rounded-card text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload size={15} className="text-brass" />
              <span>Upload cookies.txt</span>
            </button>

            {cookieStatus?.has_cookies && (
              <button
                type="button"
                onClick={onDeleteCookies}
                className="px-4 py-2.5 bg-err/10 hover:bg-err/20 text-err border border-err/30 rounded-card text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Trash2 size={15} />
                <span>Remove Cookies</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 4: Interface & Sidebar Position */}
        <div className="card p-6 sm:p-7 border border-rule2 bg-[#0e1015] shadow-xl rounded-2xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-rule pb-3.5">
            <Layout size={18} className="text-brass" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono">
              interface layout & placement
            </h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-sm font-medium text-ink block">Sidebar Position</span>
              <span className="text-xs text-muted block mt-0.5">
                Switch sidebar placement between Left (Default) or Right.
              </span>
            </div>

            <div className="flex items-center gap-2 bg-paper2 p-1.5 rounded-card border border-rule">
              <button
                type="button"
                onClick={() => setSidebarPosition('left')}
                className={`px-4 py-1.5 text-xs sm:text-sm rounded-input font-medium transition-all duration-200 cursor-pointer ${
                  sidebarPosition === 'left' ? 'bg-brass text-brassink font-bold shadow' : 'text-muted hover:text-ink'
                }`}
              >
                Left (Default)
              </button>
              <button
                type="button"
                onClick={() => setSidebarPosition('right')}
                className={`px-4 py-1.5 text-xs sm:text-sm rounded-input font-medium transition-all duration-200 cursor-pointer ${
                  sidebarPosition === 'right' ? 'bg-brass text-brassink font-bold shadow' : 'text-muted hover:text-ink'
                }`}
              >
                Right
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#ba6238] via-[#a8522a] to-[#8d421e] text-white text-xs sm:text-sm font-semibold tracking-wider hover:brightness-110 active:scale-[0.99] transition-all shadow-xl shadow-[#ba6238]/25 flex items-center justify-center gap-2 cursor-pointer lowercase"
        >
          <span>save settings & preferences</span>
        </button>
      </form>
    </div>
  );
}
