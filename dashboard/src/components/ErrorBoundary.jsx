import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Crash caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-xl mx-auto my-12 p-8 card border border-err/30 bg-[#0e1015] rounded-card text-center space-y-5 shadow-2xl animate-fade">
          <div className="w-14 h-14 rounded-full bg-err/10 border border-err/20 text-err flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              An unexpected error occurred while rendering this section. Don't worry, your data and generated clips are safe.
            </p>
            {this.state.error && (
              <div className="p-3 bg-black/60 rounded border border-rule text-[11px] font-mono text-err/90 text-left overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-paper3 hover:bg-paper2 text-ink border border-rule rounded-input text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Try again</span>
            </button>

            {this.props.onNavigateHome && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onNavigateHome();
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#ba6238] to-[#8d421e] text-white rounded-input text-xs font-semibold flex items-center gap-2 shadow-md hover:brightness-110 transition-all cursor-pointer lowercase"
              >
                <Home size={14} />
                <span>clip generator</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
