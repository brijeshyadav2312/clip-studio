import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Sparkles,
  Type,
  Crop,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Flame,
  Check,
  Palette,
  Film,
  ChevronDown,
  Zap,
  RefreshCw,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Captions,
  Timer,
  LayoutTemplate,
  ShieldCheck,
  Trash2,
  MousePointer2,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import {
  CAPTION_PRESETS,
  PRESET_BY_ID,
  CAPTION_FONTS,
  COLOR_SWATCHES,
  POSITIONS,
  buildCaptionPlan,
  activeGroupAt,
  activeWordIndex,
  exportToCss,
  hexToRgba,
  formatTime,
  presetState,
  overrideKey,
} from '../lib/captionLayout';

const HISTORY_LIMIT = 60;
const TABS = [
  { id: 'style', label: 'Style', icon: Sparkles },
  { id: 'layout', label: 'Layout', icon: LayoutTemplate },
  { id: 'text', label: 'Text', icon: Captions },
  { id: 'timeline', label: 'Trim', icon: Timer },
  { id: 'hook', label: 'Hook', icon: Flame },
  { id: 'framing', label: 'Framing', icon: Crop },
];

const FRAMING_OPTIONS = [
  {
    id: 'crop',
    title: 'Smart Face Crop',
    desc: 'Tracks the active speaker and centres the 9:16 frame.',
  },
  {
    id: 'dynamic_landscape',
    title: 'Hybrid Smart Fit',
    desc: 'Crops faces when talking, fits the wide shot otherwise.',
  },
  {
    id: 'fit_blur',
    title: 'Fit + Blur Bars',
    desc: 'Keeps the full landscape frame over a blurred backdrop.',
  },
  {
    id: 'streamer_split',
    title: 'Streamer Split',
    desc: 'Facecam stacked above gameplay.',
  },
];

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const stem = (name) => String(name || 'clip').replace(/\.mp4$/i, '');
const sameState = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
};

function makeDefaultState(clip) {
  const preset = PRESET_BY_ID[clip?.caption_style] || CAPTION_PRESETS[0];
  const start = Number(clip?.start ?? 0);
  const end = Number(clip?.end ?? start + (clip?.duration ?? 30));
  return {
    ...presetState(preset),
    position: 'bottom',
    marginV: 300,
    hook: clip?.hook || '',
    framing: clip?.reframe?.mode || 'crop',
    trimStart: start,
    trimEnd: end,
    overrides: {},
    censor: false,
  };
}

function fromCaptionOptions(options, base) {
  if (!options || typeof options !== 'object') return base;
  return hydrateState(
    {
      preset: options.caption_style,
      font: options.font,
      fontSize: options.font_size,
      primaryColor: options.primary_color,
      activeColor: options.active_color,
      uppercase: options.uppercase,
      words: options.words,
      chars: options.chars,
      outline: options.outline,
      shadow: options.shadow,
      pop: options.pop,
      pill: options.pill,
      pillColor: options.pill_color,
      pillAlpha: options.pill_alpha,
      letterSpacing: options.letter_spacing,
      lineHeight: options.line_height,
      position: options.caption_position,
      marginV: options.margin_v,
      hook: options.hook,
      overrides: options.word_overrides,
    },
    base
  );
}

function hydrateState(saved, base) {
  if (!saved || typeof saved !== 'object') return base;
  const next = { ...base };
  for (const key of Object.keys(base)) {
    const value = saved[key];
    if (value !== undefined && value !== null) next[key] = value;
  }
  if (saved.overrides && typeof saved.overrides === 'object') {
    next.overrides = saved.overrides;
  }
  return next;
}

function historyReducer(state, action) {
  switch (action.type) {
    case 'set': {
      const patch =
        typeof action.patch === 'function' ? action.patch(state.present) : action.patch;
      const next = { ...state.present, ...patch };
      if (sameState(next, state.present)) return state;
      const coalesce =
        action.key && action.key === state.lastKey && action.at - state.lastAt < 700;
      return {
        past: coalesce
          ? state.past
          : [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: action.key || null,
        lastAt: action.at,
      };
    }
    case 'undo': {
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'replace':
      return { past: [], present: action.present, future: [], lastKey: null, lastAt: 0 };
    default:
      return state;
  }
}

function useEditorHistory(initial) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  const update = useCallback(
    (patch, key) => dispatch({ type: 'set', patch, key, at: Date.now() }),
    []
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const replace = useCallback((present) => dispatch({ type: 'replace', present }), []);
  return {
    editor: state.present,
    update,
    undo,
    redo,
    replace,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

function Slider({ label, value, min, max, step = 1, onChange, suffix = '', format }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {label}
        </span>
        <span className="font-mono text-[11px] font-bold text-[#e08a5c]">
          {format ? format(value) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#c96a3d]"
      />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-xs font-bold text-white">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-white/45">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
          checked ? 'bg-[#a8542c]' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

function Swatches({ value, onChange, allowNone = false, noneLabel = 'No highlight' }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange('')}
          title={noneLabel}
          className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition-all ${
            !value
              ? 'border-white bg-white/10 text-white'
              : 'border-white/15 text-white/50 hover:text-white'
          }`}
        >
          <EyeOff size={11} /> Off
        </button>
      )}
      {COLOR_SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          title={hex}
          style={{ backgroundColor: hex }}
          className={`h-7 w-7 cursor-pointer rounded-lg border transition-all ${
            value && value.toUpperCase() === hex.toUpperCase()
              ? 'scale-110 border-white ring-2 ring-[#ba6238]'
              : 'border-white/20 hover:scale-105'
          }`}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-lg border border-dashed border-white/30">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute -left-2 -top-2 h-12 w-12 cursor-pointer opacity-0"
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-white/60">
          +
        </span>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */

export default function CustomizerView({
  jobs = [],
  activeJob = null,
  selectedClipInfo = null,
  onNavigateToGenerator,
}) {
  const allClips = useMemo(() => {
    const list = [];
    if (activeJob && Array.isArray(activeJob.clips)) {
      activeJob.clips.forEach((c) => list.push({ ...c, jobId: activeJob.id }));
    }
    if (Array.isArray(jobs)) {
      jobs.forEach((j) => {
        if (j.id === activeJob?.id) return;
        if (Array.isArray(j.clips)) {
          j.clips.forEach((c) => list.push({ ...c, jobId: j.id }));
        }
      });
    }
    return list;
  }, [jobs, activeJob]);

  const [currentClip, setCurrentClip] = useState(() => {
    if (selectedClipInfo?.clip) {
      return {
        ...selectedClipInfo.clip,
        jobId: selectedClipInfo.jobId || selectedClipInfo.clip.jobId,
      };
    }
    return allClips[0] || null;
  });

  useEffect(() => {
    if (selectedClipInfo?.clip) {
      setCurrentClip({
        ...selectedClipInfo.clip,
        jobId: selectedClipInfo.jobId || selectedClipInfo.clip.jobId,
      });
    } else if (!currentClip && allClips.length > 0) {
      setCurrentClip(allClips[0]);
    }
  }, [selectedClipInfo, allClips]);

  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const trimBarRef = useRef(null);
  const dragRef = useRef(null);
  const trimDragRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [frameWidth, setFrameWidth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState('style');
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showTranscriptSearch, setShowTranscriptSearch] = useState('');
  const [burnedAt, setBurnedAt] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const [words, setWords] = useState([]);
  const [clipMeta, setClipMeta] = useState({ start: 0, end: 30, duration: 30 });
  const [loadState, setLoadState] = useState('idle');
  const [loadError, setLoadError] = useState(null);
  const [loadedKey, setLoadedKey] = useState('');

  const { editor, update, undo, redo, replace, canUndo, canRedo } =
    useEditorHistory(makeDefaultState(currentClip));

  const jobId = currentClip?.jobId || '';
  const clipSlug = currentClip?.slug || stem(currentClip?.filename);

  /* ---- load: clean master + transcript + saved state ---- */
  useEffect(() => {
    if (!currentClip) return;
    const jid = currentClip.jobId;
    const slug = currentClip.slug || stem(currentClip.filename);
    if (!jid || !slug) {
      setLoadState('error');
      setLoadError('This clip is missing its job reference.');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoadState('loading');
      setLoadError(null);
      setWords([]);
      try {
        let clip = currentClip;
        if (!clip.clean_url) {
          const res = await fetch(`/api/jobs/${jid}/clips/${slug}/clean`, {
            method: 'POST',
            signal: controller.signal,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.detail || 'Could not build the caption-free preview');
          }
          if (data.clip) {
            clip = { ...data.clip, jobId: jid };
            if (!cancelled) setCurrentClip(clip);
          }
        }

        const res = await fetch(`/api/jobs/${jid}/clips/${slug}/words`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Could not load the transcript');
        if (cancelled) return;

        const merged = { ...clip, ...(data.clip || {}) };
        const base = makeDefaultState(merged);
        const saved = data.editor_state || fromCaptionOptions(data.caption_options, base);
        const meta = {
          start: Number(data.start ?? base.trimStart),
          end: Number(data.end ?? base.trimEnd),
          duration: Number(data.duration ?? 30),
        };
        const hydrated = hydrateState(saved, base);
        // Keep the saved trim inside the clean master that actually exists.
        const maxEnd = meta.start + meta.duration;
        hydrated.trimStart = clamp(hydrated.trimStart, meta.start, maxEnd - 0.5);
        hydrated.trimEnd = clamp(hydrated.trimEnd, hydrated.trimStart + 0.5, maxEnd);

        setWords(data.words || []);
        setClipMeta(meta);
        replace(hydrated);
        setCurrentTime(0);
        setLoadedKey(`${jid}/${slug}`);
        setLoadState('ready');
      } catch (err) {
        if (err.name === 'AbortError' || cancelled) return;
        setLoadError(err.message || 'Could not open this clip');
        setLoadState('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentClip?.jobId, currentClip?.slug, reloadToken]);

  /* ---- derived trim + caption plan (all local, no round-trips) ---- */
  const { start: sourceStart, duration } = clipMeta;
  const localTrimStart = clamp(editor.trimStart - sourceStart, 0, Math.max(0, duration - 0.5));
  const localTrimEnd = clamp(
    editor.trimEnd - sourceStart,
    localTrimStart + 0.5,
    Math.max(0.5, duration)
  );
  const trimmedDuration = Math.max(0.1, localTrimEnd - localTrimStart);

  const plan = useMemo(
    () =>
      buildCaptionPlan({
        words,
        overrides: editor.overrides,
        trimStart: localTrimStart,
        trimEnd: localTrimEnd,
        style: editor,
        censor: editor.censor,
      }),
    [words, editor, localTrimStart, localTrimEnd]
  );

  const overlayTime = currentTime - localTrimStart;
  const activeGroup = useMemo(
    () => activeGroupAt(plan.groups, overlayTime),
    [plan.groups, overlayTime]
  );
  const activeIdx = activeGroup ? activeWordIndex(activeGroup, overlayTime) : -1;

  const captionSize = frameWidth ? exportToCss(editor.fontSize, frameWidth) : 0;
  const captionOutline = frameWidth ? exportToCss(editor.outline, frameWidth) : 0;
  const captionShadow = frameWidth ? exportToCss(editor.shadow, frameWidth) : 0;
  const pillPad = frameWidth ? exportToCss(Math.max(8, Math.round(editor.fontSize * 0.16)), frameWidth) : 0;

  const overlayTopPct = (editor.marginV / 1920) * 100;
  const hookTopPct = ((editor.position === 'top' || editor.position === 'divider' ? 180 : 150) / 1920) * 100;

  const showHook = editor.hook.trim() && overlayTime >= 0 && overlayTime < plan.hookEnd;

  /* ---- playback ---- */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      if (width) setFrameWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentClip?.slug]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        let t = video.currentTime;
        if (t >= localTrimEnd - 0.02) {
          video.currentTime = localTrimStart;
          t = localTrimStart;
        }
        setCurrentTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, localTrimStart, localTrimEnd]);

  const syncVideoToTrim = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;
    if (video.currentTime < localTrimStart || video.currentTime >= localTrimEnd) {
      video.currentTime = localTrimStart;
      setCurrentTime(localTrimStart);
    }
  }, [localTrimStart, localTrimEnd]);

  useEffect(() => {
    syncVideoToTrim();
  }, [syncVideoToTrim]);

  const seekTo = useCallback(
    (time) => {
      const video = videoRef.current;
      const next = clamp(time, 0, Math.max(0.1, duration));
      if (video) video.currentTime = next;
      setCurrentTime(next);
    },
    [duration]
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < localTrimStart || video.currentTime >= localTrimEnd - 0.05) {
        video.currentTime = localTrimStart;
        setCurrentTime(localTrimStart);
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [localTrimStart, localTrimEnd]);

  const setTrimLocal = useCallback(
    (side, value) => {
      const abs = sourceStart + clamp(value, 0, duration);
      if (side === 'start') {
        update(
          { trimStart: Math.min(abs, editor.trimEnd - 0.5) },
          'trim-start'
        );
        seekTo(abs);
      } else {
        update({ trimEnd: Math.max(abs, editor.trimStart + 0.5) }, 'trim-end');
        seekTo(abs);
      }
    },
    [sourceStart, duration, editor.trimStart, editor.trimEnd, update, seekTo]
  );

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekTo(currentTime - (event.shiftKey ? 1 : 0.1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekTo(currentTime + (event.shiftKey ? 1 : 0.1));
      } else if (event.key === '[') {
        event.preventDefault();
        setTrimLocal('start', currentTime);
      } else if (event.key === ']') {
        event.preventDefault();
        setTrimLocal('end', currentTime);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, togglePlay, seekTo, currentTime, setTrimLocal]);

  /* ---- autosave ---- */
  useEffect(() => {
    if (loadState !== 'ready' || !jobId || !clipSlug) return undefined;
    // Never write the previous clip's style into the clip that just opened.
    if (loadedKey !== `${jobId}/${clipSlug}`) return undefined;
    setSaveState('dirty');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/clips/${clipSlug}/editor-state`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editor),
          }
        );
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    }, 900);
    return () => clearTimeout(saveTimerRef.current);
  }, [editor, loadState, jobId, clipSlug, loadedKey]);

  /* ---- drag captions vertically ---- */
  const onCaptionPointerDown = (event) => {
    if (!frameRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety; synthetic or already-released pointers can throw */
    }
    dragRef.current = { startY: event.clientY, startMargin: editor.marginV };
  };
  const onCaptionPointerMove = (event) => {
    if (!dragRef.current || !frameRef.current) return;
    const dy = event.clientY - dragRef.current.startY;
    const delta = -(dy / frameRef.current.clientHeight) * 1920;
    update(
      {
        marginV: clamp(Math.round(dragRef.current.startMargin + delta), 80, 1780),
        position: 'custom',
      },
      'caption-drag'
    );
  };
  const onCaptionPointerUp = () => {
    dragRef.current = null;
  };

  /* ---- trim bar drag ---- */
  const trimTimeAt = (clientX) => {
    const rect = trimBarRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  };
  const onTrimHandleDown = (side) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* see the caption drag handler */
    }
    trimDragRef.current = { side };
  };
  const onTrimPointerMove = (event) => {
    if (!trimDragRef.current) return;
    const time = trimTimeAt(event.clientX);
    setTrimLocal(trimDragRef.current.side, time);
  };
  const onTrimPointerUp = () => {
    trimDragRef.current = null;
  };

  /* ---- export ---- */
  const handleExport = async () => {
    if (!currentClip || !jobId) return;
    setIsExporting(true);
    setExportMessage(null);
    const payload = {
      caption_style: editor.preset,
      caption_position: editor.position,
      margin_v: editor.marginV,
      font: editor.font,
      font_size: editor.fontSize,
      primary_color: editor.primaryColor,
      active_color: editor.activeColor,
      uppercase: editor.uppercase,
      hook: editor.hook,
      start: editor.trimStart,
      end: editor.trimEnd,
      framing: editor.framing,
      outline: editor.outline,
      shadow: editor.shadow,
      pop: editor.pop,
      pill: editor.pill,
      pill_color: editor.pillColor,
      pill_alpha: editor.pillAlpha,
      words: editor.words,
      chars: editor.chars,
      letter_spacing: editor.letterSpacing,
      line_height: editor.lineHeight,
      censor: editor.censor,
      word_overrides: editor.overrides,
    };
    try {
      await fetch(`/api/jobs/${jobId}/clips/${clipSlug}/editor-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor),
      }).catch(() => {});
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipSlug}/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Export failed');
      setBurnedAt(Date.now());
      if (data.clip) setCurrentClip({ ...data.clip, jobId });
      setReloadToken((token) => token + 1);
      setExportMessage('Burned-in MP4 exported. Download link is up to date.');
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err) {
      setExportMessage(`Export failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const applyPreset = (preset) => update(presetState(preset), `preset-${preset.id}`);
  const resetAll = () => replace(makeDefaultState(currentClip));

  /* ---- media urls ---- */
  const filename = currentClip?.filename?.endsWith('.mp4')
    ? currentClip.filename
    : `${stem(currentClip?.filename || clipSlug)}.mp4`;
  const srtFilename = filename.replace(/\.mp4$/i, '.srt');
  const rawClean = currentClip?.clean_url || '';
  const cache = burnedAt || currentClip?.rendered_at || '';
  const cleanUrl = rawClean
    ? `${rawClean}${rawClean.includes('?') ? '&' : '?'}v=${cache || 0}`
    : '';
  const burnedUrl = currentClip?.url
    ? `${currentClip.url}${currentClip.url.includes('?') ? '&' : '?'}v=${cache || 0}`
    : `/media/${jobId}/clips/${filename}?v=${cache || 0}`;
  const srtUrl = currentClip?.srt_url || `/media/${jobId}/clips/${srtFilename}`;
  const videoUrl = cleanUrl || burnedUrl;

  if (!currentClip) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center space-y-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rule bg-paper2 text-muted">
          <Film size={28} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-ink">No clips yet</h3>
          <p className="text-xs leading-relaxed text-muted">
            Generate a vertical short first, then come back to style captions live.
          </p>
        </div>
        {onNavigateToGenerator && (
          <button
            type="button"
            onClick={onNavigateToGenerator}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-[#ba6238] via-amber-600 to-[#8d421e] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:brightness-110"
          >
            Create a short
          </button>
        )}
      </div>
    );
  }

  const editedCount = Object.keys(editor.overrides || {}).length;
  const searchQuery = showTranscriptSearch.trim().toLowerCase();
  const transcriptGroups = searchQuery
    ? plan.groups.filter((group) =>
        group.lines
          .flat()
          .some((word) => word.text.toLowerCase().includes(searchQuery))
      )
    : plan.groups;

  return (
    <div className="flex h-full select-none flex-col overflow-hidden bg-[#07090d]">
      {/* ---------------- top bar ---------------- */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-rule bg-[#0d0f14] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden text-xs font-bold uppercase tracking-wider text-white/45 sm:inline">
            Clip
          </span>
          <div className="relative">
            <select
              value={currentClip.filename || currentClip.slug}
              onChange={(e) => {
                const found = allClips.find(
                  (c) => (c.filename || c.slug) === e.target.value
                );
                if (found) setCurrentClip(found);
              }}
              className="max-w-[240px] cursor-pointer appearance-none truncate rounded-xl border border-rule bg-paper2 py-1.5 pl-3 pr-8 text-xs font-semibold text-white transition-colors hover:bg-paper3 focus:border-[#ba6238] focus:outline-none"
            >
              {allClips.map((c, i) => (
                <option key={i} value={c.filename || c.slug} className="bg-[#141822]">
                  {c.title || c.hook || c.filename || `Clip ${i + 1}`} (
                  {Math.round(c.duration || 30)}s)
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 md:inline-flex">
            <Zap size={11} /> Live preview
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="mr-1 hidden items-center gap-1 text-[10px] font-mono text-white/40 sm:flex">
            {saveState === 'saving' && (
              <>
                <Loader2 size={11} className="animate-spin" /> Saving
              </>
            )}
            {saveState === 'saved' && (
              <>
                <Save size={11} className="text-emerald-400" /> Saved
              </>
            )}
            {saveState === 'dirty' && <>Unsaved</>}
            {saveState === 'error' && (
              <span className="text-amber-400">Autosave failed</span>
            )}
          </div>

          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="cursor-pointer rounded-lg border border-rule bg-paper2 p-2 text-white/70 transition-colors hover:bg-paper3 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="cursor-pointer rounded-lg border border-rule bg-paper2 p-2 text-white/70 transition-colors hover:bg-paper3 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={resetAll}
            title="Reset every edit on this clip"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-rule bg-paper2 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-paper3 hover:text-white"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <a
            href={burnedUrl}
            download={filename}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ba6238] to-[#d47345] px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:from-[#c96a3d] hover:to-[#df7d4f]"
          >
            <Download size={13} />
            <span className="hidden sm:inline">MP4</span>
          </a>
        </div>
      </div>

      {/* ---------------- workbench ---------------- */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* preview column */}
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden border-b border-rule bg-[#05070b] p-4 sm:p-6 lg:w-[46%] lg:border-b-0 lg:border-r xl:w-[44%]">
          <div
            ref={frameRef}
            className="group relative flex aspect-[9/16] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl"
            style={{ height: 'min(62vh, 600px)', maxWidth: '100%' }}
          >
            {/* video / framing preview */}
            {editor.framing === 'fit_blur' ? (
              <div className="absolute inset-0 overflow-hidden">
                <video
                  src={videoUrl}
                  muted
                  playsInline
                  preload="auto"
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-50"
                />
                <video
                  ref={videoRef}
                  src={videoUrl}
                  preload="auto"
                  muted={isMuted}
                  playsInline
                  onLoadedMetadata={syncVideoToTrim}
                  onClick={togglePlay}
                  className="relative z-[1] h-full w-full cursor-pointer object-contain"
                />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={videoUrl}
                preload="auto"
                muted={isMuted}
                playsInline
                onLoadedMetadata={syncVideoToTrim}
                onClick={togglePlay}
                className="h-full w-full cursor-pointer object-cover"
              />
            )}

            {editor.framing === 'streamer_split' && (
              <div className="pointer-events-none absolute inset-0 z-[2]">
                <div className="absolute inset-x-0 top-[42%] h-px bg-cyan-300/60 shadow-[0_0_12px_2px_rgba(34,211,238,0.5)]" />
                <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-cyan-200">
                  SPLIT
                </span>
              </div>
            )}

            {/* safe zones */}
            {showSafeZones && (
              <div className="pointer-events-none absolute inset-0 z-[3]">
                <div className="absolute inset-x-0 top-0 h-[9%] border-b border-dashed border-cyan-300/50 bg-cyan-400/10">
                  <span className="absolute left-1.5 top-1 text-[8px] font-mono uppercase tracking-wider text-cyan-200/80">
                    top UI
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[15%] border-t border-dashed border-cyan-300/50 bg-cyan-400/10">
                  <span className="absolute bottom-1 left-1.5 text-[8px] font-mono uppercase tracking-wider text-cyan-200/80">
                    caption / UI
                  </span>
                </div>
                <div className="absolute inset-y-0 left-0 w-[6%] border-r border-dashed border-cyan-300/30 bg-cyan-400/5" />
                <div className="absolute inset-y-0 right-0 w-[6%] border-l border-dashed border-cyan-300/30 bg-cyan-400/5" />
              </div>
            )}

            {/* hook */}
            {showHook && (
              <div
                className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2"
                style={{ top: `${hookTopPct}%` }}
              >
                <p
                  className="max-w-[92%] text-center text-white"
                  style={{
                    background: 'rgba(0,0,0,0.62)',
                    fontFamily: `"${editor.font}", Impact, "Arial Black", sans-serif`,
                    fontWeight: 900,
                    fontSize: `${Math.max(8, exportToCss(72, frameWidth))}px`,
                    lineHeight: 1.12,
                    padding: `${Math.max(2, frameWidth * 0.012)}px ${Math.max(4, frameWidth * 0.02)}px`,
                  }}
                >
                  {plan.hook.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {/* caption overlay */}
            {activeGroup && captionSize > 0 && (
              <div
                className="absolute inset-x-0 z-20 flex justify-center px-1"
                style={{ bottom: `${overlayTopPct}%` }}
                onPointerDown={onCaptionPointerDown}
                onPointerMove={onCaptionPointerMove}
                onPointerUp={onCaptionPointerUp}
                onPointerCancel={onCaptionPointerUp}
              >
                <div
                  key={activeGroup.start}
                  className={`relative cursor-grab touch-none text-center active:cursor-grabbing ${
                    editor.pop ? 'caption-pop' : ''
                  }`}
                  style={{
                    maxWidth: '94%',
                    padding: editor.pill ? `${pillPad}px ${pillPad * 1.35}px` : 0,
                    borderRadius: editor.pill ? `${Math.max(6, pillPad * 0.9)}px` : 0,
                    background: editor.pill
                      ? hexToRgba(editor.pillColor, editor.pillAlpha)
                      : 'transparent',
                    backdropFilter: editor.pill ? 'blur(2px)' : undefined,
                    fontFamily: `"${editor.font}", Impact, "Arial Black", sans-serif`,
                    fontWeight: 800,
                    fontSize: `${captionSize}px`,
                    lineHeight: editor.lineHeight,
                    letterSpacing: `${exportToCss(editor.letterSpacing, frameWidth)}px`,
                    color: editor.primaryColor,
                    WebkitTextStroke: `${captionOutline}px #000000`,
                    paintOrder: 'stroke fill',
                    textShadow: captionShadow
                      ? `${captionShadow * 0.7}px ${captionShadow * 0.7}px 0 rgba(0,0,0,0.75)`
                      : 'none',
                  }}
                >
                  {activeGroup.lines.map((line, li) => {
                    const offset = activeGroup.lines
                      .slice(0, li)
                      .reduce((sum, item) => sum + item.length, 0);
                    return (
                      <div
                        key={li}
                        className="flex items-center justify-center"
                        style={{ gap: `${captionSize * 0.24}px` }}
                      >
                        {line.map((word, wi) => {
                          const isActive = offset + wi === activeIdx;
                          const highlight = Boolean(editor.activeColor);
                          const boxed = editor.preset === 'boxed' && highlight;
                          const fill = isActive && highlight
                            ? boxed
                              ? '#000000'
                              : editor.activeColor
                            : editor.primaryColor;
                          const strokeColor =
                            isActive && highlight && boxed
                              ? editor.activeColor
                              : '#000000';
                          const strokeWidth = isActive && highlight
                            ? boxed
                              ? Math.max(captionOutline + exportToCss(8, frameWidth), exportToCss(16, frameWidth))
                              : captionOutline
                            : captionOutline;
                          return (
                            <span
                              key={`${word.absStart}-${wi}`}
                              style={{
                                color: fill,
                                WebkitTextStroke: `${strokeWidth}px ${strokeColor}`,
                                whiteSpace: 'nowrap',
                                transition: 'color 80ms linear',
                              }}
                            >
                              {editor.uppercase ? word.text.toUpperCase() : word.text}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* drag affordance */}
            {activeGroup && (
              <div className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white/50 opacity-0 transition-opacity group-hover:opacity-100">
                <MousePointer2 size={12} />
              </div>
            )}

            {/* states */}
            {loadState === 'loading' && (
              <div className="absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
                <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-black/85 px-3 py-2 text-[11px] text-amber-200">
                  <Loader2 size={12} className="animate-spin" />
                  Preparing caption-free preview…
                </div>
              </div>
            )}
            {loadState === 'error' && (
              <div className="absolute inset-x-0 bottom-3 z-40 px-3">
                <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-black/90 px-3 py-2 text-[11px] leading-snug text-amber-200">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{loadError}</span>
                </div>
              </div>
            )}

            {/* play overlay */}
            {!isPlaying && loadState === 'ready' && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/30 transition-colors group-hover:bg-black/45"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-2xl backdrop-blur-md transition-transform group-hover:scale-110">
                  <Play size={24} className="ml-0.5 fill-white" />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted((m) => !m);
              }}
              className="absolute bottom-3 right-3 z-30 cursor-pointer rounded-full border border-white/20 bg-black/60 p-2 text-white/80 backdrop-blur-md transition-all hover:text-white"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSafeZones((v) => !v);
              }}
              title="Toggle social safe zones"
              className={`absolute bottom-3 left-3 z-30 cursor-pointer rounded-full border p-2 backdrop-blur-md transition-all ${
                showSafeZones
                  ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/20 bg-black/60 text-white/70 hover:text-white'
              }`}
            >
              {showSafeZones ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>

          {/* transport */}
          <div className="mt-4 w-full max-w-[360px] space-y-2">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                {isPlaying ? <Pause size={16} className="fill-black" /> : <Play size={16} className="ml-0.5 fill-black" />}
              </button>
              <div className="font-mono text-[11px] text-white/60">
                <span className="text-white">{formatTime(overlayTime)}</span>
                <span className="mx-1 text-white/30">/</span>
                {formatTime(trimmedDuration)}
              </div>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/50">
                {Math.round(trimmedDuration * 10) / 10}s clip
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.01}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#c96a3d]"
            />
          </div>
        </div>

        {/* inspector */}
        <div className="flex min-h-0 w-full flex-col overflow-hidden bg-[#0f1218] lg:w-[54%] xl:w-[56%]">
          <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-rule bg-[#131720] p-2 sm:p-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#a8542c] text-white shadow-md'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                  {tab.id === 'text' && editedCount > 0 && (
                    <span className="rounded-full bg-black/30 px-1.5 text-[9px]">{editedCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {/* ---------------- STYLE ---------------- */}
            {activeTab === 'style' && (
              <>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                      <Sparkles size={14} className="text-[#e08a5c]" /> Presets
                    </h3>
                    <span className="text-[11px] text-white/40">Tap to load a full look</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {CAPTION_PRESETS.map((preset) => {
                      const selected = editor.preset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                            selected
                              ? 'border-[#ba6238] bg-[#a8542c]/15 ring-1 ring-[#ba6238]'
                              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-white">
                              <span className="truncate">{preset.name}</span>
                              {selected && <Check size={13} className="shrink-0 stroke-[3] text-[#e08a5c]" />}
                            </h4>
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${preset.badgeColor}`}
                            >
                              {preset.badge}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-white/45">{preset.desc}</p>
                          <div className="mt-2.5 flex h-9 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-black/50">
                            <span
                              style={{
                                fontFamily: `"${preset.font}", sans-serif`,
                                fontWeight: 800,
                                fontSize: 15,
                                letterSpacing: `${preset.letterSpacing * 0.3}px`,
                                color: preset.primaryColor,
                                WebkitTextStroke: '0.8px #000',
                                paintOrder: 'stroke fill',
                                background: preset.pill
                                  ? hexToRgba(preset.pillColor, preset.pillAlpha)
                                  : 'transparent',
                                padding: preset.pill ? '2px 8px' : 0,
                                borderRadius: preset.pill ? 6 : 0,
                              }}
                            >
                              {preset.uppercase ? 'THIS HITS' : 'this hits'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    <Type size={14} className="text-[#e08a5c]" /> Type
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                        Font
                      </span>
                      <select
                        value={editor.font}
                        onChange={(e) => update({ font: e.target.value }, 'font')}
                        className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs font-medium text-white focus:border-[#ba6238] focus:outline-none"
                      >
                        {CAPTION_FONTS.map((font) => (
                          <option key={font.name} value={font.name} className="bg-[#141822]">
                            {font.label} — {font.note}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Slider
                      label="Size"
                      value={editor.fontSize}
                      min={28}
                      max={160}
                      onChange={(v) => update({ fontSize: v }, 'font-size')}
                      suffix="px"
                    />
                    <Slider
                      label="Outline"
                      value={editor.outline}
                      min={0}
                      max={28}
                      onChange={(v) => update({ outline: v }, 'outline')}
                      suffix="px"
                    />
                    <Slider
                      label="Shadow"
                      value={editor.shadow}
                      min={0}
                      max={20}
                      onChange={(v) => update({ shadow: v }, 'shadow')}
                      suffix="px"
                    />
                    <Slider
                      label="Tracking"
                      value={editor.letterSpacing}
                      min={-3}
                      max={10}
                      step={0.5}
                      onChange={(v) => update({ letterSpacing: v }, 'tracking')}
                      suffix="px"
                    />
                    <Slider
                      label="Line height"
                      value={editor.lineHeight}
                      min={0.85}
                      max={1.8}
                      step={0.01}
                      onChange={(v) => update({ lineHeight: v }, 'line-height')}
                      format={(v) => v.toFixed(2)}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    <Palette size={14} className="text-[#e08a5c]" /> Colour
                  </h3>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                        Base text
                      </span>
                      <span className="font-mono text-[11px] text-white/50">{editor.primaryColor}</span>
                    </div>
                    <Swatches
                      value={editor.primaryColor}
                      onChange={(v) => update({ primaryColor: v }, 'primary')}
                    />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                        Active word
                      </span>
                      <span className="font-mono text-[11px] text-white/50">
                        {editor.activeColor || 'off'}
                      </span>
                    </div>
                    <Swatches
                      value={editor.activeColor}
                      onChange={(v) => update({ activeColor: v }, 'active')}
                      allowNone
                    />
                  </div>
                </section>

                <section className="space-y-2.5">
                  <Toggle
                    label="UPPERCASE"
                    hint="Force capitals for readability."
                    checked={editor.uppercase}
                    onChange={(v) => update({ uppercase: v })}
                  />
                  <Toggle
                    label="Pop-in animation"
                    hint="Caption group snaps in at 112% and settles."
                    checked={editor.pop}
                    onChange={(v) => update({ pop: v })}
                  />
                  <Toggle
                    label="Background plate"
                    hint="Rounded translucent plate behind each caption group."
                    checked={editor.pill}
                    onChange={(v) => update({ pill: v })}
                  />
                  {editor.pill && (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                          Plate colour
                        </span>
                        <span className="font-mono text-[11px] text-white/50">{editor.pillColor}</span>
                      </div>
                      <Swatches
                        value={editor.pillColor}
                        onChange={(v) => update({ pillColor: v }, 'pill-color')}
                      />
                      <Slider
                        label="Plate opacity"
                        value={editor.pillAlpha}
                        min={0.1}
                        max={0.95}
                        step={0.05}
                        onChange={(v) => update({ pillAlpha: v }, 'pill-alpha')}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ---------------- LAYOUT ---------------- */}
            {activeTab === 'layout' && (
              <>
                <section className="space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Placement
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      Or drag the captions directly on the video.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() =>
                          update({ position: pos.id, marginV: pos.marginV }, `pos-${pos.id}`)
                        }
                        className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                          editor.position === pos.id
                            ? 'border-[#ba6238] bg-[#a8542c]/20 text-white ring-1 ring-[#ba6238]'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-semibold">{pos.label}</p>
                        <p className="mt-0.5 text-[10px] text-white/40">{pos.hint}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Vertical position</span>
                      <span className="font-mono text-[#e08a5c]">
                        {Math.round((editor.marginV / 1920) * 100)}% from bottom
                      </span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={1780}
                      value={editor.marginV}
                      onChange={(e) =>
                        update(
                          {
                            marginV: Number(e.target.value),
                            position: 'custom',
                          },
                          'margin'
                        )
                      }
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#c96a3d]"
                    />
                    <div className="flex justify-between font-mono text-[10px] text-white/35">
                      <span>bottom</span>
                      <span>middle</span>
                      <span>top</span>
                    </div>
                  </div>

                  <Toggle
                    label="Safe-zone guides"
                    hint="Marks the top UI band and the lower caption/UI band."
                    checked={showSafeZones}
                    onChange={setShowSafeZones}
                  />
                </section>

                <section className="space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Grouping
                  </h3>
                  <Slider
                    label="Words per caption"
                    value={editor.words}
                    min={1}
                    max={8}
                    onChange={(v) => update({ words: v }, 'words')}
                  />
                  <Slider
                    label="Max characters per line"
                    value={editor.chars}
                    min={8}
                    max={40}
                    onChange={(v) => update({ chars: v }, 'chars')}
                  />
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Groups also break on punctuation and after 2.6s, exactly like the
                    export.
                  </p>
                </section>

                <section className="space-y-2.5">
                  <Toggle
                    label="Censor profanity"
                    hint="Masks flagged words in both preview and export."
                    checked={editor.censor}
                    onChange={(v) => update({ censor: v })}
                  />
                </section>
              </>
            )}

            {/* ---------------- TEXT ---------------- */}
            {activeTab === 'text' && (
              <>
                <section className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Transcript
                      </h3>
                      <p className="mt-1 text-[11px] text-white/45">
                        Edit any word. Clear it to drop the word from the clip.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update({ overrides: {} })}
                      disabled={editedCount === 0}
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={12} /> Restore all
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={showTranscriptSearch}
                      onChange={(e) => setShowTranscriptSearch(e.target.value)}
                      placeholder="Search the transcript…"
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-3 text-xs text-white placeholder:text-white/30 focus:border-[#ba6238] focus:outline-none"
                    />
                  </div>

                  {loadState === 'loading' && (
                    <p className="flex items-center gap-2 text-xs text-white/50">
                      <Loader2 size={12} className="animate-spin" /> Loading words…
                    </p>
                  )}
                  {loadState === 'ready' && plan.groups.length === 0 && (
                    <p className="text-xs text-white/50">
                      No words in this range. Widen the trim or restore deleted words.
                    </p>
                  )}

                  <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
                    {transcriptGroups.map((group, gi) => {
                      const groupVideoTime = localTrimStart + group.start;
                      const isActive = activeGroup === group;
                      return (
                        <div
                          key={`${group.start}-${gi}`}
                          className={`rounded-xl border px-2.5 py-2 transition-colors ${
                            isActive
                              ? 'border-[#ba6238]/60 bg-[#a8542c]/10'
                              : 'border-white/[0.06] bg-white/[0.02]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => seekTo(groupVideoTime)}
                            className="mb-1.5 flex cursor-pointer items-center gap-1 font-mono text-[10px] text-white/40 transition-colors hover:text-[#e08a5c]"
                          >
                            <Timer size={10} />
                            {formatTime(group.start)}
                          </button>
                          <div className="flex flex-wrap items-center gap-1">
                            {group.lines.flat().map((word) => {
                              const key = overrideKey(word);
                              const edited = key in (editor.overrides || {});
                              return (
                                <input
                                  key={key}
                                  value={word.text}
                                  onFocus={() => seekTo(localTrimStart + word.start)}
                                  onChange={(e) =>
                                    update(
                                      {
                                        overrides: {
                                          ...(editor.overrides || {}),
                                          [key]: e.target.value,
                                        },
                                      },
                                      `word-${key}`
                                    )
                                  }
                                  style={{
                                    width: `${Math.max(2, (word.text.length || 1) + 1)}ch`,
                                  }}
                                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] outline-none transition-colors ${
                                    edited
                                      ? 'border-[#ba6238]/60 bg-[#a8542c]/15 text-amber-100'
                                      : 'border-transparent bg-white/[0.06] text-white/85 focus:border-[#ba6238] focus:bg-white/10'
                                  }`}
                                  spellCheck={false}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {editedCount > 0 && (
                    <p className="text-[11px] text-amber-300/70">
                      {editedCount} word{editedCount === 1 ? '' : 's'} edited. Ctrl+Z undoes.
                    </p>
                  )}
                </section>
              </>
            )}

            {/* ---------------- TRIM ---------------- */}
            {activeTab === 'timeline' && (
              <>
                <section className="space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Trim the clip
                    </h3>
                    <p className="mt-1 text-[11px] text-white/45">
                      Drag the handles, or press <kbd className="rounded bg-white/10 px-1">[</kbd>{' '}
                      / <kbd className="rounded bg-white/10 px-1">]</kbd> at the playhead.
                    </p>
                  </div>

                  <div
                    ref={trimBarRef}
                    onPointerMove={onTrimPointerMove}
                    onPointerUp={onTrimPointerUp}
                    onPointerCancel={onTrimPointerUp}
                    onClick={(e) => seekTo(trimTimeAt(e.clientX))}
                    className="relative h-14 cursor-pointer touch-none overflow-hidden rounded-xl border border-white/10 bg-black/40"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-black/55"
                      style={{ width: `${(localTrimStart / Math.max(0.1, duration)) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-black/55"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - (localTrimEnd / Math.max(0.1, duration)) * 100
                        )}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-1 rounded-lg border-2 border-[#c96a3d] bg-[#a8542c]/20"
                      style={{
                        left: `${(localTrimStart / Math.max(0.1, duration)) * 100}%`,
                        width: `${((localTrimEnd - localTrimStart) / Math.max(0.1, duration)) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 z-20 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                      style={{ left: `${(currentTime / Math.max(0.1, duration)) * 100}%` }}
                    />
                    {['start', 'end'].map((side) => {
                      const value = side === 'start' ? localTrimStart : localTrimEnd;
                      return (
                        <div
                          key={side}
                          role="slider"
                          tabIndex={0}
                          aria-label={`Trim ${side}`}
                          onPointerDown={onTrimHandleDown(side)}
                          className="absolute inset-y-0 z-30 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-[#e08a5c]/90 hover:bg-[#ffa06a]"
                          style={{ left: `${(value / Math.max(0.1, duration)) * 100}%` }}
                        >
                          <span className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded bg-black/40" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        In
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-bold text-white">
                        {formatTime(localTrimStart)}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTrimLocal('start', currentTime)}
                          className="cursor-pointer rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70 hover:bg-white/10"
                        >
                          Set to playhead
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        Out
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-bold text-white">
                        {formatTime(localTrimEnd)}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTrimLocal('end', currentTime)}
                          className="cursor-pointer rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70 hover:bg-white/10"
                        >
                          Set to playhead
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      Output length
                    </span>
                    <span className="font-mono text-sm font-bold text-[#e08a5c]">
                      {trimmedDuration.toFixed(2)}s
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '15s', value: 15 },
                      { label: '30s', value: 30 },
                      { label: '45s', value: 45 },
                      { label: '60s', value: 60 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const end = Math.min(
                            duration,
                            localTrimStart + preset.value
                          );
                          update({ trimEnd: sourceStart + end }, `trim-len-${preset.value}`);
                        }}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          { trimStart: sourceStart, trimEnd: sourceStart + duration },
                          'trim-full'
                        )
                      }
                      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      Full clip
                    </button>
                  </div>
                </section>

                <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                  <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                    <ShieldCheck size={12} /> Keyboard
                  </h4>
                  <ul className="space-y-1 text-[11px] text-white/45">
                    <li><kbd className="rounded bg-white/10 px-1">Space</kbd> play / pause</li>
                    <li><kbd className="rounded bg-white/10 px-1">←</kbd> <kbd className="rounded bg-white/10 px-1">→</kbd> nudge 0.1s (Shift = 1s)</li>
                    <li><kbd className="rounded bg-white/10 px-1">[</kbd> trim in · <kbd className="rounded bg-white/10 px-1">]</kbd> trim out</li>
                    <li><kbd className="rounded bg-white/10 px-1">Ctrl+Z</kbd> undo · <kbd className="rounded bg-white/10 px-1">Ctrl+Shift+Z</kbd> redo</li>
                  </ul>
                </section>
              </>
            )}

            {/* ---------------- HOOK ---------------- */}
            {activeTab === 'hook' && (
              <section className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    <Flame size={14} className="text-[#e08a5c]" /> Opening hook
                  </h3>
                  <p className="mt-1 text-[11px] text-white/45">
                    Flashes at the top for the first 3.5 seconds.
                  </p>
                </div>
                <textarea
                  value={editor.hook}
                  onChange={(e) => update({ hook: e.target.value }, 'hook')}
                  rows={3}
                  placeholder="e.g. Wait until you see the ending…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-medium text-white placeholder:text-white/30 focus:border-[#ba6238] focus:outline-none"
                />
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Preview
                  </p>
                  <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-center">
                    <p
                      className="text-xs font-black uppercase tracking-wider text-white"
                      style={{ fontFamily: `"${editor.font}", sans-serif` }}
                    >
                      {editor.hook || 'Your hook headline'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ hook: currentClip?.title || '' })}
                  className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Use clip title
                </button>
              </section>
            )}

            {/* ---------------- FRAMING ---------------- */}
            {activeTab === 'framing' && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Framing
                  </h3>
                  <p className="mt-1 text-[11px] text-white/45">
                    Preview updates instantly; the real reframe is baked on export.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {FRAMING_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => update({ framing: option.id }, 'framing')}
                      className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                        editor.framing === option.id
                          ? 'border-[#ba6238] bg-[#a8542c]/20 text-white ring-1 ring-[#ba6238]'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <h4 className="flex items-center justify-between text-xs font-bold">
                        <span>{option.title}</span>
                        {editor.framing === option.id && (
                          <Check size={13} className="text-[#e08a5c]" />
                        )}
                      </h4>
                      <p className="mt-1 text-[11px] leading-snug text-white/45">
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-white/40">
                  Export re-renders from the original source with this framing, then burns
                  the captions you see here.
                </p>
              </section>
            )}
          </div>

          {/* export bar */}
          {exportMessage && (
            <div className="flex items-center gap-2 border-t border-emerald-500/25 bg-emerald-500/15 px-5 py-2 text-xs text-emerald-200">
              <Check size={13} />
              <span>{exportMessage}</span>
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-rule bg-[#131720] p-3.5">
            <div className="flex items-center gap-2">
              <a
                href={videoUrl}
                download={filename}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Clean MP4</span>
              </a>
              <a
                href={srtUrl}
                download={srtFilename}
                className="cursor-pointer rounded-xl bg-white/5 px-2.5 py-2 font-mono text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                SRT
              </a>
              <span className="hidden items-center gap-1 text-[10px] font-mono text-white/30 sm:flex">
                <Gauge size={11} /> {Math.round(trimmedDuration)}s ·{' '}
                {plan.groups.length} groups
              </span>
            </div>

            <button
              type="button"
              disabled={isExporting || loadState !== 'ready'}
              onClick={handleExport}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#ba6238]/50 bg-[#a8542c]/25 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[#a8542c]/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-[#e08a5c]" />
                  <span>Rendering…</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} className="text-[#e08a5c]" />
                  <span>Export burned-in MP4</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
