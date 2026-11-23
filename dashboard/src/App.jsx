import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MediaInput from './components/MediaInput';
import ProcessingAnimation from './components/ProcessingAnimation';
import HistoryView from './components/HistoryView';
import AIConnectView from './components/AIConnectView';
import SettingsView from './components/SettingsView';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundView from './components/NotFoundView';
import { AlertCircle, Film, Sparkles, Cookie, Activity, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('generator'); // 'generator' | 'history' | 'aiconnect' | 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState(
    () => localStorage.getItem('clip_sidebar_pos') || 'left'
  );

  const [config, setConfig] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const pollTimerRef = useRef(null);

  const updateSidebarPosition = (pos) => {
    setSidebarPosition(pos);
    localStorage.setItem('clip_sidebar_pos', pos);
  };

  const fetchData = async () => {
    try {
      const [cfgRes, cookRes, jobsRes] = await Promise.all([
        fetch('/api/config').catch(() => null),
        fetch('/api/cookies').catch(() => null),
        fetch('/api/jobs').catch(() => null),
      ]);
      if (cfgRes?.ok) setConfig(await cfgRes.json());
      if (cookRes?.ok) setCookieStatus(await cookRes.json());
      if (jobsRes?.ok) {
        const j = await jobsRes.json();
        setJobs(Array.isArray(j) ? j : []);
      }
    } catch (e) {
      console.warn('Initial data fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();

    const savedJobId = localStorage.getItem('clip_active_job');
    if (savedJobId) {
      pollJob(savedJobId);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const determineStage = (status, msg = '') => {
    const m = msg.toLowerCase();
    if (status === 'downloading' || m.includes('download')) return 'download';
    if (status === 'transcribing' || m.includes('transcrib') || m.includes('whisper')) return 'transcribe';
    if (status === 'ranking' || m.includes('ranking') || m.includes('highlight') || m.includes('ai')) return 'ranking';
    if (status === 'rendering' || m.includes('render') || m.includes('crop') || m.includes('burn')) return 'rendering';
    if (status === 'done') return 'done';
    return 'system';
  };

  const updateStructuredLogs = (newStatus, newProgress, newMessage) => {
    if (!newMessage) return;

    const currentStage = determineStage(newStatus, newMessage);
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setLogs((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];

      const pctText = newProgress > 0 ? `${Math.round(newProgress)}%` : null;

      if (last && last.stage === currentStage) {
        last.title = newMessage;
        last.progress = newProgress;
        last.progressText = pctText;
        if (newStatus === 'done') last.status = 'completed';
        return copy;
      }

      if (last && last.status === 'running') {
        last.status = 'completed';
      }

      const newEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: nowTime,
        stage: currentStage,
        title: newMessage,
        progress: newProgress,
        progressText: pctText,
        status: newStatus === 'done' ? 'completed' : newStatus === 'error' ? 'error' : 'running',
      };

      return [...copy, newEntry];
    });
  };

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

        updateStructuredLogs(data.status, data.progress || 0, data.message);

        if (data.status === 'done') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          setLogs((prev) => prev.map((l) => ({ ...l, status: 'completed' })));
          fetchData();
        } else if (data.status === 'error' || data.status === 'cancelled') {
          setIsProcessing(false);
          clearInterval(pollTimerRef.current);
          localStorage.removeItem('clip_active_job');
          if (data.status === 'error') {
            setError(data.error || data.message || 'Job processing failed');
            setLogs((prev) =>
              prev.map((l, idx) => (idx === prev.length - 1 ? { ...l, status: 'error' } : l))
            );
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
    setLogs([
      {
        id: `init-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        stage: 'system',
        title: 'Initializing video analysis pipeline...',
        progress: 0,
        progressText: null,
        status: 'running',
      },
    ]);
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

  const getPageTitle = () => {
    if (activeTab === 'generator') return isProcessing || activeJob ? 'Live Workbench' : 'Clip Generator';
    if (activeTab === 'history') return 'Shorts History';
    if (activeTab === 'aiconnect') return 'AI Connect';
    if (activeTab === 'settings') return 'Settings & Customization';
    return 'Not Found';
  };

  const validTabs = ['generator', 'history', 'aiconnect', 'settings'];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0c10] text-ink font-sans">
      {/* If sidebarPosition is 'left' (DEFAULT), render sidebar on the left */}
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

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top Status Header Bar (Height h-16 = 64px, pixel-aligned with Sidebar header) */}
        <header className="h-16 px-5 sm:px-7 border-b border-rule bg-paper/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-ink text-base sm:text-lg tracking-tight truncate max-w-[220px] sm:max-w-md">
              {getPageTitle()}
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#ba6238]/15 text-[#ba6238] px-2 py-0.5 rounded border border-[#ba6238]/30 shrink-0">
              OPENSHORTS
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            {cookieStatus?.has_cookies && (
              <span className="pill pill-ok text-xs font-mono hidden sm:inline-flex items-center gap-1.5 font-semibold">
                <Cookie size={13} /> Cookies Active
              </span>
            )}
            <span
              onClick={() => setActiveTab('aiconnect')}
              className="pill pill-muted hover:border-[#ba6238]/60 text-xs font-mono cursor-pointer flex items-center gap-1.5 transition-colors font-semibold"
              title="Click to configure AI engine"
            >
              <Sparkles size={13} className="text-[#ba6238]" />
              <span className="truncate max-w-[120px]">
                {config?.llm?.ready ? `AI: ${config.llm.provider}` : 'Local AI'}
              </span>
            </span>
          </div>
        </header>

        {/* Scrollable View Area wrapped in ErrorBoundary */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
          {/* Error Banner */}
          {error && (
            <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-err/10 border border-err/30 text-err text-xs sm:text-sm flex items-start justify-between gap-3 animate-fade">
              <div className="flex items-start gap-3 min-w-0">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <span className="font-bold block truncate">Processing Issue</span>
                  <p className="leading-relaxed opacity-90 break-words">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-err/70 hover:text-err p-1 rounded hover:bg-err/20 transition-colors shrink-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <ErrorBoundary onReset={fetchData} onNavigateHome={() => setActiveTab('generator')}>
            {/* Tab 1: Clip Generator (Initial Input or Active Workbench) */}
            {activeTab === 'generator' && (
              <div>
                {isProcessing || activeJob ? (
                  <ProcessingAnimation
                    job={activeJob}
                    logs={logs}
                    onCancelProject={handleCancelProject}
                    onDeleteClip={handleDeleteClip}
                  />
                ) : (
                  <MediaInput
                    onProcess={handleProcess}
                    isProcessing={isProcessing}
                    onUploadCookies={handleUploadCookies}
                    cookieStatus={cookieStatus}
                  />
                )}
              </div>
            )}

            {/* Tab 2: History (Instant Optimistic Updates, Delete All, Refresh) */}
            {activeTab === 'history' && (
              <HistoryView
                jobs={jobs}
                onRefresh={fetchData}
                onDeleteAll={() => setJobs([])}
                onNavigateToGenerator={() => setActiveTab('generator')}
              />
            )}

            {/* Tab 3: AI Connect */}
            {activeTab === 'aiconnect' && (
              <AIConnectView
                onAIUpdated={() => {
                  fetchData();
                }}
              />
            )}

            {/* Tab 4: Settings */}
            {activeTab === 'settings' && (
              <SettingsView
                cookieStatus={cookieStatus}
                onUploadCookies={handleUploadCookies}
                onDeleteCookies={handleDeleteCookies}
                sidebarPosition={sidebarPosition}
                setSidebarPosition={updateSidebarPosition}
              />
            )}

            {/* Fallback 404 Not Found Page */}
            {!validTabs.includes(activeTab) && (
              <NotFoundView onNavigateHome={() => setActiveTab('generator')} />
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* If sidebarPosition is 'right', render sidebar on right */}
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
