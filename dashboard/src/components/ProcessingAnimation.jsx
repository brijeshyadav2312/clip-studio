import React, { useState } from 'react';
import { Scan, Scissors, Activity, Terminal, ChevronDown, CheckCircle, Radio } from 'lucide-react';

export default function ProcessingAnimation({ job, logs = [] }) {
  const [logsVisible, setLogsVisible] = useState(true);

  const status = job?.status || 'downloading';
  const progress = job?.progress || 0;
  const message = job?.message || 'Processing video…';

  const steps = [
    { id: 'downloading', label: 'Download' },
    { id: 'transcribing', label: 'Transcribe' },
    { id: 'ranking', label: 'AI Highlights' },
    { id: 'rendering', label: 'Render Shorts' },
  ];

  const currentIdx = steps.findIndex((s) => s.id === status);

  return (
    <div className="card p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-5 animate-fade">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-brass animate-pulse" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink font-mono">Live Video Analysis</h2>
        </div>
        <span className="pill pill-warn uppercase text-xs animate-pulse">
          {status}
        </span>
      </div>

      {/* Blueprint Visual Scanner Box */}
      <div className="relative aspect-video rounded-card border border-rule overflow-hidden bg-black/80 flex items-center justify-center">
        {/* Blueprint Grid Lines */}
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Laser Scan Line */}
        <div className="absolute left-0 w-full h-[2px] bg-brass shadow-[0_0_15px_3px_var(--color-glow)] animate-scan z-20 pointer-events-none" />
        <div className="absolute left-0 w-full h-[20%] bg-brass/10 animate-scan-overlay z-10 pointer-events-none" />

        {/* Center Target Reticle */}
        <div className="relative z-20 flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 border border-rule2 rounded-full flex items-center justify-center relative">
            <div className="w-2.5 h-2.5 bg-brass rounded-full animate-ping" />
            <Scissors size={20} className="text-brass/70 absolute" />
          </div>
          <span className="eyebrow text-brass/80 text-[10px] tracking-widest mt-1">AI DETECTING VIRAL HOOKS</span>
        </div>

        {/* Top HUD Telemetry */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between text-xs pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/80 border border-rule readout text-brass">
            <Scan size={13} className="animate-pulse" />
            <span>AI_FRAME_TRACKER</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/80 border border-rule readout text-muted">
            <Radio size={13} className="text-brass animate-pulse" />
            <span>VIRAL_PUNCH: ACTIVE</span>
          </div>
        </div>

        {/* Bottom Equalizer Waveform */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80 border-t border-rule z-30 flex items-center justify-between">
          <div className="readout text-muted text-[10px] flex items-center gap-1.5">
            <Activity size={10} className="text-brass" />
            <span>AUDIO_SPECTROGRAM: RECOGNIZING</span>
          </div>
          <div className="flex items-end gap-1 h-3">
            <div className="w-1 h-3 bg-brass animate-pulse" />
            <div className="w-1 h-5 bg-brass animate-pulse" />
            <div className="w-1 h-2 bg-brass animate-pulse" />
            <div className="w-1 h-4 bg-brass animate-pulse" />
            <div className="w-1 h-3 bg-brass animate-pulse" />
          </div>
        </div>
      </div>

      {/* Pipeline Step Breadcrumbs */}
      <div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {steps.map((s, idx) => {
            const isDone = status === 'done' || (currentIdx > -1 && idx < currentIdx);
            const isActive = idx === currentIdx;
            return (
              <div
                key={s.id}
                className={`py-2 px-1 text-center rounded-input border transition-all text-xs font-mono ${
                  isDone
                    ? 'border-ok/30 bg-ok/10 text-ok'
                    : isActive
                    ? 'border-brass bg-brass/10 text-brass font-bold animate-pulse'
                    : 'border-rule text-muted opacity-40'
                }`}
              >
                <div className="truncate">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar & Status */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-paper rounded-full overflow-hidden border border-rule">
            <div
              className="h-full bg-gradient-to-r from-brass to-amber-500 transition-all duration-300"
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-muted">
            <span className="text-ink truncate">{message}</span>
            <span className="text-brass font-bold shrink-0">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Terminal Logs Drawer */}
      <div className="bg-paper rounded-card border border-rule overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsVisible(!logsVisible)}
          className="w-full px-4 py-2 border-b border-rule flex items-center justify-between bg-paper2 text-xs font-mono text-muted hover:text-ink transition-colors"
        >
          <span className="flex items-center gap-2">
            <Terminal size={13} className="text-brass" /> System Console Stream
          </span>
          <div className="flex items-center gap-2">
            <span className="readout text-[10px]">{logs.length} events</span>
            <ChevronDown size={14} className={`transition-transform ${logsVisible ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {logsVisible && (
          <div className="p-3.5 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar text-muted">
            {logs.length === 0 ? (
              <div className="text-muted/60 italic">Starting engine process…</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-brass/60 shrink-0">›</span>
                  <span className="text-ink2 break-all">{log}</span>
                </div>
              ))
            )}
            <div className="animate-pulse text-brass">_</div>
          </div>
        )}
      </div>
    </div>
  );
}
