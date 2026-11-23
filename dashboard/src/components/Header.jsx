import React from 'react';
import { Film, Sparkles, Cookie, Activity } from 'lucide-react';

export default function Header({ config, cookieStatus }) {
  const llm = config?.llm || {};
  const ready = llm.ready;
  const provider = llm.provider || 'heuristic';

  return (
    <header className="border-b border-rule bg-paper sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-card bg-gradient-to-br from-brass to-amber-600 flex items-center justify-center shadow-lg shadow-brass/20 text-brassink font-bold text-base">
            <Film size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-ink text-base tracking-tight leading-none">Clip Studio</h1>
              <span className="text-[10px] font-mono uppercase bg-paper3 text-muted px-1.5 py-0.5 rounded border border-rule">v2.0</span>
            </div>
            <p className="text-xs text-muted mt-0.5 hidden sm:block">Long video in, vertical captioned viral shorts out</p>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {cookieStatus?.has_cookies && (
            <div className="pill pill-ok flex items-center gap-1.5 shrink-0" title="cookies.txt active for YouTube authentication">
              <Cookie size={12} />
              <span>cookies.txt active</span>
            </div>
          )}

          <div className={`pill ${ready ? 'pill-ok' : 'pill-warn'} flex items-center gap-1.5 shrink-0`}>
            <Sparkles size={12} />
            <span>{ready ? `AI: ${provider}` : 'Heuristic ranking'}</span>
          </div>

          <div className="pill flex items-center gap-1.5 shrink-0">
            <Activity size={12} className="text-brass" />
            <span className="hidden sm:inline">Local Engine:</span> Online
          </div>
        </div>
      </div>
    </header>
  );
}
