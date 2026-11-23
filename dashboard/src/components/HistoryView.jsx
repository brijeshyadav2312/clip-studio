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
  Play,
  Share2,
} from 'lucide-react';

export default function HistoryView({ jobs = [], onRefresh, onNavigateToGenerator }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Bulletproof flattening of clips across all jobs
  const allClips = useMemo(() => {
    const list = [];
    if (!Array.isArray(jobs)) return list;

    jobs.forEach((job) => {
      if (!job || typeof job !== 'object') return;

      // Extract and format date safely
      let jobDateObj = new Date();
      if (job.created) {
        // Unix timestamp in seconds or ms
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

      // Ensure clips is strictly an array of valid clip objects
      const rawClips = Array.isArray(job.clips) ? job.clips : [];

      rawClips.forEach((clip) => {
        if (!clip || typeof clip !== 'object' || !clip.filename) return;

        list.push({
          ...clip,
          jobId: job.id || 'job',
          jobTitle: job.title || job.url || 'Untitled Video',
          jobDate: dateFormatted,
          rawDate: !isNaN(jobDateObj.getTime()) ? jobDateObj : new Date(0),
        });
      });
    });

    // Sort newest first
    return list.sort((a, b) => b.rawDate - a.rawDate);
  }, [jobs]);

  // Safely filter clips based on search query
  const filteredClips = useMemo(() => {
    if (!searchTerm.trim()) return allClips;
    const q = searchTerm.toLowerCase();
    return allClips.filter((c) => {
      if (!c) return false;
      const titleMatch = c.title && String(c.title).toLowerCase().includes(q);
      const fileMatch = c.filename && String(c.filename).toLowerCase().includes(q);
      const jobMatch = c.jobTitle && String(c.jobTitle).toLowerCase().includes(q);
      const textMatch = c.text && String(c.text).toLowerCase().includes(q);
      return titleMatch || fileMatch || jobMatch || textMatch;
    });
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
      await fetch('/api/jobs', { method: 'DELETE' }).catch(() => null);
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
    <div className="w-full space-y-7 animate-fade">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Clock size={22} className="text-brass" />
            <h1 className="text-xl sm:text-2xl font-semibold text-ink lowercase tracking-tight">
              clips history
            </h1>
            <span className="pill pill-muted text-xs font-mono ml-2">
              {allClips.length} {allClips.length === 1 ? 'clip' : 'clips'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Browse, preview, download, and manage all your generated vertical shorts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clips…"
              className="bg-paper2 border border-rule focus:border-brass rounded-card py-2 pl-9 pr-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none w-52 transition-all duration-200"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 bg-paper2 hover:bg-paper3 text-muted hover:text-ink border border-rule rounded-card transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw size={15} />
          </button>

          {/* Delete All History Button */}
          {allClips.length > 0 && (
            <button
              type="button"
              disabled={isDeletingAll}
              onClick={handleDeleteAllHistory}
              className="flex items-center gap-2 px-3.5 py-2 bg-err/10 hover:bg-err/20 text-err border border-err/30 rounded-card text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Delete all jobs and clips"
            >
              <Trash2 size={14} className={isDeletingAll ? 'animate-spin' : ''} />
              <span>delete all</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive 4-Column Grid (1 row 4 clips on desktop) */}
      {filteredClips.length === 0 ? (
        <div className="card p-16 border border-rule2 bg-[#0e1015] rounded-2xl flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-paper3 border border-rule flex items-center justify-center text-muted shadow-inner">
            <Film size={26} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-ink">No clips found</h3>
            <p className="text-xs sm:text-sm text-muted max-w-sm leading-relaxed">
              {searchTerm
                ? 'No clips match your search query. Try searching for different keywords.'
                : 'You have not generated any clips yet. Generate your first viral vertical clip!'}
            </p>
          </div>
          {!searchTerm && onNavigateToGenerator && (
            <button
              type="button"
              onClick={onNavigateToGenerator}
              className="mt-3 py-2.5 px-5 rounded-card bg-gradient-to-r from-[#ba6238] to-[#8d421e] text-white text-xs sm:text-sm font-semibold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer lowercase"
            >
              go to clip generator
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredClips.map((clip, index) => {
            const videoUrl = clip.url || `/media/${clip.jobId}/${clip.filename}`;
            const srtFilename = String(clip.filename).replace(/\.mp4$/i, '.srt');
            const srtUrl = clip.srt_url || `/media/${clip.jobId}/${srtFilename}`;
            const durationSec = clip.duration
              ? Math.round(clip.duration)
              : Math.round((clip.end || 0) - (clip.start || 0));
            const score = Math.round(clip.score || clip.virality_score || 75);

            return (
              <div
                key={`${clip.jobId}-${clip.filename}-${index}`}
                className="card p-3.5 border border-rule2 bg-[#0e1015] hover:border-brass/50 transition-all duration-300 shadow-xl rounded-2xl flex flex-col justify-between group hover:-translate-y-1"
              >
                {/* 9:16 Video Player Preview */}
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-rule shadow-inner">
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <span className="pill pill-ok text-[11px] font-mono shadow-md backdrop-blur-md font-bold">
                      Score {score}
                    </span>
                    {durationSec > 0 && (
                      <span className="pill bg-black/80 border border-rule text-ink text-[11px] font-mono shadow-md backdrop-blur-md">
                        {durationSec}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="mt-3.5 space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-ink line-clamp-2 leading-snug">
                      {clip.title || clip.hook || clip.text || clip.filename}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted font-mono">
                      <Clock size={12} />
                      <span>{clip.jobDate}</span>
                    </div>
                  </div>

                  {/* Action buttons: Download MP4 | SRT | Seperate Individual Delete Button */}
                  <div className="flex items-center gap-2 pt-2 border-t border-rule/70">
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, videoUrl, clip.filename)}
                      className="flex-1 py-2 px-2.5 bg-paper3 hover:bg-brass hover:text-brassink text-ink rounded-input text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border border-rule cursor-pointer"
                      title="Download MP4 video"
                    >
                      <Download size={13} />
                      <span>MP4</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, srtUrl, srtFilename)}
                      className="py-2 px-3 bg-paper2 hover:bg-paper3 text-muted hover:text-ink rounded-input text-xs font-mono transition-colors border border-rule cursor-pointer"
                      title="Download Subtitles SRT"
                    >
                      SRT
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClip(clip.jobId, clip.filename)}
                      className="p-2 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-input transition-colors border border-rule shrink-0 cursor-pointer"
                      title="Delete this clip"
                    >
                      <Trash2 size={14} />
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
