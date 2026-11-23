import React from 'react';
import { Compass, Home, Scissors } from 'lucide-react';

export default function NotFoundView({ onNavigateHome }) {
  return (
    <div className="w-full max-w-md mx-auto my-16 p-8 card border border-rule2 bg-[#0e1015] rounded-card text-center space-y-5 shadow-2xl animate-fade">
      <div className="w-16 h-16 rounded-full bg-paper3 border border-rule text-brass flex items-center justify-center mx-auto shadow-inner">
        <Compass size={32} className="animate-spin" style={{ animationDuration: '16s' }} />
      </div>

      <div className="space-y-2">
        <span className="readout text-brass text-xs font-mono font-bold tracking-widest uppercase">
          404 · PAGE NOT FOUND
        </span>
        <h2 className="text-lg font-semibold text-ink lowercase">destination not found</h2>
        <p className="text-xs text-muted leading-relaxed">
          The view or resource you are looking for does not exist or has been moved.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateHome}
          className="px-5 py-2.5 bg-gradient-to-r from-[#ba6238] to-[#8d421e] text-white rounded-card text-xs font-semibold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer lowercase"
        >
          <Scissors size={14} />
          <span>return to clip generator</span>
        </button>
      </div>
    </div>
  );
}
