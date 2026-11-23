import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Activity,
  Terminal,
  ChevronDown,
  Sparkles,
  Scissors,
  CheckCircle2,
  Radio,
  Star,
  Loader2,
  Download,
  FileAudio,
  Film,
  AlertCircle,
  Tv,
} from 'lucide-react';
import ResultCard from './ResultCard';

export default function ProcessingAnimation({
  job,
  logs = [],
  onCancelProject,
  onDeleteClip,
}) {
  const [logsOpen, setLogsOpen] = useState(true);
  const logContainerRef = useRef(null);

  const status = job?.status || 'downloading';
  const progress = job?.progress || 0;
  const clips = Array.isArray(job?.clips) ? job.clips : [];
  const isDone = status === 'done';

  // Smooth auto-scroll when new log activity happens
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Map stage to appropriate icon
  const getStageIcon = (stage) => {
    switch (stage) {
      case 'download':
        return <Download size={13} className="text-sky-400 shrink-0" />;
      case 'transcribe':
        return <FileAudio size={13} className="text-amber-400 shrink-0" />;
      case 'ranking':
        return <Sparkles size={13} className="text-purple-400 shrink-0" />;
      case 'rendering':
        return <Film size={13} className="text-emerald-400 shrink-0" />;
      default:
        return <Terminal size={13} className="text-brass shrink-0" />;
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade">
      {/* Top Header Bar (Matching Reference Image 3) */}
      <div className="flex items-center justify-between py-3 border-b border-rule">
        {/* Left: + new project button */}
        <button
          type="button"
          onClick={onCancelProject}
          className="flex items-center gap-2 px-4 py-2 rounded-card border border-rule hover:border-brass/60 bg-paper2 hover:bg-paper3 text-ink text-xs sm:text-sm font-mono transition-all duration-200 lowercase shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          title="Terminate active generation and start a new project"
        >
          <Plus size={16} className="text-brass" />
          <span>+ new project</span>
        </button>

        {/* Right: Credits and User Avatar */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper2 border border-rule text-muted text-xs shadow-inner">
            <span className="font-mono text-ink tracking-wider font-semibold">4 0 MIN</span>
            <span className="text-brass text-[10px] font-bold uppercase hover:underline cursor-pointer">
              upgrade
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-paper3 border border-rule flex items-center justify-center text-xs font-bold text-ink shadow-sm">
            B
          </div>
        </div>
      </div>

      {/* Split Workbench Grid (Matching Reference Image 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* LEFT COLUMN: 📈 Live Analysis & Blueprint Canvas & Logs */}
        <div className="space-y-5">
          <div className="card p-5 sm:p-6 border border-rule2 bg-[#0e1015] shadow-2xl rounded-2xl space-y-5">
            {/* Header: 📈 live analysis | PROCESSING */}
            <div className="flex items-center justify-between border-b border-rule pb-3.5">
              <div className="flex items-center gap-2.5">
                <Activity size={18} className="text-brass animate-pulse" />
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono">
                  live analysis
                </h3>
              </div>
              <span className="pill pill-warn uppercase text-[10px] font-mono tracking-widest animate-pulse px-2.5 py-1">
                {isDone ? 'COMPLETED' : 'PROCESSING'}
              </span>
            </div>

            {/* Blueprint Video Scan Canvas (Matching Reference Image 3) */}
            <div className="relative aspect-video rounded-xl border border-rule overflow-hidden bg-black/95 flex items-center justify-center shadow-inner">
              {/* Background Blueprint Grid Lines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-25"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Center 9:16 Crop Guide Box (Matching Reference Image 3 center dashed frame) */}
              <div className="absolute inset-y-0 w-1/3 border-x border-dashed border-brass/60 bg-brass/5 flex flex-col items-center justify-center pointer-events-none">
                {/* Crosshair Target and Scissors */}
                <div className="w-14 h-14 rounded-full border border-brass/70 flex items-center justify-center relative shadow-lg shadow-brass/20">
                  <div className="w-2.5 h-2.5 rounded-full bg-brass animate-ping" />
                  <Scissors size={20} className="text-brass absolute" />
                </div>
              </div>

              {/* Horizontal Laser Scanning Line */}
              {!isDone && (
                <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brass to-transparent shadow-[0_0_16px_3px_var(--color-glow)] animate-scan pointer-events-none" />
              )}

              {/* Canvas Telemetry Overlays (Matching Reference Image 3) */}
              <div className="absolute top-3.5 left-4 z-10 pointer-events-none">
                <span className="readout text-[10px] sm:text-[11px] text-muted uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <span className="text-brass">[ ]</span> SCANNING CONTENT...
                </span>
              </div>

              <div className="absolute top-3.5 right-4 z-10 pointer-events-none">
                <span className="readout text-[10px] sm:text-[11px] text-brass uppercase tracking-wider font-mono">
                  VIRAL_DETECTION: ACTIVE
                </span>
              </div>

              <div className="absolute bottom-3.5 left-4 z-10 pointer-events-none space-y-1">
                <div className="readout text-[10px] sm:text-[11px] text-muted tracking-wider font-mono">
                  &gt; ANALYSIS_THREAD_01: ACTIVE
                </div>
                <div className="readout text-[10px] sm:text-[11px] text-brass/90 tracking-wider font-mono">
                  &gt; AUDIO_TRANSCRIPT: PROCESSING
                </div>
              </div>

              {/* Bottom Right Equalizer Waveform Bars (Matching Reference Image 3) */}
              <div className="absolute bottom-3.5 right-4 z-10 flex items-end gap-1.5 h-4 pointer-events-none">
                <div className="w-1 h-3.5 bg-brass animate-pulse" />
                <div className="w-1 h-6 bg-brass animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2.5 bg-brass animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1 h-5 bg-brass animate-pulse" style={{ animationDelay: '450ms' }} />
                <div className="w-1 h-3 bg-brass animate-pulse" style={{ animationDelay: '200ms' }} />
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-ink font-medium truncate max-w-[80%]">
                  {job?.message || 'Processing video…'}
                </span>
                <span className="readout text-brass text-xs font-bold font-mono">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-paper3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brass via-amber-500 to-[#ba6238] transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* GitHub Star Callout Banner (Matching Reference Image 3) */}
          <a
            href="https://github.com/brijeshyadav2312/clip-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-3.5 border border-rule hover:border-brass/50 bg-paper2 flex items-center gap-3 text-xs sm:text-sm text-ink hover:text-brass transition-all duration-200 block group rounded-card"
          >
            <span className="text-base">💬</span>
            <span className="flex-1 text-muted group-hover:text-ink transition-colors">
              Got a minute while this renders? <span className="text-ink font-semibold">Star us on GitHub</span>
            </span>
            <Star size={16} className="text-amber-400 fill-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
          </a>

          {/* Collapsible System Logs (Fixed timing, stage icons, animated loaders, and in-place percentage updates) */}
          <div className="card border border-rule overflow-hidden bg-[#0a0c10] rounded-2xl shadow-xl">
            <button
              type="button"
              onClick={() => setLogsOpen(!logsOpen)}
              className="w-full p-3.5 flex items-center justify-between text-xs text-muted hover:text-ink transition-colors border-b border-rule bg-paper cursor-pointer"
            >
              <div className="flex items-center gap-2.5 font-mono text-xs">
                <Terminal size={14} className="text-brass" />
                <span>&gt;_ SYSTEM LOGS</span>
                <span className="text-[10px] text-muted">({logs.length} events)</span>
              </div>
              <ChevronDown
                size={15}
                className={`transition-transform duration-300 ${logsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {logsOpen && (
              <div
                ref={logContainerRef}
                className="p-4 max-h-64 overflow-y-auto space-y-2.5 font-mono text-xs leading-relaxed text-muted custom-scrollbar"
              >
                {logs.length > 0 ? (
                  logs.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-1.5 rounded hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Fixed creation timestamp */}
                        <span className="text-muted/60 select-none text-[11px] shrink-0 font-mono">
                          [{item.time}]
                        </span>

                        {/* Stage Icon */}
                        {getStageIcon(item.stage)}

                        {/* Main Log Text */}
                        <span className="text-ink/90 truncate">{item.title}</span>
                      </div>

                      {/* Status / Loader / Progress Indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.progressText && (
                          <span className="text-[11px] text-brass font-bold bg-brass/10 px-1.5 py-0.5 rounded border border-brass/20">
                            {item.progressText}
                          </span>
                        )}

                        {item.status === 'running' && (
                          <Loader2 size={13} className="text-brass animate-spin shrink-0" />
                        )}

                        {item.status === 'completed' && (
                          <CheckCircle2 size={14} className="text-ok shrink-0" />
                        )}

                        {item.status === 'error' && (
                          <AlertCircle size={14} className="text-err shrink-0" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-muted/60">
                    <span>Starting video clipping engine...</span>
                    <Loader2 size={12} className="animate-spin text-brass" />
                  </div>
                )}
                {!isDone && <div className="text-brass animate-pulse text-xs pl-1">_</div>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Generated Shorts (Matching Reference Image 3) */}
        <div className="space-y-5">
          <div className="border-b border-rule pb-3 flex items-center justify-between">
            <h2 className="text-xl font-serif text-ink tracking-wide">generated shorts</h2>
            {clips.length > 0 && (
              <span className="pill pill-ok text-xs font-mono font-bold px-2.5 py-1">
                {clips.length} {clips.length === 1 ? 'clip ready' : 'clips ready'}
              </span>
            )}
          </div>

          {clips.length === 0 ? (
            /* Waiting for clips state with warm orange circular spinner (Matching Reference Image 3) */
            <div className="card p-14 border border-rule2 bg-[#0e1015] rounded-2xl flex flex-col items-center justify-center text-center min-h-[420px] space-y-5 shadow-2xl">
              {/* Circular terracotta/orange spinner */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="w-12 h-12 border-[3px] border-brass/20 border-t-brass rounded-full animate-spin" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-medium text-ink">waiting for clips...</h4>
                <p className="text-xs sm:text-sm text-muted max-w-xs leading-relaxed">
                  They appear here one by one as each finishes rendering.
                </p>
              </div>
            </div>
          ) : (
            /* Rendered Clips Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade">
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
