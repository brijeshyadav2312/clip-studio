import React, { useState, useRef } from 'react';
import { Download, FileText, Trash2, Play, Pause, Volume2, VolumeX, Sparkles, Clock } from 'lucide-react';

export default function ResultCard({ clip = {}, jobId = '', onDelete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const videoRef = useRef(null);

  const filename =
    clip.filename ||
    (clip.video ? clip.video.split('/').pop() : `${clip.slug || 'clip'}.mp4`);

  const srtFilename = filename.replace(/\.mp4$/i, '.srt');

  const videoUrl =
    clip.url ||
    (clip.video ? `/media/${jobId}/${clip.video}` : `/media/${jobId}/clips/${filename}`);

  const srtUrl =
    clip.srt_url ||
    (clip.srt ? `/media/${jobId}/${clip.srt}` : `/media/${jobId}/clips/${srtFilename}`);

  const thumbUrl = clip.thumb_url || (clip.thumb ? `/media/${jobId}/${clip.thumb}` : null);

  const handlePlay = (e) => {
    setIsPlaying(true);
    // Pause all other videos on the page so only one plays at a time
    document.querySelectorAll('video').forEach((v) => {
      if (v !== e.target && !v.paused) {
        v.pause();
      }
    });
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const togglePlay = (e) => {
    // Avoid double toggling if clicked directly on native control bar
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      document.querySelectorAll('video').forEach((v) => {
        if (v !== videoRef.current && !v.paused) v.pause();
      });
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(filename);
      } else {
        const res = await fetch(`/api/jobs/${jobId}/clips/${filename}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Delete clip error:', err);
      alert('Failed to delete clip');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (e, url, name) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const durationSec = clip.duration
    ? Math.round(clip.duration)
    : Math.round((clip.end || 0) - (clip.start || 0));
  const score = Math.round(clip.score || clip.virality_score || 75);

  return (
    <div className="card p-3 border border-rule2 bg-[#0e1015] hover:border-[#ba6238]/50 transition-colors rounded-2xl group flex flex-col justify-between">
      {/* Video Container (9:16 Portrait, fully clickable) */}
      <div
        onClick={togglePlay}
        className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-rule group/video cursor-pointer"
      >
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          poster={thumbUrl || undefined}
          controls
          preload="metadata"
          className="w-full h-full object-cover"
          onPlay={handlePlay}
          onPause={handlePause}
        />

        {/* Center Glass Play Button Overlay (visible when paused or hover) */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover/video:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl group-hover/video:scale-110 transition-transform">
              <Play size={20} className="fill-white ml-0.5" />
            </div>
          </div>
        )}

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

      {/* Clip Info & Caption */}
      <div className="mt-3 space-y-2 min-w-0">
        <div className="min-h-[38px] min-w-0">
          <p className="text-xs sm:text-sm font-medium text-ink line-clamp-2 break-words leading-snug">
            {clip.title || clip.hook || clip.text || filename}
          </p>
        </div>

        {/* Action Buttons (Static, no scaling) */}
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-rule/60">
          <button
            type="button"
            onClick={(e) => handleDownload(e, videoUrl, filename)}
            className="flex-1 py-1.5 px-2 bg-paper3 hover:bg-[#ba6238] hover:text-white text-ink rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 border border-rule cursor-pointer truncate"
            title="Download MP4"
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
            disabled={isDeleting}
            onClick={handleDelete}
            className="p-1.5 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-lg transition-colors border border-rule shrink-0 cursor-pointer"
            title="Delete this clip"
          >
            <Trash2 size={13} className={isDeleting ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
