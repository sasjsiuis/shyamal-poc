import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Contrast,
  Download,
  Highlighter,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Moon,
  MousePointerClick,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { RangeSlider } from './components/RangeSlider';
import { TemplatesPage } from './components/TemplatesPage';
import {
  ALL_TEMPLATES,
  BUILTIN_FONTS,
  PSD_GREEN_TEMPLATE,
  PSD_MAROON_TEMPLATE,
  TEMPLATE_CATEGORIES,
} from './data/templates';
import type {
  ExportFormat,
  FontOption,
  HighlightRange,
  LineMode,
  LogoBadgeStyle,
  LogoSettings,
  RenderedLayoutMetrics,
  TemplateCategory,
  TemplateConfig,
  TemplateOverride,
  ThemeMode,
} from './types/card';
import { buildHighlightMask, renderNewsCard } from './utils/canvasRenderer';

const CUSTOM_FONTS_STORAGE_KEY = 'news_card_custom_fonts_v1';
const THEME_STORAGE_KEY = 'news_card_theme_mode_v1';
const CATEGORY_NAMES_STORAGE_KEY = 'news_card_category_names_v1';
const TEMPLATE_OVERRIDES_STORAGE_KEY = 'news_card_template_overrides_v1';
const CARD_AUTOSAVE_STORAGE_KEY = 'news_card_autosave_v1';
const DEFAULT_PHOTO_SRC = '/assets/aistudio/5329_21a6eb86.png';

interface SavedCardState {
  version: 1 | 2;
  newsUrl: string;
  selectedTemplateId: string;
  customTemplate?: TemplateConfig | null;
  headline: string;
  highlights: HighlightRange[];
  highlightTab: 'words' | 'manual';
  lineMode: LineMode;
  fontSizePercent: number;
  lineGapPercent: number;
  selectedFontId: string;
  textOffsetX: number;
  textOffsetY: number;
  textShadow: boolean;
  textColor: string;
  highlightColor: string;
  photoSrc: string;
  photoZoom: number;
  photoPanX: number;
  photoPanY: number;
  logoSettings: LogoSettings;
  exportFormat: ExportFormat;
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function loadSavedCardState(): SavedCardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CARD_AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedCardState> | null;
    if (!parsed || typeof parsed !== 'object' || (parsed.version !== 1 && parsed.version !== 2)) {
      return null;
    }

    const highlights: HighlightRange[] = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter(
          (h): h is HighlightRange =>
            Boolean(h) &&
            typeof h.id === 'string' &&
            typeof h.start === 'number' &&
            typeof h.end === 'number' &&
            typeof h.text === 'string'
        )
      : [];

    const logoRaw = parsed.logoSettings;
    const rawBadge = logoRaw?.badgeStyle;
    const validBadgeStyle: LogoBadgeStyle =
      parsed.version === 2 &&
      (rawBadge === 'auto' || rawBadge === 'white' || rawBadge === 'frosted' || rawBadge === 'none')
        ? rawBadge
        : 'none';
    const logoSettings: LogoSettings = {
      dataUrl: typeof logoRaw?.dataUrl === 'string' ? logoRaw.dataUrl : null,
      scale: clampNumber(logoRaw?.scale, 25, 200, 100),
      x: clampNumber(logoRaw?.x, -100, 100, 0),
      y: clampNumber(logoRaw?.y, -100, 100, 0),
      hideDefaultBrand: Boolean(logoRaw?.hideDefaultBrand),
      badgeStyle: validBadgeStyle,
    };

    const customTemplate =
      parsed.customTemplate &&
      typeof parsed.customTemplate === 'object' &&
      typeof parsed.customTemplate.id === 'string' &&
      typeof parsed.customTemplate.canvasWidth === 'number' &&
      typeof parsed.customTemplate.canvasHeight === 'number'
        ? parsed.customTemplate
        : null;

    const matchedBuiltin = ALL_TEMPLATES.find((t) => t.id === parsed.selectedTemplateId);
    const resolvedTemplate =
      matchedBuiltin ||
      (customTemplate && customTemplate.id === parsed.selectedTemplateId ? customTemplate : null) ||
      PSD_GREEN_TEMPLATE;

    return {
      version: 1,
      newsUrl: typeof parsed.newsUrl === 'string' ? parsed.newsUrl : '',
      selectedTemplateId: resolvedTemplate.id,
      customTemplate:
        customTemplate && customTemplate.id === resolvedTemplate.id ? customTemplate : null,
      headline:
        typeof parsed.headline === 'string'
          ? parsed.headline
          : 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ',
      highlights,
      highlightTab: parsed.highlightTab === 'manual' ? 'manual' : 'words',
      lineMode:
        parsed.lineMode === 'one' || parsed.lineMode === 'two' || parsed.lineMode === 'auto'
          ? parsed.lineMode
          : 'auto',
      fontSizePercent: clampNumber(parsed.fontSizePercent, 50, 180, 100),
      lineGapPercent: clampNumber(parsed.lineGapPercent, 60, 160, 92),
      selectedFontId:
        typeof parsed.selectedFontId === 'string' && parsed.selectedFontId
          ? parsed.selectedFontId
          : 'kalpurush',
      textOffsetX: clampNumber(parsed.textOffsetX, -0.45, 0.45, 0),
      textOffsetY: clampNumber(parsed.textOffsetY, -0.45, 0.45, 0),
      textShadow: Boolean(parsed.textShadow),
      textColor:
        typeof parsed.textColor === 'string' && parsed.textColor
          ? parsed.textColor
          : resolvedTemplate.defaultTextColor,
      highlightColor:
        typeof parsed.highlightColor === 'string' && parsed.highlightColor
          ? parsed.highlightColor
          : resolvedTemplate.defaultHighlightColor,
      photoSrc:
        typeof parsed.photoSrc === 'string' &&
        parsed.photoSrc &&
        parsed.photoSrc !== '/sample/parliament.jpg' &&
        parsed.photoSrc !== '/sample/yunus_nahid.jpg'
          ? parsed.photoSrc
          : DEFAULT_PHOTO_SRC,
      photoZoom: clampNumber(parsed.photoZoom, 1, 3, 1),
      photoPanX: clampNumber(parsed.photoPanX, -100, 100, 0),
      photoPanY: clampNumber(parsed.photoPanY, -100, 100, 0),
      logoSettings,
      exportFormat: parsed.exportFormat === 'jpeg' ? 'jpeg' : 'png',
    };
  } catch {
    return null;
  }
}

function persistCardState(state: SavedCardState): void {
  if (typeof window === 'undefined') return;

  const tryWrite = (candidate: SavedCardState): boolean => {
    try {
      const serialized = JSON.stringify(candidate);
      if (serialized.length > 4_200_000) return false;
      localStorage.setItem(CARD_AUTOSAVE_STORAGE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  };

  if (tryWrite(state)) return;

  // Fallback 1: Strip oversized custom frame overlay data URL if exceeding localStorage quota
  const withoutBigCustomOverlay: SavedCardState = state.customTemplate
    ? {
        ...state,
        selectedTemplateId: PSD_GREEN_TEMPLATE.id,
        customTemplate: null,
      }
    : state;
  if (tryWrite(withoutBigCustomOverlay)) return;

  // Fallback 2: Strip oversized logo data URL
  const withoutLogoData: SavedCardState = {
    ...withoutBigCustomOverlay,
    logoSettings: {
      ...withoutBigCustomOverlay.logoSettings,
      dataUrl: null,
    },
  };
  if (tryWrite(withoutLogoData)) return;

  // Fallback 3: Strip large uploaded data-URI photo so all text, highlights, crop, and template choices still persist
  if (withoutLogoData.photoSrc.startsWith('data:')) {
    tryWrite({
      ...withoutLogoData,
      photoSrc: DEFAULT_PHOTO_SRC,
    });
  }
}

function normalizeExternalUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function sanitizeUrlInput(raw: string): string {
  const trimmed = raw.trim().replace(/[\r\n]+/g, ' ');
  if (!trimmed) return '';
  const urlMatches = trimmed.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 0) {
    const first = urlMatches[0];
    const secondProtoIdx = first.slice(8).search(/https?:\/\//i);
    if (secondProtoIdx !== -1) {
      return first.slice(0, secondProtoIdx + 8);
    }
    return first;
  }
  return trimmed;
}

function isLikelyUrl(input: string): boolean {
  const s = input.trim();
  if (s.length < 8) return false;
  if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return true;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/[^\s]*/i.test(s)) return true;
  return false;
}

function isClientErrorOrChallengeTitle(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  return (
    /^(just a moment|attention required|access denied|403 forbidden|cloudflare|security check|page not found|404\b|error\s*404|nothing found|not found)/i.test(
      t
    ) || /\b404\s*[-–|:]\s*(nothing found|not found|page not found)/i.test(t)
  );
}

function extractTitleFromSlugClient(rawUrl: string): string {
  try {
    const parsed = new URL(normalizeExternalUrl(rawUrl));
    const segments = parsed.pathname
      .split('/')
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);
    const meaningful = segments
      .filter((seg) => {
        const clean = seg.replace(/\.(html?|php|aspx?|jsp)$/i, '').trim();
        if (/^[0-9a-f]{10,}$/i.test(clean)) return false;
        if (/^[0-9a-f]{8}-[0-9a-f-]{12,}$/i.test(clean)) return false;
        return clean.length > 6;
      })
      .map((seg) =>
        seg
          .replace(/\.(html?|php|aspx?|jsp)$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\d{5,}\b/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(
        (seg) =>
          seg.length > 8 &&
          (seg.includes(' ') || /[\u0980-\u09FF]/.test(seg)) &&
          !/^(news|article|story|details|national|politics|sports|bangladesh|world|opinion|national news|economics business)$/i.test(
            seg
          )
      );
    if (meaningful.length === 0) return '';
    meaningful.sort((a, b) => b.length - a.length);
    return meaningful[0];
  } catch {
    return '';
  }
}

function extractYouTubeThumbClient(rawUrl: string): string {
  try {
    const parsed = new URL(normalizeExternalUrl(rawUrl));
    const host = parsed.hostname.toLowerCase();
    let videoId = '';
    if (host.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1).split('/')[0];
    } else if (host.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v') || '';
      if (!videoId && parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      }
    }
    if (videoId && /^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } catch {
    // ignore
  }
  return '';
}

async function fetchMicrolinkClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(target)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as {
      status?: string;
      data?: {
        title?: string;
        publisher?: string;
        image?: { url?: string } | string;
      };
    };
    if (json?.status !== 'success' || !json.data) {
      return { title: '', image: '' };
    }
    let title = (json.data.title || '').trim();
    const publisher = (json.data.publisher || '').trim();
    if (title && publisher) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = title.lastIndexOf(sep);
        if (idx > 14 && title.slice(idx + sep.length).toLowerCase().includes(publisher.toLowerCase())) {
          title = title.slice(0, idx).trim();
          break;
        }
      }
    }
    if (isClientErrorOrChallengeTitle(title)) {
      return { title: '', image: '' };
    }
    const rawImg =
      typeof json.data.image === 'string'
        ? json.data.image
        : json.data.image?.url || '';
    return {
      title,
      image: rawImg.trim().replace(/ /g, '%20'),
    };
  } catch {
    return { title: '', image: '' };
  }
}

function parseClientHtmlMeta(html: string, pageUrl: string): { title: string; image: string } {
  if (!html || typeof DOMParser === 'undefined') return { title: '', image: '' };
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pickMeta = (selectors: string[]): string => {
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        const val = el?.getAttribute('content')?.trim();
        if (val) return val;
      }
      return '';
    };

    const siteName = pickMeta([
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="publisher"]',
    ]);
    let rawTitle =
      pickMeta([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
      ]) ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.title?.trim() ||
      '';

    if (isClientErrorOrChallengeTitle(rawTitle)) {
      return { title: '', image: '' };
    }

    if (rawTitle) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = rawTitle.lastIndexOf(sep);
        if (idx > 14) {
          const right = rawTitle.slice(idx + sep.length).trim();
          if (
            right.split(/\s+/).length <= 4 ||
            (siteName && right.toLowerCase().includes(siteName.toLowerCase()))
          ) {
            rawTitle = rawTitle.slice(0, idx).trim();
            break;
          }
        }
      }
    }

    const rawImg =
      pickMeta([
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ]) ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() ||
      '';

    let image = '';
    if (rawImg) {
      try {
        image = new URL(rawImg.replace(/ /g, '%20'), pageUrl).href;
      } catch {
        image = '';
      }
    }
    return { title: rawTitle, image };
  } catch {
    return { title: '', image: '' };
  }
}

async function fetchAllOriginsClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, {
      signal,
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as { contents?: string };
    if (!json?.contents) return { title: '', image: '' };
    return parseClientHtmlMeta(json.contents, target);
  } catch {
    return { title: '', image: '' };
  }
}

async function fetchJsonLinkClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(target)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as { title?: string; images?: string[] };
    const title = (json.title || '').trim();
    if (isClientErrorOrChallengeTitle(title)) {
      return { title: '', image: '' };
    }
    const image =
      Array.isArray(json.images) && json.images[0]
        ? json.images[0].trim().replace(/ /g, '%20')
        : '';
    return { title, image };
  } catch {
    return { title: '', image: '' };
  }
}

async function fetchJinaClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://r.jina.ai/${target}`, {
      signal,
      headers: { Accept: 'text/plain' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const text = (await resp.text()).slice(0, 100_000);
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : '';
    if (title) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = title.lastIndexOf(sep);
        if (idx > 14 && title.slice(idx + sep.length).trim().split(/\s+/).length <= 4) {
          title = title.slice(0, idx).trim();
          break;
        }
      }
    }
    if (isClientErrorOrChallengeTitle(title)) title = '';
    let image = '';
    const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(text)) !== null) {
      const candidate = m[1].trim().replace(/ /g, '%20');
      if (candidate && !/logo|favicon|icon|avatar|sprite|\.svg/i.test(candidate)) {
        image = candidate;
        break;
      }
    }
    return { title, image };
  } catch {
    return { title: '', image: '' };
  }
}

interface ParsedWord {
  index: number;
  text: string;
  start: number;
  end: number;
}

export default function App() {
  const [initialSavedCard] = useState<SavedCardState | null>(() => loadSavedCardState());

  // Theme state ('light' | 'dark' | 'auto') — defaults to 'auto'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
    return 'auto';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }

    const applyTheme = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeMode === 'dark' || (themeMode === 'auto' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    };

    applyTheme();

    if (themeMode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      if (mq.addEventListener) {
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
      }
    }
  }, [themeMode]);

  // URL & Auto-extraction state
  const [newsUrl, setNewsUrl] = useState(() => initialSavedCard?.newsUrl ?? '');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const lastFetchedUrlRef = useRef<string>(initialSavedCard?.newsUrl?.trim() || '');
  const extractAbortRef = useRef<AbortController | null>(null);

  // Template state (defaults to সবুজ টেমপ্লেট or restored auto-saved template)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig>(() => {
    if (initialSavedCard) {
      if (
        initialSavedCard.customTemplate &&
        initialSavedCard.customTemplate.id === initialSavedCard.selectedTemplateId
      ) {
        return initialSavedCard.customTemplate;
      }
      const found = ALL_TEMPLATES.find((t) => t.id === initialSavedCard.selectedTemplateId);
      if (found) return found;
    }
    return PSD_GREEN_TEMPLATE;
  });
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);

  // Category & Photo Card Name Customization (persisted in localStorage)
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(CATEGORY_NAMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [templateOverrides, setTemplateOverrides] = useState<Record<string, TemplateOverride>>(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_OVERRIDES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [showRenamePanel, setShowRenamePanel] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORY_NAMES_STORAGE_KEY, JSON.stringify(categoryNames));
    } catch {
      // ignore
    }
  }, [categoryNames]);

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_OVERRIDES_STORAGE_KEY, JSON.stringify(templateOverrides));
    } catch {
      // ignore
    }
  }, [templateOverrides]);

  // Headline & Highlight state — initialized from auto-saved state or sample card
  const [headline, setHeadline] = useState(
    () => initialSavedCard?.headline ?? 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ'
  );
  const [highlights, setHighlights] = useState<HighlightRange[]>(
    () =>
      initialSavedCard?.highlights ?? [
        { id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' },
      ]
  );
  const [selectionHint, setSelectionHint] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // Word-by-word highlight UI tab ('words' | 'manual')
  const [highlightTab, setHighlightTab] = useState<'words' | 'manual'>(
    () => initialSavedCard?.highlightTab ?? 'words'
  );

  // Page navigation ('generator' | 'templates')
  const [activePage, setActivePage] = useState<'generator' | 'templates'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#templates') {
      return 'templates';
    }
    return 'generator';
  });

  useEffect(() => {
    const onHashChange = () => {
      setActivePage(window.location.hash === '#templates' ? 'templates' : 'generator');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateToPage = useCallback((page: 'generator' | 'templates') => {
    setActivePage(page);
    if (typeof window !== 'undefined') {
      const targetHash = page === 'templates' ? '#templates' : '';
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash || window.location.pathname + window.location.search);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Typography & Position controls
  const [showMoreOptions, setShowMoreOptions] = useState(true);
  const [lineMode, setLineMode] = useState<LineMode>(() => initialSavedCard?.lineMode ?? 'auto');
  const [fontSizePercent, setFontSizePercent] = useState<number>(
    () => initialSavedCard?.fontSizePercent ?? 100
  );
  const [lineGapPercent, setLineGapPercent] = useState<number>(
    () => initialSavedCard?.lineGapPercent ?? 92
  );
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<string>(
    () => initialSavedCard?.selectedFontId ?? 'kalpurush'
  );
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const [textOffsetX, setTextOffsetX] = useState<number>(
    () => initialSavedCard?.textOffsetX ?? 0
  );
  const [textOffsetY, setTextOffsetY] = useState<number>(
    () => initialSavedCard?.textOffsetY ?? 0
  );
  const [textShadow, setTextShadow] = useState<boolean>(
    () => initialSavedCard?.textShadow ?? false
  );
  const [textColor, setTextColor] = useState<string>(
    () => initialSavedCard?.textColor ?? PSD_GREEN_TEMPLATE.defaultTextColor
  );
  const [highlightColor, setHighlightColor] = useState<string>(
    () => initialSavedCard?.highlightColor ?? PSD_GREEN_TEMPLATE.defaultHighlightColor
  );

  // Photo state & controls — initialized from auto-saved state or default sample card photo
  const [photoSrc, setPhotoSrc] = useState<string>(
    () => initialSavedCard?.photoSrc ?? DEFAULT_PHOTO_SRC
  );
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(() => initialSavedCard?.photoZoom ?? 1);
  const [photoPanX, setPhotoPanX] = useState<number>(() => initialSavedCard?.photoPanX ?? 0);
  const [photoPanY, setPhotoPanY] = useState<number>(() => initialSavedCard?.photoPanY ?? 0);

  // Logo & Export format state
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(
    () =>
      initialSavedCard?.logoSettings ?? {
        dataUrl: null,
        scale: 100,
        x: 0,
        y: 0,
        hideDefaultBrand: false,
        badgeStyle: 'none',
      }
  );
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [officialLogoImg, setOfficialLogoImg] = useState<HTMLImageElement | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    () => initialSavedCard?.exportFormat ?? 'png'
  );
  const [downloadDone, setDownloadDone] = useState(false);

  // File input refs
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const customFrameInputRef = useRef<HTMLInputElement | null>(null);

  // Canvas & Dragging refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutMetricsRef = useRef<RenderedLayoutMetrics | null>(null);
  const [snapState, setSnapState] = useState<{
    snappedX: boolean;
    snappedY: boolean;
    isDragging: boolean;
  }>({
    snappedX: false,
    snappedY: false,
    isDragging: false,
  });

  const dragRef = useRef<{
    mode: 'none' | 'text' | 'photo' | 'logo';
    startClientX: number;
    startClientY: number;
    initialTextX: number;
    initialTextY: number;
    initialPanX: number;
    initialPanY: number;
    initialLogoX: number;
    initialLogoY: number;
    moved: boolean;
  }>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    initialTextX: 0,
    initialTextY: 0,
    initialPanX: 0,
    initialPanY: 0,
    initialLogoX: 0,
    initialLogoY: 0,
    moved: false,
  });

  const allFonts = useMemo(() => [...BUILTIN_FONTS, ...customFonts], [customFonts]);
  const activeFont = useMemo(
    () => allFonts.find((f) => f.id === selectedFontId) || BUILTIN_FONTS[0],
    [allFonts, selectedFontId]
  );

  // Merge selectedTemplate with any user-customized card name, category, kicker, or footer CTA
  const effectiveTemplate = useMemo<TemplateConfig>(() => {
    const ov = templateOverrides[selectedTemplate.id];
    const effectiveCategory = ov?.category || selectedTemplate.category;
    const effectiveName =
      ov?.name !== undefined && ov.name.trim() ? ov.name : selectedTemplate.name;
    const renamedCat = categoryNames[effectiveCategory]?.trim();

    let effectiveKicker = selectedTemplate.kickerText;
    if (ov?.kickerText !== undefined) {
      effectiveKicker = ov.kickerText;
    } else if (
      renamedCat &&
      selectedTemplate.kickerText &&
      selectedTemplate.kickerText === selectedTemplate.category
    ) {
      effectiveKicker = renamedCat;
    } else if (ov?.category && selectedTemplate.styleType !== 'psd-overlay') {
      effectiveKicker = renamedCat || ov.category;
    }

    const effectiveFooterCta =
      ov?.footerCtaText !== undefined ? ov.footerCtaText : selectedTemplate.footerCtaText;
    const effectiveWebsiteUrl =
      ov?.websiteUrl !== undefined ? ov.websiteUrl : selectedTemplate.websiteUrl;

    return {
      ...selectedTemplate,
      name: effectiveName,
      category: effectiveCategory,
      kickerText: effectiveKicker,
      footerCtaText: effectiveFooterCta,
      websiteUrl: effectiveWebsiteUrl,
    };
  }, [selectedTemplate, templateOverrides, categoryNames]);

  const handleRenameCategory = useCallback(
    (categoryKey: Exclude<TemplateCategory, 'সব'>, newName: string) => {
      const trimmed = newName.trim();
      setCategoryNames((prev) => {
        if (!trimmed || trimmed === categoryKey) {
          const next = { ...prev };
          delete next[categoryKey];
          return next;
        }
        return { ...prev, [categoryKey]: trimmed };
      });
    },
    []
  );

  const handleResetCategoryName = useCallback((categoryKey: Exclude<TemplateCategory, 'সব'>) => {
    setCategoryNames((prev) => {
      const next = { ...prev };
      delete next[categoryKey];
      return next;
    });
  }, []);

  const handleUpdateTemplateOverride = useCallback(
    (templateId: string, patch: TemplateOverride) => {
      setTemplateOverrides((prev) => ({
        ...prev,
        [templateId]: {
          ...prev[templateId],
          ...patch,
        },
      }));
    },
    []
  );

  const handleResetTemplateOverride = useCallback((templateId: string) => {
    setTemplateOverrides((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  }, []);

  const handleUpdateActiveTemplateOverride = useCallback(
    (patch: TemplateOverride) => {
      handleUpdateTemplateOverride(selectedTemplate.id, patch);
    },
    [selectedTemplate.id, handleUpdateTemplateOverride]
  );

  const handleResetActiveTemplateOverride = useCallback(() => {
    handleResetTemplateOverride(selectedTemplate.id);
  }, [selectedTemplate.id, handleResetTemplateOverride]);

  // Extract all individual words from the current headline with character indices
  const parsedWords = useMemo<ParsedWord[]>(() => {
    if (!headline) return [];
    const words: ParsedWord[] = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(headline)) !== null) {
      words.push({
        index: idx++,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return words;
  }, [headline]);

  // Current highlight boolean mask per character
  const highlightMask = useMemo(() => {
    return buildHighlightMask(headline, highlights);
  }, [headline, highlights]);

  // Check which parsed words are currently highlighted
  const isWordHighlighted = useCallback(
    (word: ParsedWord): boolean => {
      if (word.end <= word.start || word.start >= highlightMask.length) return false;
      // If any non-combining character of the word is masked as highlighted
      for (let i = word.start; i < word.end; i++) {
        if (highlightMask[i]) return true;
      }
      return false;
    },
    [highlightMask]
  );

  // Toggle word highlight on click (1-click word toggle!)
  const handleToggleWordHighlight = useCallback(
    (word: ParsedWord) => {
      const alreadyHighlighted = isWordHighlighted(word);
      if (alreadyHighlighted) {
        // Remove highlights overlapping this word
        setHighlights((prev) =>
          prev.filter((h) => {
            const overlaps = Math.max(h.start, word.start) < Math.min(h.end, word.end);
            return !overlaps;
          })
        );
      } else {
        // Add highlight for this word
        setHighlights((prev) => [
          ...prev,
          {
            id: `w-${word.start}-${Date.now()}`,
            start: word.start,
            end: word.end,
            text: word.text,
          },
        ]);
      }
    },
    [isWordHighlighted]
  );

  // Highlight all words
  const handleHighlightAllWords = () => {
    if (!headline.trim()) return;
    setHighlights([
      {
        id: `all-${Date.now()}`,
        start: 0,
        end: headline.length,
        text: headline,
      },
    ]);
  };

  // Load custom fonts on mount
  useEffect(() => {
    let mounted = true;
    const loadSavedFonts = async () => {
      try {
        const raw = localStorage.getItem(CUSTOM_FONTS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as FontOption[];
        if (!Array.isArray(parsed)) return;

        const restored: FontOption[] = [];
        for (const item of parsed) {
          if (item.dataUrl && item.id && item.label && typeof FontFace !== 'undefined') {
            try {
              const faceName = `CustomFont_${item.id}`;
              const ff = new FontFace(faceName, `url(${item.dataUrl})`);
              await ff.load();
              document.fonts.add(ff);
              restored.push({
                ...item,
                family: `'${faceName}', 'Kalpurush', sans-serif`,
                isCustom: true,
              });
            } catch {
              // skip
            }
          }
        }
        if (mounted && restored.length > 0) {
          setCustomFonts(restored);
          setFontsLoadedTick((t) => t + 1);
        }
      } catch {
        // ignore
      }
    };
    loadSavedFonts();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        if (mounted) setFontsLoadedTick((t) => t + 1);
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Load template overlay image if specified
  useEffect(() => {
    if (!selectedTemplate.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setOverlayImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setOverlayImg(null);
    };
    img.src = selectedTemplate.overlayUrl;
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate.overlayUrl]);

  // Load photo image (with automatic CORS-safe proxy fallback if primary URL fails)
  useEffect(() => {
    if (!photoSrc) {
      setPhotoImg(null);
      return;
    }
    let cancelled = false;
    let triedWsrvFallback = false;

    const loadSrc = (srcToLoad: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled) setPhotoImg(img);
      };
      img.onerror = () => {
        if (cancelled) return;
        if (!triedWsrvFallback) {
          triedWsrvFallback = true;
          let targetOriginal = '';
          if (srcToLoad.startsWith('/api/proxy-image?')) {
            try {
              const u = new URL(srcToLoad, window.location.origin);
              targetOriginal = u.searchParams.get('url') || '';
            } catch {
              targetOriginal = '';
            }
          } else if (/^https?:\/\//i.test(srcToLoad) && !srcToLoad.includes('wsrv.nl')) {
            targetOriginal = srcToLoad;
          }
          if (targetOriginal) {
            loadSrc(`https://wsrv.nl/?url=${encodeURIComponent(targetOriginal)}&output=jpg`);
            return;
          }
        }
        setPhotoImg(null);
      };
      img.src = srcToLoad;
    };

    loadSrc(photoSrc);
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  // Load logo image
  useEffect(() => {
    if (!logoSettings.dataUrl) {
      setLogoImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setLogoImg(null);
    };
    img.src = logoSettings.dataUrl;
    return () => {
      cancelled = true;
    };
  }, [logoSettings.dataUrl]);

  // Preload official brand logo for pixel-perfect brand rendering
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setOfficialLogoImg(img);
    };
    img.src = '/assets/shyamal_sylhet_logo.png';
    return () => {
      cancelled = true;
    };
  }, []);

  // Select template handler
  const handleSelectTemplate = useCallback(
    (nextTpl: TemplateConfig) => {
      setTextColor((prev) =>
        prev.toLowerCase() === selectedTemplate.defaultTextColor.toLowerCase()
          ? nextTpl.defaultTextColor
          : prev
      );
      setHighlightColor((prev) =>
        prev.toLowerCase() === selectedTemplate.defaultHighlightColor.toLowerCase()
          ? nextTpl.defaultHighlightColor
          : prev
      );

      // If user hasn't loaded a custom news URL yet, switch to the respective template's ready sample card
      if (!newsUrl.trim()) {
        if (
          nextTpl.id === PSD_MAROON_TEMPLATE.id &&
          (headline === 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ' || !headline.trim())
        ) {
          setHeadline('নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস');
          setHighlights([{ id: 'sample-hl-2', start: 29, end: 40, text: 'একটি ইতিহাস' }]);
          setPhotoSrc(DEFAULT_PHOTO_SRC);
          setPhotoZoom(1);
          setPhotoPanX(0);
          setPhotoPanY(0);
          setTextOffsetX(0);
          setTextOffsetY(0);
        } else if (
          nextTpl.id === PSD_GREEN_TEMPLATE.id &&
          (headline === 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস' || !headline.trim())
        ) {
          setHeadline('ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ');
          setHighlights([{ id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' }]);
          setPhotoSrc(DEFAULT_PHOTO_SRC);
          setPhotoZoom(1);
          setPhotoPanX(0);
          setPhotoPanY(0);
          setTextOffsetX(0);
          setTextOffsetY(0);
        }
      }

      setSelectedTemplate(nextTpl);
    },
    [selectedTemplate, newsUrl, headline]
  );

  const handleEditTemplateFromTemplatesPage = useCallback(
    (tpl: TemplateConfig) => {
      handleSelectTemplate(tpl);
      navigateToPage('generator');
    },
    [handleSelectTemplate, navigateToPage]
  );

  // Undo / Redo History Engine (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  type UndoableState = {
    newsUrl: string;
    selectedTemplate: TemplateConfig;
    headline: string;
    highlights: HighlightRange[];
    lineMode: LineMode;
    fontSizePercent: number;
    lineGapPercent: number;
    selectedFontId: string;
    textOffsetX: number;
    textOffsetY: number;
    textShadow: boolean;
    textColor: string;
    highlightColor: string;
    photoSrc: string;
    photoZoom: number;
    photoPanX: number;
    photoPanY: number;
    logoSettings: LogoSettings;
    templateOverrides: Record<string, TemplateOverride>;
  };

  const currentUndoable = useMemo<UndoableState>(
    () => ({
      newsUrl,
      selectedTemplate,
      headline,
      highlights,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      selectedFontId,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoSrc,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      templateOverrides,
    }),
    [
      newsUrl,
      selectedTemplate,
      headline,
      highlights,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      selectedFontId,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoSrc,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      templateOverrides,
    ]
  );

  const currentUndoableRef = useRef<UndoableState>(currentUndoable);
  currentUndoableRef.current = currentUndoable;

  const undoStackRef = useRef<UndoableState[]>([]);
  const redoStackRef = useRef<UndoableState[]>([]);
  const committedUndoableRef = useRef<UndoableState>(currentUndoable);
  const isApplyingHistoryRef = useRef(false);
  const historyDebounceRef = useRef<number | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [dragEndTick, setDragEndTick] = useState(0);

  const snapshotsEqual = (a: UndoableState, b: UndoableState): boolean =>
    a.newsUrl === b.newsUrl &&
    a.selectedTemplate.id === b.selectedTemplate.id &&
    a.selectedTemplate.overlayUrl === b.selectedTemplate.overlayUrl &&
    a.headline === b.headline &&
    a.lineMode === b.lineMode &&
    a.fontSizePercent === b.fontSizePercent &&
    a.lineGapPercent === b.lineGapPercent &&
    a.selectedFontId === b.selectedFontId &&
    a.textOffsetX === b.textOffsetX &&
    a.textOffsetY === b.textOffsetY &&
    a.textShadow === b.textShadow &&
    a.textColor === b.textColor &&
    a.highlightColor === b.highlightColor &&
    a.photoSrc === b.photoSrc &&
    a.photoZoom === b.photoZoom &&
    a.photoPanX === b.photoPanX &&
    a.photoPanY === b.photoPanY &&
    a.logoSettings.dataUrl === b.logoSettings.dataUrl &&
    a.logoSettings.scale === b.logoSettings.scale &&
    a.logoSettings.x === b.logoSettings.x &&
    a.logoSettings.y === b.logoSettings.y &&
    a.logoSettings.hideDefaultBrand === b.logoSettings.hideDefaultBrand &&
    a.logoSettings.badgeStyle === b.logoSettings.badgeStyle &&
    JSON.stringify(a.highlights) === JSON.stringify(b.highlights) &&
    JSON.stringify(a.templateOverrides) === JSON.stringify(b.templateOverrides);

  const applyUndoableSnapshot = useCallback((snap: UndoableState) => {
    isApplyingHistoryRef.current = true;
    committedUndoableRef.current = snap;
    lastFetchedUrlRef.current = snap.newsUrl.trim();
    setExtractError(null);
    setNewsUrl(snap.newsUrl);
    setSelectedTemplate(snap.selectedTemplate);
    setHeadline(snap.headline);
    setHighlights(snap.highlights);
    setLineMode(snap.lineMode);
    setFontSizePercent(snap.fontSizePercent);
    setLineGapPercent(snap.lineGapPercent);
    setSelectedFontId(snap.selectedFontId);
    setTextOffsetX(snap.textOffsetX);
    setTextOffsetY(snap.textOffsetY);
    setTextShadow(snap.textShadow);
    setTextColor(snap.textColor);
    setHighlightColor(snap.highlightColor);
    setPhotoSrc(snap.photoSrc);
    setPhotoZoom(snap.photoZoom);
    setPhotoPanX(snap.photoPanX);
    setPhotoPanY(snap.photoPanY);
    setLogoSettings(snap.logoSettings);
    setTemplateOverrides(snap.templateOverrides);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, []);

  const commitHistoryNow = useCallback(() => {
    if (historyDebounceRef.current !== null) {
      window.clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    const curr = currentUndoableRef.current;
    const committed = committedUndoableRef.current;
    if (!snapshotsEqual(committed, curr)) {
      undoStackRef.current = [...undoStackRef.current.slice(-49), committed];
      redoStackRef.current = [];
      committedUndoableRef.current = curr;
      setHistoryTick((t) => t + 1);
    }
  }, []);

  useEffect(() => {
    if (isApplyingHistoryRef.current || dragRef.current.mode !== 'none') return;
    if (snapshotsEqual(committedUndoableRef.current, currentUndoable)) return;
    if (historyDebounceRef.current !== null) {
      window.clearTimeout(historyDebounceRef.current);
    }
    historyDebounceRef.current = window.setTimeout(() => {
      historyDebounceRef.current = null;
      commitHistoryNow();
    }, 320);
    return () => {
      if (historyDebounceRef.current !== null) {
        window.clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = null;
      }
    };
  }, [currentUndoable, dragEndTick, commitHistoryNow]);

  const performUndo = useCallback(() => {
    if (historyDebounceRef.current !== null) {
      window.clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    const curr = currentUndoableRef.current;
    const committed = committedUndoableRef.current;
    if (!snapshotsEqual(committed, curr)) {
      redoStackRef.current = [...redoStackRef.current.slice(-49), curr];
      applyUndoableSnapshot(committed);
      setHistoryTick((t) => t + 1);
      return;
    }
    if (undoStackRef.current.length === 0) return;
    const prevSnap = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-49), curr];
    applyUndoableSnapshot(prevSnap);
    setHistoryTick((t) => t + 1);
  }, [applyUndoableSnapshot]);

  const performRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    if (historyDebounceRef.current !== null) {
      window.clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    const curr = currentUndoableRef.current;
    const nextSnap = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-49), curr];
    applyUndoableSnapshot(nextSnap);
    setHistoryTick((t) => t + 1);
  }, [applyUndoableSnapshot]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (undoStackRef.current.length > 0 || !snapshotsEqual(committedUndoableRef.current, currentUndoableRef.current)) {
          e.preventDefault();
          performUndo();
        }
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          performRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performUndo, performRedo]);

  const canUndo =
    historyTick >= 0 &&
    (undoStackRef.current.length > 0 || !snapshotsEqual(committedUndoableRef.current, currentUndoable));
  const canRedo = historyTick >= 0 && redoStackRef.current.length > 0;

  // Automatic News Extraction from URL (server endpoint + multi-source client fallbacks)
  const extractNewsFromUrl = useCallback(
    async (rawUrl: string, force = false) => {
      const trimmed = sanitizeUrlInput(rawUrl);
      if (!isLikelyUrl(trimmed)) return;
      if (!force && trimmed === lastFetchedUrlRef.current) return;

      lastFetchedUrlRef.current = trimmed;

      if (extractAbortRef.current) {
        extractAbortRef.current.abort();
      }
      const controller = new AbortController();
      extractAbortRef.current = controller;

      setIsExtracting(true);
      setExtractError(null);
      try {
        let title = '';
        let image = '';
        let proxiedImage = '';
        let apiReachable = false;

        try {
          const resp = await fetch(`/api/extract?url=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
          });
          const contentType = (resp.headers.get('content-type') || '').toLowerCase();
          if (resp.ok && contentType.includes('application/json')) {
            apiReachable = true;
            const data = (await resp.json()) as {
              title?: string;
              image?: string;
              proxiedImage?: string;
            };
            title = (data.title || '').trim();
            image = (data.image || '').trim();
            proxiedImage = (data.proxiedImage || '').trim();
          }
        } catch {
          // Fallback to client-side extractors below
        }

        if (controller.signal.aborted) return;

        if (!title || !image) {
          const [ml, ao, jl, jina] = await Promise.all([
            fetchMicrolinkClient(trimmed, controller.signal),
            fetchAllOriginsClient(trimmed, controller.signal),
            fetchJsonLinkClient(trimmed, controller.signal),
            fetchJinaClient(trimmed, controller.signal),
          ]);
          if (!title) title = ml.title || ao.title || jl.title || jina.title;
          if (!image) image = ml.image || ao.image || jl.image || jina.image;
        }

        if (!image) {
          image = extractYouTubeThumbClient(trimmed);
        }
        if (!title && image) {
          title = extractTitleFromSlugClient(trimmed);
        }

        if (controller.signal.aborted) return;

        if (title || image) {
          commitHistoryNow();
        }

        if (title) {
          setHeadline(title);
          setHighlights([]);
          setTextOffsetX(0);
          setTextOffsetY(0);
        }

        let nextImg = proxiedImage;
        if (!nextImg && image) {
          nextImg = apiReachable
            ? `/api/proxy-image?url=${encodeURIComponent(image)}`
            : `https://wsrv.nl/?url=${encodeURIComponent(image)}&output=jpg`;
        }

        if (nextImg) {
          setPhotoZoom(1);
          setPhotoPanX(0);
          setPhotoPanY(0);
          setPhotoSrc(nextImg);
        }

        if (!title && !nextImg) {
          setExtractError(
            'এই লিংক থেকে শিরোনাম বা ছবি পাওয়া যায়নি (সাইট ব্লক বা লিংক অনুপলব্ধ হতে পারে)। ম্যানুয়ালি শিরোনাম ও ছবি দিয়ে কার্ড বানাতে পারবেন।'
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setExtractError('লিংক থেকে তথ্য আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
        }
      } finally {
        if (extractAbortRef.current === controller) {
          setIsExtracting(false);
        }
      }
    },
    [commitHistoryNow]
  );

  // Debounced auto-fetch when typing/editing URL
  useEffect(() => {
    const trimmed = sanitizeUrlInput(newsUrl);
    if (!trimmed) {
      setExtractError(null);
      return;
    }
    if (!isLikelyUrl(trimmed)) return;
    const timer = setTimeout(() => {
      extractNewsFromUrl(trimmed);
    }, 320);
    return () => clearTimeout(timer);
  }, [newsUrl, extractNewsFromUrl]);

  // Immediate fetch on paste (preventDefault prevents double-paste!)
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const cleaned = sanitizeUrlInput(pasted);
    if (cleaned && isLikelyUrl(cleaned)) {
      e.preventDefault();
      commitHistoryNow();
      lastFetchedUrlRef.current = '';
      setExtractError(null);
      setNewsUrl(cleaned);
      extractNewsFromUrl(cleaned, true);
    }
  };

  // Clear link (×) and return immediately to initial homepage default state
  const handleClearNewsUrl = useCallback(() => {
    commitHistoryNow();
    if (extractAbortRef.current) {
      extractAbortRef.current.abort();
      extractAbortRef.current = null;
    }
    lastFetchedUrlRef.current = '';
    setIsExtracting(false);
    setExtractError(null);
    setNewsUrl('');

    const isMaroon = selectedTemplate.id === PSD_MAROON_TEMPLATE.id;
    setHeadline(
      isMaroon
        ? 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস'
        : 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ'
    );
    setHighlights(
      isMaroon
        ? [{ id: 'sample-hl-2', start: 29, end: 40, text: 'একটি ইতিহাস' }]
        : [{ id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' }]
    );
    setPhotoSrc(DEFAULT_PHOTO_SRC);
    setPhotoZoom(1);
    setPhotoPanX(0);
    setPhotoPanY(0);
    setTextOffsetX(0);
    setTextOffsetY(0);
    setLineMode('auto');
    setFontSizePercent(100);
    setLineGapPercent(92);
    setTextShadow(false);
    setTextColor(selectedTemplate.defaultTextColor);
    setHighlightColor(selectedTemplate.defaultHighlightColor);
  }, [commitHistoryNow, selectedTemplate]);

  // Auto-save card state to localStorage (debounced + synchronous flush on pagehide/beforeunload)
  const latestCardSnapshot = useMemo<SavedCardState>(
    () => ({
      version: 2,
      newsUrl,
      selectedTemplateId: selectedTemplate.id,
      customTemplate: selectedTemplate.id.startsWith('custom-') ? selectedTemplate : null,
      headline,
      highlights,
      highlightTab,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      selectedFontId,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoSrc,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      exportFormat,
    }),
    [
      newsUrl,
      selectedTemplate,
      headline,
      highlights,
      highlightTab,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      selectedFontId,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoSrc,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      exportFormat,
    ]
  );

  const latestCardSnapshotRef = useRef<SavedCardState>(latestCardSnapshot);
  latestCardSnapshotRef.current = latestCardSnapshot;

  useEffect(() => {
    const timer = setTimeout(() => {
      persistCardState(latestCardSnapshot);
    }, 150);
    return () => clearTimeout(timer);
  }, [latestCardSnapshot]);

  useEffect(() => {
    const flushAutosave = () => {
      persistCardState(latestCardSnapshotRef.current);
    };
    window.addEventListener('pagehide', flushAutosave);
    window.addEventListener('beforeunload', flushAutosave);
    return () => {
      window.removeEventListener('pagehide', flushAutosave);
      window.removeEventListener('beforeunload', flushAutosave);
    };
  }, []);

  // Render Canvas Preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    if (canvas.width !== effectiveTemplate.canvasWidth) {
      canvas.width = effectiveTemplate.canvasWidth;
    }
    if (canvas.height !== effectiveTemplate.canvasHeight) {
      canvas.height = effectiveTemplate.canvasHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const metrics = renderNewsCard({
      ctx,
      template: effectiveTemplate,
      overlayImg,
      photoImg,
      logoImg,
      officialLogoImg,
      headline,
      highlights,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      font: activeFont,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      isExport: false,
      snapState,
    });

    layoutMetricsRef.current = metrics;
  }, [
    effectiveTemplate,
    overlayImg,
    photoImg,
    logoImg,
    officialLogoImg,
    headline,
    highlights,
    lineMode,
    fontSizePercent,
    lineGapPercent,
    activeFont,
    textOffsetX,
    textOffsetY,
    textShadow,
    textColor,
    highlightColor,
    photoZoom,
    photoPanX,
    photoPanY,
    logoSettings,
    snapState,
    fontsLoadedTick,
  ]);

  // Track Textarea Selection
  const syncTextareaSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  };

  const handleHighlightSelection = () => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : selectionRef.current.start;
    const end = el ? el.selectionEnd : selectionRef.current.end;

    if (!headline.trim() || start === end || end <= start) {
      setSelectionHint('শিরোনামের যে অংশ হাইলাইট করতে চান তা সিলেক্ট করে ক্লিক করুন। অথবা নিচের শব্দগুলোর ওপর ক্লিক করুন।');
      setTimeout(() => setSelectionHint(''), 3500);
      return;
    }

    const selectedText = headline.slice(start, end);
    if (!selectedText.trim()) return;

    setSelectionHint('');
    setHighlights((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        start,
        end,
        text: selectedText,
      },
    ]);
  };

  const handleRemoveHighlight = () => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : selectionRef.current.start;
    const end = el ? el.selectionEnd : selectionRef.current.end;

    if (end > start) {
      setHighlights((prev) =>
        prev.filter((h) => {
          const overlaps = Math.max(h.start, start) < Math.min(h.end, end);
          return !overlaps;
        })
      );
    } else {
      setHighlights([]);
    }
  };

  const handleResetAllNormal = () => {
    setHighlights([]);
    setLineMode('auto');
    setFontSizePercent(100);
    setLineGapPercent(92);
    setTextOffsetX(0);
    setTextOffsetY(0);
    setTextShadow(false);
    setTextColor(selectedTemplate.defaultTextColor);
    setHighlightColor(selectedTemplate.defaultHighlightColor);
  };

  // Safe Photo Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 20 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoZoom(1);
        setPhotoPanX(0);
        setPhotoPanY(0);
        setPhotoSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Safe Custom Frame / PNG Template Upload Handler
  const handleCustomFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 25 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        const testImg = new Image();
        testImg.onload = () => {
          const w = testImg.naturalWidth || 1080;
          const h = testImg.naturalHeight || 1080;
          const isSquareOr1080 = Math.abs(w - h) < 100 || w < 1400;

          if (isSquareOr1080) {
            // Maroon square BOSSS format matching user's original template
            setSelectedTemplate({
              id: `custom-maroon-${Date.now()}`,
              name: file.name.replace(/\.[^/.]+$/, '') || 'কাস্টম আসল ফ্রেম',
              category: 'পিএসডি ডিফল্ট',
              styleType: 'psd-overlay',
              canvasWidth: 1080,
              canvasHeight: 1080,
              overlayUrl: dataUrl,
              photoBox: { x: 77, y: 82, width: 929, height: 634 },
              photoClipPadding: 3,
              headlineBox: {
                centerX: 540,
                centerY: 864,
                maxWidth: 900,
                maxHeight: 246,
                baseFontSize: 68.5,
                singleLineFontSize: 74,
              },
              defaultTextColor: '#ffffff',
              defaultHighlightColor: '#ece304',
            });
            setTextColor('#ffffff');
            setHighlightColor('#ece304');
          } else {
            // Green 2000x2000 format
            setSelectedTemplate({
              id: `custom-green-${Date.now()}`,
              name: file.name.replace(/\.[^/.]+$/, '') || 'কাস্টম আসল ফ্রেম',
              category: 'পিএসডি ডিফল্ট',
              styleType: 'psd-overlay',
              canvasWidth: 2000,
              canvasHeight: 2000,
              overlayUrl: dataUrl,
              photoBox: { x: 62, y: 512, width: 1864, height: 1057 },
              photoClipPadding: 4,
              headlineBox: {
                centerX: 1000,
                centerY: 256,
                maxWidth: 1856,
                maxHeight: 436,
                baseFontSize: 123,
                singleLineFontSize: 136,
              },
              defaultTextColor: '#f3eff6',
              defaultHighlightColor: '#ece304',
            });
            setTextColor('#f3eff6');
            setHighlightColor('#ece304');
          }
        };
        testImg.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  // Safe Custom Font Upload Handler
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    e.target.value = '';

    for (const file of fileList) {
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) continue;
      if (file.size > 15 * 1024 * 1024) continue;

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === 'string' ? resolve(reader.result) : reject();
          reader.onerror = () => reject();
          reader.readAsDataURL(file);
        });

        const cleanLabel = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').slice(0, 28);
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const faceName = `CustomFont_${id}`;

        if (typeof FontFace !== 'undefined') {
          const fontFace = new FontFace(faceName, `url(${dataUrl})`);
          await fontFace.load();
          document.fonts.add(fontFace);
        }

        const newFont: FontOption = {
          id,
          label: cleanLabel,
          family: `'${faceName}', 'Kalpurush', sans-serif`,
          weight: 600,
          isCustom: true,
          dataUrl,
        };

        setCustomFonts((prev) => {
          const next = [...prev, newFont];
          try {
            const serialized = JSON.stringify(next);
            if (serialized.length < 3_800_000) {
              localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, serialized);
            }
          } catch {
            // ignore
          }
          return next;
        });

        setSelectedFontId(id);
        setFontsLoadedTick((t) => t + 1);
      } catch {
        // ignore
      }
    }
  };

  const handleDeleteCustomFont = (fontId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomFonts((prev) => {
      const next = prev.filter((f) => f.id !== fontId);
      try {
        localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (selectedFontId === fontId) {
      setSelectedFontId('kalpurush');
    }
  };

  // Safe Logo Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        commitHistoryNow();
        setLogoSettings((prev) => ({
          ...prev,
          dataUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Canvas Point Calculation
  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, rectW: 1, rectH: 1 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      rectW: Math.max(1, rect.width),
      rectH: Math.max(1, rect.height),
    };
  };

  const pointInRect = (x: number, y: number, r: { x: number; y: number; width: number; height: number }) =>
    x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

  const startCanvasDrag = (clientX: number, clientY: number) => {
    const metrics = layoutMetricsRef.current;
    if (!metrics) return;
    const pt = getCanvasPoint(clientX, clientY);

    let mode: 'none' | 'text' | 'photo' | 'logo' = 'none';
    if (metrics.logoHitBox && pointInRect(pt.x, pt.y, metrics.logoHitBox)) {
      mode = 'logo';
    } else if (headline.trim() && pointInRect(pt.x, pt.y, metrics.textHitBox)) {
      mode = 'text';
    } else if (pointInRect(pt.x, pt.y, metrics.photoHitBox)) {
      mode = 'photo';
    } else if (headline.trim()) {
      mode = 'text';
    }

    if (mode === 'none') return;

    dragRef.current = {
      mode,
      startClientX: clientX,
      startClientY: clientY,
      initialTextX: textOffsetX,
      initialTextY: textOffsetY,
      initialPanX: photoPanX,
      initialPanY: photoPanY,
      initialLogoX: logoSettings.x,
      initialLogoY: logoSettings.y,
      moved: false,
    };
  };

  const moveCanvasDrag = (clientX: number, clientY: number) => {
    const st = dragRef.current;
    if (st.mode === 'none') return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxNorm = (clientX - st.startClientX) / Math.max(1, rect.width);
    const dyNorm = (clientY - st.startClientY) / Math.max(1, rect.height);

    if (Math.abs(clientX - st.startClientX) > 3 || Math.abs(clientY - st.startClientY) > 3) {
      st.moved = true;
    }

    if (st.mode === 'text') {
      let nextX = Math.max(-0.45, Math.min(0.45, st.initialTextX + dxNorm));
      let nextY = Math.max(-0.45, Math.min(0.45, st.initialTextY + dyNorm));

      const SNAP_RADIUS = 0.017;
      const snappedX = Math.abs(nextX) <= SNAP_RADIUS;
      const snappedY = Math.abs(nextY) <= SNAP_RADIUS;

      if (snappedX) nextX = 0;
      if (snappedY) nextY = 0;

      setTextOffsetX(nextX);
      setTextOffsetY(nextY);
      setSnapState({ snappedX, snappedY, isDragging: true });
    } else if (st.mode === 'photo' && photoImg) {
      const nextPanX = Math.round(Math.max(-100, Math.min(100, st.initialPanX + dxNorm * 220)));
      const nextPanY = Math.round(Math.max(-100, Math.min(100, st.initialPanY + dyNorm * 220)));
      setPhotoPanX(nextPanX);
      setPhotoPanY(nextPanY);
    } else if (st.mode === 'logo') {
      const nextLogoX = Math.round(Math.max(-100, Math.min(100, st.initialLogoX + dxNorm * 210)));
      const nextLogoY = Math.round(Math.max(-100, Math.min(100, st.initialLogoY + dyNorm * 210)));
      setLogoSettings((prev) => ({ ...prev, x: nextLogoX, y: nextLogoY }));
    }
  };

  const endCanvasDrag = () => {
    const st = dragRef.current;
    const hadMovement = st.moved;
    if (st.mode === 'photo' && !st.moved && !photoImg) {
      photoInputRef.current?.click();
    }
    dragRef.current.mode = 'none';
    setSnapState({ snappedX: false, snappedY: false, isDragging: false });
    if (hadMovement) {
      setDragEndTick((t) => t + 1);
    }
  };

  // Download Card
  const handleDownloadCard = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = effectiveTemplate.canvasWidth;
    exportCanvas.height = effectiveTemplate.canvasHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    renderNewsCard({
      ctx,
      template: effectiveTemplate,
      overlayImg,
      photoImg,
      logoImg,
      officialLogoImg,
      headline,
      highlights,
      lineMode,
      fontSizePercent,
      lineGapPercent,
      font: activeFont,
      textOffsetX,
      textOffsetY,
      textShadow,
      textColor,
      highlightColor,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      isExport: true,
    });

    const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
    const safeCardName = effectiveTemplate.name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    const filename = `${safeCardName || 'news-photo-card'}-${Date.now()}.${ext}`;

    const triggerDownload = (href: string, revokeAfter = false) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = href;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revokeAfter) {
        setTimeout(() => URL.revokeObjectURL(href), 5000);
      }
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 2000);
    };

    if (exportCanvas.toBlob) {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            triggerDownload(blobUrl, true);
          } else {
            triggerDownload(exportCanvas.toDataURL(mime, 0.96));
          }
        },
        mime,
        0.96
      );
    } else {
      triggerDownload(exportCanvas.toDataURL(mime, 0.96));
    }
  };

  const isTextCentered = Math.abs(textOffsetX) < 0.002 && Math.abs(textOffsetY) < 0.002;
  const countHighlightedWords = parsedWords.filter((w) => isWordHighlighted(w)).length;

  return (
    <div className="min-h-screen w-full overflow-x-clip px-3 py-4 sm:px-6 sm:py-6">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        multiple
        onChange={handleFontUpload}
        className="hidden"
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoUpload}
        className="hidden"
      />

      <div className="mx-auto w-full min-w-0 max-w-[1160px]">
        {/* Clean 3-Zone Top Navigation Bar */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e8dfd0] pb-3.5 sm:mb-5 sm:gap-4 dark:border-slate-800">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => navigateToPage('generator')}
            className="max-w-full cursor-pointer text-left text-lg font-bold tracking-tight text-[#1c3060] sm:text-xl dark:text-slate-100"
          >
            নিউজ ফটো কার্ড জেনারেটর
          </button>

          {/* Zone 2: Page Navigation Links */}
          <nav
            aria-label="পেইজ নেভিগেশন"
            className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[#e5dccd] bg-white p-1 shadow-[0_1px_6px_rgba(28,48,96,0.05)] sm:flex-nowrap dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => navigateToPage('generator')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors sm:min-h-0 sm:px-3.5 sm:text-[13px] ${
                activePage === 'generator'
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'text-[#475569] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span>কার্ড জেনারেটর</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('templates')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors sm:min-h-0 sm:px-3.5 sm:text-[13px] ${
                activePage === 'templates'
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'text-[#475569] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              <span>সব টেমপ্লেট ({ALL_TEMPLATES.length}+)</span>
            </button>
          </nav>

          {/* Zone 3: Theme Switcher */}
          <div
            role="group"
            aria-label="থিম নির্বাচন"
            className="inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full border border-[#ebe4d8] bg-white p-1 shadow-[0_2px_8px_rgba(28,48,96,0.08)] dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                themeMode === 'light'
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'text-[#334155] hover:text-[#0f172a] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>লাইট</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                themeMode === 'dark'
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'text-[#334155] hover:text-[#0f172a] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>ডার্ক</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('auto')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                themeMode === 'auto'
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'text-[#334155] hover:text-[#0f172a] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Contrast className="h-3.5 w-3.5" />
              <span>অটো</span>
            </button>
          </div>
        </header>

        {activePage === 'templates' ? (
          <TemplatesPage
            selectedTemplateId={selectedTemplate.id}
            onEditTemplate={handleEditTemplateFromTemplatesPage}
            onBackToGenerator={() => navigateToPage('generator')}
            categoryNames={categoryNames}
            onRenameCategory={handleRenameCategory}
            onResetCategoryName={handleResetCategoryName}
            templateOverrides={templateOverrides}
            onUpdateTemplateOverride={handleUpdateTemplateOverride}
            onResetTemplateOverride={handleResetTemplateOverride}
            photoImg={photoImg}
            logoImg={logoImg}
            officialLogoImg={officialLogoImg}
            logoSettings={logoSettings}
            onChangeLogoBadgeStyle={(badgeStyle) =>
              setLogoSettings((prev) => ({ ...prev, badgeStyle }))
            }
            onToggleDefaultLogo={() => {
              commitHistoryNow();
              setLogoSettings((prev) => {
                if (prev.dataUrl) {
                  return { ...prev, dataUrl: null, hideDefaultBrand: true };
                }
                return { ...prev, hideDefaultBrand: !prev.hideDefaultBrand };
              });
            }}
            headline={headline}
            highlights={highlights}
            activeFont={activeFont}
            newsUrl={newsUrl}
            onNewsUrlChange={(val) => {
              const sanitized = /https?:\/\/.*https?:\/\//i.test(val) ? sanitizeUrlInput(val) : val;
              if (sanitized.trim() !== lastFetchedUrlRef.current) {
                lastFetchedUrlRef.current = '';
                setExtractError(null);
              }
              setNewsUrl(sanitized);
            }}
            onNewsUrlPaste={handleUrlPaste}
            onClearNewsUrl={handleClearNewsUrl}
            isExtracting={isExtracting}
          />
        ) : (
          <>
            {/* News URL Input Box */}
            <section className="mb-4 rounded-2xl border border-[#ebe5da] bg-white p-3.5 shadow-[0_2px_12px_rgba(28,48,96,0.05)] sm:p-4 dark:border-slate-700/80 dark:bg-slate-800/95">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={newsUrl}
                    onPaste={handleUrlPaste}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const nextVal = /https?:\/\/.*https?:\/\//i.test(raw) ? sanitizeUrlInput(raw) : raw;
                      if (nextVal.trim() !== lastFetchedUrlRef.current) {
                        lastFetchedUrlRef.current = '';
                        setExtractError(null);
                      }
                      setNewsUrl(nextVal);
                    }}
                    placeholder="এখানে নিউজের লিংক পেস্ট করুন..."
                    aria-label="নিউজের লিংক"
                    className={`w-full rounded-xl border border-[#dcd6cb] bg-white px-4 py-3 text-[15px] text-slate-800 placeholder:text-[#78716c] focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400 ${
                      newsUrl ? (isExtracting ? 'pr-20' : 'pr-12') : 'pr-11'
                    }`}
                  />
                  {isExtracting && (
                    <div
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#1c3060] dark:text-sky-400 ${
                        newsUrl ? 'right-11' : 'right-3.5'
                      }`}
                      title="নিউজ আনা হচ্ছে..."
                    >
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                  {newsUrl.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearNewsUrl}
                      title="লিংক মুছে প্রথম অবস্থায় ফিরুন"
                      aria-label="লিংক মুছুন"
                      className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isLikelyUrl(newsUrl) && (
                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={() => extractNewsFromUrl(newsUrl, true)}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1c3060] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#15254b] disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    <RotateCcw className={`h-4 w-4 ${isExtracting ? 'animate-spin' : ''}`} />
                    <span>{isExtracting ? 'আনা হচ্ছে...' : 'তথ্য আনুন'}</span>
                  </button>
                )}
              </div>
              {extractError && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {extractError}
                </p>
              )}
            </section>

            {/* 2-Column Workspace */}
            <main className="grid grid-cols-1 items-start gap-5 md:grid-cols-[420px_1fr] lg:grid-cols-[460px_1fr]">
              {/* LEFT COLUMN: Sticky Live Card Preview + Quick Actions */}
              <div className="min-w-0 w-full space-y-2.5 md:sticky md:top-4">
                <div className="rounded-2xl border border-[#ebe5da] bg-white p-2.5 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  <div className="overflow-hidden rounded-xl">
                    <canvas
                      ref={previewCanvasRef}
                      width={selectedTemplate.canvasWidth}
                      height={selectedTemplate.canvasHeight}
                      onMouseDown={(e) => startCanvasDrag(e.clientX, e.clientY)}
                      onMouseMove={(e) => moveCanvasDrag(e.clientX, e.clientY)}
                      onMouseUp={endCanvasDrag}
                      onMouseLeave={endCanvasDrag}
                      onTouchStart={(e) => {
                        if (e.touches.length === 1) {
                          startCanvasDrag(e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (e.touches.length === 1 && dragRef.current.mode !== 'none') {
                          e.preventDefault();
                          moveCanvasDrag(e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                      onTouchEnd={endCanvasDrag}
                      className="block h-auto w-full cursor-grab select-none touch-none active:cursor-grabbing"
                    />
                  </div>

                  {/* Quick Export Format */}
                  <div className="mt-2.5 flex items-center justify-end gap-2 px-1 text-xs">
                    <div className="inline-flex shrink-0 items-center gap-1">
                      {(['png', 'jpeg'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`cursor-pointer rounded px-2 py-0.5 text-[11px] font-bold uppercase transition-colors ${
                            exportFormat === fmt
                              ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                              : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1e293b] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {fmt === 'png' ? 'PNG' : 'JPG'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1c3060] px-4 py-3 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[#15254b] active:scale-[0.995] dark:bg-[#254689] dark:hover:bg-[#2d54a4]"
                >
                  {downloadDone ? (
                    <>
                      <Check className="h-4 w-4 stroke-[2.5] shrink-0" />
                      <span>ডাউনলোড সম্পন্ন হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 stroke-[2.5] shrink-0" />
                      <span>কার্ড ডাউনলোড করুন</span>
                    </>
                  )}
                </button>

                {/* Quick Template Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(PSD_GREEN_TEMPLATE)}
                    className={`min-h-[42px] min-w-0 cursor-pointer truncate rounded-xl px-2.5 py-2 text-[13px] font-bold transition-colors sm:px-3 sm:text-[13.5px] ${
                      selectedTemplate.id === PSD_GREEN_TEMPLATE.id
                        ? 'bg-[#1c3060] text-white shadow-sm dark:bg-[#254689]'
                        : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#eae2d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {templateOverrides[PSD_GREEN_TEMPLATE.id]?.name?.trim() || PSD_GREEN_TEMPLATE.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(PSD_MAROON_TEMPLATE)}
                    className={`min-h-[42px] min-w-0 cursor-pointer truncate rounded-xl px-2.5 py-2 text-[13px] font-bold transition-colors sm:px-3 sm:text-[13.5px] ${
                      selectedTemplate.id === PSD_MAROON_TEMPLATE.id
                        ? 'bg-[#1c3060] text-white shadow-sm dark:bg-[#254689]'
                        : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#eae2d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {templateOverrides[PSD_MAROON_TEMPLATE.id]?.name?.trim() || PSD_MAROON_TEMPLATE.name}
                  </button>
                </div>

                {/* Quick Photo & Custom PNG Frame Upload */}
                <input
                  ref={customFrameInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleCustomFrameUpload}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex min-h-[42px] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#c9c5c0] bg-white px-2 py-2 text-[12.5px] font-bold text-[#1c3060] transition-colors hover:bg-[#f4eee4] sm:px-3 sm:text-[13px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">নিজের ছবি দিন</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => customFrameInputRef.current?.click()}
                    className="inline-flex min-h-[42px] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#b0a99f] bg-[#fbf8f3] px-2 py-2 text-[12.5px] font-bold text-[#1c3060] transition-colors hover:border-[#1c3060] hover:bg-[#f4eee4] sm:px-3 sm:text-[13px] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300 dark:hover:border-sky-400"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate">আসল ফ্রেম PNG</span>
                  </button>
                </div>

                {/* Browse Dedicated 70+ Templates Page CTA */}
                <button
                  type="button"
                  onClick={() => navigateToPage('templates')}
                  className="flex min-h-[44px] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#d6cfc2] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#1c3060] shadow-xs transition-colors hover:border-[#1c3060] hover:bg-[#faf6ef] sm:px-4 sm:text-[13.5px] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 dark:hover:border-sky-400"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <LayoutGrid className="h-4 w-4 shrink-0 text-[#faab3f]" />
                    <span className="truncate">সব {ALL_TEMPLATES.length}+ টেমপ্লেট ও ক্যাটাগরি দেখুন</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>

                {selectedTemplate.id.startsWith('custom-') && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <span className="truncate font-medium">আসল ফ্রেম সক্রিয়: {effectiveTemplate.name}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(PSD_GREEN_TEMPLATE)}
                      className="ml-2 underline font-semibold text-emerald-900 hover:text-emerald-700 dark:text-emerald-300"
                    >
                      ডিফল্ট
                    </button>
                  </div>
                )}
              </div>

          {/* RIGHT COLUMN: Headline Card (with Interactive Word-by-Word Click Highlight) */}
          <div className="min-w-0 w-full space-y-3">
            <section className="rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="headline-textarea"
                    className="block text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300"
                  >
                    শিরোনাম
                  </label>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={performUndo}
                      disabled={!canUndo}
                      title="পূর্বাবস্থায় ফিরুন (Ctrl+Z)"
                      aria-label="আনডু (Ctrl+Z)"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#d6cfc2] bg-[#faf6ef] px-2 py-0.5 text-[11px] font-semibold text-[#1c3060] transition-colors hover:bg-[#efe6d8] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span>আনডু</span>
                    </button>
                    <button
                      type="button"
                      onClick={performRedo}
                      disabled={!canRedo}
                      title="আবার করুন (Ctrl+Y)"
                      aria-label="রিডু (Ctrl+Y)"
                      className="inline-flex cursor-pointer items-center rounded-md border border-[#d6cfc2] bg-[#faf6ef] p-1 text-[11px] font-semibold text-[#1c3060] transition-colors hover:bg-[#efe6d8] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Redo2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs for Highlight Experience */}
                <div className="grid w-full grid-cols-2 rounded-lg border border-[#e2dcd1] bg-[#f4eee4] p-0.5 text-xs font-semibold sm:inline-flex sm:w-auto dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setHighlightTab('words')}
                    className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 transition-colors sm:px-2.5 sm:py-1 ${
                      highlightTab === 'words'
                        ? 'bg-[#1c3060] text-white shadow-xs dark:bg-[#254689]'
                        : 'text-[#57534e] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <MousePointerClick className="h-3 w-3 shrink-0" />
                    <span className="truncate">শব্দে শব্দে হাইলাইট</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighlightTab('manual')}
                    className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 transition-colors sm:px-2.5 sm:py-1 ${
                      highlightTab === 'manual'
                        ? 'bg-[#1c3060] text-white shadow-xs dark:bg-[#254689]'
                        : 'text-[#57534e] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <Highlighter className="h-3 w-3 shrink-0" />
                    <span className="truncate">সিলেকশন টুল</span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                id="headline-textarea"
                ref={textareaRef}
                rows={3}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onSelect={syncTextareaSelection}
                onKeyUp={syncTextareaSelection}
                onMouseUp={syncTextareaSelection}
                onTouchEnd={syncTextareaSelection}
                placeholder="শিরোনাম এখানে লিখুন বা লিংক দিলে নিজে আসবে"
                className="w-full resize-y rounded-xl border border-[#dcd6cb] bg-white p-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-[#78716c] focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400"
              />

              {/* OPTION 1: Interactive Word-by-Word Click Highlight UI (Requested by User!) */}
              {highlightTab === 'words' ? (
                <div className="mt-3 rounded-xl border border-[#ece4d6] bg-[#faf6f0] p-3 dark:border-slate-700/80 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1c3060] dark:text-sky-300">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>শব্দে ক্লিক করে হাইলাইট করুন:</span>
                    </span>
                    {countHighlightedWords > 0 && (
                      <span className="text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
                        {countHighlightedWords}টি শব্দ হাইলাইট
                      </span>
                    )}
                  </div>

                  {parsedWords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parsedWords.map((word) => {
                        const highlighted = isWordHighlighted(word);
                        return (
                          <button
                            key={`${word.index}-${word.start}`}
                            type="button"
                            onClick={() => handleToggleWordHighlight(word)}
                            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[14px] font-bold transition-all active:scale-95 ${
                              highlighted
                                ? 'bg-[#ece304] text-black shadow-xs ring-2 ring-[#ece304]/80'
                                : 'border border-[#d6cfc2] bg-white text-slate-800 hover:border-[#1c3060] hover:bg-[#f4eee4] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                            }`}
                            title={highlighted ? 'হাইলাইট মুছতে ক্লিক করুন' : 'হাইলাইট করতে ক্লিক করুন'}
                          >
                            <span>{word.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Word highlight action toolbar */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#ebd8c5] dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleHighlightAllWords}
                        disabled={parsedWords.length === 0}
                        className="cursor-pointer rounded-md border border-[#c9c5c0] bg-white px-2.5 py-1 text-xs font-semibold text-[#1c3060] hover:bg-[#f4eee4] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        সব শব্দ হাইলাইট
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighlights([])}
                        disabled={highlights.length === 0}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-[#f4eee4] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>সব আন-হাইলাইট</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetAllNormal}
                      className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      সব সাধারণ
                    </button>
                  </div>
                </div>
              ) : (
                /* OPTION 2: Manual Selection Buttons */
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleHighlightSelection}
                    className="cursor-pointer rounded-lg bg-[#faab3f] px-3.5 py-2 text-[13.5px] font-bold text-[#111827] shadow-xs transition-colors hover:bg-[#f19c26] whitespace-nowrap shrink-0"
                  >
                    নির্বাচিত অংশ হাইলাইট
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleRemoveHighlight}
                    className="cursor-pointer rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3.5 py-2 text-[13.5px] font-semibold text-[#1e293b] transition-colors hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                  >
                    হাইলাইট মুছুন
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAllNormal}
                    className="cursor-pointer rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3.5 py-2 text-[13.5px] font-semibold text-[#1e293b] transition-colors hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                  >
                    সব সাধারণ
                  </button>
                </div>
              )}

              {selectionHint && (
                <p className="mt-2 text-xs font-medium text-[#b45309] dark:text-amber-300">
                  {selectionHint}
                </p>
              )}
            </section>

            {/* Card & Category Name Customizer */}
            <section className="rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowRenamePanel((v) => !v)}
                  aria-expanded={showRenamePanel}
                  className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#1c3060] dark:text-slate-100">
                      <Tag className="h-4 w-4 shrink-0 text-[#faab3f]" />
                      <span>কার্ডে দেখানো ক্যাটাগরি ব্যাজ ও ফুটার লেখা</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6b655e] dark:text-slate-400">
                      ব্যাজ: {effectiveTemplate.kickerText?.trim() || 'নেই'}
                      {!['psd-overlay', 'tv-jamuna', 'paper-prothom-alo-2', 'portal-jagonews', 'paper-daily-star', 'portal-bdnews24', 'paper-ittefaq'].includes(selectedTemplate.styleType)
                        ? ` · ফুটার: ${
                            (effectiveTemplate.footerCtaText !== undefined
                              ? effectiveTemplate.footerCtaText.trim()
                              : 'বিস্তারিত কমেন্টে') || 'নেই'
                          }`
                        : ''}
                      {effectiveTemplate.hasWebsiteUrl
                        ? ` · ইউআরএল: ${effectiveTemplate.websiteUrl?.trim() || 'নেই'}`
                        : ''}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-2.5 py-1 text-xs font-bold text-[#1c3060] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <Pencil className="h-3 w-3" />
                    <span>{showRenamePanel ? 'বন্ধ করুন' : 'সম্পাদনা'}</span>
                  </span>
                </button>
              </div>

              {showRenamePanel && (
                <div className="mt-3.5 space-y-3 border-t border-[#ebe5da] pt-3.5 dark:border-slate-700">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#57534e] dark:text-slate-300">
                        কার্ডে দেখানো ক্যাটাগরি ব্যাজ
                      </label>
                      {Boolean(effectiveTemplate.kickerText?.trim()) && (
                        <button
                          type="button"
                          onClick={() => handleUpdateActiveTemplateOverride({ kickerText: '' })}
                          className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>মুছুন</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={effectiveTemplate.kickerText ?? ''}
                      onChange={(e) =>
                        handleUpdateActiveTemplateOverride({ kickerText: e.target.value })
                      }
                      placeholder="খালি রাখলে কার্ডে কোনো ব্যাজ দেখাবে না"
                      className="w-full rounded-lg border border-[#d6cfc2] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {!['psd-overlay', 'tv-jamuna', 'paper-prothom-alo-2', 'portal-jagonews', 'paper-daily-star', 'portal-bdnews24', 'paper-ittefaq'].includes(selectedTemplate.styleType) && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-[#57534e] dark:text-slate-300">
                          নিচের ফুটার লেখা (CTA)
                        </label>
                        {Boolean(
                          (effectiveTemplate.footerCtaText !== undefined
                            ? effectiveTemplate.footerCtaText
                            : 'বিস্তারিত কমেন্টে'
                          ).trim()
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateActiveTemplateOverride({ footerCtaText: '' })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>মুছুন</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={effectiveTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                        onChange={(e) =>
                          handleUpdateActiveTemplateOverride({ footerCtaText: e.target.value })
                        }
                        placeholder="খালি রাখলে ফুটার লেখা দেখাবে না"
                        className="w-full rounded-lg border border-[#d6cfc2] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}

                  {effectiveTemplate.hasWebsiteUrl && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-[#57534e] dark:text-slate-300">
                          ওয়েবসাইট ইউআরএল
                        </label>
                        {Boolean(effectiveTemplate.websiteUrl?.trim()) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateActiveTemplateOverride({ websiteUrl: '' })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>মুছুন</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={effectiveTemplate.websiteUrl ?? ''}
                        onChange={(e) =>
                          handleUpdateActiveTemplateOverride({ websiteUrl: e.target.value })
                        }
                        placeholder="যেমন: www.yoursite.com (খালি রাখলে দেখাবে না)"
                        className="w-full rounded-lg border border-[#d6cfc2] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleResetActiveTemplateOverride();
                        handleResetCategoryName(effectiveTemplate.category);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-[#ebe3d6] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>ডিফল্ট লেখায় ফিরুন</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Expandable আরও অপশন Bar */}
            <button
              type="button"
              onClick={() => setShowMoreOptions((prev) => !prev)}
              aria-expanded={showMoreOptions}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-[#1c3060] px-4 py-3.5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[#15254b] dark:bg-[#254689] dark:hover:bg-[#2d54a4]"
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Settings className="h-4 w-4" />
                <span>আরও অপশন</span>
              </span>
              {showMoreOptions ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showMoreOptions && (
              <div className="space-y-3.5">
                {/* Panel 1: Typography, Font, Spacing, Position, Shadow, Colors */}
                <section className="space-y-4 rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  {/* লাইন */}
                  <div>
                    <p className="mb-2 text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      লাইন
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { key: 'auto', label: 'অটো' },
                          { key: 'one', label: 'এক লাইন' },
                          { key: 'two', label: 'দুই লাইন' },
                        ] as const
                      ).map((item) => {
                        const active = lineMode === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setLineMode(item.key)}
                            className={`cursor-pointer rounded-lg py-2.5 px-3 text-[14px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                                : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#ebe3d6] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* লেখার সাইজ */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[#57534e] tabular-nums dark:text-slate-300">
                        লেখার সাইজ ({fontSizePercent}%)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFontSizePercent((p) => Math.max(50, p - 5))}
                          className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-2.5 py-1 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                          ছোট −
                        </button>
                        <button
                          type="button"
                          onClick={() => setFontSizePercent((p) => Math.min(180, p + 5))}
                          className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-2.5 py-1 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                          বড় +
                        </button>
                      </div>
                    </div>
                    <RangeSlider
                      min={50}
                      max={180}
                      step={1}
                      value={fontSizePercent}
                      onChange={setFontSizePercent}
                      ariaLabel="লেখার সাইজ"
                    />
                  </div>

                  {/* ফন্ট */}
                  <div>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                        ফন্ট
                      </span>
                      <button
                        type="button"
                        onClick={() => fontInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>নিজের ফন্ট যোগ করুন</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {allFonts.map((f) => {
                        const isSelected = f.id === activeFont.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setSelectedFontId(f.id)}
                            style={{ fontFamily: f.family }}
                            className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-[#faab3f] text-[#111827] border border-[#e08e1b]'
                                : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1e293b] hover:bg-[#ebe3d6] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
                            }`}
                          >
                            <span>{f.label}</span>
                            {f.isCustom && (
                              <span
                                role="button"
                                tabIndex={0}
                                title="ফন্ট মুছুন"
                                onClick={(e) => handleDeleteCustomFont(f.id, e)}
                                className="ml-0.5 rounded px-1 text-[11px] hover:bg-black/15"
                              >
                                ×
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* লাইনের ফাঁক (Tight default to avoid big gaps) */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[#57534e] tabular-nums dark:text-slate-300">
                        লাইনের ফাঁক ({lineGapPercent}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => setLineGapPercent(92)}
                        className="cursor-pointer text-xs font-medium text-[#1c3060] hover:underline dark:text-sky-300"
                      >
                        টাইট ডিফল্ট (৯২%)
                      </button>
                    </div>
                    <RangeSlider
                      min={60}
                      max={160}
                      step={1}
                      value={lineGapPercent}
                      onChange={setLineGapPercent}
                      ariaLabel="লাইনের ফাঁক"
                    />
                  </div>

                  {/* লেখার অবস্থান (Cross D-Pad) */}
                  <div>
                    <p className="mb-2 text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      লেখার অবস্থান
                    </p>
                    <div className="inline-grid grid-cols-3 gap-1.5">
                      <div />
                      <button
                        type="button"
                        onClick={() => setTextOffsetY((y) => Math.max(-0.45, y - 0.015))}
                        className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        ▲ উপরে
                      </button>
                      <div />

                      <button
                        type="button"
                        onClick={() => setTextOffsetX((x) => Math.max(-0.45, x - 0.015))}
                        className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        ◄ বামে
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTextOffsetX(0);
                          setTextOffsetY(0);
                        }}
                        className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                          isTextCentered
                            ? 'bg-[#faab3f] text-[#111827] border border-[#e08e1b]'
                            : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1e293b] hover:bg-[#ebe3d6] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                        }`}
                      >
                        ⦿ মাঝে
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextOffsetX((x) => Math.min(0.45, x + 0.015))}
                        className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        ডানে ►
                      </button>

                      <div />
                      <button
                        type="button"
                        onClick={() => setTextOffsetY((y) => Math.min(0.45, y + 0.015))}
                        className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        ▼ নিচে
                      </button>
                      <div />
                    </div>
                  </div>

                  {/* লেখায় ছায়া */}
                  <div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] font-medium text-[#1e293b] dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={textShadow}
                        onChange={(e) => setTextShadow(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-400 accent-[#1c3060]"
                      />
                      <span>লেখায় ছায়া</span>
                    </label>
                  </div>

                  {/* লেখার রং + হাইলাইট রং + আগের রং */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#1e293b] dark:text-slate-200">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="swatch-picker h-6 w-11"
                      />
                      <span>লেখার রং</span>
                    </label>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#1e293b] dark:text-slate-200">
                      <input
                        type="color"
                        value={highlightColor}
                        onChange={(e) => setHighlightColor(e.target.value)}
                        className="swatch-picker h-6 w-11"
                      />
                      <span>হাইলাইট রং</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setTextColor(selectedTemplate.defaultTextColor);
                        setHighlightColor(selectedTemplate.defaultHighlightColor);
                      }}
                      className="cursor-pointer rounded-md border border-[#c9c5c0] bg-[#f4eee4] px-3.5 py-2 text-[13px] font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      আগের রং
                    </button>
                  </div>
                </section>

                {/* Panel 2: Photo Controls (ছবি) */}
                <section className="space-y-4 rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      ছবি
                    </span>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="cursor-pointer rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3.5 py-2 text-[13px] font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      নিজের ছবি দিন
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      জুম
                    </p>
                    <RangeSlider
                      min={100}
                      max={300}
                      step={1}
                      value={Math.round(photoZoom * 100)}
                      onChange={(val) => setPhotoZoom(val / 100)}
                      ariaLabel="জুম"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      ডানে-বামে
                    </p>
                    <RangeSlider
                      min={-100}
                      max={100}
                      step={1}
                      value={photoPanX}
                      onChange={setPhotoPanX}
                      ariaLabel="ছবি ডানে-বামে"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      উপরে-নিচে
                    </p>
                    <RangeSlider
                      min={-100}
                      max={100}
                      step={1}
                      value={photoPanY}
                      onChange={setPhotoPanY}
                      ariaLabel="ছবি উপরে-নিচে"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoZoom(1);
                      setPhotoPanX(0);
                      setPhotoPanY(0);
                    }}
                    className="w-full cursor-pointer rounded-lg border border-[#c9c5c0] bg-[#f4eee4] py-2.5 px-4 text-[13.5px] font-bold text-[#1c3060] hover:bg-[#ebe3d6] whitespace-nowrap dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                  >
                    ছবি আগের মতো
                  </button>
                </section>

                {/* Panel 3: Unified Brand Logo & Dark-Background Adjustment & Export Format */}
                <section className="space-y-4 rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-[#1c3060] dark:text-slate-100">
                        সকল কার্ডে ব্র্যান্ড লোগো ও ডাউনলোড
                      </span>
                      <p className="text-[11.5px] text-[#6b655e] dark:text-slate-400">
                        {logoSettings.dataUrl
                          ? 'কাস্টম লোগো সব কার্ডে সক্রিয় আছে'
                          : logoSettings.hideDefaultBrand
                            ? 'ডিফল্ট লোগো রিমুভ করা আছে (লোগো ছাড়া কার্ড)'
                            : 'অফিসিয়াল শ্যামল সিলেট লোগো সব কার্ডে সক্রিয় আছে'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{logoSettings.dataUrl ? 'লোগো বদলান' : 'কাস্টম লোগো দিন'}</span>
                      </button>

                      {logoSettings.dataUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              commitHistoryNow();
                              setLogoSettings((prev) => ({
                                ...prev,
                                dataUrl: null,
                                hideDefaultBrand: false,
                              }));
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#c9c5c0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1c3060] hover:bg-[#f4eee4] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>অফিসিয়াল লোগো</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              commitHistoryNow();
                              setLogoSettings((prev) => ({
                                ...prev,
                                dataUrl: null,
                                hideDefaultBrand: true,
                              }));
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>লোগো রিমুভ</span>
                          </button>
                        </>
                      ) : logoSettings.hideDefaultBrand ? (
                        <button
                          type="button"
                          onClick={() => {
                            commitHistoryNow();
                            setLogoSettings((prev) => ({
                              ...prev,
                              hideDefaultBrand: false,
                            }));
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#1c3060] bg-[#eef3ff] px-3 py-1.5 text-xs font-bold text-[#1c3060] hover:bg-[#dfe8ff] whitespace-nowrap shrink-0 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>ডিফল্ট লোগো ফিরিয়ে আনুন</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            commitHistoryNow();
                            setLogoSettings((prev) => ({
                              ...prev,
                              hideDefaultBrand: true,
                            }));
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>ডিফল্ট লোগো রিমুভ</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dark Background Badge + Size & Position Controls (active whenever official or custom logo is shown) */}
                  {(logoSettings.dataUrl || !logoSettings.hideDefaultBrand) && (
                    <>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-[#57534e] dark:text-slate-300">
                          লোগো ব্যাকগ্রাউন্ড (গাঢ় কার্ডে দৃশ্যমানতা)
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {(
                            [
                              { id: 'none', label: 'ব্যাজ ছাড়া' },
                              { id: 'frosted', label: 'হালকা গ্লাস' },
                              { id: 'white', label: 'সাদা ব্যাজ' },
                              { id: 'auto', label: 'অটো ব্যাজ' },
                            ] as const
                          ).map((opt) => {
                            const active = (logoSettings.badgeStyle ?? 'none') === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setLogoSettings((prev) => ({ ...prev, badgeStyle: opt.id }))
                                }
                                className={`cursor-pointer rounded-lg px-2.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                                  active
                                    ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                                    : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1e293b] hover:bg-[#ebe3d6] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#57534e] tabular-nums dark:text-slate-300">
                              লোগোর আকার ({logoSettings.scale}%)
                            </p>
                            {(logoSettings.scale !== 100 ||
                              logoSettings.x !== 0 ||
                              logoSettings.y !== 0 ||
                              (logoSettings.badgeStyle ?? 'none') !== 'none') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setLogoSettings((prev) => ({
                                    ...prev,
                                    scale: 100,
                                    x: 0,
                                    y: 0,
                                    badgeStyle: 'none',
                                  }))
                                }
                                className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold text-[#1c3060] hover:underline dark:text-sky-300"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>ডিফল্ট পজিশন</span>
                              </button>
                            )}
                          </div>
                          <RangeSlider
                            min={25}
                            max={200}
                            value={logoSettings.scale}
                            onChange={(scale) => setLogoSettings((p) => ({ ...p, scale }))}
                            ariaLabel="লোগোর আকার"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-[#57534e] dark:text-slate-300">
                              লোগো ডানে-বামে
                            </p>
                            <RangeSlider
                              min={-100}
                              max={100}
                              value={logoSettings.x}
                              onChange={(x) => setLogoSettings((p) => ({ ...p, x }))}
                              ariaLabel="লোগো ডানে-বামে"
                            />
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-[#57534e] dark:text-slate-300">
                              লোগো উপরে-নিচে
                            </p>
                            <RangeSlider
                              min={-100}
                              max={100}
                              value={logoSettings.y}
                              onChange={(y) => setLogoSettings((p) => ({ ...p, y }))}
                              ariaLabel="লোগো উপরে-নিচে"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ebe5da] pt-2.5 dark:border-slate-700/70">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#1e293b] dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={logoSettings.hideDefaultBrand}
                        onChange={(e) => {
                          commitHistoryNow();
                          setLogoSettings((p) => ({ ...p, hideDefaultBrand: e.target.checked }));
                        }}
                        className="h-4 w-4 cursor-pointer rounded border-slate-400 accent-[#1c3060]"
                      />
                      <span>ডিফল্ট লোগো রিমুভ / লুকিয়ে রাখুন</span>
                    </label>

                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#57534e] dark:text-slate-400">
                        ফরম্যাট:
                      </span>
                      {(['png', 'jpeg'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                            exportFormat === fmt
                              ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                              : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1e293b] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {fmt === 'png' ? 'PNG' : 'JPG'}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Mobile quick scroll back to preview */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#c9c5c0] bg-[#f4eee4] px-4 py-2.5 text-xs font-bold text-[#1c3060] md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>উপরে প্রিভিউ ও ডাউনলোডে যান</span>
            </button>
          </div>
        </main>
          </>
        )}
      </div>
    </div>
  );
}
