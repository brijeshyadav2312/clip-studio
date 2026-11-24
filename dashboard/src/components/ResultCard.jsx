import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Trash2, Play, Pause, Volume2, VolumeX, RefreshCw, Clock, Sliders } from 'lucide-react';
import ClipCustomizer from './ClipCustomizer';

export default function ResultCard({ clip = {}, jobId = '', onDelete, onClipUpdated, jobDate = '' }) {
  const [currentClip, setCurrentClip] = useState(clip);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    setCurrentClip(clip);
  }, [clip]);

  const rawFilename = currentClip.filename || (currentClip.video ? currentClip.video.split('/').pop() : `${currentClip.slug || 'clip'}.mp4`);
  const filename = rawFilename.endsWith('.mp4') ? rawFilename : `${rawFilename}.mp4`;
  const srtFilename = filename.replace(/\.mp4$/i, '.srt');

  const resolvedJobId = jobId || currentClip.jobId || '';
  const rawVideo = currentClip.url || currentClip.video || '';
  const baseVideoUrl = rawVideo.startsWith('http') || rawVideo.startsWith('/media')
    ? rawVideo
    : `/media/${resolvedJobId}/${currentClip.video || `clips/${filename}`}`;
  const videoUrl = retryKey > 0 ? `${baseVideoUrl}?t=${retryKey}` : baseVideoUrl;

  const rawSrt = currentClip.srt_url || currentClip.srt || '';
  const srtUrl = rawSrt.startsWith('http') || rawSrt.startsWith('/media')
    ? rawSrt
    : `/media/${resolvedJobId}/${currentClip.srt || `clips/${srtFilename}`}`;

  const rawThumb = currentClip.thumb_url || currentClip.thumb || '';
  const thumbUrl = rawThumb ? (rawThumb.startsWith('http') || rawThumb.startsWith('/media') ? rawThumb : `/media/${resolvedJobId}/${rawThumb}`) : null;

  const durationSec = currentClip.duration
    ? Math.round(currentClip.duration)
    : Math.round((currentClip.end || 0) - (currentClip.start || 0));
  const score = Math.round(currentClip.score || currentClip.virality_score || 75);
  const displayTitle = currentClip.title || currentClip.hook || currentClip.text || filename.replace(/\.mp4$/i, '');

  // Reset state if videoUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setProgressPct(0);
    setLoadError(false);
  }, [videoUrl, retryKey]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    if (videoRef.current.paused || videoRef.current.ended) {
      // Pause all other video elements across the page
      document.querySelectorAll('video').forEach((v) => {
        if (v !== videoRef.current && !v.paused) {
          v.pause();
        }
      });
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setLoadError(false);
      }).catch((err) => {
        console.warn('Playback request was interrupted or failed:', err);
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    const curr = videoRef.current.currentTime;
    if (dur && dur > 0) {
      setProgressPct((curr / dur) * 100);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setProgressPct(100);
  };

  const handleVideoError = () => {
    console.warn(`Video failed to load: ${videoUrl}`);
    setLoadError(true);
    setIsPlaying(false);
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setLoadError(false);
    setRetryKey((k) => k + 1);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(resolvedJobId, filename);
      } else {
        const res = await fetch(`/api/jobs/${resolvedJobId}/clips/${filename}`, { method: 'DELETE' });
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

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0d0f14] border border-white/10 hover:border-[#ba6238]/60 transition-all duration-300 shadow-xl flex flex-col justify-between group">
      {/* 9:16 Video Player Container - ZERO outer padding, edge-to-edge media */}
      <div
        onClick={togglePlay}
        className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center cursor-pointer select-none group/player"
      >
        <video
          key={`${videoUrl}-${retryKey}`}
          ref={videoRef}
          src={videoUrl ? `${videoUrl}${retryKey ? `?r=${retryKey}` : ''}` : undefined}
          poster={thumbUrl || undefined}
          preload="metadata"
          playsInline
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />

        {/* Top Badges (Score & Duration) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold shadow-md">
            Score {score}
          </span>
          {durationSec > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-mono shadow-md">
              <Clock size={11} className="text-white/60" />
              {durationSec}s
            </span>
          )}
        </div>

        {/* Center Play Button Overlay - Smooth fade and scale */}
        {!isPlaying && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 group-hover/player:bg-black/45 transition-colors">
            <div className="w-13 h-13 rounded-full bg-black/65 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl transition-transform duration-200 group-hover/player:scale-110">
              <Play size={22} className="fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Error / Reload Overlay */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-4 text-center z-10 space-y-2">
            <p className="text-xs text-white/80 font-medium">Clip still finalizing or unavailable</p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Bottom Corner Mute / Unmute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className="absolute bottom-2.5 right-2.5 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:scale-110 transition-all z-20 cursor-pointer"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15 z-10 pointer-events-none overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ba6238] to-[#f28244] transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* One UI Bottom Information & Action Controls */}
      <div className="p-3.5 sm:p-4 bg-[#12151c] flex flex-col justify-between flex-1 gap-3">
        <div className="space-y-1 min-w-0">
          <h4
            className="text-xs sm:text-sm font-semibold text-white/95 line-clamp-2 leading-snug group-hover:text-[#ba6238] transition-colors"
            title={displayTitle}
          >
            {displayTitle}
          </h4>
          {jobDate && (
            <p className="text-[11px] text-muted/70 font-mono flex items-center gap-1 truncate">
              <Clock size={10} className="shrink-0" />
              <span>{jobDate}</span>
            </p>
          )}
        </div>

        {/* Clean One UI Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setIsCustomizing(true)}
            className="py-2 px-3 bg-white/5 hover:bg-[#ba6238]/20 hover:text-[#ba6238] text-white/90 rounded-xl text-xs font-semibold border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            title="Customize captions style, placement & trimming"
          >
            <Sliders size={13} className="shrink-0 text-[#ba6238]" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleDownload(e, videoUrl, filename)}
            className="flex-1 py-2 px-3 bg-gradient-to-r from-[#ba6238] to-[#d47345] hover:from-[#c96a3d] hover:to-[#df7d4f] text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer truncate"
            title="Download MP4 video"
          >
            <Download size={13} className="shrink-0" />
            <span className="truncate">Download MP4</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleDownload(e, srtUrl, srtFilename)}
            className="py-2 px-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-mono font-medium border border-white/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            title="Download Subtitles (.SRT)"
          >
            SRT
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="p-2 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-xl border border-white/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            title="Delete this clip"
          >
            <Trash2 size={14} className={isDeleting ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Clip Customization Studio Modal */}
      {isCustomizing && (
        <ClipCustomizer
          clip={currentClip}
          jobId={resolvedJobId}
          isOpen={isCustomizing}
          onClose={() => setIsCustomizing(false)}
          onSave={(updated) => {
            setCurrentClip(updated);
            setRetryKey((k) => k + 1);
            if (onClipUpdated) onClipUpdated(updated);
          }}
        />
      )}
    </div>
  );
}
