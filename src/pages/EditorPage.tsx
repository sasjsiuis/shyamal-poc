import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Contrast,
  Hand,
  ImagePlus,
  Maximize2,
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
import { MobileBottomSheet, type MobileSheetSnap } from '../components/editor/MobileBottomSheet';
import { MobileFullscreenPreviewModal } from '../components/editor/MobileFullscreenPreviewModal';
import { MobileLayersPanel } from '../components/editor/MobileLayersPanel';
import { MobilePanels } from '../components/editor/MobilePanels';
import { MobileUrlModal } from '../components/editor/MobileUrlModal';
import { ALL_TEMPLATES, BUILTIN_FONTS, PSD_GREEN_TEMPLATE, PSD_MAROON_TEMPLATE } from '../data/templates';
import type {
  CustomTextItem,
  ExportFormat,
  ExtraImageLayer,
  FontOption,
  HighlightRange,
  LineMode,
  LogoSettings,
  QuoteCardSettings,
  RenderedLayoutMetrics,
  SubheadingSettings,
  TemplateCategory,
  TemplateConfig,
  TemplateOverride,
} from '../types/card';
import type { ProjectEditorState } from '../types/project';
import { buildHighlightMask, renderNewsCard } from '../utils/canvasRenderer';
import {
  moveLayerStep as moveLayerStepHelper,
  normalizeLayerOrder,
  reorderVisualTopDown,
} from '../utils/layerUtils';
import { getDefaultQuoteSettings, isQuoteStyleType } from '../utils/quoteCardRenderer';
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
  ALL_BUILTIN_DEFAULT_PHOTO_SRCS,
  DEFAULT_PHOTO_SRC,
  createInitialEditorState,
  createNewProject,
  defaultProjectName,
  generateCanvasThumbnail,
  generateUuid,
  getProjectById,
  getTemplateDefaultPhotoSrc,
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
  const [mobileSheetTab, setMobileSheetTab] = useState<EditorTabId | null>(null);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>('default');
  const [showMobileHint, setShowMobileHint] = useState<boolean>(true);
  const [mobileUrlModalOpen, setMobileUrlModalOpen] = useState<boolean>(false);
  const [mobileFullscreenUrl, setMobileFullscreenUrl] = useState<string | null>(null);
  const [isBeforeAfterPressed, setIsBeforeAfterPressed] = useState<boolean>(false);
  const [canvasFeedbackPill, setCanvasFeedbackPill] = useState<string | null>(null);
  const [outlineLayerId, setOutlineLayerId] = useState<string | null>(null);
  const outlineTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileViewportSize, setMobileViewportSize] = useState<{ width: number; height: number }>(() =>
    typeof window !== 'undefined'
      ? {
          width: window.visualViewport?.width ?? window.innerWidth,
          height: window.visualViewport?.height ?? window.innerHeight,
        }
      : { width: 390, height: 844 }
  );
  const [isMobileSheetInputFocused, setIsMobileSheetInputFocused] = useState<boolean>(false);
  const initialMobileHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 844
  );

  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [canvasZoomMode, setCanvasZoomMode] = useState<'fit' | 'custom'>('fit');
  const [canvasZoomPercent, setCanvasZoomPercent] = useState<number>(100);
  const [stagePanX, setStagePanX] = useState<number>(0);
  const [stagePanY, setStagePanY] = useState<number>(0);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isHandMode, setIsHandMode] = useState<boolean>(false);
  const [isPanningStage, setIsPanningStage] = useState<boolean>(false);
  const stageMainRef = useRef<HTMLElement | null>(null);
  const [stageRect, setStageRect] = useState<{ width: number; height: number }>({
    width: 390,
    height: 420,
  });
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
    target: 'stage' | 'photo';
    initialDist: number;
    initialZoom: number;
  }>({
    active: false,
    target: 'stage',
    initialDist: 0,
    initialZoom: 100,
  });
  const lastCanvasTapRef = useRef<number>(0);

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
  const [renderHeadline, setRenderHeadline] = useState(initialDefaults.headline);
  const [headlineAlignOverride, setHeadlineAlignOverride] = useState<
    'left' | 'center' | 'right' | undefined
  >(undefined);
  const [highlights, setHighlights] = useState<HighlightRange[]>(initialDefaults.highlights);
  const [selectionHint, setSelectionHint] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [highlightTab, setHighlightTab] = useState<'words' | 'manual'>('words');

  const [lineMode, setLineMode] = useState<LineMode>('auto');
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [lineGapPercent, setLineGapPercent] = useState<number>(92);
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<string>(
    () => initialDefaults.selectedFontId || 'kalpurush'
  );
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const [textOffsetX, setTextOffsetX] = useState<number>(0);
  const [textOffsetY, setTextOffsetY] = useState<number>(0);
  const [textShadow, setTextShadow] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>(initialRouteTemplate.defaultTextColor);
  const [highlightColor, setHighlightColor] = useState<string>(
    initialRouteTemplate.defaultHighlightColor
  );

  const [photoSrc, setPhotoSrc] = useState<string>(initialDefaults.photoSrc);
  const [photoDeleted, setPhotoDeleted] = useState<boolean>(false);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [defaultPhotoImg, setDefaultPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [photoPanX, setPhotoPanX] = useState<number>(0);
  const [photoPanY, setPhotoPanY] = useState<number>(0);

  const [quoteSettings, setQuoteSettings] = useState<QuoteCardSettings>(() =>
    getDefaultQuoteSettings(initialRouteTemplate, initialDefaults.quoteSettings)
  );
  const [secondaryPhotoImg, setSecondaryPhotoImg] = useState<HTMLImageElement | null>(null);

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
  const [extraImages, setExtraImages] = useState<ExtraImageLayer[]>([]);
  const [extraImageEls, setExtraImageEls] = useState<Record<string, HTMLImageElement>>({});
  const [layerOrder, setLayerOrder] = useState<string[] | undefined>(undefined);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const [layerLocks, setLayerLocks] = useState<Record<string, boolean>>({});
  const [layerNames, setLayerNames] = useState<Record<string, string>>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string>('headline');
  const [isStageDragOver, setIsStageDragOver] = useState<boolean>(false);
  const stageDragDepthRef = useRef<number>(0);

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
  const secondaryPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const extraImageInputRef = useRef<HTMLInputElement | null>(null);
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
    mode: 'none' | 'text' | 'photo' | 'logo' | 'subheading' | 'custom-text' | 'extra-image';
    customTextId: string | null;
    extraImageId: string | null;
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
    initialExtraImgX: number;
    initialExtraImgY: number;
    moved: boolean;
  }>({
    mode: 'none',
    customTextId: null,
    extraImageId: null,
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
    initialExtraImgX: 0.5,
    initialExtraImgY: 0.5,
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

    const effectivePalette = ov?.palette
      ? {
          bgPrimary: ov.palette.bgPrimary ?? selectedTemplate.palette?.bgPrimary ?? '#0f172a',
          bgSecondary: ov.palette.bgSecondary ?? selectedTemplate.palette?.bgSecondary ?? '#1e293b',
          accent: ov.palette.accent ?? selectedTemplate.palette?.accent ?? '#ef4444',
          footerBg: ov.palette.footerBg ?? selectedTemplate.palette?.footerBg ?? '#ffffff',
          footerText: ov.palette.footerText ?? selectedTemplate.palette?.footerText ?? '#0f172a',
          badgeBg: ov.palette.badgeBg ?? selectedTemplate.palette?.badgeBg ?? '#f59e0b',
          badgeText: ov.palette.badgeText ?? selectedTemplate.palette?.badgeText ?? '#111827',
          borderColor: ov.palette.borderColor ?? selectedTemplate.palette?.borderColor ?? '#e2e8f0',
        }
      : selectedTemplate.palette;

    return {
      ...selectedTemplate,
      name: effectiveName,
      category: effectiveCategory,
      kickerText: effectiveKicker,
      footerCtaText: effectiveFooterCta,
      websiteUrl: effectiveWebsiteUrl,
      palette: effectivePalette,
    };
  }, [selectedTemplate, templateOverrides, categoryNames]);

  const dateTextOverride = templateOverrides[selectedTemplate.id]?.dateText ?? '';

  const resolvedLayerOrder = useMemo(
    () => normalizeLayerOrder(layerOrder, selectedTemplate.styleType, customTexts, extraImages),
    [layerOrder, selectedTemplate.styleType, customTexts, extraImages]
  );

  const activeExtraImageId = selectedLayerId.startsWith('image:')
    ? selectedLayerId.slice(6)
    : null;

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

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    let active = true;
    const stylePrefix = activeFont.italic ? 'italic ' : '';
    const weight = activeFont.weight ?? 600;
    document.fonts
      .load(`${stylePrefix}${weight} 48px ${activeFont.family}`, headline.slice(0, 12) || 'বাংলা')
      .then(() => {
        if (active) setFontsLoadedTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeFont, headline]);

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
    const secSrc = quoteSettings.secondaryPhotoSrc;
    if (!secSrc) {
      setSecondaryPhotoImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setSecondaryPhotoImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setSecondaryPhotoImg(null);
    };
    img.src = secSrc;
    return () => {
      cancelled = true;
    };
  }, [quoteSettings.secondaryPhotoSrc]);

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

  useEffect(() => {
    let cancelled = false;
    const defPhoto = new Image();
    defPhoto.crossOrigin = 'anonymous';
    defPhoto.onload = () => {
      if (!cancelled) setDefaultPhotoImg(defPhoto);
    };
    defPhoto.src = getTemplateDefaultPhotoSrc(selectedTemplate);
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate]);

  // Track mobile viewport dimensions, visualViewport keyboard resize, and stage box via ResizeObserver
  useEffect(() => {
    const syncViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileViewport(mobile);
      const vv = window.visualViewport;
      const w = Math.round(vv?.width ?? window.innerWidth);
      const h = Math.round(vv?.height ?? window.innerHeight);
      if (mobile && h > initialMobileHeightRef.current) {
        initialMobileHeightRef.current = h;
      }
      setMobileViewportSize({ width: w, height: h });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);

    const onFocusChange = () => {
      const el = document.activeElement as HTMLElement | null;
      const insideSheet = Boolean(
        el &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') &&
          el.closest('section[aria-label="মোবাইল এডিটর সেটিংস"]')
      );
      setIsMobileSheetInputFocused(insideSheet);
    };
    const onFocusOut = () => {
      window.setTimeout(onFocusChange, 40);
    };
    window.addEventListener('focusin', onFocusChange);
    window.addEventListener('focusout', onFocusOut);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('focusin', onFocusChange);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    const el = stageMainRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setStageRect({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounce headline typing (~100ms) to keep typing responsive on mobile without blocking on 2000px canvas redraws
  useEffect(() => {
    if (headline === renderHeadline) return;
    const timer = window.setTimeout(() => {
      setRenderHeadline(headline);
    }, 95);
    return () => window.clearTimeout(timer);
  }, [headline, renderHeadline]);

  const triggerMobileFeedback = useCallback((message: string, layerId?: string) => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setCanvasFeedbackPill(message);
    feedbackTimerRef.current = window.setTimeout(() => {
      setCanvasFeedbackPill(null);
    }, 1800);

    if (layerId) {
      if (outlineTimerRef.current) window.clearTimeout(outlineTimerRef.current);
      setOutlineLayerId(layerId);
      outlineTimerRef.current = window.setTimeout(() => {
        setOutlineLayerId(null);
      }, 600);
    }
  }, []);

  const flashOutlineLayer = useCallback((layerId: string) => {
    if (outlineTimerRef.current) window.clearTimeout(outlineTimerRef.current);
    setOutlineLayerId(layerId);
    outlineTimerRef.current = window.setTimeout(() => {
      setOutlineLayerId(null);
    }, 600);
  }, []);

  // Preload extra image layers
  useEffect(() => {
    let cancelled = false;
    for (const item of extraImages) {
      const existing = extraImageEls[item.id];
      if (existing && existing.src === item.dataUrl) continue;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) {
          setExtraImageEls((prev) => ({ ...prev, [item.id]: img }));
        }
      };
      img.src = item.dataUrl;
    }
    return () => {
      cancelled = true;
    };
  }, [extraImages]); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (isQuoteStyleType(nextTpl.styleType)) {
        const nextQuoteDefaults = getDefaultQuoteSettings(nextTpl);
        setQuoteSettings((prev) => ({
          ...nextQuoteDefaults,
          secondaryPhotoSrc:
            prev.secondaryPhotoSrc.startsWith('data:') ||
            prev.secondaryPhotoSrc.startsWith('blob:')
              ? prev.secondaryPhotoSrc
              : nextQuoteDefaults.secondaryPhotoSrc,
        }));
        if (nextTpl.defaultQuote?.fontId) {
          setSelectedFontId(nextTpl.defaultQuote.fontId);
        }
      }

      if (!photoDeleted && ALL_BUILTIN_DEFAULT_PHOTO_SRCS.has(photoSrc)) {
        setPhotoSrc(getTemplateDefaultPhotoSrc(nextTpl));
        setPhotoZoom(1);
        setPhotoPanX(0);
        setPhotoPanY(0);
      }

      if (!newsUrl.trim()) {
        const isCurrentDefaultSample =
          !headline.trim() ||
          headline === 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ' ||
          headline === 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস' ||
          ALL_TEMPLATES.some((t) => t.defaultQuote?.headline === headline);

        if (nextTpl.defaultQuote && isCurrentDefaultSample) {
          setHeadline(nextTpl.defaultQuote.headline);
          setRenderHeadline(nextTpl.defaultQuote.headline);
          setHighlights(nextTpl.defaultQuote.highlights ?? []);
          setHeadlineAlignOverride(undefined);
          setTextOffsetX(0);
          setTextOffsetY(0);
        } else if (
          nextTpl.id === PSD_MAROON_TEMPLATE.id &&
          isCurrentDefaultSample
        ) {
          setHeadline('নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস');
          setRenderHeadline('নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস');
          setHighlights([{ id: 'sample-hl-2', start: 29, end: 40, text: 'একটি ইতিহাস' }]);
          setPhotoSrc(getTemplateDefaultPhotoSrc(nextTpl));
          setPhotoDeleted(false);
          setPhotoZoom(1);
          setPhotoPanX(0);
          setPhotoPanY(0);
          setTextOffsetX(0);
          setTextOffsetY(0);
        } else if (
          nextTpl.id === PSD_GREEN_TEMPLATE.id &&
          isCurrentDefaultSample
        ) {
          setHeadline('ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ');
          setRenderHeadline('ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ');
          setHighlights([{ id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' }]);
          setPhotoSrc(getTemplateDefaultPhotoSrc(nextTpl));
          setPhotoDeleted(false);
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
    headlineAlignOverride?: 'left' | 'center' | 'right';
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
    photoDeleted: boolean;
    photoZoom: number;
    photoPanX: number;
    photoPanY: number;
    logoSettings: LogoSettings;
    subheading: SubheadingSettings;
    customTexts: CustomTextItem[];
    extraImages: ExtraImageLayer[];
    layerOrder: string[] | undefined;
    layerVisibility: Record<string, boolean>;
    layerOpacity: Record<string, number>;
    layerLocks: Record<string, boolean>;
    layerNames: Record<string, string>;
    templateOverrides: Record<string, TemplateOverride>;
    quoteSettings: QuoteCardSettings;
  };

  const currentUndoable = useMemo<UndoableState>(
    () => ({
      newsUrl,
      selectedTemplate,
      headline,
      headlineAlignOverride,
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
      photoDeleted,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      subheading,
      customTexts,
      extraImages,
      layerOrder,
      layerVisibility,
      layerOpacity,
      layerLocks,
      layerNames,
      templateOverrides,
      quoteSettings,
    }),
    [
      newsUrl,
      selectedTemplate,
      headline,
      headlineAlignOverride,
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
      photoDeleted,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      subheading,
      customTexts,
      extraImages,
      layerOrder,
      layerVisibility,
      layerOpacity,
      layerLocks,
      layerNames,
      templateOverrides,
      quoteSettings,
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
    a.headlineAlignOverride === b.headlineAlignOverride &&
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
    a.photoDeleted === b.photoDeleted &&
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
    JSON.stringify(a.extraImages) === JSON.stringify(b.extraImages) &&
    JSON.stringify(a.layerOrder) === JSON.stringify(b.layerOrder) &&
    JSON.stringify(a.layerVisibility) === JSON.stringify(b.layerVisibility) &&
    JSON.stringify(a.layerOpacity) === JSON.stringify(b.layerOpacity) &&
    JSON.stringify(a.layerLocks) === JSON.stringify(b.layerLocks) &&
    JSON.stringify(a.layerNames) === JSON.stringify(b.layerNames) &&
    JSON.stringify(a.highlights) === JSON.stringify(b.highlights) &&
    JSON.stringify(a.templateOverrides) === JSON.stringify(b.templateOverrides) &&
    JSON.stringify(a.quoteSettings) === JSON.stringify(b.quoteSettings);

  const applyUndoableSnapshot = useCallback((snap: UndoableState) => {
    isApplyingHistoryRef.current = true;
    committedUndoableRef.current = snap;
    lastFetchedUrlRef.current = snap.newsUrl.trim();
    setExtractError(null);
    setNewsUrl(snap.newsUrl);
    setSelectedTemplate(snap.selectedTemplate);
    setHeadline(snap.headline);
    setRenderHeadline(snap.headline);
    setHeadlineAlignOverride(snap.headlineAlignOverride);
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
    setPhotoDeleted(snap.photoDeleted);
    setPhotoZoom(snap.photoZoom);
    setPhotoPanX(snap.photoPanX);
    setPhotoPanY(snap.photoPanY);
    setLogoSettings(snap.logoSettings);
    setSubheading(snap.subheading);
    setCustomTexts(snap.customTexts);
    setExtraImages(snap.extraImages);
    setLayerOrder(snap.layerOrder);
    setLayerVisibility(snap.layerVisibility);
    setLayerOpacity(snap.layerOpacity);
    setLayerLocks(snap.layerLocks);
    setLayerNames(snap.layerNames || {});
    setTemplateOverrides(snap.templateOverrides);
    setQuoteSettings(snap.quoteSettings);
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
          setPhotoDeleted(false);
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
      setRenderHeadline(st.headline);
      setHeadlineAlignOverride(st.headlineAlignOverride);
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
      const deletedFlag = Boolean(st.photoDeleted);
      setPhotoDeleted(deletedFlag);
      setPhotoSrc(deletedFlag ? '' : st.photoSrc || getTemplateDefaultPhotoSrc(resolvedTpl));
      setPhotoZoom(st.photoZoom ?? 1);
      setPhotoPanX(st.photoPanX ?? 0);
      setPhotoPanY(st.photoPanY ?? 0);
      setLogoSettings(st.logoSettings || initialDefaults.logoSettings);
      setSubheading(st.subheading || DEFAULT_SUBHEADING);
      setCustomTexts(st.customTexts || []);
      setExtraImages(st.extraImages || []);
      setLayerOrder(st.layerOrder);
      setLayerVisibility(st.layerVisibility || {});
      setLayerOpacity(st.layerOpacity || {});
      setLayerLocks(st.layerLocks || {});
      setLayerNames(st.layerNames || {});
      setExportFormat(st.exportFormat || 'png');
      setExportQuality(st.exportQuality ?? 96);
      setQuoteSettings(getDefaultQuoteSettings(resolvedTpl, st.quoteSettings));
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
    const nextQuoteDef = selectedTemplate.defaultQuote;
    const nextHeadline = nextQuoteDef
      ? nextQuoteDef.headline
      : isMaroon
        ? 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস'
        : 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ';
    setHeadline(nextHeadline);
    setRenderHeadline(nextHeadline);
    setHeadlineAlignOverride(undefined);
    if (!hasCustomNameRef.current) {
      setProjectName(defaultProjectName(nextHeadline));
    }
    setHighlights(
      nextQuoteDef
        ? nextQuoteDef.highlights ?? []
        : isMaroon
          ? [{ id: 'sample-hl-2', start: 29, end: 40, text: 'একটি ইতিহাস' }]
          : [{ id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' }]
    );
    if (isQuoteStyleType(selectedTemplate.styleType)) {
      setQuoteSettings(getDefaultQuoteSettings(selectedTemplate));
      if (nextQuoteDef?.fontId) {
        setSelectedFontId(nextQuoteDef.fontId);
      }
    }
    setPhotoSrc(getTemplateDefaultPhotoSrc(selectedTemplate));
    setPhotoDeleted(false);
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
    setExtraImages([]);
    setLayerOrder(undefined);
    setLayerVisibility({});
    setLayerOpacity({});
    setLayerLocks({});
    setLayerNames({});
    setSelectedLayerId('headline');
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
      headlineAlignOverride,
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
      photoDeleted,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      subheading,
      customTexts,
      extraImages,
      layerOrder,
      layerVisibility,
      layerOpacity,
      layerLocks,
      layerNames,
      exportFormat,
      exportQuality,
      templateOverrides: templateOverrides[selectedTemplate.id]
        ? { [selectedTemplate.id]: templateOverrides[selectedTemplate.id] }
        : {},
      quoteSettings,
    }),
    [
      newsUrl,
      selectedTemplate,
      headline,
      headlineAlignOverride,
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
      photoDeleted,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      subheading,
      customTexts,
      extraImages,
      layerOrder,
      layerVisibility,
      layerOpacity,
      layerLocks,
      layerNames,
      exportFormat,
      exportQuality,
      templateOverrides,
      quoteSettings,
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

  // Render Canvas Preview (rAF-scheduled, debounced headline, supports Before/After compare & active layer outline flash)
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rafId = window.requestAnimationFrame(() => {
      if (canvas.width !== effectiveTemplate.canvasWidth) {
        canvas.width = effectiveTemplate.canvasWidth;
      }
      if (canvas.height !== effectiveTemplate.canvasHeight) {
        canvas.height = effectiveTemplate.canvasHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isBeforeAfterPressed) {
        renderNewsCard({
          ctx,
          template: selectedTemplate,
          overlayImg,
          photoImg: defaultPhotoImg ?? photoImg,
          logoImg: null,
          officialLogoImg,
          headline: initialDefaults.headline,
          highlights: initialDefaults.highlights,
          lineMode: 'auto',
          fontSizePercent: 100,
          lineGapPercent: 92,
          font: BUILTIN_FONTS[0],
          textOffsetX: 0,
          textOffsetY: 0,
          textShadow: false,
          textColor: selectedTemplate.defaultTextColor,
          highlightColor: selectedTemplate.defaultHighlightColor,
          photoZoom: 1,
          photoPanX: 0,
          photoPanY: 0,
          logoSettings: initialDefaults.logoSettings,
          subheading: DEFAULT_SUBHEADING,
          customTexts: [],
          extraImages: [],
          extraImageEls: {},
          layerVisibility: {},
          layerOpacity: {},
          dateTextOverride: '',
          isExport: false,
        });
        return;
      }

      const metrics = renderNewsCard({
        ctx,
        template: effectiveTemplate,
        overlayImg,
        photoImg,
        logoImg,
        officialLogoImg,
        headline: renderHeadline,
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
        headlineAlignOverride,
        photoZoom,
        photoPanX,
        photoPanY,
        logoSettings,
        subheading,
        customTexts,
        activeCustomTextId,
        extraImages,
        extraImageEls,
        activeExtraImageId,
        layerOrder: resolvedLayerOrder,
        layerVisibility,
        layerOpacity,
        dateTextOverride,
        isExport: false,
        snapState,
        outlineLayerId,
        photoDeleted,
        quoteSettings,
        secondaryPhotoImg,
      });

      layoutMetricsRef.current = metrics;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [
    effectiveTemplate,
    selectedTemplate,
    initialDefaults,
    defaultPhotoImg,
    isBeforeAfterPressed,
    overlayImg,
    photoImg,
    photoDeleted,
    quoteSettings,
    secondaryPhotoImg,
    logoImg,
    officialLogoImg,
    renderHeadline,
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
    headlineAlignOverride,
    photoZoom,
    photoPanX,
    photoPanY,
    logoSettings,
    subheading,
    customTexts,
    activeCustomTextId,
    extraImages,
    extraImageEls,
    activeExtraImageId,
    resolvedLayerOrder,
    layerVisibility,
    layerOpacity,
    dateTextOverride,
    snapState,
    outlineLayerId,
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
        setPhotoDeleted(false);
        setPhotoSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSecondaryPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        commitHistoryNow();
        setQuoteSettings((prev) => ({
          ...prev,
          secondaryPhotoSrc: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = () => {
    commitHistoryNow();
    setPhotoSrc('');
    setPhotoImg(null);
    setPhotoDeleted(true);
    setPhotoZoom(1);
    setPhotoPanX(0);
    setPhotoPanY(0);
    showToast('মূল ছবি মুছে ফেলা হয়েছে ✓', 'success');
  };

  // Add Extra Image Layer (used by Drag & Drop, Paste Ctrl+V, and Layers Tab "+ ছবি লেয়ার")
  const addExtraImageFromBlob = useCallback(
    (blob: Blob, nameHint?: string, dropPoint?: { x: number; y: number }) => {
      if (blob.size > 25 * 1024 * 1024) {
        showToast('ছবিটি ২৫ মেগাবাইটের চেয়ে বড়, ছোট ছবি দিন', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const rawUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const nw = img.naturalWidth || 800;
          const nh = img.naturalHeight || 800;
          const maxDim = 1600;
          let finalDataUrl = rawUrl;

          if (nw > maxDim || nh > maxDim) {
            const scale = maxDim / Math.max(nw, nh);
            const tw = Math.max(1, Math.round(nw * scale));
            const th = Math.max(1, Math.round(nh * scale));
            const c = document.createElement('canvas');
            c.width = tw;
            c.height = th;
            const cctx = c.getContext('2d');
            if (cctx) {
              cctx.drawImage(img, 0, 0, tw, th);
              const isPngOrWebp = /png|webp|svg/i.test(blob.type);
              finalDataUrl = isPngOrWebp
                ? c.toDataURL('image/png')
                : c.toDataURL('image/jpeg', 0.9);
            }
          }

          commitHistoryNow();
          const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const count = extraImages.length + 1;
          const cleanName =
            nameHint?.replace(/\.[^/.]+$/, '').trim().slice(0, 28) ||
            `ছবি লেয়ার ${toBengaliDigits(count)}`;
          const newLayer: ExtraImageLayer = {
            id,
            name: cleanName,
            dataUrl: finalDataUrl,
            x: dropPoint ? Math.max(0.12, Math.min(0.88, dropPoint.x)) : 0.5,
            y: dropPoint ? Math.max(0.12, Math.min(0.88, dropPoint.y)) : 0.48,
            widthPercent: 42,
            aspectRatio: nw / Math.max(1, nh),
            rotation: 0,
            opacity: 100,
            borderRadius: 0,
            borderWidth: 0,
            borderColor: '#ffffff',
            shadow: false,
          };

          setExtraImages((prev) => [...prev, newLayer]);
          setLayerOrder((prev) => [
            ...normalizeLayerOrder(prev, selectedTemplate.styleType, customTexts, extraImages),
            `image:${id}`,
          ]);
          setSelectedLayerId(`image:${id}`);
          setActiveCustomTextId(null);
          setDesktopTab('layers');
          showToast(`"${cleanName}" লেয়ার হিসেবে যোগ হয়েছে ✓`, 'success');
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(blob);
    },
    [commitHistoryNow, customTexts, extraImages, selectedTemplate.styleType, showToast]
  );

  const handleExtraImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        addExtraImageFromBlob(file, file.name);
      }
    });
    e.target.value = '';
  };

  // Global Paste Image Listener (works whenever editor panel / canvas is clicked & Ctrl+V pressed)
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

    const onWindowPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      const cd = e.clipboardData;
      if (!cd) return;

      let handled = false;
      if (cd.items) {
        for (let i = 0; i < cd.items.length; i++) {
          const item = cd.items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              addExtraImageFromBlob(file, 'পেস্ট করা ছবি');
              handled = true;
              break;
            }
          }
        }
      }
      if (!handled && cd.files && cd.files.length > 0) {
        const imgFile = Array.from(cd.files).find((f) => f.type.startsWith('image/'));
        if (imgFile) {
          e.preventDefault();
          addExtraImageFromBlob(imgFile, imgFile.name || 'পেস্ট করা ছবি');
        }
      }
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [addExtraImageFromBlob]);

  const handlePasteFromClipboardButton = useCallback(async () => {
    stageMainRef.current?.focus({ preventScroll: true });
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      showToast('কীবোর্ডে Ctrl + V চেপে কপি করা ছবি পেস্ট করুন', 'info');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          addExtraImageFromBlob(blob, 'পেস্ট করা ছবি');
          return;
        }
      }
      showToast('ক্লিপবোর্ডে কোনো ছবি পাওয়া যায়নি। আগে একটি ছবি কপি করুন।', 'warning');
    } catch {
      showToast('কীবোর্ডে Ctrl + V চেপে কপি করা ছবি পেস্ট করুন', 'info');
    }
  }, [addExtraImageFromBlob, showToast]);

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

    let mode:
      | 'none'
      | 'text'
      | 'photo'
      | 'logo'
      | 'subheading'
      | 'custom-text'
      | 'extra-image' = 'none';
    let hitCustomId: string | null = null;
    let hitCustomItem: CustomTextItem | undefined;
    let hitExtraImageId: string | null = null;
    let hitExtraImageItem: ExtraImageLayer | undefined;
    let hitLayerId: string | null = null;

    // Hit test layers strictly from top-most visible layer downwards
    for (let i = resolvedLayerOrder.length - 1; i >= 0; i--) {
      const lid = resolvedLayerOrder[i];
      if (layerVisibility[lid] === false) continue;

      if (lid.startsWith('image:')) {
        const imgId = lid.slice(6);
        const entry = metrics.extraImageHitBoxes.find((e) => e.id === imgId);
        if (entry && pointInRect(pt.x, pt.y, entry.box)) {
          hitExtraImageId = imgId;
          hitExtraImageItem = extraImages.find((x) => x.id === imgId);
          hitLayerId = lid;
          mode = 'extra-image';
          break;
        }
      } else if (lid.startsWith('text:')) {
        const txtId = lid.slice(5);
        const entry = metrics.customTextHitBoxes.find((e) => e.id === txtId);
        if (entry && pointInRect(pt.x, pt.y, entry.box)) {
          hitCustomId = txtId;
          hitCustomItem = customTexts.find((c) => c.id === txtId);
          hitLayerId = lid;
          mode = 'custom-text';
          break;
        }
      } else if (lid === 'subheading' && metrics.subheadingHitBox && pointInRect(pt.x, pt.y, metrics.subheadingHitBox)) {
        hitLayerId = 'subheading';
        mode = 'subheading';
        break;
      } else if (lid === 'logo' && metrics.logoHitBox && pointInRect(pt.x, pt.y, metrics.logoHitBox)) {
        hitLayerId = 'logo';
        mode = 'logo';
        break;
      } else if (lid === 'headline' && headline.trim() && pointInRect(pt.x, pt.y, metrics.textHitBox)) {
        hitLayerId = 'headline';
        mode = 'text';
        break;
      } else if (lid === 'photo' && pointInRect(pt.x, pt.y, metrics.photoHitBox)) {
        hitLayerId = 'photo';
        mode = 'photo';
        break;
      }
    }

    if (mode === 'none' && headline.trim() && layerVisibility['headline'] !== false) {
      hitLayerId = 'headline';
      mode = 'text';
    } else if (mode === 'none' && photoImg && layerVisibility['photo'] !== false) {
      hitLayerId = 'photo';
      mode = 'photo';
    }

    if (hitLayerId) {
      setSelectedLayerId(hitLayerId);
    }

    if (mode === 'custom-text' && hitCustomId) {
      setActiveCustomTextId(hitCustomId);
    } else {
      setActiveCustomTextId(null);
    }

    if (mode === 'none') return;

    if (hitLayerId && layerLocks[hitLayerId]) {
      showToast('এই লেয়ারটি লক করা আছে (লেয়ার মেনু থেকে আনলক করুন)', 'info', 2200);
      return;
    }

    dragRef.current = {
      mode,
      customTextId: hitCustomId,
      extraImageId: hitExtraImageId,
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
      initialExtraImgX: hitExtraImageItem?.x ?? 0.5,
      initialExtraImgY: hitExtraImageItem?.y ?? 0.5,
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
    } else if (st.mode === 'extra-image' && st.extraImageId) {
      const nextX = Math.max(0.02, Math.min(0.98, st.initialExtraImgX + dxNorm));
      const nextY = Math.max(0.02, Math.min(0.98, st.initialExtraImgY + dyNorm));
      const targetId = st.extraImageId;
      setExtraImages((prev) =>
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
  const handleDownloadCard = (alsoNotifySave = false) => {
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
      headlineAlignOverride,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings,
      subheading,
      customTexts,
      extraImages,
      extraImageEls,
      layerOrder: resolvedLayerOrder,
      layerVisibility,
      layerOpacity,
      dateTextOverride,
      isExport: true,
      photoDeleted,
      quoteSettings,
      secondaryPhotoImg,
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
      if (alsoNotifySave) {
        performSaveToIndexedDB(false);
        showToast('আমার কাজ-এ সেভ হয়েছে ✓', 'success');
      } else {
        showToast('ডাউনলোড হয়েছে ✓', 'success');
      }
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

  const isMobileKeyboardOpen =
    isMobileViewport &&
    isMobileSheetInputFocused &&
    (mobileViewportSize.height < initialMobileHeightRef.current * 0.8 ||
      mobileViewportSize.height < 580);

  const mobileFitWidth = useMemo(() => {
    const availW = Math.max(120, stageRect.width - 24);
    const availH = Math.max(120, stageRect.height - 16);
    const ratio =
      effectiveTemplate.canvasWidth / Math.max(1, effectiveTemplate.canvasHeight);
    return Math.max(120, Math.min(availW, Math.round(availH * ratio)));
  }, [stageRect.width, stageRect.height, effectiveTemplate.canvasWidth, effectiveTemplate.canvasHeight]);

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
      if (isMobileViewport) {
        setMobileSheetSnap('collapsed');
      }
    },
    onAddDirectCustomText: () => {
      setPendingPencilPoint({ x: 0.5, y: 0.2 });
      setPendingPencilText('');
      if (isMobileViewport) {
        setMobileSheetSnap('collapsed');
      }
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
      setHeadlineAlignOverride(undefined);
      setTextOffsetX(0);
      setTextOffsetY(0);
      setTextShadow(false);
      setTextColor(selectedTemplate.defaultTextColor);
      setHighlightColor(selectedTemplate.defaultHighlightColor);
    },
    onTriggerPhotoUpload: () => photoInputRef.current?.click(),
    photoDeleted,
    onDeletePhoto: handleDeletePhoto,
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
      setPhotoDeleted(false);
      setPhotoSrc(getTemplateDefaultPhotoSrc(selectedTemplate));
    },
    quoteSettings,
    onChangeQuoteSettings: setQuoteSettings,
    onResetQuoteSettings: () => {
      setQuoteSettings(getDefaultQuoteSettings(selectedTemplate));
    },
    onTriggerSecondaryPhotoUpload: () => secondaryPhotoInputRef.current?.click(),
    onDeleteSecondaryPhoto: () => {
      commitHistoryNow();
      setQuoteSettings((prev) => ({ ...prev, secondaryPhotoSrc: '' }));
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
    onDownload: () => handleDownloadCard(false),
    downloadDone,
    // Layers Controls
    resolvedLayerOrder,
    selectedLayerId,
    onSelectLayer: (layerId: string) => {
      setSelectedLayerId(layerId);
      flashOutlineLayer(layerId);
      if (layerId.startsWith('text:')) {
        setActiveCustomTextId(layerId.slice(5));
      } else {
        setActiveCustomTextId(null);
      }
    },
    layerVisibility,
    onToggleLayerVisibility: (layerId: string) => {
      commitHistoryNow();
      setLayerVisibility((prev) => ({
        ...prev,
        [layerId]: prev[layerId] === false,
      }));
    },
    layerOpacity,
    onChangeLayerOpacity: (layerId: string, opacity: number) => {
      setLayerOpacity((prev) => ({
        ...prev,
        [layerId]: Math.max(0, Math.min(100, opacity)),
      }));
    },
    layerLocks,
    onToggleLayerLock: (layerId: string) => {
      setLayerLocks((prev) => ({
        ...prev,
        [layerId]: !prev[layerId],
      }));
    },
    onMoveLayerStep: (layerId: string, direction: 'up' | 'down') => {
      commitHistoryNow();
      setLayerOrder((prev) => {
        const base = normalizeLayerOrder(
          prev,
          selectedTemplate.styleType,
          customTexts,
          extraImages
        );
        return moveLayerStepHelper(base, layerId, direction);
      });
    },
    onReorderVisualLayers: (fromVisualIdx: number, toVisualIdx: number) => {
      commitHistoryNow();
      setLayerOrder((prev) => {
        const base = normalizeLayerOrder(
          prev,
          selectedTemplate.styleType,
          customTexts,
          extraImages
        );
        return reorderVisualTopDown(base, fromVisualIdx, toVisualIdx);
      });
    },
    onResetLayerSystem: () => {
      commitHistoryNow();
      setLayerOrder(undefined);
      setLayerVisibility({});
      setLayerOpacity({});
      setLayerLocks({});
      setLayerNames({});
    },
    onDeleteCustomText: (id: string) => {
      commitHistoryNow();
      setCustomTexts((prev) => prev.filter((c) => c.id !== id));
      if (activeCustomTextId === id) setActiveCustomTextId(null);
      if (selectedLayerId === `text:${id}`) setSelectedLayerId('headline');
    },
    extraImages,
    onChangeExtraImages: setExtraImages,
    onDeleteExtraImage: (id: string) => {
      commitHistoryNow();
      setExtraImages((prev) => prev.filter((img) => img.id !== id));
      if (selectedLayerId === `image:${id}`) setSelectedLayerId('headline');
    },
    onTriggerAddExtraImage: () => extraImageInputRef.current?.click(),
    onPromoteExtraImageToMain: (id: string) => {
      const target = extraImages.find((img) => img.id === id);
      if (!target) return;
      commitHistoryNow();
      setPhotoZoom(1);
      setPhotoPanX(0);
      setPhotoPanY(0);
      setPhotoSrc(target.dataUrl);
      setPhotoDeleted(false);
      setExtraImages((prev) => prev.filter((img) => img.id !== id));
      setSelectedLayerId('photo');
      showToast('ছবিটি মূল ছবি হিসেবে সেট করা হয়েছে ✓', 'success');
    },
    dateText: dateTextOverride,
    onSwitchToTemplateTab: () => {
      setDesktopTab('template');
      setMobileSheetTab('template');
      setMobileSheetSnap('default');
    },
  };

  const aspectRatioStyle = `${effectiveTemplate.canvasWidth} / ${effectiveTemplate.canvasHeight}`;

  return (
    <div
      style={isMobileViewport ? { height: `${mobileViewportSize.height}px` } : undefined}
      className="bg-[#F7F8FA] text-[#0F172A] max-md:grid max-md:w-full max-md:max-w-full max-md:grid-cols-[minmax(0,1fr)] max-md:grid-rows-[auto_minmax(120px,1fr)_auto_auto] max-md:overflow-hidden md:flex md:h-screen md:flex-col md:overflow-hidden dark:bg-[#0B0F19] dark:text-slate-100"
    >
      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={secondaryPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleSecondaryPhotoUpload}
        className="hidden"
      />
      <input
        ref={extraImageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleExtraImageUpload}
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
      <div className="max-md:order-1 max-md:min-w-0 max-md:w-full">
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
          onDownload={() => handleDownloadCard(false)}
          downloadDone={downloadDone}
          onUndo={performUndo}
          onRedo={performRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenMobileUrlModal={() => setMobileUrlModalOpen(true)}
        />
      </div>

      {/* Main 3-Zone Workspace (on mobile uses display:contents so children sit directly in 100dvh grid rows) */}
      <div className="max-md:contents md:flex md:min-h-0 md:flex-1 md:flex-row">
        {/* Desktop Left Rail & Mobile Bottom Tab Bar */}
        <div className="max-md:order-4 max-md:min-w-0 max-md:w-full md:flex md:shrink-0">
          <EditorSidebar
            activeTab={desktopTab}
            mobileActiveTab={mobileSheetTab}
            hiddenOnMobileKeyboard={isMobileKeyboardOpen}
            onSelectTab={(tab) => {
              setDesktopTab(tab);
              setShowMobileHint(false);
              setMobileSheetTab((prev) => {
                if (prev === tab) {
                  if (mobileSheetSnap === 'collapsed') {
                    setMobileSheetSnap('default');
                    return tab;
                  }
                  return null;
                }
                setMobileSheetSnap('default');
                return tab;
              });
            }}
            onShowShortcuts={() => setShowShortcutsModal(true)}
          />
        </div>

        {/* Center Dotted Canvas Stage */}
        <main
          ref={stageMainRef}
          tabIndex={-1}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              stageDragDepthRef.current += 1;
              setIsStageDragOver(true);
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (!isStageDragOver) setIsStageDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              stageDragDepthRef.current = Math.max(0, stageDragDepthRef.current - 1);
              if (stageDragDepthRef.current === 0 || !e.currentTarget.contains(e.relatedTarget as Node)) {
                stageDragDepthRef.current = 0;
                setIsStageDragOver(false);
              }
            }
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
            e.preventDefault();
            stageDragDepthRef.current = 0;
            setIsStageDragOver(false);
            const canvas = previewCanvasRef.current;
            let dropPoint: { x: number; y: number } | undefined;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              ) {
                dropPoint = {
                  x: (e.clientX - rect.left) / Math.max(1, rect.width),
                  y: (e.clientY - rect.top) / Math.max(1, rect.height),
                };
              }
            }
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith('image/')
            );
            if (files.length === 0) {
              showToast('শুধুমাত্র ছবি ফাইল ড্রপ করুন', 'warning');
              return;
            }
            files.forEach((f, idx) => {
              const offsetPt = dropPoint
                ? { x: Math.min(0.88, dropPoint.x + idx * 0.04), y: Math.min(0.88, dropPoint.y + idx * 0.04) }
                : undefined;
              addExtraImageFromBlob(f, f.name, offsetPt);
            });
          }}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement | null;
            if (
              !target?.closest('input, textarea, select, form') &&
              stageMainRef.current
            ) {
              stageMainRef.current.focus({ preventScroll: true });
            }
            if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') {
              document.activeElement.blur();
            }
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
              const pinchPhoto = isMobileViewport && mobileSheetTab === 'photo';
              pinchRef.current = {
                active: true,
                target: pinchPhoto ? 'photo' : 'stage',
                initialDist: Math.hypot(dx, dy),
                initialZoom: pinchPhoto ? photoZoom : canvasZoomPercent,
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
                if (pinchRef.current.target === 'photo') {
                  const nextPhotoZoom = Math.max(
                    0.5,
                    Math.min(
                      2.5,
                      Number(
                        ((pinchRef.current.initialZoom * dist) / pinchRef.current.initialDist).toFixed(2)
                      )
                    )
                  );
                  setPhotoZoom(nextPhotoZoom);
                } else {
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
          className={`canvas-stage-dots relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-2 outline-none max-md:order-2 max-md:min-w-0 max-md:w-full md:p-5 ${
            isPanningStage
              ? 'cursor-grabbing select-none'
              : isSpaceHeld || isHandMode
                ? 'cursor-grab select-none'
                : ''
          }`}
        >
          {/* Drag-and-Drop Overlay */}
          {isStageDragOver && (
            <div className="pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#4F46E5] bg-[#EEF2FF]/90 backdrop-blur-xs dark:border-indigo-400 dark:bg-indigo-950/85">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F46E5] text-white shadow-lg">
                <ImagePlus className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                ছবি এখানে ছেড়ে দিন
              </p>
              <p className="text-xs font-medium text-[#4338CA] dark:text-indigo-200">
                ছবিটি সরাসরি এডিটর প্যানেলে ও লেয়ারে যোগ হয়ে যাবে
              </p>
            </div>
          )}
          {/* Desktop-Only Floating Canvas Toolbar Pill */}
          <div
            data-no-stage-wheel="true"
            onMouseDown={(e) => e.stopPropagation()}
            className="relative z-20 mb-3 hidden flex-wrap items-center justify-center gap-1 rounded-xl border border-[#E5E7EB] bg-white/95 px-2 py-1 text-xs shadow-sm backdrop-blur-xs md:flex dark:border-[#1F2937] dark:bg-[#111827]/95"
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

            <button
              type="button"
              onClick={handlePasteFromClipboardButton}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-[#0F172A] transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800"
              title="কপি করা ছবি পেস্ট করুন (ক্যানভাসে ক্লিক করে Ctrl+V)"
            >
              <ClipboardPaste className="h-3 w-3 text-[#4F46E5]" />
              <span className="hidden sm:inline">পেস্ট</span>
            </button>
          </div>

          {/* Live Canvas Wrapper (Pannable + Zoomable Stage) */}
          <div
            data-stage-area="true"
            className="relative flex min-h-0 w-full flex-1 items-center justify-center"
          >
            <div
              className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_12px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.45)] ${
                isPencilTextMode ? 'ring-2 ring-[#4F46E5]' : 'ring-1 ring-black/5 dark:ring-white/10'
              } ${
                isPanningStage || pinchRef.current.active
                  ? 'transition-none'
                  : 'transition-[width,height,box-shadow] duration-200 ease-out'
              }`}
              style={{
                aspectRatio: aspectRatioStyle,
                width:
                  canvasZoomMode === 'fit'
                    ? isMobileViewport
                      ? `${mobileFitWidth}px`
                      : 'min(100%, 520px, calc(100vh - 215px))'
                    : isMobileViewport
                      ? `${Math.round((mobileFitWidth * canvasZoomPercent) / 100)}px`
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
                  const now = Date.now();
                  if (!isPencilTextMode && now - lastCanvasTapRef.current < 260) {
                    lastCanvasTapRef.current = 0;
                    if (canvasZoomMode === 'fit') {
                      setCanvasZoomMode('custom');
                      setCanvasZoomPercent(145);
                      triggerMobileFeedback('জুম: ১৪৫%');
                    } else {
                      resetStageView();
                      triggerMobileFeedback('জুম: ফিট');
                    }
                    return;
                  }
                  lastCanvasTapRef.current = now;
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

              {/* Mobile Live Feedback Pill on Card Corner */}
              {isMobileViewport && canvasFeedbackPill && (
                <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-lg bg-[#0F172A]/88 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                  {canvasFeedbackPill}
                </div>
              )}

              {/* Mobile Before/After & Fullscreen Floating Corner Controls (44x44 targets) */}
              {isMobileViewport && !isMobileKeyboardOpen && (
                <div
                  className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 md:hidden"
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="আগে এবং পরে তুলনা"
                    title="আগে/পরে দেখুন (চেপে ধরুন)"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setIsBeforeAfterPressed(true);
                    }}
                    onPointerUp={() => setIsBeforeAfterPressed(false)}
                    onPointerLeave={() => setIsBeforeAfterPressed(false)}
                    onPointerCancel={() => setIsBeforeAfterPressed(false)}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-md backdrop-blur-xs transition-colors ${
                      isBeforeAfterPressed
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-white/92 text-[#0F172A] dark:bg-[#111827]/90 dark:text-slate-100'
                    }`}
                  >
                    <Contrast className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="ফুলস্ক্রিন প্রিভিউ"
                    title="বড় করে দেখুন"
                    onClick={(e) => {
                      e.stopPropagation();
                      const c = previewCanvasRef.current;
                      if (c) {
                        try {
                          setMobileFullscreenUrl(c.toDataURL('image/png'));
                        } catch {
                          // fallback
                        }
                      }
                    }}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/92 text-[#0F172A] shadow-md backdrop-blur-xs active:bg-slate-100 dark:bg-[#111827]/90 dark:text-slate-100"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {isPencilTextMode && (
                <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-center">
                  <span className="rounded-lg bg-[#0F172A]/90 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                    কার্ডের যেকোনো জায়গায় ক্লিক করুন — সেখানেই টেক্সট লিখবেন
                  </span>
                </div>
              )}
            </div>

            {/* First-Load One-Time Dismissible Hint on Mobile when no sheet is open */}
            {isMobileViewport && !mobileSheetTab && showMobileHint && (
              <button
                type="button"
                onClick={() => setShowMobileHint(false)}
                className="absolute bottom-2 left-1/2 z-10 min-h-[44px] -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-full bg-[#0F172A]/85 px-4 text-xs font-semibold text-white shadow-lg backdrop-blur-xs md:hidden"
              >
                নিচের টুল থেকে এডিট করুন ↓
              </button>
            )}
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
                  className="flex cursor-pointer items-center justify-center rounded p-1 text-[#64748B] hover:bg-slate-100 max-md:min-h-[44px] max-md:min-w-[44px] dark:hover:bg-gray-800"
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
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:border-[#4F46E5] focus:outline-none max-md:h-11 max-md:text-[16px] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
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
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold max-md:min-h-[44px] max-md:px-3 max-md:text-xs ${
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
                    className="swatch-picker h-6 w-7 max-md:h-11 max-md:w-11"
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
                      className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold max-md:min-h-[44px] max-md:px-3 max-md:text-xs ${
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
                  className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-semibold text-[#64748B] max-md:min-h-[44px] max-md:px-4 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={!pendingPencilText.trim()}
                  className="cursor-pointer rounded-lg bg-[#4F46E5] px-3.5 py-1.5 font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50 max-md:min-h-[44px] max-md:px-4"
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
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 text-xs font-semibold text-[#0F172A] focus:border-[#4F46E5] focus:outline-none max-md:h-11 max-md:text-[16px] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        commitHistoryNow();
                        setCustomTexts((prev) => prev.filter((c) => c.id !== activeItem.id));
                        setActiveCustomTextId(null);
                      }}
                      title="এই টেক্সট মুছুন"
                      className="flex cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-[#EF4444] hover:bg-red-100 max-md:min-h-[44px] max-md:min-w-[44px] dark:border-red-900 dark:bg-red-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCustomTextId(null)}
                      title="সিলেকশন বন্ধ"
                      className="flex cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white p-1.5 text-[#64748B] max-md:min-h-[44px] max-md:min-w-[44px] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] max-md:text-xs dark:text-slate-300">
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
                      className="swatch-picker h-6 w-7 max-md:h-11 max-md:w-11"
                      title="রং পরিবর্তন"
                    />
                  </div>
                </div>
              );
            })()}

          {/* Floating Quick Edit Bar for Selected Added Image Layer */}
          {activeExtraImageId &&
            (() => {
              const activeImg = extraImages.find((img) => img.id === activeExtraImageId);
              if (!activeImg) return null;
              return (
                <div
                  data-no-stage-wheel="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  className="relative z-20 mt-3 w-full max-w-[480px] space-y-2 rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs shadow-lg dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-[#0F172A] dark:text-slate-100">
                      {activeImg.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopTab('layers');
                          setMobileSheetTab('layers');
                        }}
                        className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-1 text-[11px] font-semibold text-[#4F46E5] hover:bg-indigo-50 max-md:min-h-[44px] max-md:px-3 max-md:text-xs dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-indigo-300"
                      >
                        সব অপশন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          commitHistoryNow();
                          setExtraImages((prev) => prev.filter((x) => x.id !== activeImg.id));
                          setSelectedLayerId('headline');
                        }}
                        title="এই ছবি লেয়ার মুছুন"
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-[#EF4444] hover:bg-red-100 max-md:min-h-[44px] max-md:min-w-[44px] dark:border-red-900 dark:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLayerId('headline')}
                        title="সিলেকশন বন্ধ"
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white p-1.5 text-[#64748B] max-md:min-h-[44px] max-md:min-w-[44px] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] max-md:text-xs dark:text-slate-300">
                      প্রস্থ
                    </span>
                    <EditableNumberBadge
                      value={Math.round(activeImg.widthPercent)}
                      min={8}
                      max={150}
                      suffix="%"
                      onChange={(widthPercent) =>
                        setExtraImages((prev) =>
                          prev.map((x) =>
                            x.id === activeImg.id ? { ...x, widthPercent } : x
                          )
                        )
                      }
                      ariaLabel="ছবি লেয়ারের প্রস্থ"
                    />
                    <div className="min-w-[100px] flex-1">
                      <RangeSlider
                        min={8}
                        max={150}
                        value={Math.round(activeImg.widthPercent)}
                        onChange={(widthPercent) =>
                          setExtraImages((prev) =>
                            prev.map((x) =>
                              x.id === activeImg.id ? { ...x, widthPercent } : x
                            )
                          )
                        }
                        ariaLabel="ছবি লেয়ারের প্রস্থ"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
        </main>

        {/* Desktop Right Control Panel (360px) — Unchanged */}
        <aside
          aria-label="এডিটর কন্ট্রোল প্যানেল"
          className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-[#E5E7EB] bg-white p-4 md:block lg:w-[360px] dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <EditorRightPanel activeTab={desktopTab} {...panelProps} />
        </aside>
      </div>

      {/* Mobile Grid-Row Bottom Sheet (<768px) */}
      <div className="max-md:order-3 max-md:min-w-0 max-md:w-full md:hidden">
        <MobileBottomSheet
          isOpen={Boolean(mobileSheetTab)}
          title={activeMobileMeta?.label || ''}
          icon={MobileTabIcon}
          snapState={mobileSheetSnap}
          onSnapChange={setMobileSheetSnap}
          onClose={() => setMobileSheetTab(null)}
          viewportHeight={mobileViewportSize.height}
          isKeyboardOpen={isMobileKeyboardOpen}
          onKeyboardDone={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            setIsMobileSheetInputFocused(false);
          }}
        >
          {mobileSheetTab === 'layers' ? (
            <MobileLayersPanel
              resolvedLayerOrder={resolvedLayerOrder}
              selectedLayerId={selectedLayerId}
              onSelectLayer={(id) => panelProps.onSelectLayer(id)}
              layerVisibility={layerVisibility}
              onToggleVisibility={panelProps.onToggleLayerVisibility}
              layerOpacity={layerOpacity}
              onChangeLayerOpacity={panelProps.onChangeLayerOpacity}
              layerLocks={layerLocks}
              onToggleLock={panelProps.onToggleLayerLock}
              layerNames={layerNames}
              onRenameLayer={(id, nextName) => {
                const trimmed = nextName.trim();
                setLayerNames((prev) => {
                  const next = { ...prev };
                  if (!trimmed) delete next[id];
                  else next[id] = trimmed;
                  return next;
                });
              }}
              onReorderVisualLayers={panelProps.onReorderVisualLayers}
              onResetLayerSystem={panelProps.onResetLayerSystem}
              effectiveTemplate={effectiveTemplate}
              selectedTemplate={selectedTemplate}
              overlayImg={overlayImg}
              photoImg={photoImg}
              logoImg={logoImg}
              officialLogoImg={officialLogoImg}
              headline={headline}
              highlights={highlights}
              lineMode={lineMode}
              fontSizePercent={fontSizePercent}
              lineGapPercent={lineGapPercent}
              activeFont={activeFont}
              allFonts={allFonts}
              textOffsetX={textOffsetX}
              textOffsetY={textOffsetY}
              textShadow={textShadow}
              textColor={textColor}
              highlightColor={highlightColor}
              headlineAlignOverride={headlineAlignOverride}
              onChangeHeadlineAlign={setHeadlineAlignOverride}
              photoZoom={photoZoom}
              photoPanX={photoPanX}
              photoPanY={photoPanY}
              logoSettings={logoSettings}
              subheading={subheading}
              customTexts={customTexts}
              extraImages={extraImages}
              extraImageEls={extraImageEls}
              dateText={dateTextOverride}
              onHeadlineChange={panelProps.onHeadlineChange}
              parsedWords={parsedWords}
              isWordHighlighted={isWordHighlighted}
              onToggleWordHighlight={handleToggleWordHighlight}
              onClearAllHighlights={panelProps.onClearAllHighlights}
              hasHighlights={highlights.length > 0}
              onChangeLineMode={setLineMode}
              onSelectFont={setSelectedFontId}
              onChangeFontSizePercent={setFontSizePercent}
              onChangeLineGapPercent={setLineGapPercent}
              onChangeTextOffset={panelProps.onChangeTextOffset}
              onChangeTextShadow={setTextShadow}
              onChangeTextColor={setTextColor}
              onChangeHighlightColor={setHighlightColor}
              onChangeSubheading={setSubheading}
              onResetSubheading={panelProps.onResetSubheading}
              onChangeCustomTexts={setCustomTexts}
              onDeleteCustomText={panelProps.onDeleteCustomText}
              onAddDirectCustomText={panelProps.onAddDirectCustomText}
              onStartPencilMode={panelProps.onStartPencilMode}
              onChangeExtraImages={setExtraImages}
              onDeleteExtraImage={panelProps.onDeleteExtraImage}
              onTriggerAddExtraImage={panelProps.onTriggerAddExtraImage}
              onPasteClipboardImage={handlePasteFromClipboardButton}
              onPromoteExtraImageToMain={panelProps.onPromoteExtraImageToMain}
              onChangePhotoZoom={setPhotoZoom}
              onChangePhotoPanX={setPhotoPanX}
              onChangePhotoPanY={setPhotoPanY}
              onTriggerPhotoUpload={panelProps.onTriggerPhotoUpload}
              onResetPhoto={panelProps.onResetPhoto}
              photoDeleted={photoDeleted}
              onDeletePhoto={handleDeletePhoto}
              quoteSettings={quoteSettings}
              onChangeQuoteSettings={setQuoteSettings}
              onResetQuoteSettings={panelProps.onResetQuoteSettings}
              onTriggerSecondaryPhotoUpload={panelProps.onTriggerSecondaryPhotoUpload}
              onDeleteSecondaryPhoto={panelProps.onDeleteSecondaryPhoto}
              secondaryPhotoImg={secondaryPhotoImg}
              onChangeLogoSettings={setLogoSettings}
              onTriggerLogoUpload={panelProps.onTriggerLogoUpload}
              onOpenLogoEditor={panelProps.onOpenLogoEditor}
              onUpdateActiveTemplateOverride={handleUpdateActiveTemplateOverride}
              onTriggerCustomFrameUpload={panelProps.onTriggerCustomFrameUpload}
              onSwitchToTemplateTab={panelProps.onSwitchToTemplateTab}
              onCommitHistory={commitHistoryNow}
              isKeyboardOpen={isMobileKeyboardOpen}
              onFeedback={triggerMobileFeedback}
            />
          ) : mobileSheetTab ? (
            <MobilePanels
              activeTab={mobileSheetTab}
              isKeyboardOpen={isMobileKeyboardOpen}
              onFeedback={triggerMobileFeedback}
              headline={headline}
              onHeadlineChange={panelProps.onHeadlineChange}
              textareaRef={mobileTextareaRef}
              onSyncTextareaSelection={syncTextareaSelection}
              highlightTab={highlightTab}
              onChangeHighlightTab={setHighlightTab}
              parsedWords={parsedWords}
              isWordHighlighted={isWordHighlighted}
              onToggleWordHighlight={handleToggleWordHighlight}
              onHighlightAllWords={handleHighlightAllWords}
              onClearAllHighlights={panelProps.onClearAllHighlights}
              onHighlightSelection={handleHighlightSelection}
              onRemoveSelectionHighlight={handleRemoveHighlight}
              onResetAllNormal={handleResetAllNormal}
              selectionHint={selectionHint}
              hasHighlights={highlights.length > 0}
              subheading={subheading}
              onChangeSubheading={setSubheading}
              onResetSubheading={panelProps.onResetSubheading}
              customTexts={customTexts}
              onChangeCustomTexts={setCustomTexts}
              onStartPencilMode={panelProps.onStartPencilMode}
              onAddDirectCustomText={panelProps.onAddDirectCustomText}
              onCommitHistory={commitHistoryNow}
              effectiveTemplate={effectiveTemplate}
              selectedTemplate={selectedTemplate}
              footerVisible={layerVisibility['footer'] !== false}
              onToggleFooterVisible={() => panelProps.onToggleLayerVisibility('footer')}
              onUpdateActiveTemplateOverride={handleUpdateActiveTemplateOverride}
              onResetActiveTemplateOverride={handleResetActiveTemplateOverride}
              lineMode={lineMode}
              onChangeLineMode={setLineMode}
              allFonts={allFonts}
              activeFont={activeFont}
              onSelectFont={setSelectedFontId}
              onTriggerFontUpload={panelProps.onTriggerFontUpload}
              fontSizePercent={fontSizePercent}
              onChangeFontSizePercent={setFontSizePercent}
              lineGapPercent={lineGapPercent}
              onChangeLineGapPercent={setLineGapPercent}
              headlineAlign={
                headlineAlignOverride ?? effectiveTemplate.headlineAlign ?? 'center'
              }
              onChangeHeadlineAlign={setHeadlineAlignOverride}
              textShadow={textShadow}
              onChangeTextShadow={setTextShadow}
              textColor={textColor}
              onChangeTextColor={setTextColor}
              highlightColor={highlightColor}
              onChangeHighlightColor={setHighlightColor}
              onResetStyleAll={panelProps.onResetStyleAll}
              onTriggerPhotoUpload={panelProps.onTriggerPhotoUpload}
              onPasteClipboardImage={handlePasteFromClipboardButton}
              photoZoom={photoZoom}
              onChangePhotoZoom={setPhotoZoom}
              photoPanX={photoPanX}
              onChangePhotoPanX={setPhotoPanX}
              photoPanY={photoPanY}
              onChangePhotoPanY={setPhotoPanY}
              onResetPhoto={panelProps.onResetPhoto}
              photoDeleted={photoDeleted}
              onDeletePhoto={handleDeletePhoto}
              quoteSettings={quoteSettings}
              onChangeQuoteSettings={setQuoteSettings}
              onResetQuoteSettings={panelProps.onResetQuoteSettings}
              onTriggerSecondaryPhotoUpload={panelProps.onTriggerSecondaryPhotoUpload}
              onDeleteSecondaryPhoto={panelProps.onDeleteSecondaryPhoto}
              onTriggerCustomFrameUpload={panelProps.onTriggerCustomFrameUpload}
              logoSettings={logoSettings}
              onChangeLogoSettings={setLogoSettings}
              onTriggerLogoUpload={panelProps.onTriggerLogoUpload}
              onOpenLogoEditor={panelProps.onOpenLogoEditor}
              onSelectTemplate={handleSelectTemplate}
              categoryNames={categoryNames}
              templateOverrides={templateOverrides}
              exportFormat={exportFormat}
              onChangeExportFormat={setExportFormat}
              exportQuality={exportQuality}
              onChangeExportQuality={setExportQuality}
              onExportAndSave={() => handleDownloadCard(true)}
              downloadDone={downloadDone}
            />
          ) : null}
        </MobileBottomSheet>
      </div>

      {/* Mobile URL Replace Modal (<768px) */}
      <MobileUrlModal
        isOpen={mobileUrlModalOpen}
        onClose={() => setMobileUrlModalOpen(false)}
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
        extractError={extractError}
      />

      {/* Mobile Fullscreen Pinch-Zoom Preview Modal (<768px) */}
      <MobileFullscreenPreviewModal
        isOpen={Boolean(mobileFullscreenUrl)}
        onClose={() => setMobileFullscreenUrl(null)}
        previewImageUrl={mobileFullscreenUrl || ''}
        aspectRatio={aspectRatioStyle}
      />

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
