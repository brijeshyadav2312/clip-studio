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
  const [statusType, setStatusType] = useState('ok');

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
    <div className="w-full max-w-3xl mx-auto space-y-6 py-4 animate-fade">
      {/* Page Title & Overview */}
      <div className="border-b border-rule pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Bot size={24} className="text-[#ba6238] shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight truncate">
            AI Connect
          </h1>
          <span className="pill pill-ok text-xs font-mono ml-1.5 font-semibold shrink-0">Dynamic LLM</span>
        </div>
        <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
          Configure your AI engine directly in the UI. No need to touch <code className="text-ink font-mono bg-paper3 px-1 py-0.5 rounded">.env</code> files or restart the server — changes apply instantly for all video clipping jobs.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="card p-6 sm:p-8 border border-rule2 bg-[#0e1015] rounded-2xl space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* AI Provider Cards (Static, no scaling) */}
          <div className="space-y-2.5">
            <label className="text-xs sm:text-sm font-semibold text-ink uppercase tracking-wider block font-mono">
              AI Provider Selection
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Google Gemini Card */}
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                  provider === 'gemini'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-sm font-semibold truncate ${provider === 'gemini' ? 'text-[#ba6238]' : 'text-ink'}`}>
                    Google Gemini
                  </span>
                  <Zap size={15} className={`shrink-0 ${provider === 'gemini' ? 'text-[#ba6238]' : 'text-muted'}`} />
                </div>
                <span className="text-xs text-muted block leading-relaxed line-clamp-2">
                  Free tier available on AI Studio, ultra fast & accurate
                </span>
              </button>

              {/* OpenAI Card */}
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                  provider === 'openai'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-sm font-semibold truncate ${provider === 'openai' ? 'text-[#ba6238]' : 'text-ink'}`}>
                    OpenAI
                  </span>
                  <Cpu size={15} className={`shrink-0 ${provider === 'openai' ? 'text-[#ba6238]' : 'text-muted'}`} />
                </div>
                <span className="text-xs text-muted block leading-relaxed line-clamp-2">
                  GPT-4o & GPT-4o-mini highlight ranking
                </span>
              </button>

              {/* Local / Heuristic Card */}
              <button
                type="button"
                onClick={() => setProvider('heuristic')}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                  provider === 'heuristic'
                    ? 'border-[#ba6238] bg-[#ba6238]/10'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-sm font-semibold truncate ${provider === 'heuristic' ? 'text-[#ba6238]' : 'text-ink'}`}>
                    Local Heuristic
                  </span>
                  <ShieldCheck size={15} className={`shrink-0 ${provider === 'heuristic' ? 'text-[#ba6238]' : 'text-muted'}`} />
                </div>
                <span className="text-xs text-muted block leading-relaxed line-clamp-2">
                  100% offline, zero API keys required
                </span>
              </button>
            </div>
          </div>

          {/* Gemini Specific Configuration */}
          {provider === 'gemini' && (
            <div className="p-4 sm:p-5 rounded-xl border border-rule bg-paper2/60 space-y-4 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-ink">Gemini API Key</label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#ba6238] hover:underline flex items-center gap-1 font-medium shrink-0"
                  >
                    <span>Get free Gemini API key</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-paper border border-rule focus:border-[#ba6238] rounded-lg py-2.5 pl-3.5 pr-11 text-sm text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-ink block mb-1.5">Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-lg p-2.5 text-xs sm:text-sm text-ink focus:border-[#ba6238] focus:outline-none"
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
            <div className="p-4 sm:p-5 rounded-xl border border-rule bg-paper2/60 space-y-4 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-ink">OpenAI API Key</label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#ba6238] hover:underline flex items-center gap-1 font-medium shrink-0"
                  >
                    <span>Get OpenAI API key</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-paper border border-rule focus:border-[#ba6238] rounded-lg py-2.5 pl-3.5 pr-11 text-sm text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-ink block mb-1.5">OpenAI Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-lg p-2.5 text-xs sm:text-sm text-ink focus:border-[#ba6238] focus:outline-none"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Cost efficient & fast)</option>
                  <option value="gpt-4o">gpt-4o (Most capable)</option>
                </select>
              </div>
            </div>
          )}

          {/* Heuristic Notice */}
          {provider === 'heuristic' && (
            <div className="p-4 rounded-xl border border-rule bg-paper2/60 text-xs sm:text-sm text-muted space-y-1 leading-relaxed">
              <p className="text-ink font-semibold">Local Heuristic Mode Active</p>
              <p>
                Clips will be automatically ranked using speech density, laughter cadence, volume peaks, and keyword triggers entirely offline. No external API call is made.
              </p>
            </div>
          )}

          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs sm:text-sm flex items-center gap-2.5 ${
                statusType === 'ok'
                  ? 'bg-ok/10 border border-ok/30 text-ok'
                  : 'bg-err/10 border border-err/30 text-err'
              }`}
            >
              {statusType === 'ok' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}

          {/* Submit Button (Static, no scaling) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] text-white text-xs sm:text-sm font-semibold tracking-wider hover:brightness-110 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="truncate">Testing & Saving…</span>
            ) : (
              <>
                <Key size={15} className="shrink-0" />
                <span className="truncate">Save & Test AI Connection</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
