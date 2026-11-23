import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import ResultCard from './ResultCard';

export default function HistoryView({ jobs = [], onRefresh, onNavigateToGenerator }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Flatten all clips from all completed or active jobs
  const allClips = useMemo(() => {
    const list = [];
    jobs.forEach((job) => {
      const jobDate = job.created_at ? new Date(job.created_at) : new Date();
      const dateFormatted = jobDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      (job.clips || []).forEach((clip) => {
        list.push({
          ...clip,
          jobId: job.id,
          jobTitle: job.title || job.url || 'Untitled Video',
          jobDate: dateFormatted,
          rawDate: jobDate,
        });
      });
    });

    // Sort newest first
    return list.sort((a, b) => b.rawDate - a.rawDate);
  }, [jobs]);

  // Filter clips based on search term
  const filteredClips = useMemo(() => {
    if (!searchTerm.trim()) return allClips;
    const q = searchTerm.toLowerCase();
    return allClips.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.filename && c.filename.toLowerCase().includes(q)) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(q)) ||
        (c.text && c.text.toLowerCase().includes(q))
    );
  }, [allClips, searchTerm]);

  const handleDeleteClip = async (jobId, filename) => {
    if (!window.confirm(`Delete clip "${filename}"?`)) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete clip');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete clip error:', err);
      alert('Failed to delete clip');
    }
  };

  const handleDeleteAllHistory = async () => {
    if (!window.confirm('Are you sure you want to delete ALL clips and job history? This cannot be undone.')) {
      return;
    }
    setIsDeletingAll(true);
    try {
      await Promise.all(
        jobs.map((job) => fetch(`/api/jobs/${job.id}`, { method: 'DELETE' }).catch(() => null))
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error clearing history:', err);
      alert('Failed to clear some history');
    } finally {
      setIsDeletingAll(false);
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

  return (
    <div className="w-full space-y-6 animate-fade">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-brass" />
            <h1 className="text-xl font-semibold text-ink lowercase tracking-tight">clips history</h1>
            <span className="pill pill-muted text-xs font-mono ml-2">
              {allClips.length} {allClips.length === 1 ? 'clip' : 'clips'}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Browse, preview, download, and manage all your generated vertical shorts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clips…"
              className="bg-paper2 border border-rule focus:border-brass rounded-input py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted/60 focus:outline-none w-48 transition-colors"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 bg-paper2 hover:bg-paper3 text-muted hover:text-ink border border-rule rounded-input transition-colors"
            title="Refresh list"
          >
            <RefreshCw size={14} />
          </button>

          {/* Delete All History Button */}
          {allClips.length > 0 && (
            <button
              type="button"
              disabled={isDeletingAll}
              onClick={handleDeleteAllHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-err/10 hover:bg-err/20 text-err border border-err/30 rounded-input text-xs font-medium transition-colors"
              title="Delete all jobs and clips"
            >
              <Trash2 size={13} className={isDeletingAll ? 'animate-spin' : ''} />
              <span>delete all</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Clips Per Row Grid (grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4) */}
      {filteredClips.length === 0 ? (
        <div className="card p-16 border border-rule2 bg-[#0e1015] rounded-card flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-paper3 border border-rule flex items-center justify-center text-muted">
            <Film size={22} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">No clips found</h3>
            <p className="text-xs text-muted max-w-sm">
              {searchTerm
                ? 'No clips match your search query. Try searching for something else.'
                : 'You have not generated any clips yet. Create your first viral clip with the clip generator!'}
            </p>
          </div>
          {!searchTerm && onNavigateToGenerator && (
            <button
              type="button"
              onClick={onNavigateToGenerator}
              className="mt-2 py-2 px-4 rounded-input bg-gradient-to-r from-[#ba6238] to-[#8d421e] text-white text-xs font-medium shadow-md hover:brightness-110 transition-all lowercase"
            >
              go to clip generator
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredClips.map((clip, index) => {
            const videoUrl = clip.url || `/media/${clip.jobId}/${clip.filename}`;
            const srtUrl = clip.srt_url || `/media/${clip.jobId}/${clip.filename.replace(/\.mp4$/i, '.srt')}`;
            const durationSec = clip.duration
              ? Math.round(clip.duration)
              : Math.round((clip.end || 0) - (clip.start || 0));
            const score = Math.round(clip.score || clip.virality_score || 75);

            return (
              <div
                key={`${clip.jobId}-${clip.filename}-${index}`}
                className="card p-3 border border-rule2 bg-[#0e1015] hover:border-brass/40 transition-all shadow-xl flex flex-col justify-between group"
              >
                {/* 9:16 Video Player Preview */}
                <div className="relative aspect-[9/16] rounded-card overflow-hidden bg-black flex items-center justify-center border border-rule">
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <span className="pill pill-ok text-[10px] font-mono shadow-md backdrop-blur-md">
                      Score {score}
                    </span>
                    {durationSec > 0 && (
                      <span className="pill bg-black/75 border border-rule text-ink text-[10px] font-mono shadow-md backdrop-blur-md">
                        {durationSec}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="mt-3 space-y-2.5">
                  <div>
                    <p className="text-xs font-medium text-ink line-clamp-2 leading-snug">
                      {clip.title || clip.hook || clip.text || clip.filename}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted font-mono">
                      <Clock size={11} />
                      <span>{clip.jobDate}</span>
                    </div>
                  </div>

                  {/* Action buttons: Download MP4 | SRT | Seperate Delete Button */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-rule/60">
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, videoUrl, clip.filename)}
                      className="flex-1 py-1.5 px-2 bg-paper3 hover:bg-brass hover:text-brassink text-ink rounded-input text-[11px] font-medium transition-all flex items-center justify-center gap-1 border border-rule"
                      title="Download MP4 video"
                    >
                      <Download size={12} />
                      <span>MP4</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, srtUrl, clip.filename.replace(/\.mp4$/i, '.srt'))}
                      className="py-1.5 px-2.5 bg-paper2 hover:bg-paper3 text-muted hover:text-ink rounded-input text-[11px] font-mono transition-colors border border-rule"
                      title="Download Subtitles SRT"
                    >
                      SRT
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClip(clip.jobId, clip.filename)}
                      className="p-1.5 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-input transition-colors border border-rule shrink-0"
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
