import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  ClipboardPaste,
  Crop,
  Download,
  Highlighter,
  MousePointerClick,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ALL_TEMPLATES, TEMPLATE_CATEGORIES } from '../../data/templates';
import type {
  CustomTextItem,
  ExportFormat,
  FontOption,
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
import type { EditorTabId } from './EditorSidebar';
import type { ParsedWord } from './EditorRightPanel';
import { QuoteCustomizerSection } from './QuoteCustomizerSection';

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

export interface MobilePanelsProps {
  activeTab: Exclude<EditorTabId, 'layers'>;
  isKeyboardOpen: boolean;
  onFeedback: (msg: string, layerId?: string) => void;
  // Text
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
  onChangeCustomTexts: (updater: (prev: CustomTextItem[]) => CustomTextItem[]) => void;
  onStartPencilMode: () => void;
  onAddDirectCustomText: () => void;
  onCommitHistory: () => void;
  // Footer / URL / Kicker
  effectiveTemplate: TemplateConfig;
  selectedTemplate: TemplateConfig;
  footerVisible: boolean;
  onToggleFooterVisible: () => void;
  onUpdateActiveTemplateOverride: (patch: TemplateOverride) => void;
  onResetActiveTemplateOverride: () => void;
  // Style
  lineMode: LineMode;
  onChangeLineMode: (m: LineMode) => void;
  allFonts: FontOption[];
  activeFont: FontOption;
  onSelectFont: (id: string) => void;
  onTriggerFontUpload: () => void;
  fontSizePercent: number;
  onChangeFontSizePercent: (v: number) => void;
  lineGapPercent: number;
  onChangeLineGapPercent: (v: number) => void;
  headlineAlign: 'left' | 'center' | 'right';
  onChangeHeadlineAlign: (align: 'left' | 'center' | 'right') => void;
  textShadow: boolean;
  onChangeTextShadow: (v: boolean) => void;
  textColor: string;
  onChangeTextColor: (v: string) => void;
  highlightColor: string;
  onChangeHighlightColor: (v: string) => void;
  onResetStyleAll: () => void;
  // Photo
  onTriggerPhotoUpload: () => void;
  onPasteClipboardImage: () => void;
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
  // Logo
  logoSettings: LogoSettings;
  onChangeLogoSettings: (updater: (prev: LogoSettings) => LogoSettings) => void;
  onTriggerLogoUpload: () => void;
  onOpenLogoEditor: (dataUrl: string) => void;
  // Template
  onSelectTemplate: (tpl: TemplateConfig) => void;
  categoryNames: Record<string, string>;
  templateOverrides: Record<string, TemplateOverride>;
  // Export
  exportFormat: ExportFormat;
  onChangeExportFormat: (fmt: ExportFormat) => void;
  exportQuality: number;
  onChangeExportQuality: (q: number) => void;
  onExportAndSave: () => void;
  downloadDone: boolean;
}

const SliderHeaderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (val: number) => void;
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

const MobileAccordion: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, open, onToggle, children }) => (
  <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white dark:border-[#1F2937] dark:bg-[#0B0F19]">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left text-[13.5px] font-semibold text-[#0F172A] active:bg-slate-50 dark:text-slate-100 dark:active:bg-gray-900"
    >
      <span className="truncate">{title}</span>
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

export const MobilePanels: React.FC<MobilePanelsProps> = (props) => {
  const [subAccordionOpen, setSubAccordionOpen] = useState(false);
  const [footerAccordionOpen, setFooterAccordionOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Template state
  const [tplSearch, setTplSearch] = useState('');
  const [tplCategory, setTplCategory] = useState<TemplateCategory>('সব');
  const [visibleTplCount, setVisibleTplCount] = useState(12);
  const tplSentinelRef = useRef<HTMLDivElement | null>(null);

  const resolvedTemplates = useMemo(() => {
    return ALL_TEMPLATES.map((tpl) => {
      const ov = props.templateOverrides[tpl.id];
      if (!ov) return tpl;
      return {
        ...tpl,
        name: ov.name !== undefined && ov.name.trim() ? ov.name : tpl.name,
        category: ov.category || tpl.category,
        kickerText: ov.kickerText !== undefined ? ov.kickerText : tpl.kickerText,
      };
    });
  }, [props.templateOverrides]);

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return resolvedTemplates.filter((t) => {
      const catMatch = tplCategory === 'সব' || t.category === tplCategory;
      const catLabel = (props.categoryNames[t.category]?.trim() || t.category).toLowerCase();
      const queryMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        catLabel.includes(q);
      return catMatch && queryMatch;
    });
  }, [resolvedTemplates, tplSearch, tplCategory, props.categoryNames]);

  useEffect(() => {
    setVisibleTplCount(12);
  }, [tplSearch, tplCategory, props.activeTab]);

  useEffect(() => {
    if (props.activeTab !== 'template') return;
    const node = tplSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleTplCount((prev) => Math.min(filteredTemplates.length, prev + 12));
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.activeTab, filteredTemplates.length, visibleTplCount]);

  // Auto-resize headline textarea up to ~3 lines smoothly
  useEffect(() => {
    const el = props.textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(104, Math.max(58, el.scrollHeight))}px`;
  }, [props.headline, props.textareaRef, props.activeTab]);

  // TAB: টেক্সট
  if (props.activeTab === 'text') {
    const onlyHeadlineInput = props.isKeyboardOpen && (focusedField === 'headline' || !focusedField);

    return (
      <div className="space-y-3.5 pb-2">
        {(!props.isKeyboardOpen || onlyHeadlineInput) && (
          <div className="space-y-2">
            {!props.isKeyboardOpen && (
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="mobile-headline-textarea"
                  className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-200"
                >
                  শিরোনাম
                </label>
                <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-0.5 text-xs font-medium dark:border-[#1F2937] dark:bg-[#0B0F19]">
                  <button
                    type="button"
                    onClick={() => props.onChangeHighlightTab('words')}
                    className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-3 transition-colors ${
                      props.highlightTab === 'words'
                        ? 'bg-white text-[#4F46E5] font-semibold shadow-2xs dark:bg-[#111827] dark:text-indigo-300'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    <span>শব্দে</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onChangeHighlightTab('manual')}
                    className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-3 transition-colors ${
                      props.highlightTab === 'manual'
                        ? 'bg-white text-[#4F46E5] font-semibold shadow-2xs dark:bg-[#111827] dark:text-indigo-300'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    <Highlighter className="h-3.5 w-3.5" />
                    <span>সিলেকশন</span>
                  </button>
                </div>
              </div>
            )}

            <textarea
              id="mobile-headline-textarea"
              ref={props.textareaRef}
              rows={2}
              value={props.headline}
              onFocus={() => setFocusedField('headline')}
              onBlur={() => setFocusedField((prev) => (prev === 'headline' ? null : prev))}
              onChange={(e) => props.onHeadlineChange(e.target.value)}
              onSelect={props.onSyncTextareaSelection}
              onKeyUp={props.onSyncTextareaSelection}
              onTouchEnd={props.onSyncTextareaSelection}
              placeholder="শিরোনাম এখানে লিখুন..."
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-[16px] leading-snug text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            />
          </div>
        )}

        {!props.isKeyboardOpen && (
          <>
            {/* Horizontal single-row word highlight chips */}
            {props.highlightTab === 'words' ? (
              <div className="space-y-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                {props.parsedWords.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1">
                    {props.parsedWords.map((word) => {
                      const highlighted = props.isWordHighlighted(word);
                      return (
                        <button
                          key={`${word.index}-${word.start}`}
                          type="button"
                          onClick={() => {
                            props.onToggleWordHighlight(word);
                            props.onFeedback(
                              highlighted ? `"${word.text}" সাধারণ করা হয়েছে` : `"${word.text}" হাইলাইট ✓`,
                              'headline'
                            );
                          }}
                          className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold whitespace-nowrap active:scale-95 ${
                            highlighted
                              ? 'bg-[#F59E0B] text-slate-950 ring-2 ring-[#F59E0B]/40'
                              : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                          }`}
                        >
                          {word.text}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      props.onHighlightAllWords();
                      props.onFeedback('সব শব্দ হাইলাইট ✓', 'headline');
                    }}
                    disabled={props.parsedWords.length === 0}
                    className="min-h-[44px] cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                  >
                    সব শব্দ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      props.onClearAllHighlights();
                      props.onFeedback('হাইলাইট মোছা হয়েছে', 'headline');
                    }}
                    disabled={!props.hasHighlights}
                    className="min-h-[44px] cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#64748B] disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300"
                  >
                    সব মুছুন
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={props.onHighlightSelection}
                  className="min-h-[44px] cursor-pointer rounded-xl bg-[#F59E0B] px-3 text-xs font-bold text-slate-950"
                >
                  সিলেকশন হাইলাইট
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={props.onRemoveSelectionHighlight}
                  className="min-h-[44px] cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                >
                  হাইলাইট মুছুন
                </button>
              </div>
            )}

            {props.selectionHint && (
              <p className="text-xs font-medium text-[#F59E0B]">{props.selectionHint}</p>
            )}
          </>
        )}

        {isQuoteStyleType(props.effectiveTemplate.styleType) &&
          (!props.isKeyboardOpen || focusedField === 'quote') && (
            <QuoteCustomizerSection
              mode="text"
              mobile
              isKeyboardOpen={props.isKeyboardOpen}
              onFocusField={() => setFocusedField('quote')}
              onBlurField={() => setFocusedField((prev) => (prev === 'quote' ? null : prev))}
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

        {/* Accordion: + সাব-হেডিং ও পেন্সিল */}
        {(!props.isKeyboardOpen || focusedField === 'subheading' || focusedField === 'customText') && (
          <MobileAccordion
            title="＋ সাব-হেডিং ও পেন্সিল টেক্সট"
            open={subAccordionOpen || focusedField === 'subheading' || focusedField === 'customText'}
            onToggle={() => setSubAccordionOpen((v) => !v)}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  সাব-হেডিং
                </label>
                {props.subheading.text.trim() && (
                  <button
                    type="button"
                    onClick={props.onResetSubheading}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 px-2 text-xs font-semibold text-[#EF4444]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>মুছুন</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={props.subheading.text}
                onFocus={() => setFocusedField('subheading')}
                onBlur={() => setFocusedField((prev) => (prev === 'subheading' ? null : prev))}
                onChange={(e) =>
                  props.onChangeSubheading((p) => ({ ...p, text: e.target.value }))
                }
                placeholder="যেমন: বিশেষ প্রতিনিধি / বিস্তারিত"
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            {!props.isKeyboardOpen && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={props.onStartPencilMode}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 text-xs font-semibold text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>পেন্সিল (কার্ডে ট্যাপ)</span>
                </button>
                <button
                  type="button"
                  onClick={props.onAddDirectCustomText}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5 text-[#4F46E5]" />
                  <span>সরাসরি টেক্সট</span>
                </button>
              </div>
            )}

            {props.customTexts.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={item.text}
                  onFocus={() => setFocusedField('customText')}
                  onBlur={() => setFocusedField((prev) => (prev === 'customText' ? null : prev))}
                  onChange={(e) =>
                    props.onChangeCustomTexts((prev) =>
                      prev.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c))
                    )
                  }
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
                {!props.isKeyboardOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      props.onCommitHistory();
                      props.onChangeCustomTexts((prev) => prev.filter((c) => c.id !== item.id));
                    }}
                    aria-label="টেক্সট মুছুন"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#EF4444]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </MobileAccordion>
        )}

        {/* Accordion: ফুটার ও ওয়েবসাইট */}
        {(!props.isKeyboardOpen ||
          focusedField === 'footerUrl' ||
          focusedField === 'footerCta' ||
          focusedField === 'kicker') && (
          <MobileAccordion
            title="ফুটার ও ওয়েবসাইট"
            open={
              footerAccordionOpen ||
              focusedField === 'footerUrl' ||
              focusedField === 'footerCta' ||
              focusedField === 'kicker'
            }
            onToggle={() => setFooterAccordionOpen((v) => !v)}
          >
            {!props.isKeyboardOpen && (
              <button
                type="button"
                onClick={props.onToggleFooterVisible}
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-3 text-sm font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
              >
                <span>ফুটার কার্ডে দেখান</span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    props.footerVisible ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-[#64748B]'
                  }`}
                >
                  {props.footerVisible ? 'চালু' : 'বন্ধ'}
                </span>
              </button>
            )}

            {(!props.isKeyboardOpen || focusedField === 'footerUrl') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  ওয়েবসাইট ইউআরএল
                </label>
                <input
                  type="text"
                  value={props.effectiveTemplate.websiteUrl ?? ''}
                  onFocus={() => setFocusedField('footerUrl')}
                  onBlur={() => setFocusedField((prev) => (prev === 'footerUrl' ? null : prev))}
                  onChange={(e) =>
                    props.onUpdateActiveTemplateOverride({ websiteUrl: e.target.value })
                  }
                  placeholder="যেমন: www.yoursite.com"
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
              </div>
            )}

            {(!props.isKeyboardOpen || focusedField === 'footerCta') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  নিচের ফুটার লেখা (CTA)
                </label>
                <input
                  type="text"
                  value={props.effectiveTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                  onFocus={() => setFocusedField('footerCta')}
                  onBlur={() => setFocusedField((prev) => (prev === 'footerCta' ? null : prev))}
                  onChange={(e) =>
                    props.onUpdateActiveTemplateOverride({ footerCtaText: e.target.value })
                  }
                  placeholder="যেমন: বিস্তারিত কমেন্টে"
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
              </div>
            )}

            {(!props.isKeyboardOpen || focusedField === 'kicker') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  ক্যাটাগরি ব্যাজ / তারিখ
                </label>
                <input
                  type="text"
                  value={props.effectiveTemplate.kickerText ?? ''}
                  onFocus={() => setFocusedField('kicker')}
                  onBlur={() => setFocusedField((prev) => (prev === 'kicker' ? null : prev))}
                  onChange={(e) =>
                    props.onUpdateActiveTemplateOverride({ kickerText: e.target.value })
                  }
                  placeholder="খালি রাখলে ব্যাজ দেখাবে না"
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[16px] text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                />
              </div>
            )}
          </MobileAccordion>
        )}
      </div>
    );
  }

  // TAB: স্টাইল
  if (props.activeTab === 'style') {
    return (
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">স্টাইল</h3>
          <button
            type="button"
            onClick={() => {
              props.onResetStyleAll();
              props.onFeedback('স্টাইল রিসেট হয়েছে ✓', 'headline');
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[#64748B] active:bg-slate-100 dark:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>সব রিসেট</span>
          </button>
        </div>

        {/* Line Mode 3-way Segmented Control */}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            লাইন মোড
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
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
                  onClick={() => {
                    props.onChangeLineMode(item.key);
                    props.onFeedback(`শিরোনাম: ${item.label} ✓`, 'headline');
                  }}
                  className={`min-h-[44px] cursor-pointer rounded-lg text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                      : 'text-[#64748B] dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizontal Font Carousel */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
              ফন্ট
            </span>
            <button
              type="button"
              onClick={props.onTriggerFontUpload}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 px-2 text-xs font-semibold text-[#4F46E5] dark:text-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>নতুন ফন্ট</span>
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
            {props.allFonts.map((f) => {
              const selected = f.id === props.activeFont.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    props.onSelectFont(f.id);
                    props.onFeedback(`ফন্ট: ${f.label} ✓`, 'headline');
                  }}
                  className={`flex min-h-[60px] min-w-[116px] shrink-0 cursor-pointer flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-[1.5px] border-[#4F46E5] bg-[#EEF2FF]/75 text-[#4F46E5] dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                  }`}
                >
                  <span
                    className="truncate max-w-[104px] text-[15px] font-bold leading-tight"
                    style={{ fontFamily: f.family }}
                  >
                    আজকের খবর
                  </span>
                  <span className="mt-0.5 max-w-[104px] truncate text-xs text-[#64748B] dark:text-slate-400">
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size Slider */}
        <div>
          <SliderHeaderRow
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

        {/* Line Gap Slider */}
        <div>
          <SliderHeaderRow
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
            value={props.lineGapPercent}
            onChange={props.onChangeLineGapPercent}
            ariaLabel="লাইন স্পেসিং"
          />
        </div>

        {/* Alignment Segmented Control */}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            লেখার অবস্থান
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
            {(
              [
                { key: 'left', label: 'বামে', Icon: AlignLeft },
                { key: 'center', label: 'মাঝে', Icon: AlignCenter },
                { key: 'right', label: 'ডানে', Icon: AlignRight },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = props.headlineAlign === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    props.onChangeHeadlineAlign(key);
                    props.onFeedback(`অবস্থান: ${label} ✓`, 'headline');
                  }}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                      : 'text-[#64748B] dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Color Row (44x44 swatches) */}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            লেখার রং
          </p>
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden py-1">
            {TEXT_COLOR_PRESETS.map((c) => {
              const active = props.textColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    props.onChangeTextColor(c);
                    props.onFeedback('লেখার রং বদলানো হয়েছে ✓', 'headline');
                  }}
                  aria-label={`লেখার রং ${c}`}
                  className={`h-11 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-transform active:scale-95 ${
                    active ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/35' : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
            <input
              type="color"
              value={props.textColor}
              onChange={(e) => props.onChangeTextColor(e.target.value)}
              aria-label="কাস্টম লেখার রং"
              className="swatch-picker h-11 w-11 shrink-0"
            />
          </div>
        </div>

        {/* Highlight Color Row (44x44 swatches) */}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            হাইলাইট রং
          </p>
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden py-1">
            {HIGHLIGHT_COLOR_PRESETS.map((c) => {
              const active = props.highlightColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    props.onChangeHighlightColor(c);
                    props.onFeedback('হাইলাইট রং বদলানো হয়েছে ✓', 'headline');
                  }}
                  aria-label={`হাইলাইট রং ${c}`}
                  className={`h-11 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-transform active:scale-95 ${
                    active ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/35' : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
            <input
              type="color"
              value={props.highlightColor}
              onChange={(e) => props.onChangeHighlightColor(e.target.value)}
              aria-label="কাস্টম হাইলাইট রং"
              className="swatch-picker h-11 w-11 shrink-0"
            />
          </div>
        </div>

        {/* Text Shadow Switch */}
        <button
          type="button"
          onClick={() => {
            const next = !props.textShadow;
            props.onChangeTextShadow(next);
            props.onFeedback(next ? 'লেখার ছায়া চালু ✓' : 'লেখার ছায়া বন্ধ', 'headline');
          }}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
        >
          <span>লেখার ছায়া</span>
          <span
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              props.textShadow
                ? 'bg-[#4F46E5] text-white'
                : 'bg-slate-100 text-[#64748B] dark:bg-gray-800 dark:text-slate-300'
            }`}
          >
            {props.textShadow ? 'চালু' : 'বন্ধ'}
          </span>
        </button>

        {isQuoteStyleType(props.effectiveTemplate.styleType) && (
          <QuoteCustomizerSection
            mode="style"
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
    );
  }

  // TAB: ছবি
  if (props.activeTab === 'photo') {
    return (
      <div className="space-y-3.5 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={props.onTriggerPhotoUpload}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 text-sm font-semibold text-white active:bg-[#4338CA]"
          >
            <Upload className="h-4 w-4" />
            <span>নিজের ছবি দিন</span>
          </button>
          <button
            type="button"
            onClick={props.onPasteClipboardImage}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            <ClipboardPaste className="h-4 w-4 text-[#4F46E5]" />
            <span>পেস্ট ছবি</span>
          </button>
        </div>

        <p className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-xs font-medium text-[#64748B] dark:bg-[#0B0F19] dark:text-slate-400">
          কার্ডে আঙুল দিয়ে ছবি সরান ও দুই আঙুলে পিঞ্চ করে জুম করুন।
        </p>

        <div>
          <SliderHeaderRow
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

        <div>
          <SliderHeaderRow
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
            value={props.photoPanX}
            onChange={props.onChangePhotoPanX}
            ariaLabel="ছবির X"
          />
        </div>

        <div>
          <SliderHeaderRow
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
            value={props.photoPanY}
            onChange={props.onChangePhotoPanY}
            ariaLabel="ছবির Y"
          />
        </div>

        {props.photoDeleted && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span>মূল ছবি মুছে ফেলা হয়েছে।</span>
            <button
              type="button"
              onClick={() => {
                props.onResetPhoto();
                props.onFeedback('ডিফল্ট ছবি ফিরানো হয়েছে ✓', 'photo');
              }}
              className="min-h-[44px] shrink-0 cursor-pointer px-2 font-bold underline"
            >
              ডিফল্ট ফিরান
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              props.onResetPhoto();
              props.onFeedback('ছবি আগের মতো হয়েছে', 'photo');
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>আগের ছবি</span>
          </button>
          {props.onDeletePhoto && !props.photoDeleted ? (
            <button
              type="button"
              onClick={() => {
                props.onDeletePhoto?.();
                props.onFeedback('ছবি মুছে ফেলা হয়েছে', 'photo');
              }}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-[#EF4444] dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ছবি মুছুন</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onTriggerCustomFrameUpload}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
            >
              <Upload className="h-3.5 w-3.5 text-[#4F46E5]" />
              <span>কাস্টম ফ্রেম PNG</span>
            </button>
          )}
        </div>

        {props.onDeletePhoto && !props.photoDeleted && (
          <button
            type="button"
            onClick={props.onTriggerCustomFrameUpload}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            <Upload className="h-3.5 w-3.5 text-[#4F46E5]" />
            <span>কাস্টম ফ্রেম PNG</span>
          </button>
        )}

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
    );
  }

  // TAB: লোগো
  if (props.activeTab === 'logo') {
    return (
      <div className="space-y-3.5 pb-2">
        <button
          type="button"
          onClick={() => {
            props.onCommitHistory();
            props.onChangeLogoSettings((p) => ({
              ...p,
              hideDefaultBrand: !p.hideDefaultBrand,
            }));
            props.onFeedback('লোগো বদলানো হয়েছে ✓', 'logo');
          }}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
        >
          <span>ডিফল্ট ওয়াটারমার্ক</span>
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              !props.logoSettings.hideDefaultBrand
                ? 'bg-[#4F46E5] text-white'
                : 'bg-slate-100 text-[#64748B]'
            }`}
          >
            {!props.logoSettings.hideDefaultBrand ? 'চালু' : 'বন্ধ'}
          </span>
        </button>

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
              <span>ক্রপ ও রিমুভ</span>
            </button>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            লোগো শেপ
          </p>
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
                onClick={() => {
                  props.onChangeLogoSettings((p) => ({ ...p, shape: s.id }));
                  props.onFeedback(`লোগো শেপ: ${s.label} ✓`, 'logo');
                }}
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
        </div>

        <div>
          <SliderHeaderRow
            label="লোগো সাইজ"
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
            ariaLabel="লোগো সাইজ"
          />
        </div>

        <div>
          <SliderHeaderRow
            label="লোগো X"
            value={props.logoSettings.x}
            min={-150}
            max={150}
            onChange={(x) => props.onChangeLogoSettings((p) => ({ ...p, x }))}
            onReset={() => props.onChangeLogoSettings((p) => ({ ...p, x: 0 }))}
          />
          <RangeSlider
            min={-150}
            max={150}
            value={props.logoSettings.x}
            onChange={(x) => props.onChangeLogoSettings((p) => ({ ...p, x }))}
            ariaLabel="লোগো X"
          />
        </div>

        <div>
          <SliderHeaderRow
            label="লোগো Y"
            value={props.logoSettings.y}
            min={-150}
            max={150}
            onChange={(y) => props.onChangeLogoSettings((p) => ({ ...p, y }))}
            onReset={() => props.onChangeLogoSettings((p) => ({ ...p, y: 0 }))}
          />
          <RangeSlider
            min={-150}
            max={150}
            value={props.logoSettings.y}
            onChange={(y) => props.onChangeLogoSettings((p) => ({ ...p, y }))}
            ariaLabel="লোগো Y"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
            ব্যাজ স্টাইল
          </p>
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
      </div>
    );
  }

  // TAB: টেমপ্লেট (Single horizontal category row + Lazy-loaded 2-column grid)
  if (props.activeTab === 'template') {
    const visibleTemplates = filteredTemplates.slice(0, visibleTplCount);

    return (
      <div className="space-y-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={tplSearch}
            onChange={(e) => setTplSearch(e.target.value)}
            placeholder="টেমপ্লেট বা ক্যাটাগরি খুঁজুন..."
            aria-label="টেমপ্লেট খুঁজুন"
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-3 text-[16px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
          />
        </div>

        {/* Single Horizontal Category Row */}
        {!props.isKeyboardOpen && (
          <>
            <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const isActive = tplCategory === cat;
                const displayLabel =
                  cat === 'সব' ? 'সব' : props.categoryNames[cat]?.trim() || cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTplCategory(cat)}
                    className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap ${
                      isActive
                        ? 'bg-[#4F46E5] text-white'
                        : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                    }`}
                  >
                    <span>{displayLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {visibleTemplates.map((tpl) => {
                const isSelected = tpl.id === props.selectedTemplate.id;
                const bgPrimary =
                  tpl.id === 'psd-green'
                    ? '#024c4b'
                    : tpl.id === 'psd-maroon'
                      ? '#65142a'
                      : tpl.palette?.bgPrimary || '#1e293b';
                const bgSecondary =
                  tpl.id === 'psd-green'
                    ? '#ffffff'
                    : tpl.id === 'psd-maroon'
                      ? '#490c1d'
                      : tpl.palette?.bgSecondary || '#0f172a';
                const accent =
                  tpl.id === 'psd-green'
                    ? '#01665e'
                    : tpl.id === 'psd-maroon'
                      ? '#ffd132'
                      : tpl.palette?.accent || '#4F46E5';

                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      props.onSelectTemplate(tpl);
                      props.onFeedback(`টেমপ্লেট: ${tpl.name} ✓`, 'frame');
                    }}
                    className={`group relative flex min-h-[44px] cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[1.5px] border-[#4F46E5] ring-2 ring-[#4F46E5]/25'
                        : 'border-[#E5E7EB] dark:border-[#1F2937]'
                    }`}
                  >
                    <div
                      className="relative flex aspect-square w-full flex-col justify-between p-2"
                      style={{
                        background: `linear-gradient(145deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`,
                      }}
                    >
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      )}
                      <div className="space-y-1 px-1 pt-1">
                        <div
                          className="mx-auto h-1.5 w-4/5 rounded-sm"
                          style={{ backgroundColor: tpl.defaultTextColor }}
                        />
                        <div
                          className="mx-auto h-1.5 w-3/5 rounded-sm"
                          style={{ backgroundColor: tpl.defaultHighlightColor }}
                        />
                      </div>
                      <div
                        className="mx-1 my-1.5 flex-1 rounded-sm border bg-slate-300/80"
                        style={{ borderColor: accent }}
                      />
                      <div
                        className="mx-auto h-2 w-1/2 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    </div>

                    <div className="bg-white px-2.5 py-2 dark:bg-[#111827]">
                      <p className="truncate text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                        {tpl.name}
                      </p>
                      <p className="truncate text-xs text-[#64748B] dark:text-slate-400">
                        {props.categoryNames[tpl.category]?.trim() || tpl.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {visibleTplCount < filteredTemplates.length && (
              <div ref={tplSentinelRef} className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleTplCount((c) => Math.min(filteredTemplates.length, c + 12))
                  }
                  className="min-h-[44px] w-full cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#4F46E5] dark:border-[#1F2937] dark:bg-[#0B0F19]"
                >
                  আরও টেমপ্লেট দেখুন ({toBengaliDigits(filteredTemplates.length - visibleTplCount)})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // TAB: এক্সপোর্ট
  return (
    <div className="space-y-4 pb-2">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">
          ফাইল ফরম্যাট
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
          {(
            [
              { key: 'png', label: 'PNG (HD)' },
              { key: 'jpeg', label: 'JPG' },
            ] as const
          ).map((fmt) => (
            <button
              key={fmt.key}
              type="button"
              onClick={() => props.onChangeExportFormat(fmt.key)}
              className={`min-h-[44px] cursor-pointer rounded-lg text-[13px] font-semibold transition-colors ${
                props.exportFormat === fmt.key
                  ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SliderHeaderRow
          label="কোয়ালিটি"
          value={props.exportQuality}
          min={70}
          max={100}
          suffix="%"
          onChange={props.onChangeExportQuality}
          onReset={() => props.onChangeExportQuality(96)}
        />
        <RangeSlider
          min={70}
          max={100}
          value={props.exportQuality}
          onChange={props.onChangeExportQuality}
          ariaLabel="এক্সপোর্ট কোয়ালিটি"
        />
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-3.5 py-2.5 text-xs text-[#64748B] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300">
        রেজোলিউশন:{' '}
        <strong className="text-[#0F172A] tabular-nums dark:text-slate-100">
          {toBengaliDigits(props.effectiveTemplate.canvasWidth)} ×{' '}
          {toBengaliDigits(props.effectiveTemplate.canvasHeight)} px
        </strong>
      </div>

      <button
        type="button"
        onClick={props.onExportAndSave}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 text-[15px] font-bold text-white shadow-sm active:bg-[#4338CA]"
      >
        {props.downloadDone ? (
          <>
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>সেভ ও ডাউনলোড হয়েছে ✓</span>
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            <span>কার্ড ডাউনলোড করুন</span>
          </>
        )}
      </button>
    </div>
  );
};
