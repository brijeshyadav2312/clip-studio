import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MediaInput from './components/MediaInput';
import ProcessingAnimation from './components/ProcessingAnimation';
import HistoryView from './components/HistoryView';
import AIConnectView from './components/AIConnectView';
import SettingsView from './components/SettingsView';
import { AlertCircle, Film, Sparkles, Cookie, Activity, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('generator'); // 'generator' | 'history' | 'aiconnect' | 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState(
    () => localStorage.getItem('clip_sidebar_pos') || 'right'
  );

  const [config, setConfig] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const pollTimerRef = useRef(null);

  // Sync sidebar position to storage
  const updateSidebarPosition = (pos) => {
    setSidebarPosition(pos);
    localStorage.setItem('clip_sidebar_pos', pos);
  };

  // Fetch initial system state
  const fetchData = async () => {
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
      console.warn('Initial data fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Check if an active job was running from localStorage
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
        if (!res.ok) {
          if (res.status === 404) {
            clearInterval(pollTimerRef.current);
            localStorage.removeItem('clip_active_job');
            setIsProcessing(false);
            setActiveJob(null);
          }
          return;
        }

        const data = await res.json();
        setActiveJob(data);

        if (data.message) {
          setLogs((prev) => {
            if (prev.length === 0 || prev[prev.length - 1] !== data.message) {
              return [...prev.slice(-50), data.message];
            }
            return prev;
          });
        }

        if (data.status === 'done') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          fetchData();
        } else if (data.status === 'error' || data.status === 'cancelled') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          if (data.status === 'error') {
            setError(data.error || data.message || 'Job processing failed');
          }
          fetchData();
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
    setLogs(['Submitting job to processor...']);
    setIsProcessing(true);

    try {
      let res;
      if (type === 'file') {
        const fd = new FormData();
        fd.append('file', payload);
        Object.entries(options).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        res = await fetch('/api/jobs/upload', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload, ...options }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      pollJob(data.id);
    } catch (err) {
      console.error('Job submission failed:', err);
      setError(err.message || 'Failed to start video processing');
      setIsProcessing(false);
    }
  };

  // Terminate active project on "+ new project" button click (as requested)
  const handleCancelProject = async () => {
    if (activeJob?.id) {
      try {
        await fetch(`/api/jobs/${activeJob.id}/cancel`, { method: 'POST' });
      } catch (err) {
        console.warn('Cancel project error:', err);
      }
    }
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    localStorage.removeItem('clip_active_job');
    setActiveJob(null);
    setIsProcessing(false);
    setLogs([]);
    fetchData();
  };

  const handleDeleteClip = async (filename) => {
    if (!activeJob?.id) return;
    try {
      const res = await fetch(`/api/jobs/${activeJob.id}/clips/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setActiveJob((prev) => ({
        ...prev,
        clips: (prev.clips || []).filter((c) => c.filename !== filename),
      }));
      fetchData();
    } catch (err) {
      console.error('Delete clip error:', err);
      alert('Failed to delete clip');
    }
  };

  const handleUploadCookies = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/cookies', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      fetchData();
      alert('cookies.txt uploaded successfully!');
    } catch (err) {
      console.error('Cookie upload error:', err);
      alert('Failed to upload cookies.txt');
    }
  };

  const handleDeleteCookies = async () => {
    if (!window.confirm('Delete uploaded cookies?')) return;
    try {
      const res = await fetch('/api/cookies', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchData();
    } catch (err) {
      console.error('Cookie delete error:', err);
      alert('Failed to delete cookies');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0c10] text-ink font-sans">
      {/* If sidebarPosition is 'left', render sidebar first */}
      {sidebarPosition === 'left' && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setError(null);
          }}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          sidebarPosition={sidebarPosition}
          setSidebarPosition={updateSidebarPosition}
        />
      )}

      {/* Main Content Area (Left side when sidebar is on right) */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Subtle Top Status Bar */}
        <header className="h-14 px-6 border-b border-rule bg-paper/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-ink text-sm tracking-tight">
              {activeTab === 'generator' && (isProcessing || activeJob ? 'workbench' : 'generator')}
              {activeTab === 'history' && 'history'}
              {activeTab === 'aiconnect' && 'ai connect'}
              {activeTab === 'settings' && 'settings'}
            </span>
            <span className="text-[10px] text-muted font-mono bg-paper3 px-2 py-0.5 rounded border border-rule">
              OPENSHORTS ENGINE
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {cookieStatus?.has_cookies && (
              <span className="pill pill-ok text-[10px] font-mono hidden sm:inline-flex items-center gap-1">
                <Cookie size={11} /> cookies active
              </span>
            )}
            <span
              onClick={() => setActiveTab('aiconnect')}
              className="pill pill-muted hover:border-brass/50 text-[10px] font-mono cursor-pointer flex items-center gap-1 transition-colors"
              title="Click to configure AI engine"
            >
              <Sparkles size={11} className="text-brass" />
              <span>{config?.llm?.ready ? `AI: ${config.llm.provider}` : 'Local AI'}</span>
            </span>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* Error Banner */}
          {error && (
            <div className="max-w-2xl mx-auto mb-6 p-4 rounded-card bg-err/10 border border-err/30 text-err text-xs flex items-start justify-between gap-3 animate-fade shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Processing Issue</span>
                  <p className="leading-relaxed opacity-90">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-err/70 hover:text-err p-1 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Tab 1: Clip Generator (Image 1 or Workbench Image 3) */}
          {activeTab === 'generator' && (
            <div>
              {isProcessing || activeJob ? (
                /* Workbench Mode (Matching Image 3) */
                <ProcessingAnimation
                  job={activeJob}
                  logs={logs}
                  onCancelProject={handleCancelProject}
                  onDeleteClip={handleDeleteClip}
                />
              ) : (
                /* Initial Generator Input Card (Matching Image 1) */
                <MediaInput
                  onProcess={handleProcess}
                  isProcessing={isProcessing}
                  onUploadCookies={handleUploadCookies}
                  cookieStatus={cookieStatus}
                />
              )}
            </div>
          )}

          {/* Tab 2: History (4 Clips per row grid, download, delete, preview) */}
          {activeTab === 'history' && (
            <HistoryView
              jobs={jobs}
              onRefresh={fetchData}
              onNavigateToGenerator={() => setActiveTab('generator')}
            />
          )}

          {/* Tab 3: AI Connect (Gemini, OpenAI, Heuristic dropdown & keys) */}
          {activeTab === 'aiconnect' && (
            <AIConnectView
              onAIUpdated={() => {
                fetchData();
              }}
            />
          )}

          {/* Tab 4: Settings (Hinglish/English/Hindi, Whisper, Stabilization, Cookies) */}
          {activeTab === 'settings' && (
            <SettingsView
              cookieStatus={cookieStatus}
              onUploadCookies={handleUploadCookies}
              onDeleteCookies={handleDeleteCookies}
              sidebarPosition={sidebarPosition}
              setSidebarPosition={updateSidebarPosition}
            />
          )}
        </div>
      </main>

      {/* If sidebarPosition is 'right', render sidebar on right (Requested) */}
      {sidebarPosition === 'right' && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setError(null);
          }}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          sidebarPosition={sidebarPosition}
          setSidebarPosition={updateSidebarPosition}
        />
      )}
    </div>
  );
}
