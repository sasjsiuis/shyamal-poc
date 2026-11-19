import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Ban,
  Check,
  ClipboardPaste,
  Crop,
  Eye,
  GripVertical,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  CustomTextItem,
  ExtraImageLayer,
  FontOption,
  LineMode,
  LogoBadgeStyle,
  LogoSettings,
  LogoShape,
  QuoteCardSettings,
  SubheadingSettings,
  TemplateConfig,
  TemplateOverride,
} from '../../types/card';
import { renderLayerThumbnail, type RenderCardOptions } from '../../utils/canvasRenderer';
import { getDefaultBengaliDateText, toVisualTopDownOrder } from '../../utils/layerUtils';
import { toBengaliDigits } from '../../utils/projectStorage';
import { isQuoteStyleType } from '../../utils/quoteCardRenderer';
import { EditableNumberBadge } from '../EditableNumberBadge';
import { RangeSlider } from '../RangeSlider';
import type { ParsedWord } from './EditorRightPanel';
import { QuoteCustomizerSection } from './QuoteCustomizerSection';

interface MobileLayersPanelProps {
  resolvedLayerOrder: string[];
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  layerVisibility: Record<string, boolean>;
  onToggleVisibility: (layerId: string) => void;
  layerOpacity: Record<string, number>;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  layerLocks: Record<string, boolean>;
  onToggleLock: (layerId: string) => void;
  layerNames: Record<string, string>;
  onRenameLayer: (layerId: string, nextName: string) => void;
  onReorderVisualLayers: (fromVisualIdx: number, toVisualIdx: number) => void;
  onResetLayerSystem: () => void;

  // Live thumbnail render dependencies
  effectiveTemplate: TemplateConfig;
  selectedTemplate: TemplateConfig;
  overlayImg: HTMLImageElement | null;
  photoImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  officialLogoImg: HTMLImageElement | null;
  headline: string;
  highlights: import('../../types/card').HighlightRange[];
  lineMode: LineMode;
  fontSizePercent: number;
  lineGapPercent: number;
  activeFont: FontOption;
  allFonts: FontOption[];
  textOffsetX: number;
  textOffsetY: number;
  textShadow: boolean;
  textColor: string;
  highlightColor: string;
  headlineAlignOverride?: 'left' | 'center' | 'right';
  onChangeHeadlineAlign?: (align: 'left' | 'center' | 'right') => void;
  photoZoom: number;
  photoPanX: number;
  photoPanY: number;
  logoSettings: LogoSettings;
  subheading: SubheadingSettings;
  customTexts: CustomTextItem[];
  extraImages: ExtraImageLayer[];
  extraImageEls: Record<string, HTMLImageElement>;
  dateText: string;

  // Content & customization callbacks
  onHeadlineChange: (val: string) => void;
  parsedWords: ParsedWord[];
  isWordHighlighted: (word: ParsedWord) => boolean;
  onToggleWordHighlight: (word: ParsedWord) => void;
  onClearAllHighlights: () => void;
  hasHighlights: boolean;
  onChangeLineMode: (m: LineMode) => void;
  onSelectFont: (id: string) => void;
  onChangeFontSizePercent: (v: number) => void;
  onChangeLineGapPercent: (v: number) => void;
  onChangeTextOffset: (x: number, y: number) => void;
  onChangeTextShadow: (v: boolean) => void;
  onChangeTextColor: (v: string) => void;
  onChangeHighlightColor: (v: string) => void;

  onChangeSubheading: (updater: (prev: SubheadingSettings) => SubheadingSettings) => void;
  onResetSubheading: () => void;

  onChangeCustomTexts: (updater: (prev: CustomTextItem[]) => CustomTextItem[]) => void;
  onDeleteCustomText: (id: string) => void;
  onAddDirectCustomText: () => void;
  onStartPencilMode: () => void;

  onChangeExtraImages: (updater: (prev: ExtraImageLayer[]) => ExtraImageLayer[]) => void;
  onDeleteExtraImage: (id: string) => void;
  onTriggerAddExtraImage: () => void;
  onPasteClipboardImage: () => void;
  onPromoteExtraImageToMain: (id: string) => void;

  onChangePhotoZoom: (v: number) => void;
  onChangePhotoPanX: (v: number) => void;
  onChangePhotoPanY: (v: number) => void;
  onTriggerPhotoUpload: () => void;
  onResetPhoto: () => void;
  photoDeleted?: boolean;
  onDeletePhoto?: () => void;
  quoteSettings: QuoteCardSettings;
  onChangeQuoteSettings: (updater: (prev: QuoteCardSettings) => QuoteCardSettings) => void;
  onResetQuoteSettings: () => void;
  onTriggerSecondaryPhotoUpload: () => void;
  onDeleteSecondaryPhoto: () => void;
  secondaryPhotoImg?: HTMLImageElement | null;

  onChangeLogoSettings: (updater: (prev: LogoSettings) => LogoSettings) => void;
  onTriggerLogoUpload: () => void;
  onOpenLogoEditor: (dataUrl: string) => void;

  onUpdateActiveTemplateOverride: (patch: TemplateOverride) => void;
  onTriggerCustomFrameUpload: () => void;
  onSwitchToTemplateTab: () => void;
  onCommitHistory: () => void;
  isKeyboardOpen?: boolean;
  onFeedback?: (msg: string, layerId?: string) => void;
}

const LayerThumbnailCanvas: React.FC<{
  layerId: string;
  renderOpts: Omit<RenderCardOptions, 'ctx' | 'isExport' | 'snapState' | 'outlineLayerId'>;
  renderKey: string;
}> = ({ layerId, renderOpts, renderKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      renderLayerThumbnail(canvas, layerId, renderOpts, 84, 48);
      return;
    }
    const timer = window.setTimeout(() => {
      renderLayerThumbnail(canvas, layerId, renderOpts, 84, 48);
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId, renderKey]);

  return (
    <canvas
      ref={canvasRef}
      width={168}
      height={96}
      aria-hidden="true"
      className="block h-12 w-[84px] shrink-0 rounded-lg border border-[#E5E7EB] bg-slate-100 object-cover dark:border-[#1F2937] dark:bg-slate-800"
    />
  );
};

const MobileSliderHeader: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
  onReset: () => void;
}> = ({ label, value, min, max, suffix = '', onChange, onReset }) => (
  <div className="mb-1 flex items-center justify-between gap-2">
    <span className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">{label}</span>
    <div className="flex items-center gap-1.5">
      <EditableNumberBadge
        value={value}
        min={min}
        max={max}
        suffix={suffix}
        onChange={onChange}
        ariaLabel={label}
      />
      <button
        type="button"
        onClick={onReset}
        aria-label={`${label} রিসেট`}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#64748B] active:bg-slate-100 dark:text-slate-400 dark:active:bg-gray-800"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const MobileColorRow: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200">
    <span className="truncate">{label}</span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs uppercase text-[#64748B]">{value}</span>
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="swatch-picker h-11 w-11"
      />
    </span>
  </label>
);

export const MobileLayersPanel: React.FC<MobileLayersPanelProps> = (props) => {
  const [subView, setSubView] = useState<'list' | 'edit'>('list');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [forceShowSubheading, setForceShowSubheading] = useState(false);

  // Rename state via long-press on layer name
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameLongPressRef = useRef<number | null>(null);

  // Pointer long-press drag reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragHoverDisplayIdx, setDragHoverDisplayIdx] = useState<number | null>(null);
  const dragOrderRef = useRef<{
    timer: number | null;
    active: boolean;
    sourceId: string;
    sourceDisplayIdx: number;
    startY: number;
    hoverDisplayIdx: number;
  } | null>(null);

  const visualLayers = toVisualTopDownOrder(props.resolvedLayerOrder);

  // Omit unused empty layers (e.g. blank subheading) unless explicitly added
  const displayLayers = useMemo(
    () =>
      visualLayers.filter((id) => {
        if (id === 'subheading') {
          return Boolean(props.subheading.text.trim()) || forceShowSubheading;
        }
        return true;
      }),
    [visualLayers, props.subheading.text, forceShowSubheading]
  );

  const selectedId = visualLayers.includes(props.selectedLayerId)
    ? props.selectedLayerId
    : displayLayers[0] || 'headline';

  const getShortLayerName = (id: string): string => {
    const customName = props.layerNames[id]?.trim();
    if (customName) return customName;
    if (id === 'logo') return 'লোগো';
    if (id === 'headline') return 'শিরোনাম';
    if (id === 'subheading') return 'সাব-হেডিং';
    if (id === 'photo') return 'ছবি';
    if (id === 'date-badge') return 'ব্যাজ';
    if (id === 'footer') return 'ফুটার';
    if (id === 'frame') return 'ফ্রেম';
    if (id.startsWith('text:')) {
      const item = props.customTexts.find((c) => c.id === id.slice(5));
      return item?.text.trim().slice(0, 16) || 'ফ্রি টেক্সট';
    }
    if (id.startsWith('image:')) {
      const item = props.extraImages.find((img) => img.id === id.slice(6));
      return item?.name || 'ছবি লেয়ার';
    }
    return id;
  };

  const renderOpts = useMemo<Omit<RenderCardOptions, 'ctx' | 'isExport' | 'snapState' | 'outlineLayerId'>>(
    () => ({
      template: props.effectiveTemplate,
      overlayImg: props.overlayImg,
      photoImg: props.photoImg,
      logoImg: props.logoImg,
      officialLogoImg: props.officialLogoImg,
      headline: props.headline,
      highlights: props.highlights,
      lineMode: props.lineMode,
      fontSizePercent: props.fontSizePercent,
      lineGapPercent: props.lineGapPercent,
      font: props.activeFont,
      textOffsetX: props.textOffsetX,
      textOffsetY: props.textOffsetY,
      textShadow: props.textShadow,
      textColor: props.textColor,
      highlightColor: props.highlightColor,
      headlineAlignOverride: props.headlineAlignOverride,
      photoZoom: props.photoZoom,
      photoPanX: props.photoPanX,
      photoPanY: props.photoPanY,
      photoDeleted: props.photoDeleted,
      quoteSettings: props.quoteSettings,
      secondaryPhotoImg: props.secondaryPhotoImg ?? null,
      logoSettings: props.logoSettings,
      subheading: props.subheading,
      customTexts: props.customTexts,
      extraImages: props.extraImages,
      extraImageEls: props.extraImageEls,
      layerOrder: props.resolvedLayerOrder,
      layerVisibility: props.layerVisibility,
      layerOpacity: props.layerOpacity,
      dateTextOverride: props.dateText,
    }),
    [
      props.effectiveTemplate,
      props.overlayImg,
      props.photoImg,
      props.logoImg,
      props.officialLogoImg,
      props.headline,
      props.highlights,
      props.lineMode,
      props.fontSizePercent,
      props.lineGapPercent,
      props.activeFont,
      props.textOffsetX,
      props.textOffsetY,
      props.textShadow,
      props.textColor,
      props.highlightColor,
      props.headlineAlignOverride,
      props.photoZoom,
      props.photoPanX,
      props.photoPanY,
      props.photoDeleted,
      props.quoteSettings,
      props.secondaryPhotoImg,
      props.logoSettings,
      props.subheading,
      props.customTexts,
      props.extraImages,
      props.extraImageEls,
      props.resolvedLayerOrder,
      props.layerVisibility,
      props.layerOpacity,
      props.dateText,
    ]
  );

  const renderKey = useMemo(
    () =>
      JSON.stringify([
        props.effectiveTemplate.id,
        props.effectiveTemplate.kickerText,
        props.effectiveTemplate.footerCtaText,
        props.effectiveTemplate.websiteUrl,
        props.effectiveTemplate.palette,
        Boolean(props.overlayImg),
        props.photoImg?.src,
        props.photoDeleted,
        props.quoteSettings,
        props.secondaryPhotoImg?.src,
        props.logoImg?.src,
        Boolean(props.officialLogoImg),
        props.headline,
        props.highlights.length,
        props.lineMode,
        props.fontSizePercent,
        props.lineGapPercent,
        props.activeFont.id,
        props.textShadow,
        props.textColor,
        props.highlightColor,
        props.headlineAlignOverride,
        props.photoZoom,
        props.photoPanX,
        props.photoPanY,
        props.logoSettings,
        props.subheading,
        props.customTexts,
        props.extraImages,
        Object.keys(props.extraImageEls).length,
        props.dateText,
      ]),
    [
      props.effectiveTemplate,
      props.overlayImg,
      props.photoImg,
      props.photoDeleted,
      props.quoteSettings,
      props.secondaryPhotoImg,
      props.logoImg,
      props.officialLogoImg,
      props.headline,
      props.highlights.length,
      props.lineMode,
      props.fontSizePercent,
      props.lineGapPercent,
      props.activeFont.id,
      props.textShadow,
      props.textColor,
      props.highlightColor,
      props.headlineAlignOverride,
      props.photoZoom,
      props.photoPanX,
      props.photoPanY,
      props.logoSettings,
      props.subheading,
      props.customTexts,
      props.extraImages,
      props.extraImageEls,
      props.dateText,
    ]
  );

  const startGripLongPress = (
    e: React.PointerEvent<HTMLButtonElement>,
    id: string,
    displayIdx: number
  ) => {
    e.stopPropagation();
    const startY = e.clientY;
    const targetBtn = e.currentTarget;
    const pointerId = e.pointerId;

    const timer = window.setTimeout(() => {
      if (!dragOrderRef.current) return;
      dragOrderRef.current.active = true;
      setDraggingId(id);
      setDragHoverDisplayIdx(displayIdx);
      try {
        targetBtn.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
    }, 220);

    dragOrderRef.current = {
      timer,
      active: false,
      sourceId: id,
      sourceDisplayIdx: displayIdx,
      startY,
      hoverDisplayIdx: displayIdx,
    };
  };

  const moveGripDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragOrderRef.current;
    if (!st) return;

    if (!st.active) {
      if (Math.abs(e.clientY - st.startY) > 10 && st.timer !== null) {
        window.clearTimeout(st.timer);
        st.timer = null;
        dragOrderRef.current = null;
      }
      return;
    }

    e.preventDefault();
    const rowNodes = document.querySelectorAll<HTMLElement>('[data-layer-row-idx]');
    let matchedIdx = st.hoverDisplayIdx;
    rowNodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const idx = Number(node.dataset.layerRowIdx);
        if (!Number.isNaN(idx)) matchedIdx = idx;
      }
    });
    if (matchedIdx !== st.hoverDisplayIdx) {
      st.hoverDisplayIdx = matchedIdx;
      setDragHoverDisplayIdx(matchedIdx);
    }
  };

  const endGripDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragOrderRef.current;
    if (!st) return;
    if (st.timer !== null) {
      window.clearTimeout(st.timer);
    }
    if (st.active && st.hoverDisplayIdx !== st.sourceDisplayIdx) {
      const targetId = displayLayers[st.hoverDisplayIdx];
      const fromFullIdx = visualLayers.indexOf(st.sourceId);
      const toFullIdx = visualLayers.indexOf(targetId);
      if (fromFullIdx !== -1 && toFullIdx !== -1) {
        props.onReorderVisualLayers(fromFullIdx, toFullIdx);
        props.onFeedback?.(`${getShortLayerName(st.sourceId)} ক্রম বদলানো হয়েছে ✓`, st.sourceId);
      }
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    dragOrderRef.current = null;
    setDraggingId(null);
    setDragHoverDisplayIdx(null);
  };

  const activePal = {
    bgPrimary: props.effectiveTemplate.palette?.bgPrimary ?? '#0f172a',
    bgSecondary: props.effectiveTemplate.palette?.bgSecondary ?? '#1e293b',
    accent: props.effectiveTemplate.palette?.accent ?? '#ef4444',
    footerBg: props.effectiveTemplate.palette?.footerBg ?? '#ffffff',
    footerText: props.effectiveTemplate.palette?.footerText ?? '#0f172a',
    badgeBg: props.effectiveTemplate.palette?.badgeBg ?? '#f59e0b',
    badgeText: props.effectiveTemplate.palette?.badgeText ?? '#111827',
    borderColor: props.effectiveTemplate.palette?.borderColor ?? '#e2e8f0',
  };

  const updatePaletteKey = (
    key: keyof NonNullable<TemplateConfig['palette']>,
    value: string
  ) => {
    const existing = props.effectiveTemplate.palette || {};
    props.onUpdateActiveTemplateOverride({
      palette: {
        ...existing,
        [key]: value,
      },
    });
  };

  // EDIT SUBVIEW (replaces list cleanly with Back button)
  if (subView === 'edit') {
    const isVisible = props.layerVisibility[selectedId] !== false;
    const isLocked = Boolean(props.layerLocks[selectedId]);
    const opacity = props.layerOpacity[selectedId] ?? 100;
    const isUserLayer = selectedId.startsWith('text:') || selectedId.startsWith('image:');
    const layerTitle = getShortLayerName(selectedId);
    const customText = selectedId.startsWith('text:')
      ? props.customTexts.find((c) => c.id === selectedId.slice(5))
      : undefined;
    const extraImage = selectedId.startsWith('image:')
      ? props.extraImages.find((img) => img.id === selectedId.slice(6))
      : undefined;

    return (
      <div className="space-y-3.5 pb-2">
        {/* Back Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2 dark:border-[#1F2937]">
          <button
            type="button"
            onClick={() => setSubView('list')}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-[14px] font-bold text-[#4F46E5] active:bg-[#EEF2FF] dark:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>লেয়ার</span>
          </button>

          <span className="truncate text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
            {layerTitle}
          </span>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => props.onToggleVisibility(selectedId)}
              aria-label={isVisible ? `${layerTitle} লুকান` : `${layerTitle} দেখান`}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl ${
                isVisible ? 'text-[#475569] dark:text-slate-300' : 'text-[#EF4444]'
              }`}
            >
              {isVisible ? <Eye className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => props.onToggleLock(selectedId)}
              aria-label={isLocked ? `${layerTitle} আনলক` : `${layerTitle} লক`}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl ${
                isLocked ? 'text-[#F59E0B]' : 'text-[#64748B] dark:text-slate-300'
              }`}
            >
              {isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            </button>
            {isUserLayer && (
              <button
                type="button"
                onClick={() => {
                  if (selectedId.startsWith('text:')) props.onDeleteCustomText(selectedId.slice(5));
                  if (selectedId.startsWith('image:')) props.onDeleteExtraImage(selectedId.slice(6));
                  setSubView('list');
                }}
                aria-label={`${layerTitle} মুছুন`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#EF4444] active:bg-red-50"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Common Opacity */}
        {!props.isKeyboardOpen && (
          <div>
            <MobileSliderHeader
              label="স্বচ্ছতা"
              value={opacity}
              min={0}
              max={100}
              suffix="%"
              onChange={(val) => props.onChangeLayerOpacity(selectedId, val)}
              onReset={() => props.onChangeLayerOpacity(selectedId, 100)}
            />
            <RangeSlider
              min={0}
              max={100}
              value={opacity}
              onChange={(val) => props.onChangeLayerOpacity(selectedId, val)}
              ariaLabel="লেয়ারের স্বচ্ছতা"
            />
          </div>
        )}

        {/* Headline Editor */}
        {selectedId === 'headline' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                শিরোনামের লেখা
              </label>
              <textarea
                rows={2}
                value={props.headline}
                onChange={(e) => props.onHeadlineChange(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-[16px] leading-snug text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>

            {!props.isKeyboardOpen && (
              <>
                {props.parsedWords.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1">
                    {props.parsedWords.map((word) => {
                      const hl = props.isWordHighlighted(word);
                      return (
                        <button
                          key={`${word.index}-${word.start}`}
                          type="button"
                          onClick={() => props.onToggleWordHighlight(word)}
                          className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold ${
                            hl
                              ? 'bg-[#F59E0B] text-slate-950'
                              : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                          }`}
                        >
                          {word.text}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                  {(
                    [
                      { key: 'auto', label: 'অটো' },
                      { key: 'one', label: 'এক লাইন' },
                      { key: 'two', label: 'দুই লাইন' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        props.onChangeLineMode(m.key);
                        props.onFeedback?.(`লাইন মোড: ${m.label} ✓`, 'headline');
                      }}
                      className={`min-h-[44px] cursor-pointer rounded-lg text-[13px] font-semibold ${
                        props.lineMode === m.key
                          ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                          : 'text-[#64748B] dark:text-slate-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {props.onChangeHeadlineAlign && (
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                    {(
                      [
                        { key: 'left', label: 'বামে', Icon: AlignLeft },
                        { key: 'center', label: 'মাঝে', Icon: AlignCenter },
                        { key: 'right', label: 'ডানে', Icon: AlignRight },
                      ] as const
                    ).map(({ key, label, Icon }) => {
                      const active = (props.headlineAlignOverride ?? props.effectiveTemplate.headlineAlign ?? 'center') === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            props.onChangeHeadlineAlign?.(key);
                            props.onFeedback?.(`অবস্থান: ${label} ✓`, 'headline');
                          }}
                          className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold ${
                            active
                              ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                              : 'text-[#64748B] dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    ফন্ট
                  </label>
                  <select
                    value={props.activeFont.id}
                    onChange={(e) => props.onSelectFont(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
                  >
                    {props.allFonts.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <MobileSliderHeader
                    label="লেখার সাইজ"
                    value={props.fontSizePercent}
                    min={50}
                    max={180}
                    suffix="%"
                    onChange={props.onChangeFontSizePercent}
                    onReset={() => props.onChangeFontSizePercent(100)}
                  />
                  <RangeSlider
                    min={50}
                    max={180}
                    value={props.fontSizePercent}
                    onChange={props.onChangeFontSizePercent}
                    ariaLabel="লেখার সাইজ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MobileColorRow label="লেখার রং" value={props.textColor} onChange={props.onChangeTextColor} />
                  <MobileColorRow label="হাইলাইট" value={props.highlightColor} onChange={props.onChangeHighlightColor} />
                </div>

                <button
                  type="button"
                  onClick={() => props.onChangeTextShadow(!props.textShadow)}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
                >
                  <span>লেখার ছায়া</span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${props.textShadow ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-[#64748B]'}`}>
                    {props.textShadow ? 'চালু' : 'বন্ধ'}
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Subheading Editor */}
        {selectedId === 'subheading' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                সাব-হেডিং লেখা
              </label>
              <input
                type="text"
                value={props.subheading.text}
                onChange={(e) => props.onChangeSubheading((p) => ({ ...p, text: e.target.value }))}
                placeholder="যেমন: বিশেষ প্রতিনিধি / বিস্তারিত"
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>

            {!props.isKeyboardOpen && (
              <>
                <div>
                  <MobileSliderHeader
                    label="সাইজ"
                    value={props.subheading.fontSizePercent}
                    min={60}
                    max={180}
                    suffix="%"
                    onChange={(fontSizePercent) =>
                      props.onChangeSubheading((p) => ({ ...p, fontSizePercent }))
                    }
                    onReset={() => props.onChangeSubheading((p) => ({ ...p, fontSizePercent: 100 }))}
                  />
                  <RangeSlider
                    min={60}
                    max={180}
                    value={props.subheading.fontSizePercent}
                    onChange={(fontSizePercent) =>
                      props.onChangeSubheading((p) => ({ ...p, fontSizePercent }))
                    }
                    ariaLabel="সাব-হেডিং সাইজ"
                  />
                </div>
                <MobileColorRow
                  label="সাব-হেডিং রং"
                  value={props.subheading.color || props.textColor}
                  onChange={(color) => props.onChangeSubheading((p) => ({ ...p, color }))}
                />
              </>
            )}
          </div>
        )}

        {/* Date & Badge Editor */}
        {selectedId === 'date-badge' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                তারিখ
              </label>
              <input
                type="text"
                value={props.dateText}
                onChange={(e) => props.onUpdateActiveTemplateOverride({ dateText: e.target.value })}
                placeholder={getDefaultBengaliDateText() || 'যেমন: ১৮ মে ২০২৬'}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                ব্যাজ / ক্যাটাগরি
              </label>
              <input
                type="text"
                value={props.effectiveTemplate.kickerText ?? ''}
                onChange={(e) => props.onUpdateActiveTemplateOverride({ kickerText: e.target.value })}
                placeholder="যেমন: ব্রেকিং নিউজ"
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>
            {!props.isKeyboardOpen && (
              <div className="grid grid-cols-2 gap-2">
                <MobileColorRow
                  label="ব্যাজ রং"
                  value={activePal.badgeBg}
                  onChange={(v) => updatePaletteKey('badgeBg', v)}
                />
                <MobileColorRow
                  label="ব্যাজ টেক্সট"
                  value={activePal.badgeText}
                  onChange={(v) => updatePaletteKey('badgeText', v)}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer Editor */}
        {selectedId === 'footer' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                ওয়েবসাইট ইউআরএল
              </label>
              <input
                type="text"
                value={props.effectiveTemplate.websiteUrl ?? ''}
                onChange={(e) => props.onUpdateActiveTemplateOverride({ websiteUrl: e.target.value })}
                placeholder="যেমন: www.yoursite.com"
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                ফুটার বাটন (CTA)
              </label>
              <input
                type="text"
                value={props.effectiveTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                onChange={(e) => props.onUpdateActiveTemplateOverride({ footerCtaText: e.target.value })}
                placeholder="যেমন: বিস্তারিত কমেন্টে"
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>
            {!props.isKeyboardOpen && (
              <div className="grid grid-cols-2 gap-2">
                <MobileColorRow
                  label="ফুটার ব্যাকগ্রাউন্ড"
                  value={activePal.footerBg}
                  onChange={(v) => updatePaletteKey('footerBg', v)}
                />
                <MobileColorRow
                  label="ফুটার টেক্সট"
                  value={activePal.footerText}
                  onChange={(v) => updatePaletteKey('footerText', v)}
                />
              </div>
            )}
          </div>
        )}

        {/* Logo Editor */}
        {selectedId === 'logo' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={props.onTriggerLogoUpload}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                <span>{props.logoSettings.dataUrl ? 'লোগো বদলান' : 'কাস্টম লোগো'}</span>
              </button>
              {props.logoSettings.dataUrl && (
                <button
                  type="button"
                  onClick={() => props.onOpenLogoEditor(props.logoSettings.dataUrl!)}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
                >
                  <Crop className="h-4 w-4 text-[#4F46E5]" />
                  <span>ক্রপ</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                props.onCommitHistory();
                props.onChangeLogoSettings((p) => ({
                  ...p,
                  hideDefaultBrand: !p.hideDefaultBrand,
                }));
              }}
              className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
            >
              <span>ডিফল্ট ওয়াটারমার্ক দেখান</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${!props.logoSettings.hideDefaultBrand ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-[#64748B]'}`}>
                {!props.logoSettings.hideDefaultBrand ? 'চালু' : 'বন্ধ'}
              </span>
            </button>

            <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {(
                [
                  { id: 'original', label: 'আসল' },
                  { id: 'square', label: 'স্কয়ার' },
                  { id: 'rounded', label: 'রাউন্ডেড' },
                  { id: 'circle', label: 'গোল' },
                  { id: 'pill', label: 'পিল' },
                ] as Array<{ id: LogoShape; label: string }>
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => props.onChangeLogoSettings((p) => ({ ...p, shape: s.id }))}
                  className={`min-h-[44px] shrink-0 cursor-pointer rounded-xl px-3.5 text-xs font-semibold ${
                    (props.logoSettings.shape ?? 'original') === s.id
                      ? 'bg-[#4F46E5] text-white'
                      : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div>
              <MobileSliderHeader
                label="লোগোর সাইজ"
                value={Math.round(props.logoSettings.scale * 100)}
                min={50}
                max={200}
                suffix="%"
                onChange={(val) => props.onChangeLogoSettings((p) => ({ ...p, scale: val / 100 }))}
                onReset={() => props.onChangeLogoSettings((p) => ({ ...p, scale: 1 }))}
              />
              <RangeSlider
                min={50}
                max={200}
                value={Math.round(props.logoSettings.scale * 100)}
                onChange={(val) => props.onChangeLogoSettings((p) => ({ ...p, scale: val / 100 }))}
                ariaLabel="লোগোর সাইজ"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {(
                [
                  { id: 'none', label: 'খালি' },
                  { id: 'white-pill', label: 'সাদা পিল' },
                  { id: 'dark-pill', label: 'ডার্ক পিল' },
                  { id: 'glass', label: 'গ্লাস' },
                ] as Array<{ id: LogoBadgeStyle; label: string }>
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => props.onChangeLogoSettings((p) => ({ ...p, badgeStyle: b.id }))}
                  className={`min-h-[44px] shrink-0 cursor-pointer rounded-xl px-3.5 text-xs font-semibold ${
                    (props.logoSettings.badgeStyle ?? 'none') === b.id
                      ? 'bg-[#4F46E5] text-white'
                      : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Photo Editor */}
        {selectedId === 'photo' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={props.onTriggerPhotoUpload}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 text-sm font-semibold text-white"
              >
                <Upload className="h-4 w-4" />
                <span>ছবি বদলান</span>
              </button>
              <button
                type="button"
                onClick={props.onResetPhoto}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                <RotateCcw className="h-4 w-4" />
                <span>রিসেট</span>
              </button>
            </div>

            {props.onDeletePhoto && !props.photoDeleted && (
              <button
                type="button"
                onClick={() => {
                  props.onDeletePhoto?.();
                  props.onFeedback?.('মূল ছবি মুছে ফেলা হয়েছে', 'photo');
                }}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-[#EF4444] dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                <span>মূল ছবি মুছুন</span>
              </button>
            )}

            {props.photoDeleted && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <span>মূল ছবি মুছে ফেলা হয়েছে।</span>
                <button
                  type="button"
                  onClick={props.onResetPhoto}
                  className="min-h-[44px] shrink-0 cursor-pointer px-2 font-bold underline"
                >
                  ডিফল্ট ফিরান
                </button>
              </div>
            )}

            <div>
              <MobileSliderHeader
                label="ছবির জুম"
                value={Math.round(props.photoZoom * 100)}
                min={50}
                max={250}
                suffix="%"
                onChange={(val) => props.onChangePhotoZoom(val / 100)}
                onReset={() => props.onChangePhotoZoom(1)}
              />
              <RangeSlider
                min={50}
                max={250}
                value={Math.round(props.photoZoom * 100)}
                onChange={(val) => props.onChangePhotoZoom(val / 100)}
                ariaLabel="ছবির জুম"
              />
            </div>

            {isQuoteStyleType(props.effectiveTemplate.styleType) && (
              <QuoteCustomizerSection
                mode="photo"
                mobile
                effectiveTemplate={props.effectiveTemplate}
                selectedTemplate={props.selectedTemplate}
                quoteSettings={props.quoteSettings}
                onChangeQuoteSettings={props.onChangeQuoteSettings}
                onResetQuoteSettings={props.onResetQuoteSettings}
                onUpdateActiveTemplateOverride={props.onUpdateActiveTemplateOverride}
                onTriggerSecondaryPhotoUpload={props.onTriggerSecondaryPhotoUpload}
                onDeleteSecondaryPhoto={props.onDeleteSecondaryPhoto}
                onCommitHistory={props.onCommitHistory}
              />
            )}
          </div>
        )}

        {/* Frame Editor */}
        {selectedId === 'frame' && (
          <div className="space-y-3">
            {!props.isKeyboardOpen && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={props.onSwitchToTemplateTab}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 text-sm font-semibold text-white"
                >
                  <span>টেমপ্লেট বদলান</span>
                </button>
                <button
                  type="button"
                  onClick={props.onTriggerCustomFrameUpload}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
                >
                  <Upload className="h-4 w-4 text-[#4F46E5]" />
                  <span>ফ্রেম আপলোড</span>
                </button>
              </div>
            )}
            {isQuoteStyleType(props.effectiveTemplate.styleType) ? (
              <QuoteCustomizerSection
                mode="all"
                mobile
                isKeyboardOpen={props.isKeyboardOpen}
                effectiveTemplate={props.effectiveTemplate}
                selectedTemplate={props.selectedTemplate}
                quoteSettings={props.quoteSettings}
                onChangeQuoteSettings={props.onChangeQuoteSettings}
                onResetQuoteSettings={props.onResetQuoteSettings}
                onUpdateActiveTemplateOverride={props.onUpdateActiveTemplateOverride}
                onTriggerSecondaryPhotoUpload={props.onTriggerSecondaryPhotoUpload}
                onDeleteSecondaryPhoto={props.onDeleteSecondaryPhoto}
                onCommitHistory={props.onCommitHistory}
              />
            ) : (
              props.selectedTemplate.styleType !== 'psd-overlay' && (
                <div className="grid grid-cols-2 gap-2">
                  <MobileColorRow label="মূল রং ১" value={activePal.bgPrimary} onChange={(v) => updatePaletteKey('bgPrimary', v)} />
                  <MobileColorRow label="মূল রং ২" value={activePal.bgSecondary} onChange={(v) => updatePaletteKey('bgSecondary', v)} />
                  <MobileColorRow label="অ্যাক্সেন্ট" value={activePal.accent} onChange={(v) => updatePaletteKey('accent', v)} />
                  <MobileColorRow label="বর্ডার" value={activePal.borderColor} onChange={(v) => updatePaletteKey('borderColor', v)} />
                </div>
              )
            )}
          </div>
        )}

        {/* Free Custom Text Editor */}
        {customText && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                টেক্সট
              </label>
              <input
                type="text"
                value={customText.text}
                onChange={(e) =>
                  props.onChangeCustomTexts((prev) =>
                    prev.map((c) => (c.id === customText.id ? { ...c, text: e.target.value } : c))
                  )
                }
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
              />
            </div>

            {!props.isKeyboardOpen && (
              <>
                <div>
                  <MobileSliderHeader
                    label="টেক্সটের সাইজ"
                    value={customText.fontSize}
                    min={16}
                    max={110}
                    suffix="px"
                    onChange={(fontSize) =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === customText.id ? { ...c, fontSize } : c))
                      )
                    }
                    onReset={() =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === customText.id ? { ...c, fontSize: 32 } : c))
                      )
                    }
                  />
                  <RangeSlider
                    min={16}
                    max={110}
                    value={customText.fontSize}
                    onChange={(fontSize) =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === customText.id ? { ...c, fontSize } : c))
                      )
                    }
                    ariaLabel="ফ্রি টেক্সট সাইজ"
                  />
                </div>
                <MobileColorRow
                  label="টেক্সট রং"
                  value={customText.color}
                  onChange={(color) =>
                    props.onChangeCustomTexts((prev) =>
                      prev.map((c) => (c.id === customText.id ? { ...c, color } : c))
                    )
                  }
                />
              </>
            )}
          </div>
        )}

        {/* Added Extra Image Editor */}
        {extraImage && (
          <div className="space-y-3">
            <div>
              <MobileSliderHeader
                label="ছবির প্রস্থ"
                value={Math.round(extraImage.widthPercent)}
                min={8}
                max={150}
                suffix="%"
                onChange={(widthPercent) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, widthPercent } : x))
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, widthPercent: 42 } : x))
                  )
                }
              />
              <RangeSlider
                min={8}
                max={150}
                value={Math.round(extraImage.widthPercent)}
                onChange={(widthPercent) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, widthPercent } : x))
                  )
                }
                ariaLabel="ছবি লেয়ারের প্রস্থ"
              />
            </div>

            <div>
              <MobileSliderHeader
                label="কোণা গোল (Radius)"
                value={extraImage.borderRadius}
                min={0}
                max={50}
                suffix="%"
                onChange={(borderRadius) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, borderRadius } : x))
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, borderRadius: 0 } : x))
                  )
                }
              />
              <RangeSlider
                min={0}
                max={50}
                value={extraImage.borderRadius}
                onChange={(borderRadius) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((x) => (x.id === extraImage.id ? { ...x, borderRadius } : x))
                  )
                }
                ariaLabel="ছবি লেয়ারের কোণা"
              />
            </div>

            <button
              type="button"
              onClick={() => props.onPromoteExtraImageToMain(extraImage.id)}
              className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white"
            >
              কার্ডের মূল ছবি হিসেবে বসান
            </button>
          </div>
        )}
      </div>
    );
  }

  // LAYER LIST VIEW (Mockup 2: Handle + 84×48 Live Thumbnail + Short Name + 44×44 Eye Toggle)
  return (
    <div className="space-y-2.5 pb-2">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#0F172A] dark:text-slate-100">লেয়ার</h3>
          <span className="text-[14px] font-semibold text-[#64748B] tabular-nums dark:text-slate-400">
            {toBengaliDigits(displayLayers.length)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAddMenu((v) => !v)}
          aria-expanded={showAddMenu}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl px-3 text-[13.5px] font-semibold text-[#4F46E5] active:bg-[#EEF2FF] dark:text-indigo-400 dark:active:bg-indigo-950/40"
        >
          <Plus className="h-4 w-4" />
          <span>যোগ করুন</span>
        </button>
      </div>

      {/* Add Layer Picker */}
      {showAddMenu && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-2 dark:border-[#1F2937] dark:bg-[#0B0F19]">
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(false);
              props.onTriggerAddExtraImage();
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-2.5 text-xs font-semibold text-white"
          >
            <ImagePlus className="h-4 w-4" />
            <span>ছবি লেয়ার</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(false);
              props.onPasteClipboardImage();
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
          >
            <ClipboardPaste className="h-4 w-4 text-[#4F46E5]" />
            <span>পেস্ট ছবি</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(false);
              props.onAddDirectCustomText();
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
          >
            <Pencil className="h-4 w-4 text-[#4F46E5]" />
            <span>ফ্রি টেক্সট</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(false);
              setForceShowSubheading(true);
              props.onSelectLayer('subheading');
              setSubView('edit');
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
          >
            <Plus className="h-4 w-4 text-[#4F46E5]" />
            <span>সাব-হেডিং</span>
          </button>
        </div>
      )}

      {/* Flat Single-Scroll Layer List (No nested scroll container!) */}
      <div className="space-y-2">
        {displayLayers.map((id, displayIdx) => {
          const isSelected = selectedId === id;
          const isVisible = props.layerVisibility[id] !== false;
          const shortName = getShortLayerName(id);
          const isDragging = draggingId === id;
          const isHoverTarget =
            draggingId !== null && dragHoverDisplayIdx === displayIdx && draggingId !== id;

          return (
            <div
              key={id}
              data-layer-row-id={id}
              data-layer-row-idx={displayIdx}
              onClick={() => {
                if (renamingId === id) return;
                props.onSelectLayer(id);
                setSubView('edit');
              }}
              className={`flex min-h-[64px] cursor-pointer items-center gap-2 rounded-xl border px-1.5 py-1.5 transition-all ${
                isSelected
                  ? 'border-[1.5px] border-[#4F46E5] bg-[#EEF2FF]/70 dark:border-indigo-400 dark:bg-indigo-950/45'
                  : 'border-[#E5E7EB] bg-white dark:border-[#1F2937] dark:bg-[#0B0F19]'
              } ${!isVisible ? 'opacity-45' : ''} ${
                isDragging ? 'scale-[0.99] ring-2 ring-[#4F46E5] shadow-md' : ''
              } ${isHoverTarget ? 'border-t-2 border-t-[#4F46E5]' : ''}`}
            >
              {/* Long-press Drag Grip (44×44 touch target) */}
              <button
                type="button"
                aria-label={`${shortName} ক্রম বদলান`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => startGripLongPress(e, id, displayIdx)}
                onPointerMove={moveGripDrag}
                onPointerUp={endGripDrag}
                onPointerCancel={endGripDrag}
                style={{ touchAction: draggingId ? 'none' : 'pan-y' }}
                className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-[#94A3B8] active:cursor-grabbing active:text-[#4F46E5]"
              >
                <GripVertical className="h-5 w-5" />
              </button>

              {/* 84×48 Isolated Layer Live Thumbnail */}
              <LayerThumbnailCanvas layerId={id} renderOpts={renderOpts} renderKey={renderKey} />

              {/* Short Name Only (long-press to rename inline) */}
              <div
                className="min-w-0 flex-1 px-1"
                onPointerDown={(e) => {
                  if (renamingId === id) return;
                  if (renameLongPressRef.current) window.clearTimeout(renameLongPressRef.current);
                  const currentTitle = shortName;
                  e.persist?.();
                  renameLongPressRef.current = window.setTimeout(() => {
                    setRenamingId(id);
                    setRenameDraft(currentTitle);
                    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                      navigator.vibrate(10);
                    }
                  }, 480);
                }}
                onPointerMove={() => {
                  if (renameLongPressRef.current) {
                    window.clearTimeout(renameLongPressRef.current);
                    renameLongPressRef.current = null;
                  }
                }}
                onPointerUp={() => {
                  if (renameLongPressRef.current) {
                    window.clearTimeout(renameLongPressRef.current);
                    renameLongPressRef.current = null;
                  }
                }}
                onPointerCancel={() => {
                  if (renameLongPressRef.current) {
                    window.clearTimeout(renameLongPressRef.current);
                    renameLongPressRef.current = null;
                  }
                }}
              >
                {renamingId === id ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => {
                        props.onRenameLayer(id, renameDraft);
                        setRenamingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          props.onRenameLayer(id, renameDraft);
                          setRenamingId(null);
                        }
                        if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-[#4F46E5] bg-white px-2 text-[16px] font-semibold text-[#0F172A] focus:outline-none dark:bg-[#111827] dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        props.onRenameLayer(id, renameDraft);
                        setRenamingId(null);
                      }}
                      aria-label="নাম সেভ করুন"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-white"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">
                    {shortName}
                  </p>
                )}
              </div>

              {/* Right 44×44 Eye Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleVisibility(id);
                  props.onFeedback?.(
                    `${shortName}: ${isVisible ? 'লুকানো' : 'দৃশ্যমান'} ✓`,
                    id
                  );
                }}
                aria-label={isVisible ? `${shortName} লুকান` : `${shortName} দেখান`}
                className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                  isVisible
                    ? 'text-[#475569] active:bg-slate-100 dark:text-slate-300 dark:active:bg-gray-800'
                    : 'text-[#EF4444] active:bg-red-50 dark:active:bg-red-950/30'
                }`}
              >
                {isVisible ? <Eye className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
