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
    <div className="w-full max-w-3xl mx-auto space-y-7 py-6 animate-fade">
      {/* Page Title & Overview */}
      <div className="border-b border-rule pb-5">
        <div className="flex items-center gap-3">
          <Bot size={26} className="text-brass" />
          <h1 className="text-xl sm:text-2xl font-semibold text-ink lowercase tracking-tight">
            ai connect
          </h1>
          <span className="pill pill-ok text-xs font-mono ml-2 font-semibold">dynamic llm</span>
        </div>
        <p className="text-xs sm:text-sm text-muted mt-1.5 leading-relaxed">
          Configure your AI engine directly in the UI. No need to touch <code className="text-ink font-mono bg-paper3 px-1.5 py-0.5 rounded">.env</code> files or restart the server — changes apply instantly for all future video clipping jobs.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="card p-7 sm:p-9 border border-rule2 bg-[#0e1015] shadow-2xl rounded-2xl space-y-7">
        <form onSubmit={handleSave} className="space-y-7">
          {/* AI Provider Cards */}
          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-semibold text-ink uppercase tracking-wider block font-mono">
              AI Provider Selection
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Google Gemini Card */}
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  provider === 'gemini'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${provider === 'gemini' ? 'text-brass' : 'text-ink'}`}>
                    Google Gemini
                  </span>
                  <Zap size={16} className={provider === 'gemini' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-xs text-muted block leading-relaxed">
                  Free tier available on AI Studio, ultra fast & high accuracy
                </span>
              </button>

              {/* OpenAI Card */}
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  provider === 'openai'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${provider === 'openai' ? 'text-brass' : 'text-ink'}`}>
                    OpenAI
                  </span>
                  <Cpu size={16} className={provider === 'openai' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-xs text-muted block leading-relaxed">
                  GPT-4o & GPT-4o-mini highlight ranking
                </span>
              </button>

              {/* Local / Heuristic Card */}
              <button
                type="button"
                onClick={() => setProvider('heuristic')}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  provider === 'heuristic'
                    ? 'border-brass bg-brass/10 shadow-lg shadow-brass/15 ring-1 ring-brass/50'
                    : 'border-rule bg-paper2/50 hover:bg-paper2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${provider === 'heuristic' ? 'text-brass' : 'text-ink'}`}>
                    Local / Heuristic
                  </span>
                  <ShieldCheck size={16} className={provider === 'heuristic' ? 'text-brass' : 'text-muted'} />
                </div>
                <span className="text-xs text-muted block leading-relaxed">
                  100% offline, zero API keys required
                </span>
              </button>
            </div>
          </div>

          {/* Gemini Specific Configuration */}
          {provider === 'gemini' && (
            <div className="p-5 rounded-2xl border border-rule bg-paper2/60 space-y-5 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-ink">Gemini API Key</label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brass hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Get free Gemini API key</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-paper border border-rule focus:border-brass rounded-input py-3 pl-4 pr-12 text-sm text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-ink block mb-2">Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
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
            <div className="p-5 rounded-2xl border border-rule bg-paper2/60 space-y-5 animate-fade">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-ink">OpenAI API Key</label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brass hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Get OpenAI API key</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-paper border border-rule focus:border-brass rounded-input py-3 pl-4 pr-12 text-sm text-ink font-mono placeholder:text-muted/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-ink block mb-2">OpenAI Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-input p-3 text-xs sm:text-sm text-ink focus:border-brass focus:outline-none"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Cost efficient & fast)</option>
                  <option value="gpt-4o">gpt-4o (Most capable)</option>
                </select>
              </div>
            </div>
          )}

          {/* Heuristic Notice */}
          {provider === 'heuristic' && (
            <div className="p-5 rounded-2xl border border-rule bg-paper2/60 text-xs sm:text-sm text-muted space-y-1.5 leading-relaxed">
              <p className="text-ink font-semibold">Local Heuristic Mode Active</p>
              <p>
                Clips will be automatically ranked using speech density, laughter cadence, volume peaks, and keyword triggers entirely offline. No external API call is made.
              </p>
            </div>
          )}

          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-input text-xs sm:text-sm flex items-center gap-2.5 ${
                statusType === 'ok'
                  ? 'bg-ok/10 border border-ok/30 text-ok'
                  : 'bg-err/10 border border-err/30 text-err'
              }`}
            >
              {statusType === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#ba6238] via-[#a8522a] to-[#8d421e] text-white text-xs sm:text-sm font-semibold tracking-wider hover:brightness-110 active:scale-[0.99] transition-all shadow-xl shadow-[#ba6238]/25 flex items-center justify-center gap-2 cursor-pointer lowercase"
          >
            {loading ? (
              <span>testing & saving…</span>
            ) : (
              <>
                <Key size={16} />
                <span>save & test ai connection</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
