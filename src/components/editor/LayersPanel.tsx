import React, { useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Calendar,
  Crop,
  Eye,
  EyeOff,
  Frame,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Lock,
  PanelBottom,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Type,
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
  SubheadingSettings,
  TemplateConfig,
  TemplateOverride,
} from '../../types/card';
import { getDefaultBengaliDateText, toVisualTopDownOrder } from '../../utils/layerUtils';
import { toBengaliDigits } from '../../utils/projectStorage';
import { EditableNumberBadge } from '../EditableNumberBadge';
import { RangeSlider } from '../RangeSlider';
import type { ParsedWord } from './EditorRightPanel';

interface LayersPanelProps {
  resolvedLayerOrder: string[];
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  layerVisibility: Record<string, boolean>;
  onToggleVisibility: (layerId: string) => void;
  layerOpacity: Record<string, number>;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  layerLocks: Record<string, boolean>;
  onToggleLock: (layerId: string) => void;
  onMoveLayerStep: (layerId: string, direction: 'up' | 'down') => void;
  onReorderVisualLayers: (fromVisualIdx: number, toVisualIdx: number) => void;
  onResetLayerSystem: () => void;

  // Content & customization callbacks
  headline: string;
  onHeadlineChange: (val: string) => void;
  parsedWords: ParsedWord[];
  isWordHighlighted: (word: ParsedWord) => boolean;
  onToggleWordHighlight: (word: ParsedWord) => void;
  onClearAllHighlights: () => void;
  hasHighlights: boolean;

  lineMode: LineMode;
  onChangeLineMode: (m: LineMode) => void;
  allFonts: FontOption[];
  activeFont: FontOption;
  onSelectFont: (id: string) => void;
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

  subheading: SubheadingSettings;
  onChangeSubheading: (updater: (prev: SubheadingSettings) => SubheadingSettings) => void;
  onResetSubheading: () => void;

  customTexts: CustomTextItem[];
  onChangeCustomTexts: (updater: (prev: CustomTextItem[]) => CustomTextItem[]) => void;
  onDeleteCustomText: (id: string) => void;
  onAddDirectCustomText: () => void;
  onStartPencilMode: () => void;

  extraImages: ExtraImageLayer[];
  onChangeExtraImages: (updater: (prev: ExtraImageLayer[]) => ExtraImageLayer[]) => void;
  onDeleteExtraImage: (id: string) => void;
  onTriggerAddExtraImage: () => void;
  onPromoteExtraImageToMain: (id: string) => void;

  photoZoom: number;
  onChangePhotoZoom: (v: number) => void;
  photoPanX: number;
  onChangePhotoPanX: (v: number) => void;
  photoPanY: number;
  onChangePhotoPanY: (v: number) => void;
  onTriggerPhotoUpload: () => void;
  onResetPhoto: () => void;

  logoSettings: LogoSettings;
  onChangeLogoSettings: (updater: (prev: LogoSettings) => LogoSettings) => void;
  onTriggerLogoUpload: () => void;
  onOpenLogoEditor: (dataUrl: string) => void;

  effectiveTemplate: TemplateConfig;
  selectedTemplate: TemplateConfig;
  dateText: string;
  onUpdateActiveTemplateOverride: (patch: TemplateOverride) => void;
  onResetActiveTemplateOverride: () => void;
  onTriggerCustomFrameUpload: () => void;
  onSwitchToTemplateTab: () => void;
  onCommitHistory: () => void;
}

const MiniSliderHeader: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
  onReset: () => void;
}> = ({ label, value, min, max, step = 1, suffix = '', onChange, onReset }) => (
  <div className="mb-1 flex items-center justify-between gap-2">
    <span className="text-[12.5px] font-medium text-[#0F172A] dark:text-slate-200">{label}</span>
    <div className="flex items-center gap-1">
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
        title="ডিফল্টে ফেরত"
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-gray-800"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  </div>
);

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200">
    <span className="truncate">{label}</span>
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[10.5px] uppercase text-[#64748B]">{value}</span>
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="swatch-picker h-6 w-6"
      />
    </span>
  </label>
);

export const LayersPanel: React.FC<LayersPanelProps> = (props) => {
  const [dragVisualIdx, setDragVisualIdx] = useState<number | null>(null);
  const [dragOverVisualIdx, setDragOverVisualIdx] = useState<number | null>(null);

  const visualLayers = toVisualTopDownOrder(props.resolvedLayerOrder);
  const selectedId = props.resolvedLayerOrder.includes(props.selectedLayerId)
    ? props.selectedLayerId
    : visualLayers[0] || 'headline';

  const getLayerMeta = (
    id: string
  ): { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> } => {
    if (id === 'headline') {
      return {
        title: 'মূল শিরোনাম',
        subtitle: props.headline.trim() ? props.headline.trim().slice(0, 28) : 'খালি',
        icon: Type,
      };
    }
    if (id === 'subheading') {
      return {
        title: 'সাব-হেডিং',
        subtitle: props.subheading.text.trim()
          ? props.subheading.text.trim().slice(0, 26)
          : 'যোগ করা হয়নি',
        icon: AlignLeft,
      };
    }
    if (id === 'date-badge') {
      const k = props.effectiveTemplate.kickerText?.trim();
      const d = props.dateText.trim() || getDefaultBengaliDateText();
      return {
        title: 'তারিখ ও ব্যাজ',
        subtitle: k || d || 'ডিফল্ট তারিখ',
        icon: Calendar,
      };
    }
    if (id === 'footer') {
      const f = props.effectiveTemplate.footerCtaText?.trim() || props.effectiveTemplate.websiteUrl?.trim();
      return {
        title: 'ফুটার ও ওয়েবসাইট',
        subtitle: f || 'কার্ডের নিচের অংশ',
        icon: PanelBottom,
      };
    }
    if (id === 'logo') {
      return {
        title: 'লোগো ও ব্র্যান্ড',
        subtitle: props.logoSettings.dataUrl
          ? 'কাস্টম লোগো'
          : props.logoSettings.hideDefaultBrand
            ? 'লুকানো'
            : 'ডিফল্ট লোগো',
        icon: BadgeCheck,
      };
    }
    if (id === 'photo') {
      return {
        title: 'মূল ছবি',
        subtitle: `জুম ${toBengaliDigits(Math.round(props.photoZoom * 100))}%`,
        icon: ImageIcon,
      };
    }
    if (id === 'frame') {
      return {
        title: 'কার্ড ফ্রেম ও রং',
        subtitle: props.effectiveTemplate.name,
        icon: Frame,
      };
    }
    if (id.startsWith('text:')) {
      const item = props.customTexts.find((c) => c.id === id.slice(5));
      return {
        title: item?.text.trim() ? item.text.trim().slice(0, 22) : 'ফ্রি টেক্সট',
        subtitle: `সাইজ ${toBengaliDigits(item?.fontSize ?? 32)}px`,
        icon: Pencil,
      };
    }
    if (id.startsWith('image:')) {
      const item = props.extraImages.find((img) => img.id === id.slice(6));
      return {
        title: item?.name || 'ছবি লেয়ার',
        subtitle: `প্রস্থ ${toBengaliDigits(Math.round(item?.widthPercent ?? 36))}%`,
        icon: ImagePlus,
      };
    }
    return { title: id, subtitle: '', icon: Layers };
  };

  const selectedMeta = getLayerMeta(selectedId);
  const SelectedIcon = selectedMeta.icon;
  const selectedVisible = props.layerVisibility[selectedId] !== false;
  const selectedLocked = Boolean(props.layerLocks[selectedId]);
  const selectedOpacity = props.layerOpacity[selectedId] ?? 100;

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

  const selectedCustomText = selectedId.startsWith('text:')
    ? props.customTexts.find((c) => c.id === selectedId.slice(5))
    : undefined;
  const selectedExtraImage = selectedId.startsWith('image:')
    ? props.extraImages.find((img) => img.id === selectedId.slice(6))
    : undefined;

  return (
    <div className="space-y-3.5">
      {/* Header + Quick Add */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">লেয়ার</h3>
          <span className="rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[11px] font-semibold text-[#4F46E5] tabular-nums dark:bg-indigo-950/60 dark:text-indigo-300">
            {toBengaliDigits(visualLayers.length)}টি
          </span>
        </div>
        <button
          type="button"
          onClick={props.onResetLayerSystem}
          title="সব লেয়ারের ক্রম, দৃশ্যমানতা ও স্বচ্ছতা রিসেট"
          className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
        >
          <RotateCcw className="h-3 w-3" />
          <span>ডিফল্ট ক্রম</span>
        </button>
      </div>

      {/* Add Image / Text Action Row */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={props.onTriggerAddExtraImage}
          className="inline-flex h-8.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span>+ ছবি লেয়ার</span>
        </button>
        <button
          type="button"
          onClick={props.onAddDirectCustomText}
          className="inline-flex h-8.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-semibold text-[#0F172A] transition-colors hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:bg-gray-800"
        >
          <Plus className="h-3.5 w-3.5 text-[#4F46E5]" />
          <span>+ ফ্রি টেক্সট</span>
        </button>
      </div>

      <p className="rounded-lg border border-dashed border-[#4F46E5]/30 bg-[#EEF2FF]/60 px-2.5 py-1.5 text-[11px] leading-snug text-[#4338CA] dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-200">
        কার্ডের উপর যেকোনো ছবি ড্র্যাগ অ্যান্ড ড্রপ করুন বা প্রিভিউয়ে ক্লিক করে <kbd className="font-mono font-bold">Ctrl+V</kbd> দিয়ে পেস্ট করুন।
      </p>

      {/* Layer Stack (Top-most first) */}
      <div className="max-h-[265px] space-y-1 overflow-y-auto pr-0.5">
        {visualLayers.map((id, visualIdx) => {
          const meta = getLayerMeta(id);
          const Icon = meta.icon;
          const isSelected = selectedId === id;
          const isVisible = props.layerVisibility[id] !== false;
          const isLocked = Boolean(props.layerLocks[id]);
          const opacity = props.layerOpacity[id] ?? 100;
          const isUserLayer = id.startsWith('text:') || id.startsWith('image:');
          const isDropTarget = dragOverVisualIdx === visualIdx && dragVisualIdx !== visualIdx;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => {
                setDragVisualIdx(visualIdx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragVisualIdx !== null) {
                  setDragOverVisualIdx(visualIdx);
                }
              }}
              onDragLeave={() => {
                if (dragOverVisualIdx === visualIdx) setDragOverVisualIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragVisualIdx !== null && dragVisualIdx !== visualIdx) {
                  props.onReorderVisualLayers(dragVisualIdx, visualIdx);
                }
                setDragVisualIdx(null);
                setDragOverVisualIdx(null);
              }}
              onDragEnd={() => {
                setDragVisualIdx(null);
                setDragOverVisualIdx(null);
              }}
              onClick={() => props.onSelectLayer(id)}
              className={`group flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                isSelected
                  ? 'border-[#4F46E5] bg-[#EEF2FF] dark:border-indigo-500 dark:bg-indigo-950/45'
                  : 'border-[#E5E7EB] bg-white hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:hover:bg-gray-900'
              } ${isDropTarget ? 'ring-2 ring-[#4F46E5]' : ''} ${!isVisible ? 'opacity-55' : ''}`}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[#94A3B8]" />

              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  isSelected
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-[#F7F8FA] text-[#475569] dark:bg-[#111827] dark:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-[12px] font-semibold text-[#0F172A] dark:text-slate-100">
                    {meta.title}
                  </p>
                  {opacity < 100 && (
                    <span className="shrink-0 text-[10px] font-medium text-[#64748B] tabular-nums">
                      {toBengaliDigits(opacity)}%
                    </span>
                  )}
                </div>
                {meta.subtitle && (
                  <p className="truncate text-[10.5px] text-[#64748B] dark:text-slate-400">
                    {meta.subtitle}
                  </p>
                )}
              </div>

              <div
                className="flex shrink-0 items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => props.onMoveLayerStep(id, 'up')}
                  disabled={visualIdx === 0}
                  title="উপরে তুলুন"
                  aria-label={`${meta.title} উপরে তুলুন`}
                  className="flex h-6 w-5 cursor-pointer items-center justify-center rounded text-[#64748B] hover:bg-white hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-gray-800"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => props.onMoveLayerStep(id, 'down')}
                  disabled={visualIdx === visualLayers.length - 1}
                  title="নিচে নামান"
                  aria-label={`${meta.title} নিচে নামান`}
                  className="flex h-6 w-5 cursor-pointer items-center justify-center rounded text-[#64748B] hover:bg-white hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-gray-800"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => props.onToggleVisibility(id)}
                  title={isVisible ? 'লুকান' : 'দেখান'}
                  aria-label={isVisible ? 'লেয়ার লুকান' : 'লেয়ার দেখান'}
                  className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors ${
                    isVisible
                      ? 'text-[#475569] hover:bg-white hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-gray-800'
                      : 'text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30'
                  }`}
                >
                  {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => props.onToggleLock(id)}
                  title={isLocked ? 'আনলক করুন' : 'লক করুন'}
                  aria-label={isLocked ? 'লেয়ার আনলক' : 'লেয়ার লক'}
                  className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors ${
                    isLocked
                      ? 'text-[#F59E0B] hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      : 'text-[#94A3B8] hover:bg-white hover:text-[#0F172A] dark:hover:bg-gray-800'
                  }`}
                >
                  {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
                {isUserLayer && (
                  <button
                    type="button"
                    onClick={() => {
                      if (id.startsWith('text:')) props.onDeleteCustomText(id.slice(5));
                      if (id.startsWith('image:')) props.onDeleteExtraImage(id.slice(6));
                    }}
                    title="লেয়ার মুছুন"
                    aria-label="লেয়ার মুছুন"
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Layer Inspector */}
      <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2 dark:border-[#1F2937]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#4F46E5] text-white">
              <SelectedIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-bold text-[#0F172A] dark:text-slate-100">
                {selectedMeta.title}
              </p>
              <p className="text-[10.5px] text-[#64748B] dark:text-slate-400">
                সিলেক্ট করা লেয়ারের স্টাইল ও ডিজাইন
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => props.onToggleVisibility(selectedId)}
              className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
            >
              {selectedVisible ? 'দৃশ্যমান' : 'লুকানো'}
            </button>
          </div>
        </div>

        {/* Common Opacity Control */}
        <div>
          <MiniSliderHeader
            label="স্বচ্ছতা (Opacity)"
            value={selectedOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(val) => props.onChangeLayerOpacity(selectedId, val)}
            onReset={() => props.onChangeLayerOpacity(selectedId, 100)}
          />
          <RangeSlider
            min={0}
            max={100}
            value={selectedOpacity}
            onChange={(val) => props.onChangeLayerOpacity(selectedId, val)}
            ariaLabel="লেয়ারের স্বচ্ছতা"
          />
        </div>

        {/* 1. HEADLINE INSPECTOR */}
        {selectedId === 'headline' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                শিরোনামের লেখা
              </label>
              <textarea
                rows={2}
                value={props.headline}
                onChange={(e) => props.onHeadlineChange(e.target.value)}
                className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-white p-2 text-[13px] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            {props.parsedWords.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>শব্দে ক্লিক করে হাইলাইট</span>
                  {props.hasHighlights && (
                    <button
                      type="button"
                      onClick={props.onClearAllHighlights}
                      className="cursor-pointer font-semibold text-[#EF4444] hover:underline"
                    >
                      হাইলাইট মুছুন
                    </button>
                  )}
                </div>
                <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                  {props.parsedWords.map((word) => {
                    const hl = props.isWordHighlighted(word);
                    return (
                      <button
                        key={`${word.index}-${word.start}`}
                        type="button"
                        onClick={() => props.onToggleWordHighlight(word)}
                        className={`cursor-pointer rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${
                          hl
                            ? 'bg-[#F59E0B] text-slate-950'
                            : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                        }`}
                      >
                        {word.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E5E7EB] bg-white p-1 dark:border-[#1F2937] dark:bg-[#111827]">
              {(
                [
                  { key: 'auto', label: 'অটো' },
                  { key: 'one', label: '১ লাইন' },
                  { key: 'two', label: '২ লাইন' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => props.onChangeLineMode(m.key)}
                  className={`cursor-pointer rounded py-1 text-[11.5px] font-semibold ${
                    props.lineMode === m.key
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A] dark:text-slate-200">
                ফন্ট
              </label>
              <select
                value={props.activeFont.id}
                onChange={(e) => props.onSelectFont(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              >
                {props.allFonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <MiniSliderHeader
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
                ariaLabel="শিরোনামের সাইজ"
              />
            </div>

            <div>
              <MiniSliderHeader
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

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান X</span>
                <EditableNumberBadge
                  value={Math.round(props.textOffsetX * 100)}
                  min={-45}
                  max={45}
                  onChange={(v) => props.onChangeTextOffset(v / 100, props.textOffsetY)}
                  ariaLabel="শিরোনাম X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান Y</span>
                <EditableNumberBadge
                  value={Math.round(props.textOffsetY * 100)}
                  min={-45}
                  max={45}
                  onChange={(v) => props.onChangeTextOffset(props.textOffsetX, v / 100)}
                  ariaLabel="শিরোনাম Y"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ColorField label="লেখার রং" value={props.textColor} onChange={props.onChangeTextColor} />
              <ColorField
                label="হাইলাইট"
                value={props.highlightColor}
                onChange={props.onChangeHighlightColor}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 dark:border-[#1F2937] dark:bg-[#111827]">
              <span className="text-xs font-medium text-[#0F172A] dark:text-slate-200">লেখার ছায়া</span>
              <button
                type="button"
                onClick={() => props.onChangeTextShadow(!props.textShadow)}
                className={`cursor-pointer rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${
                  props.textShadow
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-slate-100 text-[#64748B] dark:bg-gray-800 dark:text-slate-300'
                }`}
              >
                {props.textShadow ? 'চালু' : 'বন্ধ'}
              </button>
            </div>
          </div>
        )}

        {/* 2. SUBHEADING INSPECTOR */}
        {selectedId === 'subheading' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  সাব-হেডিং লেখা
                </label>
                {props.subheading.text.trim() && (
                  <button
                    type="button"
                    onClick={props.onResetSubheading}
                    className="cursor-pointer text-[11px] font-semibold text-[#EF4444] hover:underline"
                  >
                    মুছুন
                  </button>
                )}
              </div>
              <input
                type="text"
                value={props.subheading.text}
                onChange={(e) =>
                  props.onChangeSubheading((p) => ({ ...p, text: e.target.value }))
                }
                placeholder="যেমন: বিশেষ প্রতিনিধি / বিস্তারিত প্রতিবেদন"
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div>
              <MiniSliderHeader
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

            <ColorField
              label="সাব-হেডিং রং"
              value={props.subheading.color || props.textColor}
              onChange={(color) => props.onChangeSubheading((p) => ({ ...p, color }))}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">X</span>
                <EditableNumberBadge
                  value={Math.round(props.subheading.offsetX * 100)}
                  min={-48}
                  max={48}
                  onChange={(v) => props.onChangeSubheading((p) => ({ ...p, offsetX: v / 100 }))}
                  ariaLabel="সাব-হেডিং X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">Y</span>
                <EditableNumberBadge
                  value={Math.round(props.subheading.offsetY * 100)}
                  min={-48}
                  max={48}
                  onChange={(v) => props.onChangeSubheading((p) => ({ ...p, offsetY: v / 100 }))}
                  ariaLabel="সাব-হেডিং Y"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. DATE & BADGE INSPECTOR */}
        {selectedId === 'date-badge' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  তারিখ পরিবর্তন করুন
                </label>
                {props.dateText.trim() && (
                  <button
                    type="button"
                    onClick={() => props.onUpdateActiveTemplateOverride({ dateText: '' })}
                    className="cursor-pointer text-[11px] font-semibold text-[#4F46E5] hover:underline"
                  >
                    আজকের তারিখ
                  </button>
                )}
              </div>
              <input
                type="text"
                value={props.dateText}
                onChange={(e) =>
                  props.onUpdateActiveTemplateOverride({ dateText: e.target.value })
                }
                placeholder={getDefaultBengaliDateText() || 'যেমন: ১৮ মে ২০২৬'}
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  ক্যাটাগরি / ব্যাজ লেখা
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
                placeholder="যেমন: ব্রেকিং নিউজ / জাতীয়"
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label="ব্যাজ ব্যাকগ্রাউন্ড"
                value={activePal.badgeBg}
                onChange={(v) => updatePaletteKey('badgeBg', v)}
              />
              <ColorField
                label="ব্যাজ টেক্সট রং"
                value={activePal.badgeText}
                onChange={(v) => updatePaletteKey('badgeText', v)}
              />
            </div>
          </div>
        )}

        {/* 4. FOOTER INSPECTOR */}
        {selectedId === 'footer' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                ফুটার বাটন / CTA লেখা
              </label>
              <input
                type="text"
                value={props.effectiveTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                onChange={(e) =>
                  props.onUpdateActiveTemplateOverride({ footerCtaText: e.target.value })
                }
                placeholder="যেমন: বিস্তারিত কমেন্টে"
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                ওয়েবসাইট ইউআরএল
              </label>
              <input
                type="text"
                value={props.effectiveTemplate.websiteUrl ?? ''}
                onChange={(e) =>
                  props.onUpdateActiveTemplateOverride({ websiteUrl: e.target.value })
                }
                placeholder="যেমন: www.yoursite.com"
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label="ফুটার ব্যাকগ্রাউন্ড"
                value={activePal.footerBg}
                onChange={(v) => updatePaletteKey('footerBg', v)}
              />
              <ColorField
                label="ফুটার টেক্সট রং"
                value={activePal.footerText}
                onChange={(v) => updatePaletteKey('footerText', v)}
              />
            </div>
            <ColorField
              label="ফুটার পিল / অ্যাক্সেন্ট"
              value={activePal.accent}
              onChange={(v) => updatePaletteKey('accent', v)}
            />
          </div>
        )}

        {/* 5. LOGO INSPECTOR */}
        {selectedId === 'logo' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={props.onTriggerLogoUpload}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#4F46E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{props.logoSettings.dataUrl ? 'লোগো বদলান' : 'কাস্টম লোগো'}</span>
              </button>
              {props.logoSettings.dataUrl && (
                <button
                  type="button"
                  onClick={() => props.onOpenLogoEditor(props.logoSettings.dataUrl!)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                >
                  <Crop className="h-3.5 w-3.5 text-[#4F46E5]" />
                  <span>ক্রপ</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 dark:border-[#1F2937] dark:bg-[#111827]">
              <span className="text-xs font-medium text-[#0F172A] dark:text-slate-200">
                ডিফল্ট লোগো দেখান
              </span>
              <button
                type="button"
                onClick={() => {
                  props.onCommitHistory();
                  props.onChangeLogoSettings((p) => ({
                    ...p,
                    hideDefaultBrand: !p.hideDefaultBrand,
                  }));
                }}
                className={`cursor-pointer rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${
                  !props.logoSettings.hideDefaultBrand
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-slate-100 text-[#64748B] dark:bg-gray-800'
                }`}
              >
                {!props.logoSettings.hideDefaultBrand ? 'চালু' : 'বন্ধ'}
              </button>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">লোগোর শেপ</p>
              <div className="flex flex-wrap gap-1">
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
                    className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold ${
                      (props.logoSettings.shape ?? 'original') === s.id
                        ? 'bg-[#4F46E5] text-white'
                        : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">লোগো ব্যাজ</p>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { id: 'none', label: 'ব্যাজ ছাড়া' },
                    { id: 'frosted', label: 'হালকা গ্লাস' },
                    { id: 'white', label: 'সাদা ব্যাজ' },
                    { id: 'auto', label: 'অটো ব্যাজ' },
                  ] as Array<{ id: LogoBadgeStyle; label: string }>
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => props.onChangeLogoSettings((p) => ({ ...p, badgeStyle: b.id }))}
                    className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold ${
                      (props.logoSettings.badgeStyle ?? 'none') === b.id
                        ? 'bg-[#4F46E5] text-white'
                        : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <MiniSliderHeader
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
                ariaLabel="লোগোর সাইজ"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">X</span>
                <EditableNumberBadge
                  value={props.logoSettings.x}
                  min={-200}
                  max={200}
                  onChange={(x) => props.onChangeLogoSettings((p) => ({ ...p, x }))}
                  ariaLabel="লোগো X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">Y</span>
                <EditableNumberBadge
                  value={props.logoSettings.y}
                  min={-200}
                  max={200}
                  onChange={(y) => props.onChangeLogoSettings((p) => ({ ...p, y }))}
                  ariaLabel="লোগো Y"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. MAIN PHOTO INSPECTOR */}
        {selectedId === 'photo' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={props.onTriggerPhotoUpload}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>নতুন ছবি দিন</span>
              </button>
              <button
                type="button"
                onClick={props.onResetPhoto}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" />
                <span>রিসেট</span>
              </button>
            </div>

            <div>
              <MiniSliderHeader
                label="ছবির জুম"
                value={Math.round(props.photoZoom * 100)}
                min={100}
                max={300}
                suffix="%"
                onChange={(v) => props.onChangePhotoZoom(v / 100)}
                onReset={() => props.onChangePhotoZoom(1)}
              />
              <RangeSlider
                min={100}
                max={300}
                value={Math.round(props.photoZoom * 100)}
                onChange={(v) => props.onChangePhotoZoom(v / 100)}
                ariaLabel="ছবির জুম"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">প্যান X</span>
                <EditableNumberBadge
                  value={props.photoPanX}
                  min={-100}
                  max={100}
                  onChange={props.onChangePhotoPanX}
                  ariaLabel="ছবি X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">প্যান Y</span>
                <EditableNumberBadge
                  value={props.photoPanY}
                  min={-100}
                  max={100}
                  onChange={props.onChangePhotoPanY}
                  ariaLabel="ছবি Y"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. FRAME / TEMPLATE INSPECTOR */}
        {selectedId === 'frame' && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            {props.selectedTemplate.styleType !== 'psd-overlay' ? (
              <div className="grid grid-cols-1 gap-2">
                <ColorField
                  label="মূল পটভূমি (Primary)"
                  value={activePal.bgPrimary}
                  onChange={(v) => updatePaletteKey('bgPrimary', v)}
                />
                <ColorField
                  label="গ্রেডিয়েন্ট পটভূমি (Secondary)"
                  value={activePal.bgSecondary}
                  onChange={(v) => updatePaletteKey('bgSecondary', v)}
                />
                <ColorField
                  label="অ্যাক্সেন্ট রং"
                  value={activePal.accent}
                  onChange={(v) => updatePaletteKey('accent', v)}
                />
                <ColorField
                  label="বর্ডার রং"
                  value={activePal.borderColor}
                  onChange={(v) => updatePaletteKey('borderColor', v)}
                />
              </div>
            ) : (
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                এই টেমপ্লেটটি আসল PNG/SVG ফ্রেম দিয়ে তৈরি। চাইলে নিজের PNG ফ্রেম আপলোড বা অন্য টেমপ্লেট বাছাই করতে পারেন।
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={props.onTriggerCustomFrameUpload}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
              >
                <Upload className="h-3.5 w-3.5 text-[#4F46E5]" />
                <span>PNG ফ্রেম</span>
              </button>
              <button
                type="button"
                onClick={props.onSwitchToTemplateTab}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#4F46E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
              >
                <span>টেমপ্লেট বদলান</span>
              </button>
            </div>

            <button
              type="button"
              onClick={props.onResetActiveTemplateOverride}
              className="flex w-full cursor-pointer items-center justify-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>ফ্রেমের ডিফল্ট রঙে ফেরান</span>
            </button>
          </div>
        )}

        {/* 8. CUSTOM FLOATING TEXT LAYER INSPECTOR */}
        {selectedCustomText && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                টেক্সটের লেখা
              </label>
              <textarea
                rows={2}
                value={selectedCustomText.text}
                onChange={(e) =>
                  props.onChangeCustomTexts((prev) =>
                    prev.map((c) =>
                      c.id === selectedCustomText.id ? { ...c, text: e.target.value } : c
                    )
                  )
                }
                className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-white p-2 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div>
              <MiniSliderHeader
                label="ফন্ট সাইজ"
                value={selectedCustomText.fontSize}
                min={16}
                max={110}
                suffix="px"
                onChange={(fontSize) =>
                  props.onChangeCustomTexts((prev) =>
                    prev.map((c) => (c.id === selectedCustomText.id ? { ...c, fontSize } : c))
                  )
                }
                onReset={() =>
                  props.onChangeCustomTexts((prev) =>
                    prev.map((c) =>
                      c.id === selectedCustomText.id ? { ...c, fontSize: 32 } : c
                    )
                  )
                }
              />
              <RangeSlider
                min={16}
                max={110}
                value={selectedCustomText.fontSize}
                onChange={(fontSize) =>
                  props.onChangeCustomTexts((prev) =>
                    prev.map((c) => (c.id === selectedCustomText.id ? { ...c, fontSize } : c))
                  )
                }
                ariaLabel="ফ্রি টেক্সটের সাইজ"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান X</span>
                <EditableNumberBadge
                  value={Math.round(selectedCustomText.x * 100)}
                  min={3}
                  max={97}
                  suffix="%"
                  onChange={(v) =>
                    props.onChangeCustomTexts((prev) =>
                      prev.map((c) =>
                        c.id === selectedCustomText.id ? { ...c, x: v / 100 } : c
                      )
                    )
                  }
                  ariaLabel="টেক্সট X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান Y</span>
                <EditableNumberBadge
                  value={Math.round(selectedCustomText.y * 100)}
                  min={3}
                  max={97}
                  suffix="%"
                  onChange={(v) =>
                    props.onChangeCustomTexts((prev) =>
                      prev.map((c) =>
                        c.id === selectedCustomText.id ? { ...c, y: v / 100 } : c
                      )
                    )
                  }
                  ariaLabel="টেক্সট Y"
                />
              </div>
            </div>

            <ColorField
              label="টেক্সটের রং"
              value={selectedCustomText.color}
              onChange={(color) =>
                props.onChangeCustomTexts((prev) =>
                  prev.map((c) => (c.id === selectedCustomText.id ? { ...c, color } : c))
                )
              }
            />

            <div>
              <p className="mb-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">
                ব্যাকগ্রাউন্ড পিল
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { label: 'খালি', val: null },
                    { label: 'কালো', val: 'rgba(15, 23, 42, 0.72)' },
                    { label: 'হলুদ', val: '#ece304' },
                    { label: 'লাল', val: '#dc2626' },
                    { label: 'নীল', val: '#2563eb' },
                  ] as const
                ).map((bg) => (
                  <button
                    key={bg.label}
                    type="button"
                    onClick={() =>
                      props.onChangeCustomTexts((prev) =>
                        prev.map((c) =>
                          c.id === selectedCustomText.id
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
                    className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold ${
                      selectedCustomText.bgColor === bg.val
                        ? 'bg-[#4F46E5] text-white'
                        : 'border border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => props.onDeleteCustomText(selectedCustomText.id)}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>এই টেক্সট লেয়ার মুছুন</span>
            </button>
          </div>
        )}

        {/* 9. EXTRA IMAGE LAYER INSPECTOR */}
        {selectedExtraImage && (
          <div className="space-y-3 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                লেয়ারের নাম
              </label>
              <input
                type="text"
                value={selectedExtraImage.name}
                onChange={(e) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, name: e.target.value } : img
                    )
                  )
                }
                className="h-8.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
            </div>

            <div>
              <MiniSliderHeader
                label="ছবির প্রস্থ (Width)"
                value={Math.round(selectedExtraImage.widthPercent)}
                min={8}
                max={150}
                suffix="%"
                onChange={(widthPercent) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, widthPercent } : img
                    )
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, widthPercent: 38 } : img
                    )
                  )
                }
              />
              <RangeSlider
                min={8}
                max={150}
                value={Math.round(selectedExtraImage.widthPercent)}
                onChange={(widthPercent) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, widthPercent } : img
                    )
                  )
                }
                ariaLabel="ছবি লেয়ারের প্রস্থ"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান X</span>
                <EditableNumberBadge
                  value={Math.round(selectedExtraImage.x * 100)}
                  min={2}
                  max={98}
                  suffix="%"
                  onChange={(v) =>
                    props.onChangeExtraImages((prev) =>
                      prev.map((img) =>
                        img.id === selectedExtraImage.id ? { ...img, x: v / 100 } : img
                      )
                    )
                  }
                  ariaLabel="ছবি X"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="text-[#64748B]">অবস্থান Y</span>
                <EditableNumberBadge
                  value={Math.round(selectedExtraImage.y * 100)}
                  min={2}
                  max={98}
                  suffix="%"
                  onChange={(v) =>
                    props.onChangeExtraImages((prev) =>
                      prev.map((img) =>
                        img.id === selectedExtraImage.id ? { ...img, y: v / 100 } : img
                      )
                    )
                  }
                  ariaLabel="ছবি Y"
                />
              </div>
            </div>

            <div>
              <MiniSliderHeader
                label="ঘোরানো (Rotation)"
                value={Math.round(selectedExtraImage.rotation)}
                min={-180}
                max={180}
                suffix="°"
                onChange={(rotation) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, rotation } : img
                    )
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, rotation: 0 } : img
                    )
                  )
                }
              />
              <RangeSlider
                min={-180}
                max={180}
                value={Math.round(selectedExtraImage.rotation)}
                onChange={(rotation) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, rotation } : img
                    )
                  )
                }
                ariaLabel="ছবির ঘোরানো"
              />
            </div>

            <div>
              <MiniSliderHeader
                label="কোণা গোল (Radius)"
                value={Math.round(selectedExtraImage.borderRadius)}
                min={0}
                max={50}
                suffix="%"
                onChange={(borderRadius) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderRadius } : img
                    )
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderRadius: 0 } : img
                    )
                  )
                }
              />
              <RangeSlider
                min={0}
                max={50}
                value={Math.round(selectedExtraImage.borderRadius)}
                onChange={(borderRadius) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderRadius } : img
                    )
                  )
                }
                ariaLabel="ছবির কোণা গোল"
              />
            </div>

            <div>
              <MiniSliderHeader
                label="বর্ডার পুরুত্ব"
                value={Math.round(selectedExtraImage.borderWidth)}
                min={0}
                max={24}
                suffix="px"
                onChange={(borderWidth) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderWidth } : img
                    )
                  )
                }
                onReset={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderWidth: 0 } : img
                    )
                  )
                }
              />
              <RangeSlider
                min={0}
                max={24}
                value={Math.round(selectedExtraImage.borderWidth)}
                onChange={(borderWidth) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderWidth } : img
                    )
                  )
                }
                ariaLabel="বর্ডার পুরুত্ব"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label="বর্ডার রং"
                value={selectedExtraImage.borderColor}
                onChange={(borderColor) =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, borderColor } : img
                    )
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  props.onChangeExtraImages((prev) =>
                    prev.map((img) =>
                      img.id === selectedExtraImage.id ? { ...img, shadow: !img.shadow } : img
                    )
                  )
                }
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  selectedExtraImage.shadow
                    ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                    : 'border-[#E5E7EB] bg-white text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                }`}
              >
                ছায়া: {selectedExtraImage.shadow ? 'চালু' : 'বন্ধ'}
              </button>
            </div>

            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => props.onPromoteExtraImageToMain(selectedExtraImage.id)}
                className="flex-1 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
              >
                মূল ছবি হিসেবে সেট
              </button>
              <button
                type="button"
                onClick={() => props.onDeleteExtraImage(selectedExtraImage.id)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>মুছুন</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
