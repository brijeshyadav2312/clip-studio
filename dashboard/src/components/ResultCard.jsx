import React, { useState } from 'react';
import { Download, FileText, Trash2, Play, Pause, Volume2, VolumeX, Sparkles, Clock } from 'lucide-react';

export default function ResultCard({ clip, jobId, onDelete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoUrl = clip.url || `/media/${jobId}/${clip.filename}`;
  const srtUrl = clip.srt_url || `/media/${jobId}/${clip.filename.replace(/\.mp4$/i, '.srt')}`;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${clip.filename}"?`)) return;
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(clip.filename);
      } else {
        const res = await fetch(`/api/jobs/${jobId}/clips/${clip.filename}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Delete clip error:', err);
      alert('Failed to delete clip');
    } finally {
      setIsDeleting(false);
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

  const durationSec = clip.duration ? Math.round(clip.duration) : Math.round((clip.end || 0) - (clip.start || 0));
  const score = Math.round(clip.score || clip.virality_score || 75);

  return (
    <div className="card p-3 shadow-xl border border-rule2 bg-[#0e1015] hover:border-brass/40 transition-all group flex flex-col justify-between">
      {/* Video Container (9:16 Portrait) */}
      <div className="relative aspect-[9/16] rounded-card overflow-hidden bg-black flex items-center justify-center border border-rule group/video">
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
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

      {/* Clip Info & Caption */}
      <div className="mt-3 space-y-2">
        <div className="min-h-[38px]">
          <p className="text-xs font-medium text-ink line-clamp-2 leading-snug">
            {clip.title || clip.hook || clip.text || clip.filename}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={(e) => handleDownload(e, videoUrl, clip.filename)}
            className="flex-1 py-1.5 px-2 bg-paper3 hover:bg-brass hover:text-brassink text-ink rounded-input text-[11px] font-medium transition-all flex items-center justify-center gap-1 border border-rule"
            title="Download MP4"
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
            disabled={isDeleting}
            onClick={handleDelete}
            className="p-1.5 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-input transition-colors border border-rule shrink-0"
            title="Delete this clip"
          >
            <Trash2 size={13} className={isDeleting ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
