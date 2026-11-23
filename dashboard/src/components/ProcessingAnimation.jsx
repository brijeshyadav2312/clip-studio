import React, { useState } from 'react';
import {
  Plus,
  Activity,
  Terminal,
  ChevronDown,
  Sparkles,
  Scissors,
  CheckCircle,
  Radio,
  Star,
  Loader2,
  Trash2,
} from 'lucide-react';
import ResultCard from './ResultCard';

export default function ProcessingAnimation({
  job,
  logs = [],
  onCancelProject,
  onDeleteClip,
}) {
  const [logsOpen, setLogsOpen] = useState(true);

  const status = job?.status || 'downloading';
  const progress = job?.progress || 0;
  const clips = Array.isArray(job?.clips) ? job.clips : [];
  const isDone = status === 'done';

  const formatTime = (ts) => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="w-full space-y-4 animate-fade">
      {/* Top Header Bar (Matching Image 3: + new project | platform chips | upgrade | user avatar) */}
      <div className="flex items-center justify-between py-2 border-b border-rule">
        {/* Left: + new project button */}
        <button
          type="button"
          onClick={onCancelProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-rule hover:border-brass/50 bg-paper2 hover:bg-paper3 text-ink text-xs font-mono transition-all lowercase"
          title="Terminate active generation and start fresh"
        >
          <Plus size={14} className="text-brass" />
          <span>+ new project</span>
        </button>

        {/* Right: Status Indicators & Credits & Profile */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper2 border border-rule text-muted text-xs">
            <span className="text-[11px] font-mono opacity-80">4 0 MIN</span>
            <span className="text-brass text-[10px] font-semibold uppercase hover:underline cursor-pointer">
              upgrade
            </span>
          </div>

          <div className="w-7 h-7 rounded-full bg-paper3 border border-rule flex items-center justify-center text-xs font-bold text-ink">
            B
          </div>
        </div>
      </div>

      {/* Split Workbench Grid (Matching Image 3: Left Live Analysis | Right Generated Shorts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: 📈 Live Analysis & Blueprint Canvas & Logs */}
        <div className="space-y-4">
          <div className="card p-4 sm:p-5 border border-rule2 bg-[#0e1015] shadow-xl space-y-4">
            {/* Header: 📈 live analysis | PROCESSING */}
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-brass animate-pulse" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                  live analysis
                </h3>
              </div>
              <span className="pill pill-warn uppercase text-[10px] font-mono tracking-wider animate-pulse">
                {isDone ? 'COMPLETED' : 'PROCESSING'}
              </span>
            </div>

            {/* Blueprint Video Scan Canvas (Matching Image 3) */}
            <div className="relative aspect-video rounded-card border border-rule overflow-hidden bg-black/95 flex items-center justify-center">
              {/* Background Blueprint Grid Lines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              />

              {/* Vertical 9:16 Crop Guides (Matching Image 3 center dashed frame) */}
              <div className="absolute inset-y-0 w-1/3 border-x border-dashed border-brass/50 bg-brass/5 flex flex-col items-center justify-center pointer-events-none">
                {/* Crosshair Target and Scissors */}
                <div className="w-12 h-12 rounded-full border border-brass/60 flex items-center justify-center relative">
                  <div className="w-2 h-2 rounded-full bg-brass animate-ping" />
                  <Scissors size={18} className="text-brass absolute" />
                </div>
              </div>

              {/* Horizontal Laser Scanning Line */}
              {!isDone && (
                <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brass to-transparent shadow-[0_0_12px_2px_var(--color-glow)] animate-scan pointer-events-none" />
              )}

              {/* Canvas Telemetry Overlays (Matching Image 3 text labels) */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                <span className="readout text-[10px] text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-brass">[ ]</span> SCANNING CONTENT...
                </span>
              </div>

              <div className="absolute top-3 right-3 z-10 pointer-events-none">
                <span className="readout text-[10px] text-brass uppercase tracking-wider">
                  VIRAL_DETECTION: ACTIVE
                </span>
              </div>

              <div className="absolute bottom-3 left-3 z-10 pointer-events-none space-y-0.5">
                <div className="readout text-[10px] text-muted tracking-wider">
                  &gt; ANALYSIS_THREAD_01: ACTIVE
                </div>
                <div className="readout text-[10px] text-brass/80 tracking-wider">
                  &gt; AUDIO_TRANSCRIPT: PROCESSING
                </div>
              </div>

              {/* Bottom Right Equalizer Waveform Bars (Matching Image 3 |||||) */}
              <div className="absolute bottom-3 right-3 z-10 flex items-end gap-1 h-3 pointer-events-none">
                <div className="w-1 h-3 bg-brass animate-pulse" />
                <div className="w-1 h-5 bg-brass animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2 bg-brass animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1 h-4 bg-brass animate-pulse" style={{ animationDelay: '450ms' }} />
                <div className="w-1 h-3 bg-brass animate-pulse" style={{ animationDelay: '200ms' }} />
              </div>
            </div>

            {/* Progress Bar & Status Text */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink font-medium truncate max-w-[80%]">
                  {job?.message || 'Analyzing scene transitions and audio cadence…'}
                </span>
                <span className="readout text-brass text-xs font-bold">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-paper3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brass to-amber-500 transition-all duration-300"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* GitHub Star Callout Banner (Matching Image 3) */}
          <a
            href="https://github.com/brijeshyadav2312/clip-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-3 border border-rule hover:border-brass/40 bg-paper2 flex items-center gap-2 text-xs text-ink hover:text-brass transition-all block group"
          >
            <span className="text-muted group-hover:text-brass transition-colors">💬</span>
            <span className="flex-1 text-muted group-hover:text-ink transition-colors">
              Got a minute while this renders? <span className="text-ink font-semibold">Star us on GitHub</span>
            </span>
            <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
          </a>

          {/* Collapsible System Logs (Matching Image 3: >_ SYSTEM LOGS ⌄) */}
          <div className="card border border-rule overflow-hidden bg-[#0a0c10]">
            <button
              type="button"
              onClick={() => setLogsOpen(!logsOpen)}
              className="w-full p-3 flex items-center justify-between text-xs text-muted hover:text-ink transition-colors border-b border-rule bg-paper"
            >
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Terminal size={13} className="text-brass" />
                <span>&gt;_ SYSTEM LOGS</span>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${logsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {logsOpen && (
              <div className="p-3 max-h-56 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed text-muted scrollbar-thin">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted/50 select-none">{formatTime()}</span>
                      <span className="text-ink/80">{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex gap-2">
                    <span className="text-muted/50 select-none">{formatTime()}</span>
                    <span className="text-ink/80">Starting process...</span>
                  </div>
                )}
                <div className="text-brass animate-pulse">_</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Generated Shorts (Matching Image 3: serif header | waiting spinner or grid) */}
        <div className="space-y-4">
          <div className="border-b border-rule pb-2 flex items-center justify-between">
            <h2 className="text-lg font-serif text-ink tracking-wide">generated shorts</h2>
            {clips.length > 0 && (
              <span className="pill pill-ok text-xs font-mono">{clips.length} ready</span>
            )}
          </div>

          {clips.length === 0 ? (
            /* Waiting for clips state with circular spinner (Matching Image 3) */
            <div className="card p-12 border border-rule2 bg-[#0e1015] rounded-card flex flex-col items-center justify-center text-center min-h-[360px] space-y-4">
              {/* Circular terracotta/orange spinner */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-brass/20 border-t-brass rounded-full animate-spin" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-medium text-ink">waiting for clips...</h4>
                <p className="text-xs text-muted max-w-xs">
                  They appear here one by one as each finishes rendering.
                </p>
              </div>
            </div>
          ) : (
            /* Rendered Clips List / Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {clips.map((clip, index) => (
                <ResultCard
                  key={clip.filename || index}
                  clip={clip}
                  jobId={job.id}
                  onDelete={onDeleteClip}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
