import React from 'react';
import { Compass, Home, Scissors } from 'lucide-react';

export default function NotFoundView({ onNavigateHome }) {
  return (
    <div className="w-full max-w-md mx-auto my-12 p-8 card border border-rule2 bg-[#0e1015] rounded-2xl text-center space-y-4 animate-fade">
      <div className="w-14 h-14 rounded-2xl bg-paper3 border border-rule text-[#ba6238] flex items-center justify-center mx-auto">
        <Compass size={28} className="animate-spin" style={{ animationDuration: '16s' }} />
      </div>

      <div className="space-y-1.5">
        <span className="readout text-[#ba6238] text-xs font-mono font-bold tracking-widest uppercase">
          404 · PAGE NOT FOUND
        </span>
        <h2 className="text-lg font-semibold text-ink">Destination Not Found</h2>
        <p className="text-xs text-muted leading-relaxed">
          The view or resource you are looking for does not exist or has been moved.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateHome}
          className="px-5 py-2.5 bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          <Scissors size={14} />
          <span>Return to Clip Generator</span>
        </button>
      </div>
    </div>
  );
}
