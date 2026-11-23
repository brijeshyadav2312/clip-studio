import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
  Zap,
  ShieldCheck,
} from 'lucide-react';

export default function AIConnectView({ onAIUpdated }) {
  const [provider, setProvider] = useState('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('ok'); // 'ok' | 'err'

  useEffect(() => {
    fetch('/api/ai')
      .then((r) => r.json())
      .then((data) => {
        if (data.provider) setProvider(data.provider);
        if (data.gemini_api_key) setGeminiKey(data.gemini_api_key);
        if (data.openai_api_key) setOpenaiKey(data.openai_api_key);
        if (data.gemini_model) setGeminiModel(data.gemini_model);
        if (data.openai_model) setOpenaiModel(data.openai_model);
      })
      .catch((err) => console.warn('Failed to load AI config:', err));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          gemini_api_key: geminiKey,
          gemini_model: geminiModel,
          openai_api_key: openaiKey,
          openai_model: openaiModel,
        }),
      });

      if (!res.ok) throw new Error('Failed to save AI configuration');
      const data = await res.json();
      setStatusType('ok');
      setStatusMessage('AI configuration updated & connected successfully!');
      if (onAIUpdated) onAIUpdated();
    } catch (err) {
      console.error('Error updating AI config:', err);
      setStatusType('err');
      setStatusMessage('Failed to save AI configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-4 animate-fade">
      {/* Page Title & Overview */}
      <div className="border-b border-rule pb-4">
        <div className="flex items-center gap-2">
          <Bot size={22} className="text-brass" />
          <h1 className="text-xl font-semibold text-ink lowercase tracking-tight">ai connect</h1>
          <span className="pill pill-ok text-xs font-mono ml-2">dynamic llm</span>
        </div>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Configure your AI engine directly in the UI. No need to touch <code className="text-ink">.env</code> files or restart the server — changes apply instantly for all future video clipping jobs.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="card p-6 sm:p-7 border border-rule2 bg-[#0e1015] shadow-2xl space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* AI Provider Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
              AI Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Google Gemini Card */}
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-input border text-left transition-all flex flex-col justify-between ${
                  provider === 'gemini'
                    ? 'border-brass bg-brass/10 shadow-sm'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${provider === 'gemini' ? 'text-brass' : 'text-ink'}`}>
                    Google Gemini
                  </span>
                  <Zap size={14} className={provider === 'gemini' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-[10px] text-muted block leading-tight">
                  Free tier available, ultra fast & accurate
                </span>
              </button>

              {/* OpenAI Card */}
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-3 rounded-input border text-left transition-all flex flex-col justify-between ${
                  provider === 'openai'
                    ? 'border-brass bg-brass/10 shadow-sm'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${provider === 'openai' ? 'text-brass' : 'text-ink'}`}>
                    OpenAI
                  </span>
                  <Cpu size={14} className={provider === 'openai' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-[10px] text-muted block leading-tight">
                  GPT-4o & GPT-4o-mini
                </span>
              </button>

              {/* Local / Heuristic Card */}
              <button
                type="button"
                onClick={() => setProvider('heuristic')}
                className={`p-3 rounded-input border text-left transition-all flex flex-col justify-between ${
                  provider === 'heuristic'
                    ? 'border-brass bg-brass/10 shadow-sm'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${provider === 'heuristic' ? 'text-brass' : 'text-ink'}`}>
                    Local / Heuristic
                  </span>
                  <ShieldCheck size={14} className={provider === 'heuristic' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-[10px] text-muted block leading-tight">
                  No API key needed, offline rules
                </span>
              </button>
            </div>
          </div>

          {/* Gemini Specific Configuration */}
          {provider === 'gemini' && (
            <div className="p-4 rounded-card border border-rule bg-paper2/60 space-y-4 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">Gemini API Key</label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brass hover:underline flex items-center gap-1"
                  >
                    <span>Get free API key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-paper border border-rule focus:border-brass rounded-input py-2.5 pl-3 pr-10 text-xs text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-input p-2 text-xs text-ink focus:border-brass focus:outline-none"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Fastest & Best, Recommended)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (High intelligence)</option>
                </select>
              </div>
            </div>
          )}

          {/* OpenAI Specific Configuration */}
          {provider === 'openai' && (
            <div className="p-4 rounded-card border border-rule bg-paper2/60 space-y-4 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">OpenAI API Key</label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brass hover:underline flex items-center gap-1"
                  >
                    <span>Get OpenAI key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-paper border border-rule focus:border-brass rounded-input py-2.5 pl-3 pr-10 text-xs text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">OpenAI Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-input p-2 text-xs text-ink focus:border-brass focus:outline-none"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Cost efficient & fast)</option>
                  <option value="gpt-4o">gpt-4o (Most capable)</option>
                </select>
              </div>
            </div>
          )}

          {/* Heuristic Notice */}
          {provider === 'heuristic' && (
            <div className="p-4 rounded-card border border-rule bg-paper2/60 text-xs text-muted space-y-1">
              <p className="text-ink font-medium">Local Heuristic Mode Active</p>
              <p>
                Clips will be automatically ranked using speech density, laughter cadence, volume peaks, and keyword triggers entirely offline. No API key or internet access required for ranking.
              </p>
            </div>
          )}

          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-input text-xs flex items-center gap-2 ${
                statusType === 'ok'
                  ? 'bg-ok/10 border border-ok/30 text-ok'
                  : 'bg-err/10 border border-err/30 text-err'
              }`}
            >
              {statusType === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 rounded-input bg-gradient-to-r from-[#ba6238] via-[#a8522a] to-[#8d421e] text-white text-xs font-semibold tracking-wider hover:brightness-110 active:scale-[0.99] transition-all shadow-md shadow-[#ba6238]/20 flex items-center justify-center gap-2 cursor-pointer lowercase"
          >
            {loading ? (
              <span>testing & saving…</span>
            ) : (
              <>
                <Key size={14} />
                <span>save & test ai connection</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
