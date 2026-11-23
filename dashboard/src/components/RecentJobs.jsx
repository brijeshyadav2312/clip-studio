import React, { useState } from 'react';
import { ChevronDown, Trash2, Clock, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';

export default function RecentJobs({ jobs = [], onSelectJob, onDeleteJob, onDeleteAllJobs }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card overflow-hidden">
      <div
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer border-b border-rule bg-paper2"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted text-sm">{open ? '▼' : '▶'}</span>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider font-mono">Recent Jobs</h2>
          <span className="pill text-xs font-mono">{jobs.length}</span>
        </div>

        {jobs.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete all recent jobs history?')) {
                onDeleteAllJobs();
              }
            }}
            className="btn-ghost text-xs py-1 px-3 text-danger hover:border-danger flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Delete All Jobs</span>
          </button>
        )}
      </div>

      {open && (
        <div className="p-4 sm:p-5 space-y-3">
          {jobs.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted font-mono">No recent jobs found.</div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => {
                const isDone = j.status === 'done';
                const isError = j.status === 'error';
                const isRunning = !isDone && !isError;

                return (
                  <div
                    key={j.id}
                    onClick={() => onSelectJob(j.id)}
                    className="p-3.5 rounded-input border border-rule hover:border-rule2 bg-paper flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isDone && <CheckCircle2 size={18} className="text-ok shrink-0" />}
                      {isError && <AlertCircle size={18} className="text-danger shrink-0" />}
                      {isRunning && <PlayCircle size={18} className="text-brass animate-pulse shrink-0" />}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink truncate max-w-xs sm:max-w-md">
                            {j.title || j.url || j.id}
                          </span>
                          <span className="readout text-[10px] text-muted shrink-0">
                            {j.created ? new Date(j.created * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted truncate">{j.message || j.status}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                      <span className={`pill text-[11px] font-mono uppercase ${isDone ? 'pill-ok' : isError ? 'text-danger border-danger/30' : 'pill-warn'}`}>
                        {isDone ? `${j.clips?.length || 0} clips` : j.status}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteJob(j.id);
                        }}
                        className="p-1.5 text-muted hover:text-danger rounded transition-colors"
                        title="Delete job"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
