import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Maximize2,
  Palette,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ALL_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import {
  CATEGORY_USAGE_NOTES,
  STYLE_TYPE_META,
  getTemplateAspectLabel,
} from '../data/templateMetadata';
import type {
  FontOption,
  HighlightRange,
  LogoBadgeStyle,
  LogoSettings,
  TemplateCategory,
  TemplateConfig,
  TemplateOverride,
} from '../types/card';
import { renderNewsCard } from '../utils/canvasRenderer';

const overlayImageCache = new Map<string, HTMLImageElement | null>();
const overlayWaiters = new Map<string, Array<(img: HTMLImageElement | null) => void>>();

function loadCachedOverlay(url: string, cb: (img: HTMLImageElement | null) => void) {
  if (overlayImageCache.has(url)) {
    cb(overlayImageCache.get(url) ?? null);
    return;
  }
  const existing = overlayWaiters.get(url);
  if (existing) {
    existing.push(cb);
    return;
  }
  overlayWaiters.set(url, [cb]);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    overlayImageCache.set(url, img);
    const list = overlayWaiters.get(url) || [];
    overlayWaiters.delete(url);
    list.forEach((fn) => fn(img));
  };
  img.onerror = () => {
    overlayImageCache.set(url, null);
    const list = overlayWaiters.get(url) || [];
    overlayWaiters.delete(url);
    list.forEach((fn) => fn(null));
  };
  img.src = url;
}

interface TemplatePreviewCanvasProps {
  template: TemplateConfig;
  photoImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  officialLogoImg: HTMLImageElement | null;
  logoSettings: LogoSettings;
  headline: string;
  highlights: HighlightRange[];
  activeFont: FontOption;
  size?: number;
  eager?: boolean;
  preserveAspect?: boolean;
}

const DEFAULT_THUMB_HEADLINE = 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ';
const DEFAULT_THUMB_HIGHLIGHTS: HighlightRange[] = [
  { id: 'thumb-hl', start: 16, end: 27, text: 'আরও ৬ জনের' },
];

const TemplatePreviewCanvas: React.FC<TemplatePreviewCanvasProps> = ({
  template,
  photoImg,
  logoImg,
  officialLogoImg,
  logoSettings,
  headline,
  highlights,
  activeFont,
  size = 420,
  eager = false,
  preserveAspect = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inView, setInView] = useState(eager);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(() =>
    template.overlayUrl ? overlayImageCache.get(template.overlayUrl) ?? null : null
  );

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: '220px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!inView) return;
    if (!template.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    let active = true;
    loadCachedOverlay(template.overlayUrl, (img) => {
      if (active) setOverlayImg(img);
    });
    return () => {
      active = false;
    };
  }, [inView, template.overlayUrl]);

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = size / template.canvasWidth;
    canvas.width = size;
    canvas.height = Math.round(template.canvasHeight * scale);

    ctx.save();
    ctx.scale(scale, scale);

    const effectiveHeadline = headline.trim() ? headline : DEFAULT_THUMB_HEADLINE;
    const effectiveHighlights = headline.trim() ? highlights : DEFAULT_THUMB_HIGHLIGHTS;

    renderNewsCard({
      ctx,
      template,
      overlayImg,
      photoImg,
      logoImg,
      officialLogoImg,
      headline: effectiveHeadline,
      highlights: effectiveHighlights,
      lineMode: 'auto',
      fontSizePercent: 100,
      lineGapPercent: 92,
      font: activeFont,
      textOffsetX: 0,
      textOffsetY: 0,
      textShadow: false,
      textColor: template.defaultTextColor,
      highlightColor: template.defaultHighlightColor,
      photoZoom: 1,
      photoPanX: 0,
      photoPanY: 0,
      logoSettings,
      isExport: true,
    });

    ctx.restore();
  }, [
    inView,
    size,
    template,
    overlayImg,
    photoImg,
    logoImg,
    officialLogoImg,
    logoSettings,
    headline,
    highlights,
    activeFont,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-[#f4eee4] dark:bg-slate-900 ${
        preserveAspect ? '' : 'aspect-square'
      }`}
      style={
        preserveAspect
          ? { aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }
          : undefined
      }
    >
      {inView ? (
        <canvas ref={canvasRef} className="block h-full w-full object-contain" />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: template.palette
              ? `linear-gradient(145deg, ${template.palette.bgPrimary}, ${template.palette.bgSecondary})`
              : '#024c4b',
          }}
        />
      )}
    </div>
  );
};

interface TemplatesPageProps {
  selectedTemplateId: string;
  onEditTemplate: (template: TemplateConfig) => void;
  onBackToGenerator: () => void;
  categoryNames: Record<string, string>;
  onRenameCategory: (categoryKey: Exclude<TemplateCategory, 'সব'>, newName: string) => void;
  onResetCategoryName: (categoryKey: Exclude<TemplateCategory, 'সব'>) => void;
  templateOverrides: Record<string, TemplateOverride>;
  onUpdateTemplateOverride: (templateId: string, patch: TemplateOverride) => void;
  onResetTemplateOverride: (templateId: string) => void;
  photoImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  officialLogoImg: HTMLImageElement | null;
  logoSettings: LogoSettings;
  onChangeLogoBadgeStyle: (badgeStyle: LogoBadgeStyle) => void;
  onToggleDefaultLogo: () => void;
  headline: string;
  highlights: HighlightRange[];
  activeFont: FontOption;
  newsUrl: string;
  onNewsUrlChange: (url: string) => void;
  onNewsUrlPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClearNewsUrl: () => void;
  isExtracting: boolean;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({
  selectedTemplateId,
  onEditTemplate,
  onBackToGenerator,
  categoryNames,
  onRenameCategory,
  onResetCategoryName,
  templateOverrides,
  onUpdateTemplateOverride,
  onResetTemplateOverride,
  photoImg,
  logoImg,
  officialLogoImg,
  logoSettings,
  onChangeLogoBadgeStyle,
  onToggleDefaultLogo,
  headline,
  highlights,
  activeFont,
  newsUrl,
  onNewsUrlChange,
  onNewsUrlPaste,
  onClearNewsUrl,
  isExtracting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('সব');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [editingCategoryKey, setEditingCategoryKey] = useState<Exclude<TemplateCategory, 'সব'> | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [inspectedTemplateId, setInspectedTemplateId] = useState<string | null>(null);

  const getCategoryDisplayName = (cat: TemplateCategory): string => {
    if (cat === 'সব') return 'সব';
    return categoryNames[cat]?.trim() || cat;
  };

  const resolvedTemplates = useMemo(() => {
    return ALL_TEMPLATES.map((tpl) => {
      const ov = templateOverrides[tpl.id];
      const effectiveCategory = ov?.category || tpl.category;
      const renamedCat = categoryNames[effectiveCategory]?.trim();

      let effectiveKicker = tpl.kickerText;
      if (ov?.kickerText !== undefined) {
        effectiveKicker = ov.kickerText;
      } else if (renamedCat && tpl.kickerText && tpl.kickerText === tpl.category) {
        effectiveKicker = renamedCat;
      } else if (ov?.category && tpl.styleType !== 'psd-overlay') {
        effectiveKicker = renamedCat || ov.category;
      }

      return {
        ...tpl,
        name: ov?.name !== undefined && ov.name.trim() ? ov.name : tpl.name,
        category: effectiveCategory,
        kickerText: effectiveKicker,
        footerCtaText:
          ov?.footerCtaText !== undefined ? ov.footerCtaText : tpl.footerCtaText,
        websiteUrl: ov?.websiteUrl !== undefined ? ov.websiteUrl : tpl.websiteUrl,
      };
    });
  }, [templateOverrides, categoryNames]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resolvedTemplates.filter((t) => {
      const catMatch = activeCategory === 'সব' || t.category === activeCategory;
      const catDisplay = getCategoryDisplayName(t.category).toLowerCase();
      const styleLabel = STYLE_TYPE_META[t.styleType]?.label.toLowerCase() || '';
      const queryMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        catDisplay.includes(q) ||
        styleLabel.includes(q) ||
        (t.kickerText && t.kickerText.toLowerCase().includes(q));
      return catMatch && queryMatch;
    });
  }, [resolvedTemplates, searchQuery, activeCategory, categoryNames]);

  const inspectedTemplate = useMemo(() => {
    if (!inspectedTemplateId) return null;
    return resolvedTemplates.find((t) => t.id === inspectedTemplateId) || null;
  }, [resolvedTemplates, inspectedTemplateId]);

  const inspectedBaseTemplate = useMemo(() => {
    if (!inspectedTemplateId) return null;
    return ALL_TEMPLATES.find((t) => t.id === inspectedTemplateId) || null;
  }, [inspectedTemplateId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { সব: resolvedTemplates.length };
    for (const tpl of resolvedTemplates) {
      counts[tpl.category] = (counts[tpl.category] || 0) + 1;
    }
    return counts;
  }, [resolvedTemplates]);

  useEffect(() => {
    if (!inspectedTemplate && !isCategoryPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCategoryPickerOpen) setIsCategoryPickerOpen(false);
        else setInspectedTemplateId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedTemplate, isCategoryPickerOpen]);

  const startEditingCategory = (catKey: Exclude<TemplateCategory, 'সব'>) => {
    setEditingCategoryKey(catKey);
    setCategoryDraft(getCategoryDisplayName(catKey));
  };

  const commitCategoryRename = () => {
    if (!editingCategoryKey) return;
    const trimmed = categoryDraft.trim();
    if (trimmed) {
      onRenameCategory(editingCategoryKey, trimmed);
    }
    setEditingCategoryKey(null);
  };

  return (
    <div className="min-w-0 w-full space-y-4 sm:space-y-5">
      {/* Page Header + Back Button */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-slate-700/80 dark:bg-slate-800/95">
        <h2 className="min-w-0 text-lg font-bold text-[#1c3060] sm:text-2xl dark:text-slate-100">
          {ALL_TEMPLATES.length}+ ফ্রি প্রফেশনাল টেমপ্লেট ও ক্যাটাগরি
        </h2>

        <button
          type="button"
          onClick={onBackToGenerator}
          className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#c9c5c0] bg-[#f4eee4] px-4 py-2.5 text-sm font-bold text-[#1c3060] transition-colors hover:bg-[#eae2d5] sm:min-h-0 sm:w-auto sm:shrink-0 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>কার্ড জেনারেটরে ফিরুন</span>
        </button>
      </section>

      {/* News URL Auto-Extract Input Box */}
      <section className="rounded-2xl border border-[#ebe5da] bg-white p-4 shadow-[0_2px_12px_rgba(28,48,96,0.05)] sm:p-5 dark:border-slate-700/80 dark:bg-slate-800/95">
        <label
          htmlFor="templates-news-url-input"
          className="mb-2 block text-[13.5px] font-semibold text-[#1c3060] dark:text-slate-200"
        >
          নিউজের লিংক দিন — শিরোনাম আর ছবি বসে কার্ড রেডি হয়ে যাবে
        </label>
        <div className="relative">
          <input
            id="templates-news-url-input"
            type="url"
            value={newsUrl}
            onPaste={onNewsUrlPaste}
            onChange={(e) => onNewsUrlChange(e.target.value)}
            placeholder="এখানে নিউজের লিংক পেস্ট করুন..."
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
              onClick={onClearNewsUrl}
              title="লিংক মুছে প্রথম অবস্থায় ফিরুন"
              aria-label="লিংক মুছুন"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {/* Search & Clean Click-to-Filter Category Toolbar */}
      <section className="space-y-3 rounded-2xl border border-[#ebe5da] bg-white p-3.5 shadow-[0_2px_12px_rgba(28,48,96,0.05)] sm:p-5 dark:border-slate-700/80 dark:bg-slate-800/95">
        {/* Row 1: Search Input + Click-to-Filter Category Selector */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="টেমপ্লেট, স্টাইল বা ক্যাটাগরি খুঁজুন..."
              className="min-h-[44px] w-full rounded-xl border border-[#d6cfc2] bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="খোঁজা মুছুন"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setIsCategoryPickerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isCategoryPickerOpen}
              className={`inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors sm:flex-initial ${
                activeCategory !== 'সব'
                  ? 'border-[#1c3060] bg-[#1c3060] text-white dark:border-sky-500 dark:bg-[#254689]'
                  : 'border-[#c9c5c0] bg-[#f4eee4] text-[#1c3060] hover:bg-[#ebe3d5] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {activeCategory === 'সব'
                    ? 'ক্যাটাগরি ফিল্টার: সব'
                    : `ক্যাটাগরি: ${getCategoryDisplayName(activeCategory)}`}
                </span>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    activeCategory !== 'সব'
                      ? 'text-white/80'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  ({categoryCounts[activeCategory] ?? resolvedTemplates.length})
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
            </button>

            {activeCategory !== 'সব' && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('সব');
                  setEditingCategoryKey(null);
                }}
                title="সব ক্যাটাগরি দেখুন"
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl border border-[#c9c5c0] bg-white px-3 py-2 text-xs font-bold text-[#1c3060] hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span>সব দেখুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Logo Badge Options + Remove Default Logo + Count (wraps cleanly on any phone width) */}
        <div className="flex flex-col gap-2.5 border-t border-[#f1ece2] pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-slate-700/70">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {(logoSettings.dataUrl || !logoSettings.hideDefaultBrand) && (
              <div className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[#e2dcd1] bg-[#f4eee4] p-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                <span className="px-1.5 py-1 font-semibold text-[#57534e] dark:text-slate-300">
                  লোগো ব্যাজ:
                </span>
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
                      onClick={() => onChangeLogoBadgeStyle(opt.id)}
                      className={`min-h-[34px] cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                          : 'text-slate-700 hover:text-[#1c3060] dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onToggleDefaultLogo}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                !logoSettings.dataUrl && logoSettings.hideDefaultBrand
                  ? 'border-[#1c3060] bg-[#eef3ff] text-[#1c3060] hover:bg-[#dfe8ff] dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200'
                  : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/80 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80'
              }`}
            >
              {!logoSettings.dataUrl && logoSettings.hideDefaultBrand ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>ডিফল্ট লোগো ফিরিয়ে আনুন</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{logoSettings.dataUrl ? 'লোগো রিমুভ' : 'ডিফল্ট লোগো রিমুভ'}</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs font-semibold text-[#6b655e] tabular-nums dark:text-slate-400">
            দেখানো হচ্ছে {filteredTemplates.length}টি টেমপ্লেট
          </p>
        </div>

        {/* Inline Category Rename Bar */}
        {activeCategory !== 'সব' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e3dbcd] bg-[#faf6ef] px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900/70">
            {editingCategoryKey === activeCategory ? (
              <div className="flex w-full items-center gap-2">
                <input
                  type="text"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCategoryRename();
                    if (e.key === 'Escape') setEditingCategoryKey(null);
                  }}
                  autoFocus
                  placeholder="ক্যাটাগরির নতুন নাম লিখুন"
                  className="min-w-0 flex-1 rounded-md border border-[#1c3060] bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none dark:border-sky-400 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={commitCategoryRename}
                  className="cursor-pointer rounded-md bg-[#1c3060] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#15254b] dark:bg-[#254689]"
                >
                  সেভ
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategoryKey(null)}
                  className="cursor-pointer rounded-md border border-[#c9c5c0] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  বাতিল
                </button>
              </div>
            ) : (
              <>
                <span className="text-[#57534e] dark:text-slate-300">
                  ক্যাটাগরি:{' '}
                  <strong className="text-[#1c3060] dark:text-sky-300">
                    {getCategoryDisplayName(activeCategory)}
                  </strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEditingCategory(activeCategory)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#1c3060] hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>ক্যাটাগরির নাম পরিবর্তন</span>
                  </button>
                  {categoryNames[activeCategory] && categoryNames[activeCategory] !== activeCategory && (
                    <button
                      type="button"
                      onClick={() => onResetCategoryName(activeCategory)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>আগের নাম</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Full Responsive Template Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredTemplates.map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;
          const styleInfo = STYLE_TYPE_META[tpl.styleType];

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setInspectedTemplateId(tpl.id)}
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800/95 ${
                isSelected
                  ? 'border-[#faab3f] ring-2 ring-[#faab3f]/70'
                  : 'border-[#ebe5da] hover:border-[#1c3060] dark:border-slate-700/80 dark:hover:border-sky-400'
              }`}
            >
              <div className="relative w-full">
                <TemplatePreviewCanvas
                  template={tpl}
                  photoImg={photoImg}
                  logoImg={logoImg}
                  officialLogoImg={officialLogoImg}
                  logoSettings={logoSettings}
                  headline={headline}
                  highlights={highlights}
                  activeFont={activeFont}
                  size={380}
                />
                {isSelected && (
                  <span className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-md bg-[#faab3f] px-2 py-0.5 text-[11px] font-bold text-slate-950 shadow">
                    <Check className="h-3 w-3 stroke-[3]" />
                    <span>নির্বাচিত</span>
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
                <div>
                  <h3 className="truncate text-[14.5px] font-bold text-slate-900 dark:text-slate-100">
                    {tpl.name}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[#6b655e] dark:text-slate-400">
                    {getCategoryDisplayName(tpl.category)} · {styleInfo?.label}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[#f1ece2] pt-2 text-xs font-bold text-[#1c3060] dark:border-slate-700/70 dark:text-sky-300">
                  <span>বিস্তারিত দেখুন ও এডিট</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full rounded-2xl border border-[#ebe5da] bg-white py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            কোনো টেমপ্লেট পাওয়া যায়নি। অন্য শব্দ বা ক্যাটাগরি নির্বাচন করুন।
          </div>
        )}
      </section>

      {/* Template Detail & Inspection Modal */}
      {inspectedTemplate && inspectedBaseTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-xs sm:p-5"
          onClick={() => setInspectedTemplateId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-detail-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-[#e3dbcd] bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#ebe5da] px-4 py-3.5 sm:px-6 dark:border-slate-800">
              <div className="min-w-0">
                <h3
                  id="template-detail-title"
                  className="truncate text-lg font-bold text-[#1c3060] dark:text-slate-100"
                >
                  {inspectedTemplate.name}
                </h3>
                <p className="truncate text-xs text-[#6b655e] dark:text-slate-400">
                  {getCategoryDisplayName(inspectedTemplate.category)} ·{' '}
                  {STYLE_TYPE_META[inspectedTemplate.styleType]?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTemplateId(null)}
                aria-label="বন্ধ করুন"
                className="cursor-pointer rounded-lg border border-[#d6cfc2] bg-[#faf6ef] p-2 text-slate-700 hover:bg-[#ebe3d6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-[360px_1fr]">
              {/* Left: High-Res Live Preview */}
              <div>
                <div className="overflow-hidden rounded-xl border border-[#e3dbcd] shadow-sm dark:border-slate-700">
                  <TemplatePreviewCanvas
                    template={inspectedTemplate}
                    photoImg={photoImg}
                    logoImg={logoImg}
                    officialLogoImg={officialLogoImg}
                    logoSettings={logoSettings}
                    headline={headline}
                    highlights={highlights}
                    activeFont={activeFont}
                    size={700}
                    eager
                    preserveAspect
                  />
                </div>
              </div>

              {/* Right: Complete Info + Quick Name/Category Edit + Edit Button */}
              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  {/* Style & Usage Info */}
                  <div className="space-y-2.5 rounded-xl border border-[#ebe5da] bg-[#faf6ef] p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-start gap-2.5">
                      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#1c3060] dark:text-sky-400" />
                      <div>
                        <p className="text-xs font-bold text-[#1c3060] dark:text-slate-200">
                          ডিজাইন স্টাইল: {STYLE_TYPE_META[inspectedTemplate.styleType]?.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#57534e] dark:text-slate-400">
                          {STYLE_TYPE_META[inspectedTemplate.styleType]?.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 border-t border-[#e8dfd0] pt-2.5 dark:border-slate-700/70">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706] dark:text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-[#1c3060] dark:text-slate-200">
                          কোথায় ব্যবহার করবেন ({getCategoryDisplayName(inspectedTemplate.category)})
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#57534e] dark:text-slate-400">
                          {CATEGORY_USAGE_NOTES[inspectedTemplate.category]}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-[#e8dfd0] pt-2.5 text-xs text-[#57534e] dark:border-slate-700/70 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Maximize2 className="h-3.5 w-3.5 text-[#1c3060] dark:text-sky-400" />
                        <span>সাইজ: {getTemplateAspectLabel(inspectedTemplate)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-[#1c3060] dark:text-sky-400" />
                        <span>রং:</span>
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{
                            backgroundColor:
                              inspectedTemplate.palette?.bgPrimary ||
                              (inspectedTemplate.id === 'psd-green' ? '#024c4b' : '#65142a'),
                          }}
                          title="ব্যাকগ্রাউন্ড রং"
                        />
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{
                            backgroundColor:
                              inspectedTemplate.palette?.accent || '#faab3f',
                          }}
                          title="অ্যাক্সেন্ট রং"
                        />
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{ backgroundColor: inspectedTemplate.defaultHighlightColor }}
                          title="হাইলাইট রং"
                        />
                      </span>
                    </div>
                  </div>

                  {/* Quick Card & Category Rename inside Detail View */}
                  <div className="space-y-3 rounded-xl border border-[#ebe5da] bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1c3060] dark:text-slate-200">
                        <Tag className="h-3.5 w-3.5 text-[#faab3f]" />
                        <span>কার্ড ও ক্যাটাগরির নাম পরিবর্তন (ঐচ্ছিক)</span>
                      </span>
                      {(templateOverrides[inspectedTemplate.id] ||
                        categoryNames[inspectedTemplate.category]) && (
                        <button
                          type="button"
                          onClick={() => {
                            onResetTemplateOverride(inspectedTemplate.id);
                            onResetCategoryName(inspectedTemplate.category);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>রিসেট</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-semibold text-[#57534e] dark:text-slate-300">
                          কার্ডে দেখানো ক্যাটাগরি ব্যাজ
                        </label>
                        <input
                          type="text"
                          value={inspectedTemplate.kickerText ?? ''}
                          onChange={(e) =>
                            onUpdateTemplateOverride(inspectedTemplate.id, {
                              kickerText: e.target.value,
                            })
                          }
                          placeholder="খালি রাখলে ব্যাজ দেখাবে না"
                          className="w-full rounded-lg border border-[#d6cfc2] bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>

                      {!['psd-overlay', 'tv-jamuna', 'paper-prothom-alo-2', 'portal-jagonews', 'paper-daily-star', 'portal-bdnews24', 'paper-ittefaq'].includes(inspectedTemplate.styleType) && (
                        <div>
                          <label className="mb-1 block text-[11.5px] font-semibold text-[#57534e] dark:text-slate-300">
                            নিচের ফুটার লেখা (CTA)
                          </label>
                          <input
                            type="text"
                            value={inspectedTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                            onChange={(e) =>
                              onUpdateTemplateOverride(inspectedTemplate.id, {
                                footerCtaText: e.target.value,
                              })
                            }
                            placeholder="খালি রাখলে ফুটার লেখা দেখাবে না"
                            className="w-full rounded-lg border border-[#d6cfc2] bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {inspectedTemplate.hasWebsiteUrl && (
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[11.5px] font-semibold text-[#57534e] dark:text-slate-300">
                            ওয়েবসাইট ইউআরএল
                          </label>
                          <input
                            type="text"
                            value={inspectedTemplate.websiteUrl ?? ''}
                            onChange={(e) =>
                              onUpdateTemplateOverride(inspectedTemplate.id, {
                                websiteUrl: e.target.value,
                              })
                            }
                            placeholder="যেমন: www.yoursite.com (খালি রাখলে দেখাবে না)"
                            className="w-full rounded-lg border border-[#d6cfc2] bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#ebe5da] pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInspectedTemplateId(null)}
                    className="cursor-pointer rounded-xl border border-[#c9c5c0] bg-[#f4eee4] px-4 py-2.5 text-sm font-bold text-[#1e293b] hover:bg-[#ebe3d6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    অন্য টেমপ্লেট দেখুন
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEditTemplate(inspectedBaseTemplate);
                      setInspectedTemplateId(null);
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#1c3060] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#15254b] dark:bg-[#254689] dark:hover:bg-[#2d54a4]"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>এই কার্ডটি এডিট করুন</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Sheet / Dialog */}
      {isCategoryPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs sm:items-center sm:p-5"
          onClick={() => setIsCategoryPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-picker-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[82vh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-3xl border border-[#e3dbcd] bg-white shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Mobile drag handle */}
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

            <div className="flex items-center justify-between border-b border-[#ebe5da] px-4 py-3.5 sm:px-5 dark:border-slate-800">
              <div className="min-w-0">
                <h3
                  id="category-picker-title"
                  className="text-base font-bold text-[#1c3060] sm:text-lg dark:text-slate-100"
                >
                  ক্যাটাগরি অনুযায়ী টেমপ্লেট বাছাই করুন
                </h3>
                <p className="text-xs text-[#6b655e] dark:text-slate-400">
                  খবরের ধরন অনুযায়ী যেকোনো একটি ক্যাটাগরিতে ক্লিক করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                aria-label="বন্ধ করুন"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#d6cfc2] bg-[#faf6ef] text-slate-700 hover:bg-[#ebe3d6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 md:grid-cols-3">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                const displayLabel = getCategoryDisplayName(cat);
                const count = categoryCounts[cat] ?? 0;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setEditingCategoryKey(null);
                      setIsCategoryPickerOpen(false);
                    }}
                    className={`flex min-h-[48px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-[#1c3060] bg-[#1c3060] text-white shadow-xs dark:border-sky-500 dark:bg-[#254689]'
                        : 'border-[#e6dfd2] bg-[#faf6ef] text-slate-800 hover:border-[#1c3060]/50 hover:bg-[#f2ebde] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:border-sky-400/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      {isActive && <Check className="h-4 w-4 shrink-0 text-[#faab3f]" />}
                      <span className="truncate text-sm font-bold">
                        {cat === 'সব' ? 'সব ক্যাটাগরি' : displayLabel}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold tabular-nums ${
                        isActive ? 'text-white/85' : 'text-[#6b655e] dark:text-slate-400'
                      }`}
                    >
                      {count}টি
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
