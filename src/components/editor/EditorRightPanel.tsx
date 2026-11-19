import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Crop,
  Download,
  Highlighter,
  ImagePlus,
  MousePointerClick,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type {
  CustomTextItem,
  ExportFormat,
  ExtraImageLayer,
  FontOption,
  HighlightRange,
  LineMode,
  LogoBadgeStyle,
  LogoSettings,
  LogoShape,
  QuoteCardSettings,
  SubheadingSettings,
  TemplateCategory,
  TemplateConfig,
  TemplateOverride,
} from '../../types/card';
import { toBengaliDigits } from '../../utils/projectStorage';
import { isQuoteStyleType } from '../../utils/quoteCardRenderer';
import { EditableNumberBadge } from '../EditableNumberBadge';
import { RangeSlider } from '../RangeSlider';
import { TemplateGallery } from '../TemplateGallery';
import type { EditorTabId } from './EditorSidebar';
import { LayersPanel } from './LayersPanel';
import { QuoteCustomizerSection } from './QuoteCustomizerSection';

export interface ParsedWord {
  index: number;
  text: string;
  start: number;
  end: number;
}

const TEXT_COLOR_PRESETS = [
  '#FFFFFF',
  '#0F172A',
  '#F59E0B',
  '#FACC15',
  '#EF4444',
  '#10B981',
  '#3B82F6',
  '#A855F7',
];

const HIGHLIGHT_COLOR_PRESETS = [
  '#ECE304',
  '#F59E0B',
  '#FFFFFF',
  '#EF4444',
  '#10B981',
  '#38BDF8',
  '#EC4899',
  '#0F172A',
];

interface EditorRightPanelProps {
  activeTab: EditorTabId;
  // Headline & Highlight
  headline: string;
  onHeadlineChange: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSyncTextareaSelection: () => void;
  highlightTab: 'words' | 'manual';
  onChangeHighlightTab: (tab: 'words' | 'manual') => void;
  parsedWords: ParsedWord[];
  isWordHighlighted: (word: ParsedWord) => boolean;
  onToggleWordHighlight: (word: ParsedWord) => void;
  onHighlightAllWords: () => void;
  onClearAllHighlights: () => void;
  onHighlightSelection: () => void;
  onRemoveSelectionHighlight: () => void;
  onResetAllNormal: () => void;
  selectionHint: string;
  hasHighlights: boolean;
  // Subheading & Floating Custom Text
  subheading: SubheadingSettings;
  onChangeSubheading: (updater: (prev: SubheadingSettings) => SubheadingSettings) => void;
  onResetSubheading: () => void;
  customTexts: CustomTextItem[];
  activeCustomTextId: string | null;
  onSelectCustomText: (id: string | null) => void;
  onChangeCustomTexts: (updater: (prev: CustomTextItem[]) => CustomTextItem[]) => void;
  onStartPencilMode: () => void;
  onAddDirectCustomText: () => void;
  // Card Kicker / Footer CTA / Website URL
  effectiveTemplate: TemplateConfig;
  selectedTemplate: TemplateConfig;
  onUpdateActiveTemplateOverride: (patch: TemplateOverride) => void;
  onResetActiveTemplateOverride: () => void;
  // Style Controls
  lineMode: LineMode;
  onChangeLineMode: (m: LineMode) => void;
  allFonts: FontOption[];
  activeFont: FontOption;
  onSelectFont: (id: string) => void;
  onTriggerFontUpload: () => void;
  onDeleteCustomFont: (fontId: string, e: React.MouseEvent) => void;
  fontSizePercent: number;
  onChangeFontSizePercent: (v: number) => void;
  lineGapPercent: number;
  onChangeLineGapPercent: (v: number) => void;
  textOffsetX: number;
  textOffsetY: number;
  onChangeTextOffset: (x: number, y: number) => void;
  textShadow: boolean;
  onChangeTextShadow: (v: boolean) => void;
  textColor: string;
  onChangeTextColor: (v: string) => void;
  highlightColor: string;
  onChangeHighlightColor: (v: string) => void;
  onResetColors: () => void;
  onResetStyleAll: () => void;
  // Photo Controls
  onTriggerPhotoUpload: () => void;
  photoDeleted?: boolean;
  onDeletePhoto?: () => void;
  photoZoom: number;
  onChangePhotoZoom: (v: number) => void;
  photoPanX: number;
  onChangePhotoPanX: (v: number) => void;
  photoPanY: number;
  onChangePhotoPanY: (v: number) => void;
  onResetPhoto: () => void;
  quoteSettings: QuoteCardSettings;
  onChangeQuoteSettings: (updater: (prev: QuoteCardSettings) => QuoteCardSettings) => void;
  onResetQuoteSettings: () => void;
  onTriggerSecondaryPhotoUpload: () => void;
  onDeleteSecondaryPhoto: () => void;
  onTriggerCustomFrameUpload: () => void;
  onResetToDefaultGreenTemplate: () => void;
  extractError: string | null;
  // Logo Controls
  logoSettings: LogoSettings;
  onChangeLogoSettings: (updater: (prev: LogoSettings) => LogoSettings) => void;
  onTriggerLogoUpload: () => void;
  onOpenLogoEditor: (dataUrl: string) => void;
  onCommitHistory: () => void;
  // Template Switcher
  onSelectTemplate: (tpl: TemplateConfig) => void;
  categoryNames: Record<string, string>;
  onRenameCategory: (cat: Exclude<TemplateCategory, 'সব'>, name: string) => void;
  onResetCategoryName: (cat: Exclude<TemplateCategory, 'সব'>) => void;
  templateOverrides: Record<string, TemplateOverride>;
  // Export Controls
  exportFormat: ExportFormat;
  onChangeExportFormat: (fmt: ExportFormat) => void;
  exportQuality: number;
  onChangeExportQuality: (q: number) => void;
  onDownload: () => void;
  downloadDone: boolean;
  // Layers Controls
  resolvedLayerOrder: string[];
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  layerVisibility: Record<string, boolean>;
  onToggleLayerVisibility: (layerId: string) => void;
  layerOpacity: Record<string, number>;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  layerLocks: Record<string, boolean>;
  onToggleLayerLock: (layerId: string) => void;
  onMoveLayerStep: (layerId: string, direction: 'up' | 'down') => void;
  onReorderVisualLayers: (fromVisualIdx: number, toVisualIdx: number) => void;
  onResetLayerSystem: () => void;
  onDeleteCustomText: (id: string) => void;
  extraImages: ExtraImageLayer[];
  onChangeExtraImages: (updater: (prev: ExtraImageLayer[]) => ExtraImageLayer[]) => void;
  onDeleteExtraImage: (id: string) => void;
  onTriggerAddExtraImage: () => void;
  onPromoteExtraImageToMain: (id: string) => void;
  dateText: string;
  onSwitchToTemplateTab: () => void;
}

const SliderHeader: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
  onReset: () => void;
  resetTitle?: string;
}> = ({ label, value, min, max, step = 1, suffix = '', onChange, onReset, resetTitle = 'ডিফল্টে ফেরত' }) => (
  <div className="mb-1.5 flex items-center justify-between gap-2">
    <span className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">{label}</span>
    <div className="flex items-center gap-1.5">
      <EditableNumberBadge
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        onChange={onChange}
        ariaLabel={label}
      />
      <button
        type="button"
        onClick={onReset}
        title={resetTitle}
        aria-label={`${label} ${resetTitle}`}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#64748B] transition-colors hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-slate-100"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

const AccordionSection: React.FC<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white dark:border-[#1F2937] dark:bg-[#0B0F19]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-gray-900"
      >
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
            {title}
          </p>
          {subtitle && !open && (
            <p className="truncate text-[11px] text-[#64748B] dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#E5E7EB] p-3.5 dark:border-[#1F2937]">
          {children}
        </div>
      )}
    </div>
  );
};

export const EditorRightPanel: React.FC<EditorRightPanelProps> = (props) => {
  const { activeTab } = props;
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fontMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [fontMenuOpen]);

  const countHighlightedWords = props.parsedWords.filter((w) => props.isWordHighlighted(w)).length;

  // 3x3 text offset grid presets
  const gridCells: Array<{ x: number; y: number; label: string }> = [
    { x: -0.22, y: -0.2, label: 'উপরে বামে' },
    { x: 0, y: -0.2, label: 'উপরে মাঝে' },
    { x: 0.22, y: -0.2, label: 'উপরে ডানে' },
    { x: -0.22, y: 0, label: 'মাঝে বামে' },
    { x: 0, y: 0, label: 'কেন্দ্রে' },
    { x: 0.22, y: 0, label: 'মাঝে ডানে' },
    { x: -0.22, y: 0.2, label: 'নিচে বামে' },
    { x: 0, y: 0.2, label: 'নিচে মাঝে' },
    { x: 0.22, y: 0.2, label: 'নিচে ডানে' },
  ];

  const isCellActive = (cx: number, cy: number) =>
    Math.abs(props.textOffsetX - cx) < 0.08 && Math.abs(props.textOffsetY - cy) < 0.08;

  return (
    <div className="space-y-4">
      {/* TAB 1: টেক্সট */}
      {activeTab === 'text' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="editor-headline-textarea"
                className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200"
              >
                শিরোনাম
              </label>
              <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-0.5 text-[11.5px] font-medium dark:border-[#1F2937] dark:bg-[#0B0F19]">
                <button
                  type="button"
                  onClick={() => props.onChangeHighlightTab('words')}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                    props.highlightTab === 'words'
                      ? 'bg-white text-[#4F46E5] font-semibold shadow-2xs dark:bg-[#111827] dark:text-indigo-300'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400'
                  }`}
                >
                  <MousePointerClick className="h-3 w-3" />
                  <span>শব্দে</span>
                </button>
                <button
                  type="button"
                  onClick={() => props.onChangeHighlightTab('manual')}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                    props.highlightTab === 'manual'
                      ? 'bg-white text-[#4F46E5] font-semibold shadow-2xs dark:bg-[#111827] dark:text-indigo-300'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400'
                  }`}
                >
                  <Highlighter className="h-3 w-3" />
                  <span>সিলেকশন</span>
                </button>
              </div>
            </div>

            <textarea
              id="editor-headline-textarea"
              ref={props.textareaRef}
              rows={3}
              value={props.headline}
              onChange={(e) => props.onHeadlineChange(e.target.value)}
              onSelect={props.onSyncTextareaSelection}
              onKeyUp={props.onSyncTextareaSelection}
              onMouseUp={props.onSyncTextareaSelection}
              onTouchEnd={props.onSyncTextareaSelection}
              placeholder="শিরোনাম এখানে লিখুন বা লিংক দিলে নিজে আসবে"
              className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-white p-3 text-[14.5px] leading-relaxed text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            />
          </div>

          {/* Highlight Words / Selection */}
          {props.highlightTab === 'words' ? (
            <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              <div className="flex items-center justify-between text-[12px] text-[#64748B] dark:text-slate-400">
                <span>হাইলাইট করতে শব্দে ক্লিক করুন</span>
                {countHighlightedWords > 0 && (
                  <span className="font-semibold text-[#4F46E5] tabular-nums dark:text-indigo-400">
                    {toBengaliDigits(countHighlightedWords)}টি শব্দ
                  </span>
                )}
              </div>

              {props.parsedWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {props.parsedWords.map((word) => {
                    const highlighted = props.isWordHighlighted(word);
                    return (
                      <button
                        key={`${word.index}-${word.start}`}
                        type="button"
                        onClick={() => props.onToggleWordHighlight(word)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-all active:scale-95 ${
                          highlighted
                            ? 'bg-[#F59E0B] text-slate-950 shadow-2xs ring-2 ring-[#F59E0B]/40'
                            : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:border-[#4F46E5]/50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                        }`}
                      >
                        {word.text}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-2 dark:border-[#1F2937]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={props.onHighlightAllWords}
                    disabled={props.parsedWords.length === 0}
                    className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#0F172A] hover:bg-slate-50 disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                  >
                    সব শব্দ
                  </button>
                  <button
                    type="button"
                    onClick={props.onClearAllHighlights}
                    disabled={!props.hasHighlights}
                    className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300"
                  >
                    সব মুছুন
                  </button>
                </div>
                <button
                  type="button"
                  onClick={props.onResetAllNormal}
                  className="cursor-pointer text-[11.5px] font-medium text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
                >
                  সব সাধারণ
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={props.onHighlightSelection}
                className="cursor-pointer rounded-lg bg-[#F59E0B] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                নির্বাচিত অংশ হাইলাইট
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={props.onRemoveSelectionHighlight}
                className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
              >
                হাইলাইট মুছুন
              </button>
              <button
                type="button"
                onClick={props.onResetAllNormal}
                className="cursor-pointer text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
              >
                সব সাধারণ
              </button>
            </div>
          )}

          {props.selectionHint && (
            <p className="text-xs font-medium text-[#F59E0B]">{props.selectionHint}</p>
          )}

          {isQuoteStyleType(props.effectiveTemplate.styleType) && (
            <QuoteCustomizerSection
              mode="text"
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

          {/* Accordion: Sub-heading & Pencil Custom Text */}
          <AccordionSection
            title="সাব-হেডিং ও নতুন টেক্সট"
            subtitle="শিরোনামের নিচে বা কার্ডের যেকোনো স্থানে লেখা যোগ"
            defaultOpen={Boolean(props.subheading.text.trim()) || props.customTexts.length > 0}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-medium text-[#0F172A] dark:text-slate-200">
                  সাব-হেডিং
                </label>
                {props.subheading.text.trim() && (
                  <button
                    type="button"
                    onClick={props.onResetSubheading}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#EF4444] hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>মুছুন</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={props.subheading.text}
                onChange={(e) =>
                  props.onChangeSubheading((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="যেমন: ঢাকা প্রতিনিধি / বিস্তারিত প্রতিবেদন..."
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />

              {props.subheading.text.trim() && (
                <div className="space-y-2.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 dark:border-[#1F2937] dark:bg-[#111827]">
                  <SliderHeader
                    label="সাব-হেডিং সাইজ"
                    value={props.subheading.fontSizePercent}
                    min={60}
                    max={180}
                    suffix="%"
                    onChange={(fontSizePercent) =>
                      props.onChangeSubheading((prev) => ({ ...prev, fontSizePercent }))
                    }
                    onReset={() =>
                      props.onChangeSubheading((prev) => ({ ...prev, fontSizePercent: 100 }))
                    }
                  />
                  <RangeSlider
                    min={60}
                    max={180}
                    value={props.subheading.fontSizePercent}
                    onChange={(fontSizePercent) =>
                      props.onChangeSubheading((prev) => ({ ...prev, fontSizePercent }))
                    }
                    ariaLabel="সাব-হেডিং সাইজ"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F172A] dark:text-slate-200">
                      <input
                        type="color"
                        value={props.subheading.color || props.textColor}
                        onChange={(e) =>
                          props.onChangeSubheading((prev) => ({ ...prev, color: e.target.value }))
                        }
                        className="swatch-picker h-6 w-6"
                      />
                      <span>সাব-হেডিং রং</span>
                    </label>
                    {(Math.abs(props.subheading.offsetX) > 0.005 ||
                      Math.abs(props.subheading.offsetY) > 0.005) && (
                      <button
                        type="button"
                        onClick={() =>
                          props.onChangeSubheading((prev) => ({
                            ...prev,
                            offsetX: 0,
                            offsetY: 0,
                          }))
                        }
                        className="cursor-pointer text-[11px] font-semibold text-[#4F46E5] hover:underline"
                      >
                        অবস্থান রিসেট
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5 border-t border-[#E5E7EB] pt-3 dark:border-[#1F2937]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={props.onStartPencilMode}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>পেন্সিল দিয়ে বসান</span>
                </button>
                <button
                  type="button"
                  onClick={props.onAddDirectCustomText}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>সরাসরি যোগ</span>
                </button>
              </div>

              {props.customTexts.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => props.onSelectCustomText(item.id)}
                  className={`space-y-2 rounded-lg border p-2.5 transition-colors ${
                    props.activeCustomTextId === item.id
                      ? 'border-[#4F46E5] bg-[#EEF2FF]/50 dark:bg-indigo-950/30'
                      : 'border-[#E5E7EB] bg-[#F7F8FA] dark:border-[#1F2937] dark:bg-[#111827]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] tabular-nums">
                      #{toBengaliDigits(idx + 1)}
                    </span>
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) =>
                        props.onChangeCustomTexts((prev) =>
                          prev.map((c) =>
                            c.id === item.id ? { ...c, text: e.target.value } : c
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onCommitHistory();
                        props.onChangeCustomTexts((prev) => prev.filter((c) => c.id !== item.id));
                        if (props.activeCustomTextId === item.id) props.onSelectCustomText(null);
                      }}
                      aria-label="টেক্সট মুছুন"
                      className="cursor-pointer rounded p-1 text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <SliderHeader
                    label="সাইজ"
                    value={item.fontSize}
                    min={16}
                    max={110}
                    suffix="px"
                    onChange={(fontSize) =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === item.id ? { ...c, fontSize } : c))
                      )
                    }
                    onReset={() =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === item.id ? { ...c, fontSize: 32 } : c))
                      )
                    }
                  />
                  <RangeSlider
                    min={16}
                    max={110}
                    value={item.fontSize}
                    onChange={(fontSize) =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) => (c.id === item.id ? { ...c, fontSize } : c))
                      )
                    }
                    ariaLabel="টেক্সটের সাইজ"
                  />

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) =>
                        props.onChangeCustomTexts((prev) =>
                          prev.map((c) =>
                            c.id === item.id ? { ...c, color: e.target.value } : c
                          )
                        )
                      }
                      className="swatch-picker h-6 w-6"
                      title="টেক্সটের রং"
                    />
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { label: 'খালি', val: null },
                          { label: 'কালো', val: 'rgba(15, 23, 42, 0.72)' },
                          { label: 'হলুদ', val: '#ece304' },
                        ] as const
                      ).map((bg) => (
                        <button
                          key={bg.label}
                          type="button"
                          onClick={() =>
                            props.onChangeCustomTexts((prev) =>
                              prev.map((c) =>
                                c.id === item.id
                                  ? {
                                      ...c,
                                      bgColor: bg.val,
                                      color:
                                        bg.val === '#ece304'
                                          ? '#111827'
                                          : bg.val
                                            ? '#ffffff'
                                            : c.color,
                                    }
                                  : c
                              )
                            )
                          }
                          className={`cursor-pointer rounded px-2 py-0.5 text-[10.5px] font-semibold ${
                            item.bgColor === bg.val
                              ? 'bg-[#4F46E5] text-white'
                              : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Accordion: Category Badge, Footer CTA, Website URL */}
          <AccordionSection
            title="ক্যাটাগরি ব্যাজ ও ফুটার টেক্সট"
            subtitle="ব্যাজ, বাটন ও ওয়েবসাইট ইউআরএল পরিবর্তন"
          >
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-[#64748B] dark:text-slate-300">
                  ক্যাটাগরি ব্যাজ / তারিখ
                </label>
                {Boolean(props.effectiveTemplate.kickerText?.trim()) && (
                  <button
                    type="button"
                    onClick={() => props.onUpdateActiveTemplateOverride({ kickerText: '' })}
                    className="cursor-pointer text-[11px] font-semibold text-[#EF4444] hover:underline"
                  >
                    মুছুন
                  </button>
                )}
              </div>
              <input
                type="text"
                value={props.effectiveTemplate.kickerText ?? ''}
                onChange={(e) =>
                  props.onUpdateActiveTemplateOverride({ kickerText: e.target.value })
                }
                placeholder="খালি রাখলে ব্যাজ দেখাবে না"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            {![
              'psd-overlay',
              'tv-jamuna',
              'paper-prothom-alo-2',
              'portal-jagonews',
              'paper-daily-star',
              'portal-bdnews24',
              'paper-ittefaq',
            ].includes(props.selectedTemplate.styleType) && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-[#64748B] dark:text-slate-300">
                    নিচের ফুটার লেখা (CTA)
                  </label>
                  {Boolean(
                    (props.effectiveTemplate.footerCtaText !== undefined
                      ? props.effectiveTemplate.footerCtaText
                      : 'বিস্তারিত কমেন্টে'
                    ).trim()
                  ) && (
                    <button
                      type="button"
                      onClick={() => props.onUpdateActiveTemplateOverride({ footerCtaText: '' })}
                      className="cursor-pointer text-[11px] font-semibold text-[#EF4444] hover:underline"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={props.effectiveTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                  onChange={(e) =>
                    props.onUpdateActiveTemplateOverride({ footerCtaText: e.target.value })
                  }
                  placeholder="খালি রাখলে ফুটার দেখাবে না"
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
              </div>
            )}

            {props.effectiveTemplate.hasWebsiteUrl && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-[#64748B] dark:text-slate-300">
                    ওয়েবসাইট ইউআরএল
                  </label>
                  {Boolean(props.effectiveTemplate.websiteUrl?.trim()) && (
                    <button
                      type="button"
                      onClick={() => props.onUpdateActiveTemplateOverride({ websiteUrl: '' })}
                      className="cursor-pointer text-[11px] font-semibold text-[#EF4444] hover:underline"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={props.effectiveTemplate.websiteUrl ?? ''}
                  onChange={(e) =>
                    props.onUpdateActiveTemplateOverride({ websiteUrl: e.target.value })
                  }
                  placeholder="যেমন: www.yoursite.com"
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={props.onResetActiveTemplateOverride}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                <span>ডিফল্ট লেখায় ফিরুন</span>
              </button>
            </div>
          </AccordionSection>
        </>
      )}

      {/* TAB 1B: লেয়ার */}
      {activeTab === 'layers' && (
        <LayersPanel
          resolvedLayerOrder={props.resolvedLayerOrder}
          selectedLayerId={props.selectedLayerId}
          onSelectLayer={props.onSelectLayer}
          layerVisibility={props.layerVisibility}
          onToggleVisibility={props.onToggleLayerVisibility}
          layerOpacity={props.layerOpacity}
          onChangeLayerOpacity={props.onChangeLayerOpacity}
          layerLocks={props.layerLocks}
          onToggleLock={props.onToggleLayerLock}
          onMoveLayerStep={props.onMoveLayerStep}
          onReorderVisualLayers={props.onReorderVisualLayers}
          onResetLayerSystem={props.onResetLayerSystem}
          headline={props.headline}
          onHeadlineChange={props.onHeadlineChange}
          parsedWords={props.parsedWords}
          isWordHighlighted={props.isWordHighlighted}
          onToggleWordHighlight={props.onToggleWordHighlight}
          onClearAllHighlights={props.onClearAllHighlights}
          hasHighlights={props.hasHighlights}
          lineMode={props.lineMode}
          onChangeLineMode={props.onChangeLineMode}
          allFonts={props.allFonts}
          activeFont={props.activeFont}
          onSelectFont={props.onSelectFont}
          fontSizePercent={props.fontSizePercent}
          onChangeFontSizePercent={props.onChangeFontSizePercent}
          lineGapPercent={props.lineGapPercent}
          onChangeLineGapPercent={props.onChangeLineGapPercent}
          textOffsetX={props.textOffsetX}
          textOffsetY={props.textOffsetY}
          onChangeTextOffset={props.onChangeTextOffset}
          textShadow={props.textShadow}
          onChangeTextShadow={props.onChangeTextShadow}
          textColor={props.textColor}
          onChangeTextColor={props.onChangeTextColor}
          highlightColor={props.highlightColor}
          onChangeHighlightColor={props.onChangeHighlightColor}
          subheading={props.subheading}
          onChangeSubheading={props.onChangeSubheading}
          onResetSubheading={props.onResetSubheading}
          customTexts={props.customTexts}
          onChangeCustomTexts={props.onChangeCustomTexts}
          onDeleteCustomText={props.onDeleteCustomText}
          onAddDirectCustomText={props.onAddDirectCustomText}
          onStartPencilMode={props.onStartPencilMode}
          extraImages={props.extraImages}
          onChangeExtraImages={props.onChangeExtraImages}
          onDeleteExtraImage={props.onDeleteExtraImage}
          onTriggerAddExtraImage={props.onTriggerAddExtraImage}
          onPromoteExtraImageToMain={props.onPromoteExtraImageToMain}
          photoZoom={props.photoZoom}
          onChangePhotoZoom={props.onChangePhotoZoom}
          photoPanX={props.photoPanX}
          onChangePhotoPanX={props.onChangePhotoPanX}
          photoPanY={props.photoPanY}
          onChangePhotoPanY={props.onChangePhotoPanY}
          onTriggerPhotoUpload={props.onTriggerPhotoUpload}
          photoDeleted={props.photoDeleted}
          onDeletePhoto={props.onDeletePhoto}
          onResetPhoto={props.onResetPhoto}
          quoteSettings={props.quoteSettings}
          onChangeQuoteSettings={props.onChangeQuoteSettings}
          onResetQuoteSettings={props.onResetQuoteSettings}
          onTriggerSecondaryPhotoUpload={props.onTriggerSecondaryPhotoUpload}
          onDeleteSecondaryPhoto={props.onDeleteSecondaryPhoto}
          logoSettings={props.logoSettings}
          onChangeLogoSettings={props.onChangeLogoSettings}
          onTriggerLogoUpload={props.onTriggerLogoUpload}
          onOpenLogoEditor={props.onOpenLogoEditor}
          effectiveTemplate={props.effectiveTemplate}
          selectedTemplate={props.selectedTemplate}
          dateText={props.dateText}
          onUpdateActiveTemplateOverride={props.onUpdateActiveTemplateOverride}
          onResetActiveTemplateOverride={props.onResetActiveTemplateOverride}
          onTriggerCustomFrameUpload={props.onTriggerCustomFrameUpload}
          onSwitchToTemplateTab={props.onSwitchToTemplateTab}
          onCommitHistory={props.onCommitHistory}
        />
      )}

      {/* TAB 2: স্টাইল */}
      {activeTab === 'style' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">স্টাইল</h3>
            <button
              type="button"
              onClick={props.onResetStyleAll}
              className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
            >
              <RotateCcw className="h-3 w-3" />
              <span>সব রিসেট</span>
            </button>
          </div>

          {/* Line Mode Segmented Control */}
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
              লাইন মোড
            </p>
            <div className="grid grid-cols-3 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              {(
                [
                  { key: 'auto', label: 'অটো' },
                  { key: 'one', label: 'এক লাইন' },
                  { key: 'two', label: 'দুই লাইন' },
                ] as const
              ).map((item) => {
                const active = props.lineMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => props.onChangeLineMode(item.key)}
                    className={`cursor-pointer rounded-md py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#0F172A] font-semibold shadow-2xs dark:bg-[#111827] dark:text-white'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Font Dropdown (each font previewed in its own fontFamily!) */}
          <div ref={fontMenuRef} className="relative">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
                ফন্ট
              </span>
              <button
                type="button"
                onClick={props.onTriggerFontUpload}
                className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-[#4F46E5] hover:underline dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>নতুন ফন্ট</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFontMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={fontMenuOpen}
              className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-left text-[14px] text-[#0F172A] transition-colors hover:border-[#4F46E5]/60 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#F7F8FA] text-xs font-bold text-[#0F172A] dark:bg-[#111827] dark:text-slate-200">
                  অ
                </span>
                <span
                  className="truncate font-semibold"
                  style={{ fontFamily: props.activeFont.family }}
                >
                  {props.activeFont.label}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${
                  fontMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {fontMenuOpen && (
              <div
                role="listbox"
                className="absolute left-0 right-0 z-30 mt-1.5 max-h-[250px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
              >
                {props.allFonts.map((f) => {
                  const selected = f.id === props.activeFont.id;
                  return (
                    <div
                      key={f.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        props.onSelectFont(f.id);
                        setFontMenuOpen(false);
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                        selected
                          ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold dark:bg-indigo-950/70 dark:text-indigo-300'
                          : 'text-[#0F172A] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="truncate" style={{ fontFamily: f.family }}>
                        {f.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {f.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => props.onDeleteCustomFont(f.id, e)}
                            title="ফন্ট মুছুন"
                            className="rounded p-0.5 text-[#EF4444] hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Text Size Slider + Reset */}
          <div>
            <SliderHeader
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
              step={1}
              value={props.fontSizePercent}
              onChange={props.onChangeFontSizePercent}
              ariaLabel="লেখার সাইজ"
            />
          </div>

          {/* Line Spacing Slider + Reset */}
          <div>
            <SliderHeader
              label="লাইন স্পেসিং"
              value={props.lineGapPercent}
              min={60}
              max={160}
              suffix="%"
              onChange={props.onChangeLineGapPercent}
              onReset={() => props.onChangeLineGapPercent(92)}
            />
            <RangeSlider
              min={60}
              max={160}
              step={1}
              value={props.lineGapPercent}
              onChange={props.onChangeLineGapPercent}
              ariaLabel="লাইন স্পেসিং"
            />
          </div>

          {/* Text Position (3x3 Grid + Editable Numeric X/Y) + Text Shadow Toggle */}
          <div className="grid grid-cols-[128px_1fr] items-start gap-4">
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-[#0F172A] dark:text-slate-200">
                লেখার অবস্থান
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                {gridCells.map((cell, i) => {
                  const active = isCellActive(cell.x, cell.y);
                  return (
                    <button
                      key={i}
                      type="button"
                      title={cell.label}
                      aria-label={cell.label}
                      onClick={() => props.onChangeTextOffset(cell.x, cell.y)}
                      className={`flex h-8 w-full cursor-pointer items-center justify-center rounded-md transition-colors ${
                        active
                          ? 'bg-[#4F46E5] text-white shadow-2xs'
                          : 'bg-white text-slate-400 hover:text-[#0F172A] dark:bg-[#111827] dark:hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          active ? 'bg-white' : 'bg-current'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <div className="flex items-center justify-between gap-1 text-[10.5px] text-[#64748B]">
                  <span>X</span>
                  <EditableNumberBadge
                    value={Math.round(props.textOffsetX * 100)}
                    min={-45}
                    max={45}
                    onChange={(val) => props.onChangeTextOffset(val / 100, props.textOffsetY)}
                    ariaLabel="লেখা ডানে-বামে X"
                    className="!min-w-[38px] !px-1 !text-[11px]"
                  />
                </div>
                <div className="flex items-center justify-between gap-1 text-[10.5px] text-[#64748B]">
                  <span>Y</span>
                  <EditableNumberBadge
                    value={Math.round(props.textOffsetY * 100)}
                    min={-45}
                    max={45}
                    onChange={(val) => props.onChangeTextOffset(props.textOffsetX, val / 100)}
                    ariaLabel="লেখা উপরে-নিচে Y"
                    className="!min-w-[38px] !px-1 !text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12.5px] font-medium text-[#0F172A] dark:text-slate-200">
                লেখার ছায়া
              </p>
              <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                <span className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
                  {props.textShadow ? 'চালু' : 'বন্ধ'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={props.textShadow}
                  onClick={() => props.onChangeTextShadow(!props.textShadow)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                    props.textShadow ? 'bg-[#4F46E5]' : 'bg-slate-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-150 ${
                      props.textShadow ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Text Color Swatches */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
                লেখার রং
              </span>
              <span className="font-mono text-[11.5px] uppercase text-[#64748B] tabular-nums dark:text-slate-400">
                {props.textColor}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TEXT_COLOR_PRESETS.map((hex) => {
                const active = props.textColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => props.onChangeTextColor(hex)}
                    aria-label={`লেখার রং ${hex}`}
                    className={`h-7 w-7 cursor-pointer rounded-full border border-slate-300 transition-transform hover:scale-110 dark:border-gray-700 ${
                      active ? 'ring-2 ring-[#4F46E5] ring-offset-2 dark:ring-offset-[#111827]' : ''
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
              <input
                type="color"
                value={props.textColor}
                onChange={(e) => props.onChangeTextColor(e.target.value)}
                title="কাস্টম রং"
                className="swatch-picker h-7 w-7"
              />
            </div>
          </div>

          {/* Highlight Color Swatches */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
                হাইলাইট রং
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11.5px] uppercase text-[#64748B] tabular-nums dark:text-slate-400">
                  {props.highlightColor}
                </span>
                <button
                  type="button"
                  onClick={props.onResetColors}
                  title="টেমপ্লেটের ডিফল্ট রং"
                  className="cursor-pointer text-[#64748B] hover:text-[#0F172A]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {HIGHLIGHT_COLOR_PRESETS.map((hex) => {
                const active = props.highlightColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => props.onChangeHighlightColor(hex)}
                    aria-label={`হাইলাইট রং ${hex}`}
                    className={`h-7 w-7 cursor-pointer rounded-full border border-slate-300 transition-transform hover:scale-110 dark:border-gray-700 ${
                      active ? 'ring-2 ring-[#4F46E5] ring-offset-2 dark:ring-offset-[#111827]' : ''
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
              <input
                type="color"
                value={props.highlightColor}
                onChange={(e) => props.onChangeHighlightColor(e.target.value)}
                title="কাস্টম হাইলাইট রং"
                className="swatch-picker h-7 w-7"
              />
            </div>
          </div>

          {isQuoteStyleType(props.effectiveTemplate.styleType) && (
            <QuoteCustomizerSection
              mode="style"
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
        </>
      )}

      {/* TAB 3: ছবি */}
      {activeTab === 'photo' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">ছবি</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={props.onTriggerPhotoUpload}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 text-[12.5px] font-semibold text-white hover:bg-[#4338CA]"
              >
                <ImagePlus className="h-4 w-4" />
                <span>নিজের ছবি দিন</span>
              </button>
              {props.onDeletePhoto && !props.photoDeleted && (
                <button
                  type="button"
                  onClick={props.onDeletePhoto}
                  title="ডিফল্ট বা বর্তমান ছবি মুছুন"
                  className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[12px] font-semibold text-[#EF4444] hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ছবি মুছুন</span>
                </button>
              )}
            </div>
          </div>

          {props.photoDeleted && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <span>মূল ছবি মুছে ফেলা হয়েছে।</span>
              <button
                type="button"
                onClick={props.onResetPhoto}
                className="shrink-0 cursor-pointer font-bold underline"
              >
                ডিফল্ট ফিরান
              </button>
            </div>
          )}

          {props.extractError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {props.extractError}
            </div>
          )}

          <div>
            <SliderHeader
              label="জুম"
              value={Math.round(props.photoZoom * 100)}
              min={100}
              max={300}
              suffix="%"
              onChange={(val) => props.onChangePhotoZoom(val / 100)}
              onReset={() => props.onChangePhotoZoom(1)}
            />
            <RangeSlider
              min={100}
              max={300}
              step={1}
              value={Math.round(props.photoZoom * 100)}
              onChange={(val) => props.onChangePhotoZoom(val / 100)}
              ariaLabel="ছবির জুম"
            />
          </div>

          <div>
            <SliderHeader
              label="ডানে-বামে (X)"
              value={props.photoPanX}
              min={-100}
              max={100}
              onChange={props.onChangePhotoPanX}
              onReset={() => props.onChangePhotoPanX(0)}
            />
            <RangeSlider
              min={-100}
              max={100}
              step={1}
              value={props.photoPanX}
              onChange={props.onChangePhotoPanX}
              ariaLabel="ছবি ডানে-বামে"
            />
          </div>

          <div>
            <SliderHeader
              label="উপরে-নিচে (Y)"
              value={props.photoPanY}
              min={-100}
              max={100}
              onChange={props.onChangePhotoPanY}
              onReset={() => props.onChangePhotoPanY(0)}
            />
            <RangeSlider
              min={-100}
              max={100}
              step={1}
              value={props.photoPanY}
              onChange={props.onChangePhotoPanY}
              ariaLabel="ছবি উপরে-নিচে"
            />
          </div>

          <button
            type="button"
            onClick={props.onResetPhoto}
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>ছবি আগের মতো করুন</span>
          </button>

          {isQuoteStyleType(props.effectiveTemplate.styleType) && (
            <QuoteCustomizerSection
              mode="photo"
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

          <AccordionSection title="আসল ফ্রেম PNG (কাস্টম টেমপ্লেট)">
            <button
              type="button"
              onClick={props.onTriggerCustomFrameUpload}
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F7F8FA] text-[13px] font-semibold text-[#0F172A] hover:border-[#4F46E5] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
            >
              <Upload className="h-4 w-4 text-[#4F46E5]" />
              <span>নিজের PNG ফ্রেম আপলোড</span>
            </button>
            {props.selectedTemplate.id.startsWith('custom-') && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="truncate font-medium">{props.effectiveTemplate.name}</span>
                <button
                  type="button"
                  onClick={props.onResetToDefaultGreenTemplate}
                  className="ml-2 cursor-pointer font-semibold underline"
                >
                  ডিফল্ট
                </button>
              </div>
            )}
          </AccordionSection>
        </>
      )}

      {/* TAB 4: লোগো */}
      {activeTab === 'logo' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">লোগো ও ওয়াটারমার্ক</h3>
            <button
              type="button"
              onClick={props.onTriggerLogoUpload}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 text-[12.5px] font-semibold text-white hover:bg-[#4338CA]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{props.logoSettings.dataUrl ? 'লোগো বদলান' : 'কাস্টম লোগো'}</span>
            </button>
          </div>

          {props.logoSettings.dataUrl && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => props.onOpenLogoEditor(props.logoSettings.dataUrl!)}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                <Crop className="h-3.5 w-3.5 text-[#4F46E5]" />
                <span>ক্রপ ও রিমুভ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onCommitHistory();
                  props.onChangeLogoSettings((prev) => ({
                    ...prev,
                    dataUrl: null,
                    hideDefaultBrand: false,
                    shape: 'original',
                  }));
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>অফিসিয়াল</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onCommitHistory();
                  props.onChangeLogoSettings((prev) => ({
                    ...prev,
                    dataUrl: null,
                    hideDefaultBrand: true,
                  }));
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-[#EF4444] hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>মুছুন</span>
              </button>
            </div>
          )}

          {/* Watermark / Hide Default Brand Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-3.5 py-2.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
            <div>
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
                ডিফল্ট ওয়াটারমার্ক / লোগো
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                বন্ধ করলে টেমপ্লেটের ডিফল্ট লোগো দেখাবে না
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!props.logoSettings.hideDefaultBrand}
              onClick={() => {
                props.onCommitHistory();
                props.onChangeLogoSettings((p) => ({
                  ...p,
                  hideDefaultBrand: !p.hideDefaultBrand,
                }));
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                !props.logoSettings.hideDefaultBrand ? 'bg-[#4F46E5]' : 'bg-slate-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-150 ${
                  !props.logoSettings.hideDefaultBrand ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {(props.logoSettings.dataUrl || !props.logoSettings.hideDefaultBrand) && (
            <>
              {/* Shape */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
                  লোগোর শেপ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'original', label: 'আসল' },
                      { id: 'square', label: 'চার কোণা' },
                      { id: 'rounded', label: 'রাউন্ডেড' },
                      { id: 'circle', label: 'গোল' },
                      { id: 'pill', label: 'পিল' },
                    ] as Array<{ id: LogoShape; label: string }>
                  ).map((shapeOpt) => {
                    const active = (props.logoSettings.shape ?? 'original') === shapeOpt.id;
                    return (
                      <button
                        key={shapeOpt.id}
                        type="button"
                        onClick={() =>
                          props.onChangeLogoSettings((prev) => ({ ...prev, shape: shapeOpt.id }))
                        }
                        className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#4F46E5] text-white'
                            : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                        }`}
                      >
                        {shapeOpt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scale Slider */}
              <div>
                <SliderHeader
                  label="লোগোর সাইজ"
                  value={props.logoSettings.scale}
                  min={25}
                  max={200}
                  suffix="%"
                  onChange={(scale) => props.onChangeLogoSettings((p) => ({ ...p, scale }))}
                  onReset={() => props.onChangeLogoSettings((p) => ({ ...p, scale: 100 }))}
                />
                <RangeSlider
                  min={25}
                  max={200}
                  value={props.logoSettings.scale}
                  onChange={(scale) => props.onChangeLogoSettings((p) => ({ ...p, scale }))}
                  ariaLabel="লোগোর আকার"
                />
              </div>

              {/* Position X & Y */}
              <div>
                <SliderHeader
                  label="লোগো ডানে-বামে (X)"
                  value={props.logoSettings.x}
                  min={-200}
                  max={200}
                  onChange={(x) => props.onChangeLogoSettings((p) => ({ ...p, x }))}
                  onReset={() => props.onChangeLogoSettings((p) => ({ ...p, x: 0 }))}
                />
                <RangeSlider
                  min={-200}
                  max={200}
                  value={props.logoSettings.x}
                  onChange={(x) => props.onChangeLogoSettings((p) => ({ ...p, x }))}
                  ariaLabel="লোগো ডানে-বামে"
                />
              </div>

              <div>
                <SliderHeader
                  label="লোগো উপরে-নিচে (Y)"
                  value={props.logoSettings.y}
                  min={-200}
                  max={200}
                  onChange={(y) => props.onChangeLogoSettings((p) => ({ ...p, y }))}
                  onReset={() => props.onChangeLogoSettings((p) => ({ ...p, y: 0 }))}
                />
                <RangeSlider
                  min={-200}
                  max={200}
                  value={props.logoSettings.y}
                  onChange={(y) => props.onChangeLogoSettings((p) => ({ ...p, y }))}
                  ariaLabel="লোগো উপরে-নিচে"
                />
              </div>

              <AccordionSection title="লোগো ব্যাকগ্রাউন্ড ব্যাজ" subtitle="গাঢ় কার্ডে দৃশ্যমানতার জন্য">
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'none', label: 'ব্যাজ ছাড়া' },
                      { id: 'frosted', label: 'হালকা গ্লাস' },
                      { id: 'white', label: 'সাদা ব্যাজ' },
                      { id: 'auto', label: 'অটো ব্যাজ' },
                    ] as Array<{ id: LogoBadgeStyle; label: string }>
                  ).map((opt) => {
                    const active = (props.logoSettings.badgeStyle ?? 'none') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          props.onChangeLogoSettings((prev) => ({ ...prev, badgeStyle: opt.id }))
                        }
                        className={`cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#4F46E5] text-white'
                            : 'border border-[#E5E7EB] bg-[#F7F8FA] text-[#0F172A] hover:bg-slate-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>
            </>
          )}
        </>
      )}

      {/* TAB 5: টেমপ্লেট */}
      {activeTab === 'template' && (
        <div className="space-y-3">
          <div>
            <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
              টেমপ্লেট বদলান
            </h3>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400">
              আপনার লেখা ও ছবি অপরিবর্তিত থাকবে
            </p>
          </div>
          <TemplateGallery
            selectedTemplateId={props.selectedTemplate.id}
            onSelectTemplate={props.onSelectTemplate}
            categoryNames={props.categoryNames}
            onRenameCategory={props.onRenameCategory}
            onResetCategoryName={props.onResetCategoryName}
            templateOverrides={props.templateOverrides}
          />
        </div>
      )}

      {/* TAB 6: এক্সপোর্ট */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">এক্সপোর্ট সেটিংস</h3>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
              ফাইল ফরম্যাট
            </p>
            <div className="grid grid-cols-2 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              {(['png', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => props.onChangeExportFormat(fmt)}
                  className={`cursor-pointer rounded-md py-2 text-[13px] font-semibold uppercase transition-colors ${
                    props.exportFormat === fmt
                      ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400'
                  }`}
                >
                  {fmt === 'png' ? 'PNG (স্বচ্ছ ও HD)' : 'JPG (ছোট ফাইল)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SliderHeader
              label="কোয়ালিটি"
              value={props.exportQuality}
              min={60}
              max={100}
              suffix="%"
              onChange={props.onChangeExportQuality}
              onReset={() => props.onChangeExportQuality(96)}
            />
            <RangeSlider
              min={60}
              max={100}
              step={1}
              value={props.exportQuality}
              onChange={props.onChangeExportQuality}
              ariaLabel="এক্সপোর্ট কোয়ালিটি"
            />
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 text-xs text-[#64748B] tabular-nums dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-400">
            <p className="font-semibold text-[#0F172A] dark:text-slate-200">
              রেজোলিউশন: {toBengaliDigits(props.effectiveTemplate.canvasWidth)} ×{' '}
              {toBengaliDigits(props.effectiveTemplate.canvasHeight)} px
            </p>
            <p className="mt-1">সোশ্যাল মিডিয়া পোস্ট ও প্রিন্টের জন্য প্রস্তুত</p>
          </div>

          <button
            type="button"
            onClick={props.onDownload}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 text-[14.5px] font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA]"
          >
            {props.downloadDone ? (
              <>
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>ডাউনলোড হয়েছে ✓</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>কার্ড ডাউনলোড করুন</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
