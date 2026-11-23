import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Trash2,
  Download,
  FileText,
  Search,
  Filter,
  Film,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function HistoryView({ jobs = [], onRefresh, onDeleteAll, onNavigateToGenerator }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Local optimistic state for instant zero-delay updates
  const [localClips, setLocalClips] = useState([]);

  useEffect(() => {
    const list = [];
    if (!Array.isArray(jobs)) {
      setLocalClips([]);
      return;
    }

    jobs.forEach((job) => {
      if (!job || typeof job !== 'object') return;

      let jobDateObj = new Date();
      if (job.created) {
        const ts = typeof job.created === 'number' && job.created < 10000000000 ? job.created * 1000 : job.created;
        jobDateObj = new Date(ts);
      } else if (job.created_at) {
        jobDateObj = new Date(job.created_at);
      }

      const dateFormatted = !isNaN(jobDateObj.getTime())
        ? jobDateObj.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Recently generated';

      const rawClips = Array.isArray(job.clips) ? job.clips : [];

      rawClips.forEach((clip) => {
        if (!clip || typeof clip !== 'object') return;
        const filename =
          clip.filename ||
          (clip.video ? clip.video.split('/').pop() : `${clip.slug || 'clip'}.mp4`);

        list.push({
          ...clip,
          filename,
          jobId: job.id || 'job',
          jobTitle: job.title || job.url || 'Untitled Video',
          jobDate: dateFormatted,
          rawDate: !isNaN(jobDateObj.getTime()) ? jobDateObj : new Date(0),
        });
      });
    });

    list.sort((a, b) => b.rawDate - a.rawDate);
    setLocalClips(list);
  }, [jobs]);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteClip = async (jobId, filename) => {
    if (!window.confirm(`Delete clip "${filename}"?`)) return;

    setLocalClips((prev) => prev.filter((c) => !(c.jobId === jobId && c.filename === filename)));
    showToast(`Clip deleted successfully`);

    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed on server');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete clip error:', err);
      showToast('Server failed to delete clip file', 'err');
    }
  };

  const handleDeleteAllHistory = async () => {
    if (!window.confirm('Are you sure you want to delete ALL clips and job history? This cannot be undone.')) {
      return;
    }

    setIsDeletingAll(true);
    setLocalClips([]);
    showToast('All clips and history deleted');

    try {
      await fetch('/api/jobs', { method: 'DELETE' });
      if (onDeleteAll) onDeleteAll();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error clearing history:', err);
      showToast('Failed to delete some files from server', 'err');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      showToast('History refreshed');
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownload = (e, url, filename) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredClips = useMemo(() => {
    if (!searchTerm.trim()) return localClips;
    const q = searchTerm.toLowerCase();
    return localClips.filter((c) => {
      if (!c) return false;
      const titleMatch = c.title && String(c.title).toLowerCase().includes(q);
      const fileMatch = c.filename && String(c.filename).toLowerCase().includes(q);
      const jobMatch = c.jobTitle && String(c.jobTitle).toLowerCase().includes(q);
      const textMatch = c.text && String(c.text).toLowerCase().includes(q);
      return titleMatch || fileMatch || jobMatch || textMatch;
    });
  }, [localClips, searchTerm]);

  return (
    <div className="w-full space-y-6 animate-fade">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-xl shadow-lg flex items-center gap-3 animate-fade text-xs sm:text-sm font-medium border ${
            toast.type === 'ok'
              ? 'bg-[#0e1713] text-ok border-ok/30'
              : 'bg-[#1a0f0f] text-err border-err/30'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span className="truncate max-w-xs">{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 hover:opacity-80 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock size={20} className="text-[#ba6238] shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight truncate">
              Clips History
            </h1>
            <span className="pill pill-muted text-xs font-mono ml-1.5 font-semibold shrink-0">
              {localClips.length} {localClips.length === 1 ? 'Clip' : 'Clips'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1 truncate">
            Browse, preview, download, and manage your rendered vertical shorts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clips…"
              className="bg-paper2 border border-rule focus:border-[#ba6238] rounded-xl py-1.5 pl-8 pr-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none w-48 transition-colors"
            />
          </div>

          {/* Refresh Button (Static, no scale) */}
          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleManualRefresh}
            className="p-2 bg-paper2 hover:bg-paper3 text-muted hover:text-ink border border-rule rounded-xl transition-colors cursor-pointer"
            title="Refresh History"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#ba6238]' : ''} />
          </button>

          {/* Delete All History Button (Static, no scale) */}
          {localClips.length > 0 && (
            <button
              type="button"
              disabled={isDeletingAll}
              onClick={handleDeleteAllHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-err/10 hover:bg-err/20 text-err border border-err/30 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              title="Delete all jobs and clips"
            >
              <Trash2 size={13} className={isDeletingAll ? 'animate-spin' : ''} />
              <span className="truncate">Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Clips Per Row Responsive Grid */}
      {filteredClips.length === 0 ? (
        <div className="card p-14 border border-rule2 bg-[#0e1015] rounded-2xl flex flex-col items-center justify-center text-center space-y-3.5">
          <div className="w-12 h-12 rounded-xl bg-paper3 border border-rule flex items-center justify-center text-muted">
            <Film size={22} />
          </div>
          <div className="space-y-1 max-w-full px-4">
            <h3 className="text-base font-semibold text-ink truncate">No Clips in History</h3>
            <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto leading-relaxed">
              {searchTerm
                ? 'No clips match your search query. Try searching with different keywords.'
                : 'You have not generated any shorts yet, or all previous clips were deleted.'}
            </p>
          </div>
          {!searchTerm && onNavigateToGenerator && (
            <button
              type="button"
              onClick={onNavigateToGenerator}
              className="mt-2 py-2 px-5 rounded-xl bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all cursor-pointer"
            >
              Create New Shorts
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredClips.map((clip, index) => {
            const videoUrl = clip.url || `/media/${clip.jobId}/clips/${clip.filename}`;
            const srtFilename = String(clip.filename).replace(/\.mp4$/i, '.srt');
            const srtUrl = clip.srt_url || `/media/${clip.jobId}/clips/${srtFilename}`;
            const thumbUrl = clip.thumb_url || (clip.thumb ? `/media/${clip.jobId}/${clip.thumb}` : null);
            const durationSec = clip.duration
              ? Math.round(clip.duration)
              : Math.round((clip.end || 0) - (clip.start || 0));
            const score = Math.round(clip.score || clip.virality_score || 75);

            return (
              <div
                key={`${clip.jobId}-${clip.filename}-${index}`}
                className="card p-3 border border-rule2 bg-[#0e1015] hover:border-[#ba6238]/50 transition-colors rounded-2xl flex flex-col justify-between group"
              >
                {/* 9:16 Video Player Preview */}
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-rule">
                  <video
                    src={videoUrl || undefined}
                    poster={thumbUrl || undefined}
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
                    <span className="pill pill-ok text-[10px] font-mono font-bold">
                      Score {score}
                    </span>
                    {durationSec > 0 && (
                      <span className="pill bg-black/80 border border-rule text-ink text-[10px] font-mono">
                        {durationSec}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="mt-3 space-y-2.5 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-ink line-clamp-2 break-words leading-snug">
                      {clip.title || clip.hook || clip.text || clip.filename}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-muted font-mono truncate">
                      <Clock size={11} className="shrink-0" />
                      <span className="truncate">{clip.jobDate}</span>
                    </div>
                  </div>

                  {/* Action buttons: Download MP4 | SRT | Seperate Individual Delete Button */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-rule/70">
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, videoUrl, clip.filename)}
                      className="flex-1 py-1.5 px-2 bg-paper3 hover:bg-[#ba6238] hover:text-white text-ink rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 border border-rule cursor-pointer truncate"
                      title="Download MP4 video"
                    >
                      <Download size={12} className="shrink-0" />
                      <span className="truncate">MP4</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, srtUrl, srtFilename)}
                      className="py-1.5 px-2.5 bg-paper2 hover:bg-paper3 text-muted hover:text-ink rounded-lg text-xs font-mono transition-colors border border-rule cursor-pointer shrink-0"
                      title="Download Subtitles SRT"
                    >
                      SRT
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClip(clip.jobId, clip.filename)}
                      className="p-1.5 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-lg transition-colors border border-rule shrink-0 cursor-pointer"
                      title="Delete this clip"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
