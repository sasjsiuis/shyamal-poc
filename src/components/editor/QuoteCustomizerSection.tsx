import React from 'react';
import { Palette, Quote, RotateCcw, Sparkles, Trash2, Upload, User } from 'lucide-react';
import type {
  QuoteCardSettings,
  QuoteMarkStyle,
  QuotePhotoStyle,
  TemplateConfig,
  TemplateOverride,
} from '../../types/card';
import { RangeSlider } from '../RangeSlider';

interface QuoteCustomizerSectionProps {
  mode: 'text' | 'style' | 'photo' | 'all';
  mobile?: boolean;
  effectiveTemplate: TemplateConfig;
  selectedTemplate: TemplateConfig;
  quoteSettings: QuoteCardSettings;
  onChangeQuoteSettings: (updater: (prev: QuoteCardSettings) => QuoteCardSettings) => void;
  onResetQuoteSettings: () => void;
  onUpdateActiveTemplateOverride: (patch: TemplateOverride) => void;
  onTriggerSecondaryPhotoUpload?: () => void;
  onDeleteSecondaryPhoto?: () => void;
  onCommitHistory?: () => void;
  onFocusField?: () => void;
  onBlurField?: () => void;
  isKeyboardOpen?: boolean;
}

const QUOTE_MARK_STYLES: Array<{ id: QuoteMarkStyle; label: string }> = [
  { id: 'classic', label: 'ক্লাসিক “”' },
  { id: 'bold-block', label: 'বোল্ড ব্লক' },
  { id: 'slash', label: 'স্ল্যাশ //' },
  { id: 'circle-badge', label: 'সার্কেল ব্যাজ' },
  { id: 'none', label: 'বন্ধ' },
];

const PHOTO_STYLES: Array<{ id: QuotePhotoStyle; label: string }> = [
  { id: 'original', label: 'স্বাভাবিক' },
  { id: 'grayscale', label: 'সাদাকালো' },
  { id: 'rim-glow', label: 'নিয়ন রিম' },
  { id: 'duotone', label: 'ডুয়োটোন' },
];

const SwatchRow: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  mobile?: boolean;
}> = ({ label, value, onChange, mobile }) => (
  <label
    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2.5 dark:border-[#1F2937] dark:bg-[#111827] ${
      mobile ? 'min-h-[48px] py-1' : 'py-1.5'
    }`}
  >
    <span className="truncate text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
      {label}
    </span>
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase text-[#64748B]">{value}</span>
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className={`swatch-picker shrink-0 ${mobile ? 'h-11 w-11' : 'h-6 w-6'}`}
      />
    </span>
  </label>
);

export const QuoteCustomizerSection: React.FC<QuoteCustomizerSectionProps> = ({
  mode,
  mobile = false,
  effectiveTemplate,
  selectedTemplate,
  quoteSettings,
  onChangeQuoteSettings,
  onResetQuoteSettings,
  onUpdateActiveTemplateOverride,
  onTriggerSecondaryPhotoUpload,
  onDeleteSecondaryPhoto,
  onCommitHistory,
  onFocusField,
  onBlurField,
  isKeyboardOpen = false,
}) => {
  const isQaSplit = effectiveTemplate.styleType === 'quote-qa-split';
  const pal = effectiveTemplate.palette || {
    bgPrimary: '#0853b8',
    bgSecondary: '#021742',
    accent: '#fbbf24',
    footerBg: '#021742',
    footerText: '#ffffff',
    badgeBg: '#ffffff',
    badgeText: '#111827',
    borderColor: '#ffffff',
  };

  const inputCls = mobile
    ? 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100'
    : 'w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#4F46E5] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100';

  const btnCls = mobile
    ? 'min-h-[44px] cursor-pointer rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all'
    : 'cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-all';

  const setField = <K extends keyof QuoteCardSettings>(key: K, val: QuoteCardSettings[K]) => {
    onChangeQuoteSettings((prev) => ({ ...prev, [key]: val }));
  };

  const setPalField = (
    key: keyof NonNullable<TemplateConfig['palette']>,
    val: string
  ) => {
    onUpdateActiveTemplateOverride({ palette: { [key]: val } });
  };

  return (
    <div className="space-y-3">
      {(mode === 'text' || mode === 'all') && (
        <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A] dark:text-slate-100">
              <User className="h-4 w-4 text-[#4F46E5]" />
              <span>বক্তা ও কার্ডের তথ্য (বাংলা)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onCommitHistory?.();
                onResetQuoteSettings();
              }}
              className={`flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 ${
                mobile ? 'min-h-[44px] px-2' : ''
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              রিসেট
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                বক্তার / লেখকের নাম
              </label>
              <input
                type="text"
                value={quoteSettings.authorName}
                onFocus={onFocusField}
                onBlur={onBlurField}
                onChange={(e) => setField('authorName', e.target.value)}
                placeholder="যেমন: ড. রফিকুল ইসলাম"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                পদবি / পরিচিতি
              </label>
              <input
                type="text"
                value={quoteSettings.authorTitle}
                onFocus={onFocusField}
                onBlur={onBlurField}
                onChange={(e) => setField('authorTitle', e.target.value)}
                placeholder="যেমন: প্রধান নির্বাহী / কথাসাহিত্যিক"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                  ব্যাজ / ট্যাগ
                </label>
                <input
                  type="text"
                  value={quoteSettings.badgeText}
                  onFocus={onFocusField}
                  onBlur={onBlurField}
                  onChange={(e) => setField('badgeText', e.target.value)}
                  placeholder="যেমন: উক্তি"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                  সূত্র / বই / #ট্যাগ
                </label>
                <input
                  type="text"
                  value={quoteSettings.sourceText}
                  onFocus={onFocusField}
                  onBlur={onBlurField}
                  onChange={(e) => setField('sourceText', e.target.value)}
                  placeholder="যেমন: বই: রূপার পালঙ্ক"
                  className={inputCls}
                />
              </div>
            </div>

            {(effectiveTemplate.styleType === 'quote-dark-glass-rating' ||
              Boolean(quoteSettings.ratingText)) && (
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                  রেটিং ব্যাজ
                </label>
                <input
                  type="text"
                  value={quoteSettings.ratingText}
                  onFocus={onFocusField}
                  onBlur={onBlurField}
                  onChange={(e) => setField('ratingText', e.target.value)}
                  placeholder="যেমন: ★ ৫"
                  className={inputCls}
                />
              </div>
            )}

            {isQaSplit && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[11.5px] font-bold text-amber-900 dark:text-amber-300">
                  উপরের প্রশ্ন ও প্রশ্নকারীর তথ্য
                </p>
                <input
                  type="text"
                  value={quoteSettings.questionText}
                  onFocus={onFocusField}
                  onBlur={onBlurField}
                  onChange={(e) => setField('questionText', e.target.value)}
                  placeholder="যেমন: আপনার সেরা পরামর্শ কী?"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={quoteSettings.questionAuthor}
                    onFocus={onFocusField}
                    onBlur={onBlurField}
                    onChange={(e) => setField('questionAuthor', e.target.value)}
                    placeholder="প্রশ্নকারীর নাম"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={quoteSettings.questionMeta}
                    onFocus={onFocusField}
                    onBlur={onBlurField}
                    onChange={(e) => setField('questionMeta', e.target.value)}
                    placeholder="তারিখ / সৌজন্যে"
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(mode === 'style' || mode === 'all') && !isKeyboardOpen && (
        <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A] dark:text-slate-100">
              <Quote className="h-4 w-4 text-[#4F46E5]" />
              <span>কোটেশন আইকন ও এলিমেন্ট</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={quoteSettings.showQuoteMarks}
              onClick={() => {
                onCommitHistory?.();
                setField('showQuoteMarks', !quoteSettings.showQuoteMarks);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors ${
                mobile ? 'min-h-[44px]' : 'py-1'
              } ${
                quoteSettings.showQuoteMarks
                  ? 'bg-[#4F46E5] text-white'
                  : 'border border-[#E5E7EB] bg-white text-[#64748B] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300'
              }`}
            >
              <span>আইকন: {quoteSettings.showQuoteMarks ? 'চালু' : 'বন্ধ'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {QUOTE_MARK_STYLES.map((st) => {
              const active = quoteSettings.quoteMarkStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    onCommitHistory?.();
                    onChangeQuoteSettings((prev) => ({
                      ...prev,
                      quoteMarkStyle: st.id,
                      showQuoteMarks: st.id !== 'none',
                    }));
                  }}
                  className={`${btnCls} ${
                    active
                      ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                      : 'border-[#E5E7EB] bg-white text-[#0F172A] hover:border-slate-300 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {quoteSettings.showQuoteMarks && quoteSettings.quoteMarkStyle !== 'none' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] font-medium text-[#64748B] dark:text-slate-400">
                <span>কোটেশন আইকনের সাইজ</span>
                <span className="font-semibold text-[#0F172A] dark:text-slate-200">
                  {quoteSettings.quoteMarkSizePercent}%
                </span>
              </div>
              <RangeSlider
                min={50}
                max={160}
                value={quoteSettings.quoteMarkSizePercent}
                onChange={(val) => setField('quoteMarkSizePercent', val)}
                ariaLabel="কোটেশন আইকনের সাইজ"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onCommitHistory?.();
                setField('showDecorShapes', !quoteSettings.showDecorShapes);
              }}
              className={`${btnCls} flex items-center justify-center gap-1.5 ${
                quoteSettings.showDecorShapes
                  ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-[#E5E7EB] bg-white text-[#64748B] dark:border-[#1F2937] dark:bg-[#111827]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              শেপ ও নকশা {quoteSettings.showDecorShapes ? 'চালু' : 'বন্ধ'}
            </button>

            <button
              type="button"
              onClick={() => {
                onCommitHistory?.();
                setField('showSocialIcons', !quoteSettings.showSocialIcons);
              }}
              className={`${btnCls} flex items-center justify-center gap-1.5 ${
                quoteSettings.showSocialIcons
                  ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-[#E5E7EB] bg-white text-[#64748B] dark:border-[#1F2937] dark:bg-[#111827]'
              }`}
            >
              সোশ্যাল আইকন {quoteSettings.showSocialIcons ? 'চালু' : 'বন্ধ'}
            </button>
          </div>

          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F172A] dark:text-slate-100">
                <Palette className="h-3.5 w-3.5 text-[#4F46E5]" />
                <span>সম্পূর্ণ কালার কাস্টমাইজেশন</span>
              </div>
            </div>
            <div className={mobile ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-1.5'}>
              <SwatchRow
                mobile={mobile}
                label="মূল ব্যাকগ্রাউন্ড"
                value={pal.bgPrimary}
                onChange={(v) => setPalField('bgPrimary', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="সেকেন্ডারি ব্যাকগ্রাউন্ড"
                value={pal.bgSecondary}
                onChange={(v) => setPalField('bgSecondary', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="কার্ড / বক্স"
                value={quoteSettings.cardSurfaceColor}
                onChange={(v) => setField('cardSurfaceColor', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="অ্যাক্সেন্ট / রিবন"
                value={pal.accent}
                onChange={(v) => setPalField('accent', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="কোট আইকনের রঙ"
                value={quoteSettings.quoteMarkColor}
                onChange={(v) => setField('quoteMarkColor', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="বক্তার নামের রঙ"
                value={quoteSettings.authorNameColor}
                onChange={(v) => setField('authorNameColor', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="পদবির রঙ"
                value={quoteSettings.authorTitleColor}
                onChange={(v) => setField('authorTitleColor', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="ব্যাজ ব্যাকগ্রাউন্ড"
                value={pal.badgeBg}
                onChange={(v) => setPalField('badgeBg', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="ব্যাজ টেক্সট"
                value={pal.badgeText}
                onChange={(v) => setPalField('badgeText', v)}
              />
              <SwatchRow
                mobile={mobile}
                label="ফুটার ব্যাকগ্রাউন্ড"
                value={pal.footerBg}
                onChange={(v) => setPalField('footerBg', v)}
              />
            </div>
          </div>
        </div>
      )}

      {(mode === 'photo' || mode === 'all') && !isKeyboardOpen && (
        <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
          <div className="text-[12.5px] font-bold text-[#0F172A] dark:text-slate-100">
            পোর্ট্রেট ছবির স্টাইল ও ইফেক্ট
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PHOTO_STYLES.map((ps) => {
              const active = quoteSettings.photoStyle === ps.id;
              return (
                <button
                  key={ps.id}
                  type="button"
                  onClick={() => {
                    onCommitHistory?.();
                    setField('photoStyle', ps.id);
                  }}
                  className={`${btnCls} ${
                    active
                      ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                      : 'border-[#E5E7EB] bg-white text-[#0F172A] hover:border-slate-300 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                  }`}
                >
                  {ps.label}
                </button>
              );
            })}
          </div>

          {(quoteSettings.photoStyle === 'rim-glow' ||
            quoteSettings.photoStyle === 'duotone' ||
            selectedTemplate.styleType === 'quote-neon-duotone') && (
            <SwatchRow
              mobile={mobile}
              label="আউটলাইন / রিম কালার"
              value={quoteSettings.photoRimColor}
              onChange={(v) => setField('photoRimColor', v)}
            />
          )}

          {(isQaSplit || selectedTemplate.styleType === 'quote-dramatic-gradient') && (
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-[#1F2937] dark:bg-[#111827]">
              <div className="text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                {isQaSplit ? 'প্রশ্নকারীর ছবি (উপরের অংশ)' : 'ছোট প্রোফাইল অবতার (টপ-লেফট)'}
              </div>
              <div className="flex gap-2">
                {onTriggerSecondaryPhotoUpload && (
                  <button
                    type="button"
                    onClick={onTriggerSecondaryPhotoUpload}
                    className={`${btnCls} flex flex-1 items-center justify-center gap-1.5 border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/40 dark:text-indigo-300`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {quoteSettings.secondaryPhotoSrc ? 'ছবি পাল্টান' : 'ছবি যুক্ত করুন'}
                  </button>
                )}
                {quoteSettings.secondaryPhotoSrc && onDeleteSecondaryPhoto && (
                  <button
                    type="button"
                    onClick={onDeleteSecondaryPhoto}
                    className={`${btnCls} flex items-center justify-center gap-1 border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    মুছুন
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
