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

  // Auto-scroll log container smoothly
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'download':
        return <Download size={14} className="text-sky-400 shrink-0" />;
      case 'transcribe':
        return <FileAudio size={14} className="text-amber-400 shrink-0" />;
      case 'ranking':
        return <Sparkles size={14} className="text-purple-400 shrink-0" />;
      case 'rendering':
        return <Film size={14} className="text-emerald-400 shrink-0" />;
      default:
        return <Terminal size={14} className="text-[#ba6238] shrink-0" />;
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade">
      {/* Top Header Bar: New Project button (Static, no scaling) & Profile */}
      <div className="flex items-center justify-between py-2.5 border-b border-rule">
        <button
          type="button"
          onClick={onCancelProject}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rule hover:border-[#ba6238] bg-paper2 hover:bg-paper3 text-ink text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0"
          title="Terminate active generation and start fresh"
        >
          <Plus size={16} className="text-[#ba6238] shrink-0" />
          <span className="truncate">New Project</span>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper2 border border-rule text-muted text-xs">
            <span className="font-mono text-ink tracking-wider font-semibold">4 0 MIN</span>
            <span className="text-[#ba6238] text-[11px] font-bold uppercase hover:underline cursor-pointer">
              Upgrade
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-paper3 border border-rule flex items-center justify-center text-xs font-bold text-ink shrink-0">
            B
          </div>
        </div>
      </div>

      {/* Split Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">
        {/* LEFT COLUMN: Live Analysis & Blueprint Canvas & Logs */}
        <div className="space-y-4 min-w-0">
          <div className="card p-5 border border-rule2 bg-[#0e1015] rounded-2xl space-y-4">
            {/* Header: Live Analysis | Status Pill */}
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Activity size={18} className="text-[#ba6238] animate-pulse shrink-0" />
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink font-mono truncate">
                  Live Analysis
                </h3>
              </div>
              <span className="pill pill-warn uppercase text-[10px] font-mono tracking-widest animate-pulse px-2 py-0.5 shrink-0">
                {isDone ? 'Completed' : 'Processing'}
              </span>
            </div>

            {/* Blueprint Video Scan Canvas */}
            <div className="relative aspect-video rounded-xl border border-rule overflow-hidden bg-black/95 flex items-center justify-center">
              {/* Background Grid Lines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Vertical 9:16 Crop Guides */}
              <div className="absolute inset-y-0 w-1/3 border-x border-dashed border-[#ba6238]/60 bg-[#ba6238]/5 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full border border-[#ba6238]/70 flex items-center justify-center relative">
                  <div className="w-2 h-2 rounded-full bg-[#ba6238] animate-ping" />
                  <Scissors size={18} className="text-[#ba6238] absolute" />
                </div>
              </div>

              {/* Laser Scanning Line */}
              {!isDone && (
                <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#ba6238] to-transparent shadow-[0_0_12px_2px_var(--color-glow)] animate-scan pointer-events-none" />
              )}

              {/* Telemetry Readouts */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none max-w-[45%] truncate">
                <span className="readout text-[10px] sm:text-[11px] text-muted uppercase tracking-wider flex items-center gap-1.5 font-mono truncate">
                  <span className="text-[#ba6238]">[ ]</span> SCANNING CONTENT...
                </span>
              </div>

              <div className="absolute top-3 right-3 z-10 pointer-events-none max-w-[45%] text-right truncate">
                <span className="readout text-[10px] sm:text-[11px] text-[#ba6238] uppercase tracking-wider font-mono truncate">
                  VIRAL_DETECTION: ACTIVE
                </span>
              </div>

              <div className="absolute bottom-3 left-3 z-10 pointer-events-none space-y-0.5 max-w-[65%] truncate">
                <div className="readout text-[10px] sm:text-[11px] text-muted tracking-wider font-mono truncate">
                  &gt; ANALYSIS_THREAD_01: ACTIVE
                </div>
                <div className="readout text-[10px] sm:text-[11px] text-[#ba6238]/90 tracking-wider font-mono truncate">
                  &gt; AUDIO_TRANSCRIPT: PROCESSING
                </div>
              </div>

              {/* Waveform Equalizer */}
              <div className="absolute bottom-3 right-3 z-10 flex items-end gap-1 h-3.5 pointer-events-none">
                <div className="w-1 h-3 bg-[#ba6238] animate-pulse" />
                <div className="w-1 h-5 bg-[#ba6238] animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2 bg-[#ba6238] animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1 h-4 bg-[#ba6238] animate-pulse" style={{ animationDelay: '450ms' }} />
                <div className="w-1 h-3 bg-[#ba6238] animate-pulse" style={{ animationDelay: '200ms' }} />
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-ink font-medium truncate max-w-[80%]">
                  {job?.message || 'Processing video…'}
                </span>
                <span className="readout text-[#ba6238] text-xs font-bold font-mono shrink-0">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-paper3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ba6238] via-amber-500 to-amber-600 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* GitHub Star Banner */}
          <a
            href="https://github.com/brijeshyadav2312/clip-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-3 border border-rule hover:border-[#ba6238]/50 bg-paper2 flex items-center gap-2.5 text-xs sm:text-sm text-ink hover:text-[#ba6238] transition-colors block group rounded-xl"
          >
            <span className="text-base shrink-0">💬</span>
            <span className="flex-1 text-muted group-hover:text-ink transition-colors truncate">
              Got a minute while this renders? <span className="text-ink font-semibold">Star Clip Studio on GitHub</span>
            </span>
            <Star size={15} className="text-amber-400 fill-amber-400 shrink-0" />
          </a>

          {/* Collapsible System Logs */}
          <div className="card border border-rule overflow-hidden bg-[#0a0c10] rounded-2xl">
            <button
              type="button"
              onClick={() => setLogsOpen(!logsOpen)}
              className="w-full p-3 flex items-center justify-between text-xs text-muted hover:text-ink transition-colors border-b border-rule bg-paper cursor-pointer"
            >
              <div className="flex items-center gap-2 font-mono text-xs truncate">
                <Terminal size={14} className="text-[#ba6238] shrink-0" />
                <span className="truncate">&gt;_ SYSTEM LOGS</span>
                <span className="text-[10px] text-muted shrink-0">({logs.length} events)</span>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 shrink-0 ${logsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {logsOpen && (
              <div
                ref={logContainerRef}
                className="p-3.5 max-h-60 overflow-y-auto space-y-2 font-mono text-xs leading-relaxed text-muted custom-scrollbar"
              >
                {logs.length > 0 ? (
                  logs.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2.5 p-1 rounded hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted/60 select-none text-[11px] shrink-0 font-mono">
                          [{item.time}]
                        </span>
                        {getStageIcon(item.stage)}
                        <span className="text-ink/90 truncate">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.progressText && (
                          <span className="text-[10.5px] text-[#ba6238] font-bold bg-[#ba6238]/10 px-1.5 py-0.5 rounded border border-[#ba6238]/20">
                            {item.progressText}
                          </span>
                        )}

                        {item.status === 'running' && (
                          <Loader2 size={12} className="text-[#ba6238] animate-spin shrink-0" />
                        )}

                        {item.status === 'completed' && (
                          <CheckCircle2 size={13} className="text-ok shrink-0" />
                        )}

                        {item.status === 'error' && (
                          <AlertCircle size={13} className="text-err shrink-0" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-muted/60">
                    <span className="truncate">Starting video clipping engine...</span>
                    <Loader2 size={12} className="animate-spin text-[#ba6238] shrink-0" />
                  </div>
                )}
                {!isDone && <div className="text-[#ba6238] animate-pulse text-xs pl-1">_</div>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Generated Shorts */}
        <div className="space-y-4 min-w-0">
          <div className="border-b border-rule pb-2.5 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-serif text-ink tracking-wide truncate">Generated Shorts</h2>
            {clips.length > 0 && (
              <span className="pill pill-ok text-xs font-mono font-bold px-2 py-0.5 shrink-0">
                {clips.length} {clips.length === 1 ? 'Clip Ready' : 'Clips Ready'}
              </span>
            )}
          </div>

          {clips.length === 0 ? (
            <div className="card p-12 border border-rule2 bg-[#0e1015] rounded-2xl flex flex-col items-center justify-center text-center min-h-[380px] space-y-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-[#ba6238]/20 border-t-[#ba6238] rounded-full animate-spin" />
              </div>

              <div className="space-y-1 max-w-full px-4">
                <h4 className="text-sm sm:text-base font-semibold text-ink truncate">Analyzing Video & Detecting Hooks…</h4>
                <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                  Vertical shorts will appear here automatically as each clip finishes rendering.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade">
              {clips.map((clip, index) => (
                <ResultCard
                  key={clip.filename || clip.slug || index}
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
