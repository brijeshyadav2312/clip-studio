/**
 * Client-side caption layout.
 *
 * This mirrors `clipping/captions.py` (`_groups`, `_wrap_word_objs`,
 * `apply_word_overrides`, the censor list and the style table) so the editor can
 * regroup, rewrap and restyle captions locally on every keystroke. The server
 * still builds the ASS at export time with the same rules, which is what keeps
 * the live preview and the burned MP4 in agreement.
 */

export const CAPTION_PRESETS = [
  {
    id: 'wordpop',
    name: 'Word Pop',
    desc: 'Bold sans, one word lighting up at a time with a 4-word window.',
    badge: 'Default',
    badgeColor: 'bg-white/10 text-white/70 border-white/20',
    font: 'Poppins',
    fontSize: 70,
    primaryColor: '#FFFFFF',
    activeColor: '#FFFF00',
    uppercase: true,
    words: 4,
    chars: 17,
    outline: 8,
    shadow: 3,
    pop: true,
    pill: false,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.06,
  },
  {
    id: 'karaoke',
    name: 'Karaoke Glow',
    desc: 'Lower-case lyric line in a frosted plate, words fill with gold.',
    badge: 'Lyric',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    font: 'Montserrat',
    fontSize: 68,
    primaryColor: '#FFFFFF',
    activeColor: '#FFD400',
    uppercase: false,
    words: 5,
    chars: 19,
    outline: 6,
    shadow: 2,
    pop: false,
    pill: true,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.12,
  },
  {
    id: 'hormozi',
    name: 'Hormozi Punch',
    desc: 'Huge condensed caps, 1-2 words per hit, heavy black stroke.',
    badge: 'Viral',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    font: 'Anton',
    fontSize: 104,
    primaryColor: '#FFFFFF',
    activeColor: '#00FF66',
    uppercase: true,
    words: 2,
    chars: 13,
    outline: 12,
    shadow: 5,
    pop: true,
    pill: false,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.0,
  },
  {
    id: 'clean',
    name: 'Cinematic Clean',
    desc: 'Quiet subtitle flow, no colour swap, translucent backdrop.',
    badge: 'Clean',
    badgeColor: 'bg-white/10 text-white/70 border-white/20',
    font: 'Rubik',
    fontSize: 58,
    primaryColor: '#FFFFFF',
    activeColor: '',
    uppercase: false,
    words: 8,
    chars: 26,
    outline: 3,
    shadow: 2,
    pop: false,
    pill: true,
    pillColor: '#000000',
    pillAlpha: 0.5,
    letterSpacing: 0,
    lineHeight: 1.18,
  },
  {
    id: 'neon',
    name: 'Cyber Neon',
    desc: 'Tight caps with wide tracking, cyan highlights, dark glass plate.',
    badge: 'Trending',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    font: 'Oswald',
    fontSize: 76,
    primaryColor: '#E9FBFF',
    activeColor: '#00F0FF',
    uppercase: true,
    words: 3,
    chars: 16,
    outline: 9,
    shadow: 7,
    pop: true,
    pill: true,
    pillColor: '#0B0B1A',
    pillAlpha: 0.65,
    letterSpacing: 1,
    lineHeight: 1.06,
  },
  {
    id: 'boxed',
    name: 'Boxed Highlighter',
    desc: 'Active word inverts into a marker smear with a thick colour stroke.',
    badge: 'Retention',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    font: 'Archivo Black',
    fontSize: 68,
    primaryColor: '#FFFFFF',
    activeColor: '#FFD700',
    uppercase: true,
    words: 3,
    chars: 15,
    outline: 6,
    shadow: 0,
    pop: false,
    pill: false,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.06,
  },
  {
    id: 'beast',
    name: 'MrBeast Zoom',
    desc: 'Two words, maximum scale, hard yellow flash on the active word.',
    badge: 'Punchy',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    font: 'Anton',
    fontSize: 94,
    primaryColor: '#FFFFFF',
    activeColor: '#FFFF00',
    uppercase: true,
    words: 2,
    chars: 12,
    outline: 14,
    shadow: 6,
    pop: true,
    pill: false,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.0,
  },
  {
    id: 'comic',
    name: 'Comic Sticker',
    desc: 'Yellow ink with a rose pop and a chunky cartoon outline.',
    badge: 'Playful',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    font: 'Poppins',
    fontSize: 86,
    primaryColor: '#FFF01F',
    activeColor: '#FF2A6D',
    uppercase: true,
    words: 3,
    chars: 14,
    outline: 12,
    shadow: 8,
    pop: true,
    pill: false,
    pillColor: '#000000',
    pillAlpha: 0.55,
    letterSpacing: 0,
    lineHeight: 1.02,
  },
];

export const PRESET_BY_ID = Object.fromEntries(CAPTION_PRESETS.map((p) => [p.id, p]));

export const CAPTION_FONTS = [
  { name: 'Anton', label: 'Anton', weight: 400, note: 'Condensed impact' },
  { name: 'Archivo Black', label: 'Archivo Black', weight: 400, note: 'Heavy grotesk' },
  { name: 'Bebas Neue', label: 'Bebas Neue', weight: 400, note: 'Tall caps' },
  { name: 'Poppins', label: 'Poppins', weight: 700, note: 'Rounded geometric' },
  { name: 'Montserrat', label: 'Montserrat', weight: 700, note: 'Editorial sans' },
  { name: 'Rubik', label: 'Rubik', weight: 600, note: 'Soft corners' },
  { name: 'Oswald', label: 'Oswald', weight: 600, note: 'Narrow news' },
];

export const COLOR_SWATCHES = [
  '#FFFFFF',
  '#FFFF00',
  '#00FF66',
  '#00F0FF',
  '#FF2A6D',
  '#FFAA00',
  '#A855F7',
  '#FFD700',
  '#000000',
];

export const POSITIONS = [
  { id: 'top', label: 'Top', marginV: 1500, hint: 'Headline zone' },
  { id: 'divider', label: 'Divider', marginV: 780, hint: 'Split-screen seam' },
  { id: 'middle', label: 'Middle', marginV: 860, hint: 'Dead centre' },
  { id: 'bottom', label: 'Bottom', marginV: 300, hint: 'Lower third' },
];

// Mirrors PROFANITY in captions.py.
const PROFANITY = new Set([
  'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitty', 'bullshit', 'bitch',
  'asshole', 'damn', 'dammit', 'cunt', 'dick', 'piss', 'bastard', 'slut', 'whore',
]);

const SYMBOL_ONLY = /^[\W_]+$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Same sanitiser as the ASS writer: no braces, backslashes or newlines. */
export function cleanText(text) {
  return String(text ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\\/g, '/')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

export function overrideKey(word) {
  return Number(word.abs_start ?? word.absStart ?? word.start ?? 0).toFixed(3);
}

export function groupWords(words, maxWords) {
  const groups = [];
  let current = [];
  let start = null;
  for (const word of words) {
    if (start === null) start = word.start;
    current.push(word);
    const duration = word.end - start;
    const punctuated = /[.!?,;:]$/.test(word.text);
    if (punctuated || current.length >= maxWords || duration >= 2.6) {
      groups.push(current);
      current = [];
      start = null;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

export function wrapWords(words, maxChars) {
  const lines = [];
  let current = [];
  let length = 0;
  for (const word of words) {
    const size = word.text.length;
    if (current.length && length + 1 + size > maxChars) {
      lines.push(current);
      current = [word];
      length = size;
    } else {
      length = current.length ? length + 1 + size : size;
      current.push(word);
    }
  }
  if (current.length) lines.push(current);
  return lines.slice(0, 3);
}

export function wrapPlain(text, maxChars) {
  const lines = [];
  let current = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/**
 * Build the same event structure `plan_captions()` returns, from the raw
 * transcript words plus the editor's current style.
 *
 * `trimStart` / `trimEnd` are in the same space as each word's `start` / `end`
 * (seconds from the start of the clean master), so the output group times are
 * directly comparable to `video.currentTime`.
 */
export function buildCaptionPlan({
  words = [],
  overrides = {},
  trimStart = 0,
  trimEnd = 30,
  style,
  censor = false,
}) {
  const duration = Math.max(0.1, trimEnd - trimStart);
  const local = [];

  for (const raw of words) {
    const wordStart = Number(raw.start ?? 0);
    const wordEnd = Number(raw.end ?? wordStart + 0.1);
    if (wordEnd <= trimStart || wordStart >= trimEnd) continue;

    const absStart = Number(raw.abs_start ?? wordStart);
    const key = absStart.toFixed(3);
    let text = cleanText(key in overrides ? overrides[key] : raw.text ?? raw.word ?? '');
    if (!text || SYMBOL_ONLY.test(text)) continue;

    if (censor && PROFANITY.has(text.toLowerCase().replace(/[.,!?]+$/, ''))) {
      text = text[0] + '*'.repeat(Math.max(2, text.length - 1));
    }

    let start = Math.max(0, wordStart - trimStart);
    let end = Math.max(0, Math.min(duration, wordEnd - trimStart));
    if (end <= start) end = Math.min(duration, start + 0.08);
    local.push({ start, end, text, absStart: Math.round(absStart * 1000) / 1000 });
  }

  // Collapse the duplicated half-words Whisper emits at segment seams.
  const deduped = [];
  for (const word of local) {
    const last = deduped[deduped.length - 1];
    if (last && last.text === word.text && Math.abs(last.end - word.start) < 0.02) {
      last.end = word.end;
      continue;
    }
    deduped.push(word);
  }

  const groups = groupWords(deduped, Math.max(1, style.words)).map((group) => ({
    start: group[0].start,
    end: Math.min(duration, Math.max(...group.map((w) => w.end))),
    lines: wrapWords(group, Math.max(4, style.chars)),
  }));

  const hookSource = cleanText(style.hook || '');
  const hookLines = hookSource
    ? wrapPlain(style.uppercase ? hookSource.toUpperCase() : hookSource, 18)
    : [];

  return {
    duration,
    groups,
    words: deduped,
    hook: hookLines,
    hookEnd: Math.min(duration, 3.5),
  };
}

export function activeGroupAt(groups, time) {
  if (!groups.length) return null;
  let lo = 0;
  let hi = groups.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const group = groups[mid];
    if (time < group.start - 0.03) hi = mid - 1;
    else if (time >= group.end + 0.06) lo = mid + 1;
    else return group;
  }
  return null;
}

export function activeWordIndex(group, time) {
  if (!group) return -1;
  const flat = group.lines.flat();
  const idx = flat.findIndex((w) => time >= w.start - 0.02 && time < w.end);
  return idx < 0 ? 0 : idx;
}

/** 1080x1920 export space -> CSS pixels for the preview frame. */
export function exportToCss(value, frameWidth) {
  return (value * frameWidth) / 1080;
}

export function hexToRgba(hex, alpha = 1) {
  const raw = String(hex || '#000000').replace('#', '');
  const value = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function presetState(preset) {
  return {
    preset: preset.id,
    font: preset.font,
    fontSize: preset.fontSize,
    primaryColor: preset.primaryColor,
    activeColor: preset.activeColor || '',
    uppercase: preset.uppercase,
    words: preset.words,
    chars: preset.chars,
    outline: preset.outline,
    shadow: preset.shadow,
    pop: preset.pop,
    pill: preset.pill,
    pillColor: preset.pillColor,
    pillAlpha: preset.pillAlpha,
    letterSpacing: preset.letterSpacing,
    lineHeight: preset.lineHeight,
  };
}
