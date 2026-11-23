import React, { useState } from 'react';
import { Download, FileText, Trash2, Play, Pause, Volume2, VolumeX, Sparkles, Clock } from 'lucide-react';

export default function ResultCard({ clip = {}, jobId = '', onDelete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Safe filename resolution: handles clip.filename, clip.video, clip.slug
  const filename =
    clip.filename ||
    (clip.video ? clip.video.split('/').pop() : `${clip.slug || 'clip'}.mp4`);

  const srtFilename = filename.replace(/\.mp4$/i, '.srt');

  // Safe URLs: prefers clip.url/clip.video directly from backend
  const videoUrl =
    clip.url ||
    (clip.video ? `/media/${jobId}/${clip.video}` : `/media/${jobId}/clips/${filename}`);

  const srtUrl =
    clip.srt_url ||
    (clip.srt ? `/media/${jobId}/${clip.srt}` : `/media/${jobId}/clips/${srtFilename}`);

  const thumbUrl = clip.thumb_url || (clip.thumb ? `/media/${jobId}/${clip.thumb}` : null);

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
    <div className="card p-3.5 shadow-xl border border-rule2 bg-[#0e1015] hover:border-brass/50 transition-all duration-300 rounded-2xl group flex flex-col justify-between">
      {/* Video Container (9:16 Portrait) */}
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-rule shadow-inner group/video">
        <video
          src={videoUrl}
          poster={thumbUrl || undefined}
          controls
          preload="metadata"
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
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

      {/* Clip Info & Caption */}
      <div className="mt-3.5 space-y-2.5">
        <div className="min-h-[40px]">
          <p className="text-xs sm:text-sm font-medium text-ink line-clamp-2 leading-snug">
            {clip.title || clip.hook || clip.text || filename}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-rule/60">
          <button
            type="button"
            onClick={(e) => handleDownload(e, videoUrl, filename)}
            className="flex-1 py-2 px-2.5 bg-paper3 hover:bg-brass hover:text-brassink text-ink rounded-input text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border border-rule cursor-pointer"
            title="Download MP4"
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
            disabled={isDeleting}
            onClick={handleDelete}
            className="p-2 bg-paper2 hover:bg-err/20 text-muted hover:text-err rounded-input transition-colors border border-rule shrink-0 cursor-pointer"
            title="Delete this clip"
          >
            <Trash2 size={14} className={isDeleting ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
