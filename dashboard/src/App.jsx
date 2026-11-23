import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MediaInput from './components/MediaInput';
import ProcessingAnimation from './components/ProcessingAnimation';
import ResultCard from './components/ResultCard';
import RecentJobs from './components/RecentJobs';
import { AlertCircle, ArrowLeft, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const pollTimerRef = useRef(null);

  // Load initial backend config, cookies & recent jobs
  const fetchInitialData = async () => {
    try {
      const [cfgRes, cookRes, jobsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/cookies'),
        fetch('/api/jobs'),
      ]);
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (cookRes.ok) setCookieStatus(await cookRes.json());
      if (jobsRes.ok) {
        const j = await jobsRes.json();
        setJobs(Array.isArray(j) ? j : []);
      }
    } catch (e) {
      console.warn('Initial fetch error:', e);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Reconnect active job from localStorage if refreshed
    const savedJobId = localStorage.getItem('clip_active_job');
    if (savedJobId) {
      pollJob(savedJobId);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const pollJob = (jobId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsProcessing(true);
    localStorage.setItem('clip_active_job', jobId);

    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('Failed to fetch job state');
        const data = await res.json();
        setActiveJob(data);

        // Append to logs if message changes
        if (data.message) {
          setLogs((prev) => {
            if (prev.length === 0 || prev[prev.length - 1] !== data.message) {
              return [...prev.slice(-40), data.message];
            }
            return prev;
          });
        }

        if (data.status === 'done') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          fetchInitialData();
        } else if (data.status === 'error') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          setError(data.error || data.message || 'Job failed');
          fetchInitialData();
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    };

    tick();
    pollTimerRef.current = setInterval(tick, 1500);
  };

  const handleProcess = async ({ type, payload, options }) => {
    setError(null);
    setLogs([]);
    try {
      let res;
      if (type === 'file') {
        const form = new FormData();
        form.append('file', payload);
        Object.entries(options).forEach(([k, v]) => {
          if (v !== null && v !== undefined) form.append(k, v);
        });
        res = await fetch('/api/jobs/upload', { method: 'POST', body: form });
      } else {
        res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload, ...options }),
        });
      }

      if (!res.ok) {
        let detail = 'Submission failed';
        try {
          const b = await res.json();
          detail = b.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const jobData = await res.json();
      pollJob(jobData.id);
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handleUploadCookies = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/cookies', { method: 'POST', body: fd });
      if (res.ok) {
        const status = await (await fetch('/api/cookies')).json();
        setCookieStatus(status);
        setError(null);
        alert('cookies.txt uploaded successfully! YouTube authentication is active.');
      } else {
        alert('Failed to upload cookies.txt');
      }
    } catch (e) {
      alert('Upload error: ' + e.message);
    }
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (activeJob?.id === jobId) setActiveJob(null);
      fetchInitialData();
    } catch (e) {}
  };

  const handleDeleteAllJobs = async () => {
    try {
      await fetch('/api/jobs', { method: 'DELETE' });
      setActiveJob(null);
      setJobs([]);
      fetchInitialData();
    } catch (e) {}
  };

  const isBotError = error && (
    error.includes('Bot Protection') ||
    error.includes('Sign in to confirm') ||
    error.includes('confirm you\'re not a bot')
  );

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink selection:bg-brass selection:text-brassink">
      <Header config={config} cookieStatus={cookieStatus} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full space-y-8">
        {/* Error Notification Banner */}
        {error && (
          <div className="p-5 rounded-card border border-danger/40 bg-danger/10 text-ink animate-fade">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-danger text-sm">
                  {isBotError ? 'YouTube Bot Verification Required' : 'Processing Error'}
                </h3>
                <p className="text-xs text-ink2 mt-1 leading-relaxed whitespace-pre-line">{error}</p>

                {isBotError && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      Use "Upload File" Tab (Instant Clip)
                    </button>
                    <label className="btn-ghost text-xs py-1.5 px-3 cursor-pointer">
                      Upload cookies.txt
                      <input
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadCookies(f);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top: Media Input & Configuration */}
        <MediaInput
          onProcess={handleProcess}
          isProcessing={isProcessing}
          onUploadCookies={handleUploadCookies}
          cookieStatus={cookieStatus}
        />

        {/* Live Processing or Results Workbench */}
        {activeJob && (
          <section className="space-y-6 animate-fade">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-brass" />
                <h2 className="text-base font-semibold text-ink font-mono uppercase tracking-wider">
                  {activeJob.status === 'done' ? `Generated Shorts (${activeJob.clips?.length || 0})` : 'Processing Video'}
                </h2>
              </div>

              {activeJob.status === 'done' && (
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 text-muted hover:text-ink"
                >
                  <ArrowLeft size={13} />
                  New Project
                </button>
              )}
            </div>

            {/* If Processing: Show Live HUD & Terminal */}
            {isProcessing && (
              <ProcessingAnimation job={activeJob} logs={logs} />
            )}

            {/* If Done: Show Result Cards Gallery */}
            {activeJob.status === 'done' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeJob.clips && activeJob.clips.length > 0 ? (
                  activeJob.clips.map((clip, i) => (
                    <ResultCard
                      key={clip.filename || i}
                      clip={clip}
                      index={i}
                      jobId={activeJob.id}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 card text-muted font-mono text-sm">
                    No clips could be generated from this segment.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Bottom: Collapsible History Drawer */}
        <RecentJobs
          jobs={jobs}
          onSelectJob={(id) => {
            const found = jobs.find((j) => j.id === id);
            if (found) setActiveJob(found);
          }}
          onDeleteJob={handleDeleteJob}
          onDeleteAllJobs={handleDeleteAllJobs}
        />
      </main>

      <footer className="border-t border-rule py-6 text-center text-xs font-mono text-muted">
        Clip Studio Engine · Local GPU/CPU High-Speed Pipeline
      </footer>
    </div>
  );
}
