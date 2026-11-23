import React, { useState, useRef } from 'react';
import { Download, FileText, Share2, Check, Sparkles, Play, Pause } from 'lucide-react';

export default function ResultCard({ clip, index, jobId }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const videoRef = useRef(null);

  const videoUrl = clip?.video_url ? clip.video_url : `/media/${jobId}/${clip.filename}`;
  const srtUrl = clip?.srt_url ? clip.srt_url : `/media/${jobId}/${clip.filename.replace(/\.[^.]+$/, '.srt')}`;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const copyTitle = () => {
    if (clip.title) {
      navigator.clipboard.writeText(clip.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = clip.filename || `clip-${index + 1}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      window.open(videoUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const score = Math.round(clip.score || 85);
  const duration = Math.round(clip.duration || clip.end - clip.start || 40);

  return (
    <div className="card overflow-hidden flex flex-col group card-interactive">
      {/* 9:16 Vertical Video Preview Container */}
      <div className="relative aspect-[9/16] bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          loop
          className="w-full h-full object-cover cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Score & Duration Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-rule font-mono text-[11px] font-bold text-brass backdrop-blur-md">
            <Sparkles size={12} />
            <span>Score {score}</span>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-black/75 border border-rule font-mono text-[11px] text-ink backdrop-blur-md">
            {duration}s
          </div>
        </div>

        {/* Play Overlay Button */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors z-10"
          >
            <div className="w-14 h-14 rounded-full bg-brass/90 text-brassink flex items-center justify-center shadow-xl transform group-hover:scale-105 transition-transform">
              <Play size={22} className="ml-1" fill="currentColor" />
            </div>
          </button>
        )}
      </div>

      {/* Card Details & Actions */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3 bg-paper2">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="eyebrow text-brass">CLIP #{index + 1}</span>
            <div className="flex items-center gap-1.5">
              <span className="readout text-[10px] bg-paper px-2 py-0.5 rounded-full border border-rule text-muted">
                {clip.layout || '9:16 Vertical'}
              </span>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-ink line-clamp-2 leading-snug" title={clip.title}>
            {clip.title || 'Viral Clip Moment'}
          </h3>

          {clip.hook && (
            <p className="text-xs text-muted mt-1 line-clamp-2 italic">
              "{clip.hook}"
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rule">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5"
          >
            <Download size={14} />
            <span>{downloading ? 'Saving…' : 'MP4'}</span>
          </button>

          <a
            href={srtUrl}
            download={`${clip.filename?.replace(/\.[^.]+$/, '') || `clip-${index + 1}`}.srt`}
            className="btn-ghost py-2 px-3 text-xs flex items-center justify-center gap-1.5 text-center"
          >
            <FileText size={14} />
            <span>SRT</span>
          </a>
        </div>
      </div>
    </div>
  );
}
