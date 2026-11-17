import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Hand,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EditableNumberBadge } from '../components/EditableNumberBadge';
import { LogoEditorModal } from '../components/LogoEditorModal';
import { RangeSlider } from '../components/RangeSlider';
import { useToast } from '../components/Toast';
import { EditorRightPanel, type ParsedWord } from '../components/editor/EditorRightPanel';
import { EDITOR_TABS, EditorSidebar, type EditorTabId } from '../components/editor/EditorSidebar';
import { EditorTopBar, type AutoSaveStatus } from '../components/editor/EditorTopBar';
import { ALL_TEMPLATES, BUILTIN_FONTS, PSD_GREEN_TEMPLATE, PSD_MAROON_TEMPLATE } from '../data/templates';
import type {
  CustomTextItem,
  ExportFormat,
  FontOption,
  HighlightRange,
  LineMode,
  LogoSettings,
  RenderedLayoutMetrics,
  SubheadingSettings,
  TemplateCategory,
  TemplateConfig,
  TemplateOverride,
} from '../types/card';
import type { ProjectEditorState } from '../types/project';
import { buildHighlightMask, renderNewsCard } from '../utils/canvasRenderer';
import {
  extractTitleFromSlugClient,
  extractYouTubeThumbClient,
  fetchAllOriginsClient,
  fetchJinaClient,
  fetchJsonLinkClient,
  fetchMicrolinkClient,
  isLikelyUrl,
  sanitizeUrlInput,
} from '../utils/newsExtractor';
import {
  DEFAULT_PHOTO_SRC,
  createInitialEditorState,
  createNewProject,
  defaultProjectName,
  generateCanvasThumbnail,
  generateUuid,
  getProjectById,
  saveProject,
  toBengaliDigits,
} from '../utils/projectStorage';

const CUSTOM_FONTS_STORAGE_KEY = 'news_card_custom_fonts_v1';
const CATEGORY_NAMES_STORAGE_KEY = 'news_card_category_names_v1';
const TEMPLATE_OVERRIDES_STORAGE_KEY = 'news_card_template_overrides_v1';

const DEFAULT_SUBHEADING: SubheadingSettings = {
  text: '',
  fontSizePercent: 100,
  color: '',
  offsetX: 0,
  offsetY: 0,
};

export const EditorPage: React.FC = () => {
  const { templateId, projectId } = useParams<{ templateId?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Route guard: if creating without projectId and templateId doesn't exist, redirect to /templates
  const isInvalidNewTemplate =
    !projectId && (!templateId || !ALL_TEMPLATES.some((t) => t.id === templateId));

  const initialRouteTemplate = useMemo(
    () => ALL_TEMPLATES.find((t) => t.id === templateId) || PSD_GREEN_TEMPLATE,
    [templateId]
  );

  // Active project tracking
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => projectId || generateUuid()
  );
  const createdAtRef = useRef<number>(Date.now());
  const hasCustomNameRef = useRef<boolean>(false);
  const [projectName, setProjectName] = useState<string>(() =>
    defaultProjectName(createInitialEditorState(initialRouteTemplate).headline)
  );
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const isHydratedRef = useRef<boolean>(false);
  const limitToastShownRef = useRef<boolean>(false);

  // Navigation / Drawer & Stage Pan/Zoom state
  const [desktopTab, setDesktopTab] = useState<EditorTabId>('text');
  const [mobileSheetTab, setMobileSheetTab] = useState<EditorTabId | null>('text');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [canvasZoomMode, setCanvasZoomMode] = useState<'fit' | 'custom'>('fit');
  const [canvasZoomPercent, setCanvasZoomPercent] = useState<number>(100);
  const [stagePanX, setStagePanX] = useState<number>(0);
  const [stagePanY, setStagePanY] = useState<number>(0);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isHandMode, setIsHandMode] = useState<boolean>(false);
  const [isPanningStage, setIsPanningStage] = useState<boolean>(false);
  const stageMainRef = useRef<HTMLElement | null>(null);
  const stagePanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    initPanX: number;
    initPanY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
  });
  const pinchRef = useRef<{
    active: boolean;
    initialDist: number;
    initialZoom: number;
  }>({
    active: false,
    initialDist: 0,
    initialZoom: 100,
  });

  // URL & Auto-extraction state
  const [newsUrl, setNewsUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const lastFetchedUrlRef = useRef<string>('');
  const extractAbortRef = useRef<AbortController | null>(null);

  // Template & Override state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig>(initialRouteTemplate);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);

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

  const [templateOverrides, setTemplateOverrides] = useState<Record<string, TemplateOverride>>(
    () => {
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
    }
  );

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

  // Card Editor State
  const initialDefaults = useMemo(
    () => createInitialEditorState(initialRouteTemplate),
    [initialRouteTemplate]
  );

  const [headline, setHeadline] = useState(initialDefaults.headline);
  const [highlights, setHighlights] = useState<HighlightRange[]>(initialDefaults.highlights);
  const [selectionHint, setSelectionHint] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [highlightTab, setHighlightTab] = useState<'words' | 'manual'>('words');

  const [lineMode, setLineMode] = useState<LineMode>('auto');
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [lineGapPercent, setLineGapPercent] = useState<number>(92);
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<string>('kalpurush');
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const [textOffsetX, setTextOffsetX] = useState<number>(0);
  const [textOffsetY, setTextOffsetY] = useState<number>(0);
  const [textShadow, setTextShadow] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>(initialRouteTemplate.defaultTextColor);
  const [highlightColor, setHighlightColor] = useState<string>(
    initialRouteTemplate.defaultHighlightColor
  );

  const [photoSrc, setPhotoSrc] = useState<string>(DEFAULT_PHOTO_SRC);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [photoPanX, setPhotoPanX] = useState<number>(0);
  const [photoPanY, setPhotoPanY] = useState<number>(0);

  const [logoSettings, setLogoSettings] = useState<LogoSettings>(initialDefaults.logoSettings);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [officialLogoImg, setOfficialLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoEditorSource, setLogoEditorSource] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState<number>(96);
  const [downloadDone, setDownloadDone] = useState(false);

  const [subheading, setSubheading] = useState<SubheadingSettings>(DEFAULT_SUBHEADING);
  const [customTexts, setCustomTexts] = useState<CustomTextItem[]>([]);
  const [activeCustomTextId, setActiveCustomTextId] = useState<string | null>(null);
  const [isPencilTextMode, setIsPencilTextMode] = useState(false);
  const [pendingPencilPoint, setPendingPencilPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [pendingPencilText, setPendingPencilText] = useState('');
  const [pendingPencilSize, setPendingPencilSize] = useState(32);
  const [pendingPencilColor, setPendingPencilColor] = useState('#ffffff');
  const [pendingPencilBg, setPendingPencilBg] = useState<string | null>('rgba(15, 23, 42, 0.72)');

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
    mode: 'none' | 'text' | 'photo' | 'logo' | 'subheading' | 'custom-text';
    customTextId: string | null;
    startClientX: number;
    startClientY: number;
    initialTextX: number;
    initialTextY: number;
    initialPanX: number;
    initialPanY: number;
    initialLogoX: number;
    initialLogoY: number;
    initialSubX: number;
    initialSubY: number;
    initialCustomX: number;
    initialCustomY: number;
    moved: boolean;
  }>({
    mode: 'none',
    customTextId: null,
    startClientX: 0,
    startClientY: 0,
    initialTextX: 0,
    initialTextY: 0,
    initialPanX: 0,
    initialPanY: 0,
    initialLogoX: 0,
    initialLogoY: 0,
    initialSubX: 0,
    initialSubY: 0,
    initialCustomX: 0.5,
    initialCustomY: 0.5,
    moved: false,
  });

  const allFonts = useMemo(() => [...BUILTIN_FONTS, ...customFonts], [customFonts]);
  const activeFont = useMemo(
    () => allFonts.find((f) => f.id === selectedFontId) || BUILTIN_FONTS[0],
    [allFonts, selectedFontId]
  );

  // Effective template with overrides applied
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

  const handleUpdateActiveTemplateOverride = useCallback(
    (patch: TemplateOverride) => {
      setTemplateOverrides((prev) => ({
        ...prev,
        [selectedTemplate.id]: {
          ...prev[selectedTemplate.id],
          ...patch,
        },
      }));
    },
    [selectedTemplate.id]
  );

  const handleResetActiveTemplateOverride = useCallback(() => {
    setTemplateOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedTemplate.id];
      return next;
    });
  }, [selectedTemplate.id]);

  // Parsed words for click-to-highlight
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

  const highlightMask = useMemo(() => buildHighlightMask(headline, highlights), [headline, highlights]);

  const isWordHighlighted = useCallback(
    (word: ParsedWord): boolean => {
      if (word.end <= word.start || word.start >= highlightMask.length) return false;
      for (let i = word.start; i < word.end; i++) {
        if (highlightMask[i]) return true;
      }
      return false;
    },
    [highlightMask]
  );

  const handleToggleWordHighlight = useCallback(
    (word: ParsedWord) => {
      if (isWordHighlighted(word)) {
        setHighlights((prev) =>
          prev.filter((h) => !(Math.max(h.start, word.start) < Math.min(h.end, word.end)))
        );
      } else {
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

  // Load custom fonts
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

  // Load overlay, photo, logo, official logo
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

  // Select Template inside Editor
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

  // Undo / Redo Engine
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
    subheading: SubheadingSettings;
    customTexts: CustomTextItem[];
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
      subheading,
      customTexts,
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
      subheading,
      customTexts,
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
    (a.logoSettings.shape ?? 'original') === (b.logoSettings.shape ?? 'original') &&
    JSON.stringify(a.subheading) === JSON.stringify(b.subheading) &&
    JSON.stringify(a.customTexts) === JSON.stringify(b.customTexts) &&
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
    setSubheading(snap.subheading);
    setCustomTexts(snap.customTexts);
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
    if (!isHydratedRef.current || isApplyingHistoryRef.current || dragRef.current.mode !== 'none')
      return;
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

  const canUndo =
    historyTick >= 0 &&
    (undoStackRef.current.length > 0 || !snapshotsEqual(committedUndoableRef.current, currentUndoable));
  const canRedo = historyTick >= 0 && redoStackRef.current.length > 0;

  // Automatic News Extraction from URL
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
          if (!hasCustomNameRef.current) {
            setProjectName(defaultProjectName(title));
          }
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

  // Hydrate or create project in IndexedDB on route mount/change
  useEffect(() => {
    if (isInvalidNewTemplate) return;
    let active = true;
    isHydratedRef.current = false;

    const urlQueryParam = sanitizeUrlInput(searchParams.get('url') || '');

    const applyProjectState = (st: ProjectEditorState, projId: string, name: string, createdAt: number) => {
      const matchedBuiltin = ALL_TEMPLATES.find((t) => t.id === st.selectedTemplateId);
      const matchedCustom =
        st.customTemplate && st.customTemplate.id === st.selectedTemplateId
          ? st.customTemplate
          : null;
      let resolvedTpl = matchedBuiltin || matchedCustom;
      if (!resolvedTpl) {
        resolvedTpl = PSD_GREEN_TEMPLATE;
        showToast('আগের টেমপ্লেট পাওয়া যায়নি, ডিফল্ট টেমপ্লেট দিয়ে খোলা হয়েছে', 'warning', 4000);
      }

      setActiveProjectId(projId);
      createdAtRef.current = createdAt;
      setProjectName(name);
      hasCustomNameRef.current = Boolean(name && name !== defaultProjectName(st.headline));

      setSelectedTemplate(resolvedTpl);
      setNewsUrl(st.newsUrl || '');
      lastFetchedUrlRef.current = (st.newsUrl || '').trim();
      setHeadline(st.headline);
      setHighlights(st.highlights || []);
      setHighlightTab(st.highlightTab || 'words');
      setLineMode(st.lineMode || 'auto');
      setFontSizePercent(st.fontSizePercent ?? 100);
      setLineGapPercent(st.lineGapPercent ?? 92);
      setSelectedFontId(st.selectedFontId || 'kalpurush');
      setTextOffsetX(st.textOffsetX ?? 0);
      setTextOffsetY(st.textOffsetY ?? 0);
      setTextShadow(Boolean(st.textShadow));
      setTextColor(st.textColor || resolvedTpl.defaultTextColor);
      setHighlightColor(st.highlightColor || resolvedTpl.defaultHighlightColor);
      setPhotoSrc(st.photoSrc || DEFAULT_PHOTO_SRC);
      setPhotoZoom(st.photoZoom ?? 1);
      setPhotoPanX(st.photoPanX ?? 0);
      setPhotoPanY(st.photoPanY ?? 0);
      setLogoSettings(st.logoSettings || initialDefaults.logoSettings);
      setSubheading(st.subheading || DEFAULT_SUBHEADING);
      setCustomTexts(st.customTexts || []);
      setExportFormat(st.exportFormat || 'png');
      setExportQuality(st.exportQuality ?? 96);
      if (st.templateOverrides && Object.keys(st.templateOverrides).length > 0) {
        setTemplateOverrides((prev) => ({ ...prev, ...st.templateOverrides }));
      }

      undoStackRef.current = [];
      redoStackRef.current = [];
      isHydratedRef.current = true;
      setLastSavedAt(createdAt);
      setSaveStatus('saved');
    };

    const bootstrap = async () => {
      if (!projectId && templateId) {
        const { project, limitReached } = await createNewProject(templateId, urlQueryParam);
        if (!active) return;
        if (project) {
          navigate(
            `/editor/${templateId}/${project.id}${
              urlQueryParam ? `?url=${encodeURIComponent(urlQueryParam)}` : ''
            }`,
            { replace: true }
          );
          return;
        }
        if (limitReached) {
          setSaveStatus('limit-reached');
          limitToastShownRef.current = true;
          showToast(
            'সর্বোচ্চ ৫০টি প্রজেক্ট পূর্ণ হয়েছে — নতুন প্রজেক্ট সেভ করতে "আমার কাজ" থেকে পুরনো কাজ মুছুন',
            'warning',
            4500
          );
          const fallbackState = createInitialEditorState(initialRouteTemplate, urlQueryParam);
          applyProjectState(fallbackState, generateUuid(), defaultProjectName(fallbackState.headline), Date.now());
          if (urlQueryParam && isLikelyUrl(urlQueryParam)) {
            extractNewsFromUrl(urlQueryParam, true);
          }
          return;
        }
      }

      if (projectId) {
        const existing = await getProjectById(projectId);
        if (!active) return;

        if (!existing) {
          // If URL points to unknown projectId, verify templateId first
          if (!templateId || !ALL_TEMPLATES.some((t) => t.id === templateId)) {
            navigate('/templates', { replace: true });
            return;
          }
          const { project } = await createNewProject(templateId, urlQueryParam);
          if (!active) return;
          if (project) {
            applyProjectState(project.state, project.id, project.name, project.createdAt);
            if (urlQueryParam && isLikelyUrl(urlQueryParam)) {
              navigate(`/editor/${templateId}/${project.id}`, { replace: true });
              extractNewsFromUrl(urlQueryParam, true);
            }
          }
          return;
        }

        applyProjectState(existing.state, existing.id, existing.name, existing.createdAt);

        if (urlQueryParam && isLikelyUrl(urlQueryParam)) {
          setNewsUrl(urlQueryParam);
          navigate(`/editor/${existing.templateId}/${existing.id}`, { replace: true });
          extractNewsFromUrl(urlQueryParam, true);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [templateId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced Auto-fetch URL when user types or pastes
  useEffect(() => {
    if (!isHydratedRef.current) return;
    const trimmed = sanitizeUrlInput(newsUrl);
    if (!trimmed) {
      setExtractError(null);
      return;
    }
    if (!isLikelyUrl(trimmed)) return;
    const timer = setTimeout(() => {
      extractNewsFromUrl(trimmed);
    }, 340);
    return () => clearTimeout(timer);
  }, [newsUrl, extractNewsFromUrl]);

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
    const nextHeadline = isMaroon
      ? 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস'
      : 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ';
    setHeadline(nextHeadline);
    if (!hasCustomNameRef.current) {
      setProjectName(defaultProjectName(nextHeadline));
    }
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
    setSubheading(DEFAULT_SUBHEADING);
    setCustomTexts([]);
    setActiveCustomTextId(null);
    setPendingPencilPoint(null);
    setIsPencilTextMode(false);
  }, [commitHistoryNow, selectedTemplate]);

  // Build snapshot of ProjectEditorState for IndexedDB auto-save
  const projectEditorState = useMemo<ProjectEditorState>(
    () => ({
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
      subheading,
      customTexts,
      exportFormat,
      exportQuality,
      templateOverrides: templateOverrides[selectedTemplate.id]
        ? { [selectedTemplate.id]: templateOverrides[selectedTemplate.id] }
        : {},
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
      subheading,
      customTexts,
      exportFormat,
      exportQuality,
      templateOverrides,
    ]
  );

  const performSaveToIndexedDB = useCallback(
    async (explicitToast = false) => {
      if (!isHydratedRef.current) return;
      setSaveStatus('saving');
      const now = Date.now();
      const thumb = generateCanvasThumbnail(previewCanvasRef.current);
      const res = await saveProject({
        id: activeProjectId,
        templateId: selectedTemplate.id,
        name: projectName.trim() || defaultProjectName(headline),
        newsUrl,
        state: projectEditorState,
        thumbnail: thumb,
        createdAt: createdAtRef.current,
        updatedAt: now,
      });

      if (res.limitReached) {
        setSaveStatus('limit-reached');
        if (explicitToast || !limitToastShownRef.current) {
          limitToastShownRef.current = true;
          showToast(
            'সর্বোচ্চ ৫০টি প্রজেক্ট পূর্ণ হয়েছে — "আমার কাজ" থেকে পুরনো কাজ মুছে দিন',
            'warning',
            4500
          );
        }
        return;
      }

      if (res.saved) {
        setSaveStatus('saved');
        setLastSavedAt(now);
        if (explicitToast) {
          showToast('সেভ হয়েছে ✓', 'success');
        }
      }
    },
    [activeProjectId, headline, newsUrl, projectEditorState, projectName, selectedTemplate.id, showToast]
  );

  // Debounced auto-save (1000ms)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      performSaveToIndexedDB(false);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [projectEditorState, projectName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+S + Spacebar Stage Pan
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isTypingTarget(e.target)) {
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
          }
          setIsSpaceHeld(true);
        }
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        performSaveToIndexedDB(true);
      } else if (key === 'z' && !e.shiftKey) {
        if (
          undoStackRef.current.length > 0 ||
          !snapshotsEqual(committedUndoableRef.current, currentUndoableRef.current)
        ) {
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
        if (stagePanRef.current.active) {
          stagePanRef.current.active = false;
          setIsPanningStage(false);
        }
      }
    };

    const onBlur = () => {
      setIsSpaceHeld(false);
      stagePanRef.current.active = false;
      setIsPanningStage(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [performUndo, performRedo, performSaveToIndexedDB]);

  // Global mouse move/up for smooth stage panning even outside <main>
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (!stagePanRef.current.active) return;
      const dx = e.clientX - stagePanRef.current.startX;
      const dy = e.clientY - stagePanRef.current.startY;
      setStagePanX(Math.max(-1200, Math.min(1200, Math.round(stagePanRef.current.initPanX + dx))));
      setStagePanY(Math.max(-1200, Math.min(1200, Math.round(stagePanRef.current.initPanY + dy))));
    };
    const onWindowMouseUp = () => {
      if (stagePanRef.current.active) {
        stagePanRef.current.active = false;
        setIsPanningStage(false);
      }
    };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, []);

  // Mouse wheel & trackpad pinch-to-zoom directly on <main>
  useEffect(() => {
    const mainEl = stageMainRef.current;
    if (!mainEl) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('form, input, textarea, [data-no-stage-wheel="true"]')) {
        return;
      }
      e.preventDefault();
      const stepDelta = e.ctrlKey ? -e.deltaY * 0.8 : -e.deltaY * 0.18;
      if (Math.abs(stepDelta) < 0.2) return;
      setCanvasZoomMode('custom');
      setCanvasZoomPercent((prev) =>
        Math.max(30, Math.min(250, Math.round(prev + stepDelta)))
      );
    };
    mainEl.addEventListener('wheel', onWheel, { passive: false });
    return () => mainEl.removeEventListener('wheel', onWheel);
  }, []);

  const resetStageView = useCallback(() => {
    setStagePanX(0);
    setStagePanY(0);
    setCanvasZoomMode('fit');
    setCanvasZoomPercent(100);
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
      subheading,
      customTexts,
      activeCustomTextId,
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
    subheading,
    customTexts,
    activeCustomTextId,
    snapState,
    fontsLoadedTick,
  ]);

  // Textarea selection helpers
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
      setSelectionHint(
        'শিরোনামের যে অংশ হাইলাইট করতে চান তা সিলেক্ট করে ক্লিক করুন। অথবা নিচের শব্দগুলোর ওপর ক্লিক করুন।'
      );
      window.setTimeout(() => setSelectionHint(''), 3500);
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
        prev.filter((h) => !(Math.max(h.start, start) < Math.min(h.end, end)))
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

  // Safe Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) return;

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

  // Safe Custom Frame PNG Upload
  const handleCustomFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) return;

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

  // Safe Custom Font Upload
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

  // Logo upload -> opens LogoEditorModal
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoEditorSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Floating Custom Text via Pencil click
  const handleCommitPencilText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = pendingPencilText.trim();
    if (!trimmed || !pendingPencilPoint) return;
    commitHistoryNow();
    const id = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextItem: CustomTextItem = {
      id,
      text: trimmed,
      x: pendingPencilPoint.x,
      y: pendingPencilPoint.y,
      fontSize: pendingPencilSize,
      color: pendingPencilColor,
      bgColor: pendingPencilBg,
    };
    setCustomTexts((prev) => [...prev, nextItem]);
    setActiveCustomTextId(id);
    setPendingPencilPoint(null);
    setPendingPencilText('');
  };

  // Canvas interactions (drag, snap, pencil click)
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

  const pointInRect = (
    x: number,
    y: number,
    r: { x: number; y: number; width: number; height: number }
  ) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

  const startCanvasDrag = (clientX: number, clientY: number) => {
    const metrics = layoutMetricsRef.current;
    if (!metrics) return;
    const pt = getCanvasPoint(clientX, clientY);

    if (isPencilTextMode) {
      const nx = Math.max(0.06, Math.min(0.94, pt.x / Math.max(1, metrics.canvasWidth)));
      const ny = Math.max(0.06, Math.min(0.94, pt.y / Math.max(1, metrics.canvasHeight)));
      setIsPencilTextMode(false);
      setPendingPencilPoint({ x: nx, y: ny });
      setPendingPencilText('');
      return;
    }

    let mode: 'none' | 'text' | 'photo' | 'logo' | 'subheading' | 'custom-text' = 'none';
    let hitCustomId: string | null = null;
    let hitCustomItem: CustomTextItem | undefined;

    for (let i = metrics.customTextHitBoxes.length - 1; i >= 0; i--) {
      const entry = metrics.customTextHitBoxes[i];
      if (pointInRect(pt.x, pt.y, entry.box)) {
        hitCustomId = entry.id;
        hitCustomItem = customTexts.find((c) => c.id === entry.id);
        mode = 'custom-text';
        break;
      }
    }

    if (mode === 'none' && metrics.subheadingHitBox && pointInRect(pt.x, pt.y, metrics.subheadingHitBox)) {
      mode = 'subheading';
      setActiveCustomTextId(null);
    } else if (mode === 'none' && metrics.logoHitBox && pointInRect(pt.x, pt.y, metrics.logoHitBox)) {
      mode = 'logo';
      setActiveCustomTextId(null);
    } else if (mode === 'none' && headline.trim() && pointInRect(pt.x, pt.y, metrics.textHitBox)) {
      mode = 'text';
      setActiveCustomTextId(null);
    } else if (mode === 'none' && pointInRect(pt.x, pt.y, metrics.photoHitBox)) {
      mode = 'photo';
      setActiveCustomTextId(null);
    } else if (mode === 'none' && headline.trim()) {
      mode = 'text';
      setActiveCustomTextId(null);
    }

    if (mode === 'custom-text' && hitCustomId) {
      setActiveCustomTextId(hitCustomId);
    }

    if (mode === 'none') return;

    dragRef.current = {
      mode,
      customTextId: hitCustomId,
      startClientX: clientX,
      startClientY: clientY,
      initialTextX: textOffsetX,
      initialTextY: textOffsetY,
      initialPanX: photoPanX,
      initialPanY: photoPanY,
      initialLogoX: logoSettings.x,
      initialLogoY: logoSettings.y,
      initialSubX: subheading.offsetX,
      initialSubY: subheading.offsetY,
      initialCustomX: hitCustomItem?.x ?? 0.5,
      initialCustomY: hitCustomItem?.y ?? 0.5,
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
    } else if (st.mode === 'subheading') {
      const nextSubX = Math.max(-0.48, Math.min(0.48, st.initialSubX + dxNorm));
      const nextSubY = Math.max(-0.48, Math.min(0.48, st.initialSubY + dyNorm));
      setSubheading((prev) => ({ ...prev, offsetX: nextSubX, offsetY: nextSubY }));
    } else if (st.mode === 'custom-text' && st.customTextId) {
      const nextX = Math.max(0.03, Math.min(0.97, st.initialCustomX + dxNorm));
      const nextY = Math.max(0.03, Math.min(0.97, st.initialCustomY + dyNorm));
      const targetId = st.customTextId;
      setCustomTexts((prev) =>
        prev.map((item) => (item.id === targetId ? { ...item, x: nextX, y: nextY } : item))
      );
    } else if (st.mode === 'photo' && photoImg) {
      const nextPanX = Math.round(Math.max(-100, Math.min(100, st.initialPanX + dxNorm * 220)));
      const nextPanY = Math.round(Math.max(-100, Math.min(100, st.initialPanY + dyNorm * 220)));
      setPhotoPanX(nextPanX);
      setPhotoPanY(nextPanY);
    } else if (st.mode === 'logo') {
      const nextLogoX = Math.round(Math.max(-200, Math.min(200, st.initialLogoX + dxNorm * 220)));
      const nextLogoY = Math.round(Math.max(-200, Math.min(200, st.initialLogoY + dyNorm * 220)));
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

  // Download Card (preserves exact renderNewsCard export logic)
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
      subheading,
      customTexts,
      isExport: true,
    });

    const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
    const qualityRatio = Math.max(0.6, Math.min(1, exportQuality / 100));
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
        window.setTimeout(() => URL.revokeObjectURL(href), 5000);
      }
      setDownloadDone(true);
      showToast('ডাউনলোড হয়েছে ✓', 'success');
      window.setTimeout(() => setDownloadDone(false), 2000);
    };

    if (exportCanvas.toBlob) {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            triggerDownload(blobUrl, true);
          } else {
            triggerDownload(exportCanvas.toDataURL(mime, qualityRatio));
          }
        },
        mime,
        qualityRatio
      );
    } else {
      triggerDownload(exportCanvas.toDataURL(mime, qualityRatio));
    }
  };

  if (isInvalidNewTemplate) {
    return <Navigate to="/templates" replace />;
  }

  const activeMobileMeta = EDITOR_TABS.find((t) => t.id === mobileSheetTab);
  const MobileTabIcon = activeMobileMeta?.icon;

  const panelProps = {
    headline,
    onHeadlineChange: (val: string) => {
      setHeadline(val);
      if (!hasCustomNameRef.current) {
        setProjectName(defaultProjectName(val));
      }
    },
    textareaRef,
    onSyncTextareaSelection: syncTextareaSelection,
    highlightTab,
    onChangeHighlightTab: setHighlightTab,
    parsedWords,
    isWordHighlighted,
    onToggleWordHighlight: handleToggleWordHighlight,
    onHighlightAllWords: handleHighlightAllWords,
    onClearAllHighlights: () => setHighlights([]),
    onHighlightSelection: handleHighlightSelection,
    onRemoveSelectionHighlight: handleRemoveHighlight,
    onResetAllNormal: handleResetAllNormal,
    selectionHint,
    hasHighlights: highlights.length > 0,
    subheading,
    onChangeSubheading: setSubheading,
    onResetSubheading: () => setSubheading(DEFAULT_SUBHEADING),
    customTexts,
    activeCustomTextId,
    onSelectCustomText: setActiveCustomTextId,
    onChangeCustomTexts: setCustomTexts,
    onStartPencilMode: () => {
      setPendingPencilPoint(null);
      setIsPencilTextMode(true);
    },
    onAddDirectCustomText: () => {
      setPendingPencilPoint({ x: 0.5, y: 0.2 });
      setPendingPencilText('');
    },
    effectiveTemplate,
    selectedTemplate,
    onUpdateActiveTemplateOverride: handleUpdateActiveTemplateOverride,
    onResetActiveTemplateOverride: handleResetActiveTemplateOverride,
    lineMode,
    onChangeLineMode: setLineMode,
    allFonts,
    activeFont,
    onSelectFont: setSelectedFontId,
    onTriggerFontUpload: () => fontInputRef.current?.click(),
    onDeleteCustomFont: handleDeleteCustomFont,
    fontSizePercent,
    onChangeFontSizePercent: setFontSizePercent,
    lineGapPercent,
    onChangeLineGapPercent: setLineGapPercent,
    textOffsetX,
    textOffsetY,
    onChangeTextOffset: (x: number, y: number) => {
      setTextOffsetX(x);
      setTextOffsetY(y);
    },
    textShadow,
    onChangeTextShadow: setTextShadow,
    textColor,
    onChangeTextColor: setTextColor,
    highlightColor,
    onChangeHighlightColor: setHighlightColor,
    onResetColors: () => {
      setTextColor(selectedTemplate.defaultTextColor);
      setHighlightColor(selectedTemplate.defaultHighlightColor);
    },
    onResetStyleAll: () => {
      setLineMode('auto');
      setFontSizePercent(100);
      setLineGapPercent(92);
      setTextOffsetX(0);
      setTextOffsetY(0);
      setTextShadow(false);
      setTextColor(selectedTemplate.defaultTextColor);
      setHighlightColor(selectedTemplate.defaultHighlightColor);
    },
    onTriggerPhotoUpload: () => photoInputRef.current?.click(),
    photoZoom,
    onChangePhotoZoom: setPhotoZoom,
    photoPanX,
    onChangePhotoPanX: setPhotoPanX,
    photoPanY,
    onChangePhotoPanY: setPhotoPanY,
    onResetPhoto: () => {
      setPhotoZoom(1);
      setPhotoPanX(0);
      setPhotoPanY(0);
      setPhotoSrc(DEFAULT_PHOTO_SRC);
    },
    onTriggerCustomFrameUpload: () => customFrameInputRef.current?.click(),
    onResetToDefaultGreenTemplate: () => {
      setSelectedTemplate(PSD_GREEN_TEMPLATE);
      setTextColor(PSD_GREEN_TEMPLATE.defaultTextColor);
      setHighlightColor(PSD_GREEN_TEMPLATE.defaultHighlightColor);
    },
    extractError,
    logoSettings,
    onChangeLogoSettings: setLogoSettings,
    onTriggerLogoUpload: () => logoInputRef.current?.click(),
    onOpenLogoEditor: (dataUrl: string) => setLogoEditorSource(dataUrl),
    onCommitHistory: commitHistoryNow,
    onSelectTemplate: handleSelectTemplate,
    categoryNames,
    onRenameCategory: handleRenameCategory,
    onResetCategoryName: handleResetCategoryName,
    templateOverrides,
    exportFormat,
    onChangeExportFormat: setExportFormat,
    exportQuality,
    onChangeExportQuality: setExportQuality,
    onDownload: handleDownloadCard,
    downloadDone,
  };

  const aspectRatioStyle = `${effectiveTemplate.canvasWidth} / ${effectiveTemplate.canvasHeight}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#0F172A] md:h-screen md:overflow-hidden dark:bg-[#0B0F19] dark:text-slate-100">
      {/* Hidden File Inputs */}
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
      <input
        ref={customFrameInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomFrameUpload}
        className="hidden"
      />

      {/* Top Bar */}
      <EditorTopBar
        templateName={effectiveTemplate.name}
        projectName={projectName}
        onRenameProject={(nextName) => {
          hasCustomNameRef.current = true;
          setProjectName(nextName);
        }}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onManualSave={() => performSaveToIndexedDB(true)}
        newsUrl={newsUrl}
        onNewsUrlChange={(val) => {
          if (val.trim() !== lastFetchedUrlRef.current) {
            lastFetchedUrlRef.current = '';
            setExtractError(null);
          }
          setNewsUrl(val);
        }}
        onNewsUrlPaste={handleUrlPaste}
        onClearNewsUrl={handleClearNewsUrl}
        onTriggerFetch={() => extractNewsFromUrl(newsUrl, true)}
        isExtracting={isExtracting}
        isLikelyValidUrl={isLikelyUrl(newsUrl)}
        exportFormat={exportFormat}
        onChangeExportFormat={setExportFormat}
        onDownload={handleDownloadCard}
        downloadDone={downloadDone}
      />

      {/* Main 3-Zone Workspace */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Desktop Left Rail & Mobile Fixed Bottom Bar */}
        <EditorSidebar
          activeTab={desktopTab}
          onSelectTab={(tab) => {
            setDesktopTab(tab);
            setMobileSheetTab((prev) => (prev === tab ? null : tab));
          }}
          onShowShortcuts={() => setShowShortcutsModal(true)}
        />

        {/* Center Dotted Canvas Stage */}
        <main
          ref={stageMainRef}
          onMouseDown={(e) => {
            if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') {
              document.activeElement.blur();
            }
            const target = e.target as HTMLElement | null;
            const isEmptyStage =
              e.target === e.currentTarget || target?.dataset.stageArea === 'true';
            if ((isSpaceHeld || isHandMode || isEmptyStage) && e.button === 0) {
              e.preventDefault();
              stagePanRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                initPanX: stagePanX,
                initPanY: stagePanY,
              };
              setIsPanningStage(true);
            }
          }}
          onDoubleClick={(e) => {
            const target = e.target as HTMLElement | null;
            if (e.target === e.currentTarget || target?.dataset.stageArea === 'true') {
              resetStageView();
            }
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchRef.current = {
                active: true,
                initialDist: Math.hypot(dx, dy),
                initialZoom: canvasZoomPercent,
              };
              stagePanRef.current.active = false;
              setIsPanningStage(false);
              return;
            }
            const target = e.target as HTMLElement | null;
            const isEmptyStage =
              e.target === e.currentTarget || target?.dataset.stageArea === 'true';
            if (e.touches.length === 1 && (isHandMode || isEmptyStage)) {
              stagePanRef.current = {
                active: true,
                startX: e.touches[0].clientX,
                startY: e.touches[0].clientY,
                initPanX: stagePanX,
                initPanY: stagePanY,
              };
              setIsPanningStage(true);
            }
          }}
          onTouchMove={(e) => {
            if (pinchRef.current.active && e.touches.length === 2) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              if (pinchRef.current.initialDist > 10) {
                const nextZoom = Math.max(
                  30,
                  Math.min(
                    250,
                    Math.round((pinchRef.current.initialZoom * dist) / pinchRef.current.initialDist)
                  )
                );
                setCanvasZoomMode('custom');
                setCanvasZoomPercent(nextZoom);
              }
              return;
            }
            if (stagePanRef.current.active && e.touches.length === 1) {
              e.preventDefault();
              const dx = e.touches[0].clientX - stagePanRef.current.startX;
              const dy = e.touches[0].clientY - stagePanRef.current.startY;
              setStagePanX(
                Math.max(-1200, Math.min(1200, Math.round(stagePanRef.current.initPanX + dx)))
              );
              setStagePanY(
                Math.max(-1200, Math.min(1200, Math.round(stagePanRef.current.initPanY + dy)))
              );
            }
          }}
          onTouchEnd={() => {
            pinchRef.current.active = false;
            stagePanRef.current.active = false;
            setIsPanningStage(false);
          }}
          className={`canvas-stage-dots relative flex flex-1 flex-col items-center justify-center overflow-hidden px-3 py-3 sm:p-5 ${
            mobileSheetTab ? 'max-md:pb-4' : 'max-md:pb-20'
          } ${
            isPanningStage
              ? 'cursor-grabbing select-none'
              : isSpaceHeld || isHandMode
                ? 'cursor-grab select-none'
                : ''
          }`}
        >
          {/* Floating Canvas Toolbar Pill */}
          <div
            data-no-stage-wheel="true"
            onMouseDown={(e) => e.stopPropagation()}
            className="relative z-20 mb-3 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-[#E5E7EB] bg-white/95 px-2 py-1 text-xs shadow-sm backdrop-blur-xs dark:border-[#1F2937] dark:bg-[#111827]/95"
          >
            <button
              type="button"
              onClick={performUndo}
              disabled={!canUndo}
              title="পিছনে যান (Ctrl+Z)"
              aria-label="আনডু"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#0F172A] transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-200 dark:hover:bg-gray-800"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={performRedo}
              disabled={!canRedo}
              title="সামনে যান (Ctrl+Y)"
              aria-label="রিডু"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#0F172A] transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-200 dark:hover:bg-gray-800"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>

            <span className="mx-0.5 h-4 w-px bg-[#E5E7EB] dark:bg-[#1F2937]" />

            {/* Hand / Space Pan Tool */}
            <button
              type="button"
              onClick={() => setIsHandMode((v) => !v)}
              title="ডিজাইন ডানে-বামে সরাতে ক্লিক করুন অথবা কীবোর্ডে Space চেপে ধরে টানুন"
              aria-label="ডিজাইন সরানোর টুল"
              className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold transition-colors ${
                isHandMode || isSpaceHeld
                  ? 'bg-[#4F46E5] text-white'
                  : 'text-[#0F172A] hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">সরান</span>
            </button>

            <span className="mx-0.5 h-4 w-px bg-[#E5E7EB] dark:bg-[#1F2937]" />

            {/* Zoom Controls + Clickable Number Input */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setCanvasZoomMode('custom');
                  setCanvasZoomPercent((z) => Math.max(30, z - 10));
                }}
                aria-label="ছোট করুন (Zoom Out)"
                title="ছোট করুন"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:hover:bg-gray-800"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>

              <EditableNumberBadge
                value={canvasZoomPercent}
                min={30}
                max={250}
                suffix="%"
                onChange={(val) => {
                  setCanvasZoomMode('custom');
                  setCanvasZoomPercent(val);
                }}
                ariaLabel="প্রিভিউ জুম"
                className="!h-7 !min-w-[48px]"
              />

              <button
                type="button"
                onClick={() => {
                  setCanvasZoomMode('custom');
                  setCanvasZoomPercent((z) => Math.min(250, z + 10));
                }}
                aria-label="বড় করুন (Zoom In)"
                title="বড় করুন"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:hover:bg-gray-800"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>

              {(canvasZoomMode !== 'fit' || stagePanX !== 0 || stagePanY !== 0) && (
                <button
                  type="button"
                  onClick={resetStageView}
                  title="মাঝে ও ডিফল্ট সাইজে ফেরান"
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[#4F46E5] hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>ফিট</span>
                </button>
              )}
            </div>

            <span className="mx-0.5 hidden h-4 w-px bg-[#E5E7EB] sm:inline-block dark:bg-[#1F2937]" />

            <span className="hidden px-1.5 text-[11.5px] font-medium text-[#64748B] tabular-nums sm:inline dark:text-slate-400">
              {toBengaliDigits(effectiveTemplate.canvasWidth)} ×{' '}
              {toBengaliDigits(effectiveTemplate.canvasHeight)} px
            </span>

            <span className="mx-0.5 h-4 w-px bg-[#E5E7EB] dark:bg-[#1F2937]" />

            <button
              type="button"
              onClick={() => {
                setPendingPencilPoint(null);
                setIsPencilTextMode((v) => !v);
              }}
              className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold transition-colors ${
                isPencilTextMode
                  ? 'bg-[#4F46E5] text-white'
                  : 'text-[#0F172A] hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800'
              }`}
              title="কার্ডের যেকোনো জায়গায় ক্লিক করে টেক্সট যোগ করুন"
            >
              <Pencil className="h-3 w-3" />
              <span>পেন্সিল</span>
            </button>
          </div>

          {/* Live Canvas Wrapper (Pannable + Zoomable Stage) */}
          <div
            data-stage-area="true"
            className="flex w-full flex-1 items-center justify-center"
          >
            <div
              className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_12px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.45)] ${
                isPencilTextMode ? 'ring-2 ring-[#4F46E5]' : 'ring-1 ring-black/5 dark:ring-white/10'
              } ${isPanningStage ? 'transition-none' : 'transition-shadow'}`}
              style={{
                aspectRatio: aspectRatioStyle,
                width:
                  canvasZoomMode === 'fit'
                    ? mobileSheetTab
                      ? 'min(100%, 310px, 36vh)'
                      : 'min(100%, 520px, calc(100vh - 215px))'
                    : `${Math.round((520 * canvasZoomPercent) / 100)}px`,
                transform: `translate3d(${stagePanX}px, ${stagePanY}px, 0)`,
              }}
            >
              <canvas
                ref={previewCanvasRef}
                width={effectiveTemplate.canvasWidth}
                height={effectiveTemplate.canvasHeight}
                onMouseDown={(e) => {
                  if (isSpaceHeld || isHandMode) return;
                  startCanvasDrag(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  if (isSpaceHeld || isHandMode || stagePanRef.current.active) return;
                  moveCanvasDrag(e.clientX, e.clientY);
                }}
                onMouseUp={endCanvasDrag}
                onMouseLeave={endCanvasDrag}
                onTouchStart={(e) => {
                  if (isHandMode || e.touches.length !== 1) return;
                  startCanvasDrag(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchMove={(e) => {
                  if (isHandMode || e.touches.length !== 1) return;
                  if (dragRef.current.mode !== 'none') {
                    e.preventDefault();
                    moveCanvasDrag(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchEnd={endCanvasDrag}
                className={`block h-full w-full select-none touch-none ${
                  isPanningStage
                    ? 'cursor-grabbing'
                    : isSpaceHeld || isHandMode
                      ? 'cursor-grab'
                      : isPencilTextMode
                        ? 'cursor-crosshair'
                        : 'cursor-grab active:cursor-grabbing'
                }`}
              />

              {isPencilTextMode && (
                <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-center">
                  <span className="rounded-lg bg-[#0F172A]/90 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                    কার্ডের যেকোনো জায়গায় ক্লিক করুন — সেখানেই টেক্সট লিখবেন
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Inline Floating Text Creator (Pencil Click on Canvas) */}
          {pendingPencilPoint && (
            <form
              data-no-stage-wheel="true"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={handleCommitPencilText}
              className="relative z-20 mt-3 w-full max-w-[480px] space-y-2.5 rounded-xl border border-[#4F46E5]/50 bg-white p-3.5 text-xs shadow-lg dark:border-indigo-500/40 dark:bg-[#111827]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-slate-100">
                  <Pencil className="h-3.5 w-3.5 text-[#4F46E5]" />
                  <span>নির্বাচিত জায়গায় নতুন টেক্সট লিখুন</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPencilPoint(null)}
                  className="cursor-pointer rounded p-1 text-[#64748B] hover:bg-slate-100 dark:hover:bg-gray-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <input
                type="text"
                autoFocus
                value={pendingPencilText}
                onChange={(e) => setPendingPencilText(e.target.value)}
                placeholder="যেমন: ফাইল ছবি / বিশেষ প্রতিনিধি / তারিখ..."
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[
                    { label: 'ছোট', size: 24 },
                    { label: 'মাঝারি', size: 34 },
                    { label: 'বড়', size: 52 },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      onClick={() => setPendingPencilSize(preset.size)}
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        pendingPencilSize === preset.size
                          ? 'bg-[#4F46E5] text-white'
                          : 'border border-[#E5E7EB] bg-[#F7F8FA] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <EditableNumberBadge
                    value={pendingPencilSize}
                    min={16}
                    max={110}
                    suffix="px"
                    onChange={setPendingPencilSize}
                    ariaLabel="নতুন টেক্সটের সাইজ"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={pendingPencilColor}
                    onChange={(e) => setPendingPencilColor(e.target.value)}
                    title="টেক্সটের রং"
                    className="swatch-picker h-6 w-7"
                  />
                  {(
                    [
                      { label: 'খালি', val: null },
                      { label: 'কালো', val: 'rgba(15, 23, 42, 0.72)' },
                      { label: 'হলুদ', val: '#ece304' },
                    ] as const
                  ).map((bgOpt) => (
                    <button
                      key={bgOpt.label}
                      type="button"
                      onClick={() => {
                        setPendingPencilBg(bgOpt.val);
                        if (bgOpt.val === '#ece304') setPendingPencilColor('#111827');
                        else if (bgOpt.val === 'rgba(15, 23, 42, 0.72)')
                          setPendingPencilColor('#ffffff');
                      }}
                      className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold ${
                        pendingPencilBg === bgOpt.val
                          ? 'bg-[#F59E0B] text-slate-950'
                          : 'border border-[#E5E7EB] bg-[#F7F8FA] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                      }`}
                    >
                      {bgOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPencilPoint(null)}
                  className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-semibold text-[#64748B] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={!pendingPencilText.trim()}
                  className="cursor-pointer rounded-lg bg-[#4F46E5] px-3.5 py-1.5 font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  স্ক্রিনে বসান
                </button>
              </div>
            </form>
          )}

          {/* Floating Quick Edit Bar for Selected Floating Custom Text */}
          {activeCustomTextId &&
            (() => {
              const activeItem = customTexts.find((c) => c.id === activeCustomTextId);
              if (!activeItem) return null;
              return (
                <div
                  data-no-stage-wheel="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  className="relative z-20 mt-3 w-full max-w-[480px] space-y-2 rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs shadow-lg dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={activeItem.text}
                      onChange={(e) =>
                        setCustomTexts((prev) =>
                          prev.map((c) =>
                            c.id === activeItem.id ? { ...c, text: e.target.value } : c
                          )
                        )
                      }
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 text-xs font-semibold text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        commitHistoryNow();
                        setCustomTexts((prev) => prev.filter((c) => c.id !== activeItem.id));
                        setActiveCustomTextId(null);
                      }}
                      title="এই টেক্সট মুছুন"
                      className="cursor-pointer rounded-lg border border-red-200 bg-red-50 p-1.5 text-[#EF4444] hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCustomTextId(null)}
                      title="সিলেকশন বন্ধ"
                      className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white p-1.5 text-[#64748B] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-300">
                      সাইজ
                    </span>
                    <EditableNumberBadge
                      value={activeItem.fontSize}
                      min={16}
                      max={110}
                      suffix="px"
                      onChange={(fontSize) =>
                        setCustomTexts((prev) =>
                          prev.map((c) =>
                            c.id === activeItem.id ? { ...c, fontSize } : c
                          )
                        )
                      }
                      ariaLabel="অতিরিক্ত টেক্সটের সাইজ"
                    />
                    <div className="min-w-[100px] flex-1">
                      <RangeSlider
                        min={16}
                        max={110}
                        value={activeItem.fontSize}
                        onChange={(fontSize) =>
                          setCustomTexts((prev) =>
                            prev.map((c) =>
                              c.id === activeItem.id ? { ...c, fontSize } : c
                            )
                          )
                        }
                        ariaLabel="অতিরিক্ত টেক্সটের সাইজ"
                      />
                    </div>
                    <input
                      type="color"
                      value={activeItem.color}
                      onChange={(e) =>
                        setCustomTexts((prev) =>
                          prev.map((c) =>
                            c.id === activeItem.id ? { ...c, color: e.target.value } : c
                          )
                        )
                      }
                      className="swatch-picker h-6 w-7"
                      title="রং পরিবর্তন"
                    />
                  </div>
                </div>
              );
            })()}
        </main>

        {/* Desktop Right Control Panel (360px) */}
        <aside
          aria-label="এডিটর কন্ট্রোল প্যানেল"
          className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-[#E5E7EB] bg-white p-4 md:block lg:w-[360px] dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <EditorRightPanel activeTab={desktopTab} {...panelProps} />
        </aside>
      </div>

      {/* Mobile Slide-Up Sheet (<768px) */}
      {mobileSheetTab && (
        <section
          aria-label="মোবাইল এডিটর সেটিংস"
          className="fixed inset-x-0 bottom-[55px] z-30 flex max-h-[50vh] flex-col rounded-t-2xl border-t border-[#E5E7EB] bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.12)] md:hidden dark:border-[#1F2937] dark:bg-[#111827]"
        >
          {/* Sheet Handle & Header */}
          <div className="flex shrink-0 flex-col items-center border-b border-[#E5E7EB] px-4 pb-2.5 pt-2 dark:border-[#1F2937]">
            <span className="mb-1.5 h-1 w-9 rounded-full bg-slate-300 dark:bg-gray-700" />
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                {MobileTabIcon && <MobileTabIcon className="h-4 w-4 text-[#4F46E5]" />}
                <span>{activeMobileMeta?.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetTab(null)}
                aria-label="প্যানেল বন্ধ করুন"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#F7F8FA] text-[#64748B] hover:text-[#0F172A] dark:bg-[#0B0F19] dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <EditorRightPanel activeTab={mobileSheetTab} {...panelProps} />
          </div>
        </section>
      )}

      {/* Interactive Logo Editor Modal */}
      {logoEditorSource && (
        <LogoEditorModal
          isOpen={Boolean(logoEditorSource)}
          sourceDataUrl={logoEditorSource}
          initialShape={logoSettings.shape ?? 'original'}
          initialScale={logoSettings.scale}
          onCancel={() => setLogoEditorSource(null)}
          onApply={({ dataUrl, shape, scale }) => {
            commitHistoryNow();
            setLogoSettings((prev) => ({
              ...prev,
              dataUrl,
              shape,
              scale,
              hideDefaultBrand: false,
            }));
            setLogoEditorSource(null);
          }}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#0F172A] dark:text-slate-100">
                কীবোর্ড শর্টকাট
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="cursor-pointer rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-[13px]">
              {[
                { key: 'Space + টানুন', desc: 'প্রিভিউ যেকোনো জায়গায় সরান' },
                { key: 'মাউস হুইল', desc: 'প্রিভিউ ছোট-বড় করুন (Zoom)' },
                { key: 'Ctrl + S', desc: 'প্রজেক্ট সেভ করুন' },
                { key: 'Ctrl + Z', desc: 'পিছনের ধাপে ফিরুন (Undo)' },
                { key: 'Ctrl + Y', desc: 'পরের ধাপে যান (Redo)' },
                { key: 'টেনে ধরুন', desc: 'কার্ডে শিরোনাম, ছবি বা লোগো সরান' },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-2 dark:border-[#1F2937] dark:bg-[#0B0F19]"
                >
                  <span className="text-[#0F172A] dark:text-slate-200">{row.desc}</span>
                  <kbd className="rounded border border-[#E5E7EB] bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#4F46E5] dark:border-[#1F2937] dark:bg-[#111827] dark:text-indigo-400">
                    {row.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
