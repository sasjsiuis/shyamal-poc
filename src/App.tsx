import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Contrast,
  Download,
  Highlighter,
  Loader2,
  Moon,
  MousePointerClick,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { RangeSlider } from './components/RangeSlider';
import { TemplateGallery } from './components/TemplateGallery';
import {
  BUILTIN_FONTS,
  PSD_GREEN_TEMPLATE,
  PSD_MAROON_TEMPLATE,
} from './data/templates';
import type {
  ExportFormat,
  FontOption,
  HighlightRange,
  LineMode,
  LogoSettings,
  RenderedLayoutMetrics,
  TemplateConfig,
  ThemeMode,
} from './types/card';
import { buildHighlightMask, renderNewsCard } from './utils/canvasRenderer';

const CUSTOM_FONTS_STORAGE_KEY = 'news_card_custom_fonts_v1';
const THEME_STORAGE_KEY = 'news_card_theme_mode_v1';

function isLikelyUrl(input: string): boolean {
  const s = input.trim();
  if (s.length < 8) return false;
  if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return true;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/[^\s]*/i.test(s)) return true;
  return false;
}

interface ParsedWord {
  index: number;
  text: string;
  start: number;
  end: number;
}

export default function App() {
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
  const [newsUrl, setNewsUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const lastFetchedUrlRef = useRef<string>('');
  const extractAbortRef = useRef<AbortController | null>(null);

  // Template state (defaults to সবুজ টেমপ্লেট)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig>(PSD_GREEN_TEMPLATE);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);

  // Headline & Highlight state — initialized with user's sample card so user immediately sees a ready card
  const [headline, setHeadline] = useState('ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ');
  const [highlights, setHighlights] = useState<HighlightRange[]>([
    { id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' },
  ]);
  const [selectionHint, setSelectionHint] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // Word-by-word highlight UI tab ('words' | 'manual')
  const [highlightTab, setHighlightTab] = useState<'words' | 'manual'>('words');

  // Typography & Position controls
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showExtraTemplates, setShowExtraTemplates] = useState(false);
  const [lineMode, setLineMode] = useState<LineMode>('auto');
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [lineGapPercent, setLineGapPercent] = useState<number>(92);
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<string>('kalpurush');
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const [textOffsetX, setTextOffsetX] = useState<number>(0);
  const [textOffsetY, setTextOffsetY] = useState<number>(0);
  const [textShadow, setTextShadow] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>(PSD_GREEN_TEMPLATE.defaultTextColor);
  const [highlightColor, setHighlightColor] = useState<string>(
    PSD_GREEN_TEMPLATE.defaultHighlightColor
  );

  // Photo state & controls — initialized with user's sample card photo
  const [photoSrc, setPhotoSrc] = useState<string>('/sample/parliament.jpg');
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [photoPanX, setPhotoPanX] = useState<number>(0);
  const [photoPanY, setPhotoPanY] = useState<number>(0);

  // Logo & Export format state
  const [logoSettings, setLogoSettings] = useState<LogoSettings>({
    dataUrl: null,
    scale: 100,
    x: 0,
    y: 0,
    hideDefaultBrand: false,
  });
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [officialLogoImg, setOfficialLogoImg] = useState<HTMLImageElement | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
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

  // Load photo image
  useEffect(() => {
    if (!photoSrc) {
      setPhotoImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setPhotoImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setPhotoImg(null);
    };
    img.src = photoSrc;
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
          setPhotoSrc('/sample/yunus_nahid.jpg');
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
          setPhotoSrc('/sample/parliament.jpg');
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

  // Automatic News Extraction from URL
  const extractNewsFromUrl = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!isLikelyUrl(trimmed)) return;
    if (trimmed === lastFetchedUrlRef.current) return;

    lastFetchedUrlRef.current = trimmed;

    if (extractAbortRef.current) {
      extractAbortRef.current.abort();
    }
    const controller = new AbortController();
    extractAbortRef.current = controller;

    setIsExtracting(true);
    try {
      const resp = await fetch(`/api/extract?url=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        title?: string;
        image?: string;
        proxiedImage?: string;
      };

      if (controller.signal.aborted) return;

      if (data.title && data.title.trim()) {
        setHeadline(data.title.trim());
        setHighlights([]);
        setTextOffsetX(0);
        setTextOffsetY(0);
      }

      const nextImg = data.proxiedImage || data.image || '';
      if (nextImg) {
        setPhotoZoom(1);
        setPhotoPanX(0);
        setPhotoPanY(0);
        setPhotoSrc(nextImg);
      }
    } catch {
      // Silently ignore network aborts
    } finally {
      if (extractAbortRef.current === controller) {
        setIsExtracting(false);
      }
    }
  }, []);

  // Debounced auto-fetch when typing/editing URL
  useEffect(() => {
    const trimmed = newsUrl.trim();
    if (!isLikelyUrl(trimmed)) return;
    const timer = setTimeout(() => {
      extractNewsFromUrl(trimmed);
    }, 320);
    return () => clearTimeout(timer);
  }, [newsUrl, extractNewsFromUrl]);

  // Immediate fetch on paste
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && isLikelyUrl(pasted)) {
      lastFetchedUrlRef.current = '';
      setNewsUrl(pasted.trim());
      extractNewsFromUrl(pasted.trim());
    }
  };

  // Render Canvas Preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    if (canvas.width !== selectedTemplate.canvasWidth) {
      canvas.width = selectedTemplate.canvasWidth;
    }
    if (canvas.height !== selectedTemplate.canvasHeight) {
      canvas.height = selectedTemplate.canvasHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const metrics = renderNewsCard({
      ctx,
      template: selectedTemplate,
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
    selectedTemplate,
    overlayImg,
    photoImg,
    logoImg,
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
    if (st.mode === 'photo' && !st.moved && !photoImg) {
      photoInputRef.current?.click();
    }
    dragRef.current.mode = 'none';
    setSnapState({ snappedX: false, snappedY: false, isDragging: false });
  };

  // Download Card
  const handleDownloadCard = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = selectedTemplate.canvasWidth;
    exportCanvas.height = selectedTemplate.canvasHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    renderNewsCard({
      ctx,
      template: selectedTemplate,
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
    const filename = `news-photo-card-${Date.now()}.${ext}`;

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
    <div className="min-h-screen w-full px-3 py-4 sm:px-6 sm:py-6">
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

      <div className="mx-auto max-w-[1040px]">
        {/* Top Row: Theme Switcher */}
        <div className="flex justify-end mb-1">
          <div
            role="group"
            aria-label="থিম নির্বাচন"
            className="inline-flex items-center gap-0.5 rounded-full border border-[#ebe4d8] bg-white p-1 shadow-[0_2px_8px_rgba(28,48,96,0.08)] dark:border-slate-700 dark:bg-slate-800"
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
        </div>

        {/* Header */}
        <header className="mb-5 text-center">
          <h1
            className="text-[26px] font-bold tracking-tight text-[#1c3060] sm:text-[31px] dark:text-slate-100"
            style={{ textWrap: 'balance' }}
          >
            নিউজ ফটো কার্ড জেনারেটর
          </h1>
          <p className="mt-1 text-[13.5px] text-[#6b655e] sm:text-[14.5px] dark:text-slate-400">
            নিউজের লিংক দিন — শিরোনাম আর ছবি বসে কার্ড রেডি হয়ে যাবে
          </p>
        </header>

        {/* News URL Input Box */}
        <section className="mb-4 rounded-2xl border border-[#ebe5da] bg-white p-3.5 shadow-[0_2px_12px_rgba(28,48,96,0.05)] sm:p-4 dark:border-slate-700/80 dark:bg-slate-800/95">
          <div className="relative">
            <input
              type="url"
              value={newsUrl}
              onPaste={handleUrlPaste}
              onChange={(e) => {
                lastFetchedUrlRef.current = '';
                setNewsUrl(e.target.value);
              }}
              placeholder="এখানে নিউজের লিংক পেস্ট করুন..."
              aria-label="নিউজের লিংক"
              className="w-full rounded-xl border border-[#dcd6cb] bg-white px-4 py-3 pr-11 text-[15px] text-slate-800 placeholder:text-[#78716c] focus:border-[#1c3060] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400"
            />
            {isExtracting && (
              <div
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1c3060] dark:text-sky-400"
                title="নিউজ আনা হচ্ছে..."
              >
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
        </section>

        {/* 2-Column Workspace */}
        <main className="grid grid-cols-1 items-start gap-4 md:grid-cols-[480px_1fr]">
          {/* LEFT COLUMN: Card Preview + Download + Template Buttons */}
          <div className="w-full">
            <div className="rounded-2xl border border-[#ebe5da] bg-white p-3 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
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
            </div>

            <button
              type="button"
              onClick={handleDownloadCard}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1c3060] px-5 py-3.5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[#15254b] active:scale-[0.995] whitespace-nowrap dark:bg-[#254689] dark:hover:bg-[#2d54a4]"
            >
              {downloadDone ? (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>ডাউনলোড সম্পন্ন হয়েছে</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 stroke-[2.5]" />
                  <span>কার্ড ডাউনলোড করুন</span>
                </>
              )}
            </button>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTemplate(PSD_GREEN_TEMPLATE)}
                className={`cursor-pointer rounded-xl py-2.5 px-4 text-[14px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                  selectedTemplate.id === PSD_GREEN_TEMPLATE.id
                    ? 'bg-[#1c3060] text-white shadow-sm dark:bg-[#254689]'
                    : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#eae2d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                সবুজ টেমপ্লেট
              </button>
              <button
                type="button"
                onClick={() => handleSelectTemplate(PSD_MAROON_TEMPLATE)}
                className={`cursor-pointer rounded-xl py-2.5 px-4 text-[14px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                  selectedTemplate.id === PSD_MAROON_TEMPLATE.id
                    ? 'bg-[#1c3060] text-white shadow-sm dark:bg-[#254689]'
                    : 'border border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#eae2d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                মেরুন টেমপ্লেট
              </button>
            </div>

            <input
              ref={customFrameInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleCustomFrameUpload}
            />
            <button
              type="button"
              onClick={() => customFrameInputRef.current?.click()}
              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#b0a99f] bg-[#fbf8f3] px-3.5 py-2.5 text-[13.5px] font-bold text-[#1c3060] transition-colors hover:border-[#1c3060] hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300 dark:hover:border-sky-400"
            >
              <Upload className="h-4 w-4 stroke-[2.2]" />
              <span>📸 আসল ফটো কার্ড PNG আপলোড করুন</span>
            </button>

            {selectedTemplate.id.startsWith('custom-') && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <span className="truncate font-medium">✨ আসল ফ্রেম সক্রিয়: {selectedTemplate.name}</span>
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
          <div className="w-full space-y-3">
            <section className="rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <label
                  htmlFor="headline-textarea"
                  className="block text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300"
                >
                  শিরোনাম
                </label>

                {/* Sub-Tabs for Highlight Experience */}
                <div className="inline-flex rounded-lg border border-[#e2dcd1] bg-[#f4eee4] p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setHighlightTab('words')}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                      highlightTab === 'words'
                        ? 'bg-[#1c3060] text-white shadow-xs dark:bg-[#254689]'
                        : 'text-[#57534e] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <MousePointerClick className="h-3 w-3" />
                    <span>শব্দে শব্দে হাইলাইট</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighlightTab('manual')}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                      highlightTab === 'manual'
                        ? 'bg-[#1c3060] text-white shadow-xs dark:bg-[#254689]'
                        : 'text-[#57534e] hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <Highlighter className="h-3 w-3" />
                    <span>সিলেকশন টুল</span>
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
                  ) : (
                    <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                      উপরে শিরোনাম লিখলে শব্দগুলো আলাদা বাটন আকারে এখানে আসবে।
                    </p>
                  )}

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

              {selectionHint ? (
                <p className="mt-2 text-xs font-medium text-[#b45309] dark:text-amber-300">
                  {selectionHint}
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[#6b655e] dark:text-slate-400">
                  কার্ডের লেখা আঙুল/মাউস দিয়ে টেনে সরাতে পারবেন — মাঝখানে এলে নিজে আটকে যাবে।
                </p>
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
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-bold transition-colors whitespace-nowrap shrink-0 ${
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

                {/* Panel 3: Logo & Export Format */}
                <section className="space-y-3.5 rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[#57534e] dark:text-slate-300">
                      নিজের লোগো ও ডাউনলোড ফরম্যাট (ঐচ্ছিক)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1e293b] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>লোগো আপলোড</span>
                      </button>
                      {logoSettings.dataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLogoSettings((prev) => ({
                              ...prev,
                              dataUrl: null,
                            }))
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>লোগো মুছুন</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {logoSettings.dataUrl && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#57534e] tabular-nums dark:text-slate-300">
                          লোগোর আকার ({logoSettings.scale}%)
                        </p>
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
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#1e293b] dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={logoSettings.hideDefaultBrand}
                        onChange={(e) =>
                          setLogoSettings((p) => ({ ...p, hideDefaultBrand: e.target.checked }))
                        }
                        className="h-4 w-4 cursor-pointer rounded border-slate-400 accent-[#1c3060]"
                      />
                      <span>ডিফল্ট ব্র্যান্ডিং লুকান</span>
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

                {/* Panel 4: 50+ Free Templates Gallery */}
                <section className="rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] dark:border-slate-700/80 dark:bg-slate-800/95">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-[#1c3060] dark:text-slate-100">
                        ৫০+ ফ্রি প্রফেশনাল টেমপ্লেট
                      </p>
                      <p className="text-xs text-[#6b655e] dark:text-slate-400">
                        সব টেমপ্লেট সম্পূর্ণ ফ্রি — প্রিভিউ দেখে যেকোনোটি বেছে নিন
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowExtraTemplates((v) => !v)}
                      className="cursor-pointer rounded-lg border border-[#c9c5c0] bg-[#f4eee4] px-3 py-1.5 text-xs font-bold text-[#1c3060] hover:bg-[#ebe3d6] whitespace-nowrap shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {showExtraTemplates ? 'তালিকা লুকান' : 'সব টেমপ্লেট দেখুন'}
                    </button>
                  </div>

                  {showExtraTemplates && (
                    <div className="mt-3.5 border-t border-[#ebe5da] pt-3.5 dark:border-slate-700">
                      <TemplateGallery
                        selectedTemplateId={selectedTemplate.id}
                        onSelectTemplate={handleSelectTemplate}
                      />
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
