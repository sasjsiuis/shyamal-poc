import React, { useMemo, useState } from 'react';
import { Search, Check, Pencil, RotateCcw } from 'lucide-react';
import { ALL_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import type { TemplateCategory, TemplateConfig, TemplateOverride } from '../types/card';

interface TemplateGalleryProps {
  selectedTemplateId: string;
  onSelectTemplate: (template: TemplateConfig) => void;
  categoryNames: Record<string, string>;
  onRenameCategory: (categoryKey: Exclude<TemplateCategory, 'সব'>, newName: string) => void;
  onResetCategoryName: (categoryKey: Exclude<TemplateCategory, 'সব'>) => void;
  templateOverrides: Record<string, TemplateOverride>;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  selectedTemplateId,
  onSelectTemplate,
  categoryNames,
  onRenameCategory,
  onResetCategoryName,
  templateOverrides,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('সব');
  const [editingCategoryKey, setEditingCategoryKey] = useState<Exclude<TemplateCategory, 'সব'> | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');

  const getCategoryDisplayName = (cat: TemplateCategory): string => {
    if (cat === 'সব') return 'সব';
    return categoryNames[cat]?.trim() || cat;
  };

  const resolvedTemplates = useMemo(() => {
    return ALL_TEMPLATES.map((tpl) => {
      const ov = templateOverrides[tpl.id];
      if (!ov) return tpl;
      return {
        ...tpl,
        name: ov.name !== undefined && ov.name.trim() ? ov.name : tpl.name,
        category: ov.category || tpl.category,
        kickerText: ov.kickerText !== undefined ? ov.kickerText : tpl.kickerText,
        footerCtaText: ov.footerCtaText !== undefined ? ov.footerCtaText : tpl.footerCtaText,
        websiteUrl: ov.websiteUrl !== undefined ? ov.websiteUrl : tpl.websiteUrl,
      };
    });
  }, [templateOverrides]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resolvedTemplates.filter((t) => {
      const catMatch = activeCategory === 'সব' || t.category === activeCategory;
      const catDisplay = getCategoryDisplayName(t.category).toLowerCase();
      const queryMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        catDisplay.includes(q) ||
        (t.kickerText && t.kickerText.toLowerCase().includes(q));
      return catMatch && queryMatch;
    });
  }, [resolvedTemplates, searchQuery, activeCategory, categoryNames]);

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
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="টেমপ্লেট বা ক্যাটাগরি খুঁজুন..."
          className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
        />
      </div>

      {/* Category Filter Buttons */}
      <div className="flex max-h-[108px] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const displayLabel = getCategoryDisplayName(cat);
          const count =
            cat === 'সব'
              ? resolvedTemplates.length
              : resolvedTemplates.filter((t) => t.category === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#4F46E5] text-white'
                  : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-gray-800'
              }`}
            >
              <span>{displayLabel}</span>
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? 'text-white/80' : 'text-[#64748B] dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Category Inline Rename Bar */}
      {activeCategory !== 'সব' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-2 text-xs dark:border-[#1F2937] dark:bg-[#0B0F19]">
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
                className="min-w-0 flex-1 rounded-lg border border-[#4F46E5] bg-white px-2.5 py-1 text-xs font-medium text-[#0F172A] focus:outline-none dark:bg-[#111827] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={commitCategoryRename}
                className="cursor-pointer rounded-lg bg-[#4F46E5] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4338CA]"
              >
                সেভ
              </button>
              <button
                type="button"
                onClick={() => setEditingCategoryKey(null)}
                className="cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300"
              >
                বাতিল
              </button>
            </div>
          ) : (
            <>
              <span className="text-[#64748B] dark:text-slate-300">
                ক্যাটাগরি:{' '}
                <strong className="text-[#0F172A] dark:text-slate-100">
                  {getCategoryDisplayName(activeCategory)}
                </strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEditingCategory(activeCategory)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                >
                  <Pencil className="h-3 w-3" />
                  <span>নাম বদলান</span>
                </button>
                {categoryNames[activeCategory] && categoryNames[activeCategory] !== activeCategory && (
                  <button
                    type="button"
                    onClick={() => onResetCategoryName(activeCategory)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300"
                    title="আগের নামে ফিরে যান"
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

      {/* Mini Visual Grid (2 columns in 360px editor panel) */}
      <div className="grid grid-cols-2 gap-2.5">
        {filteredTemplates.map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;
          const isGreenPsd = tpl.id === 'psd-green';
          const isMaroonPsd = tpl.id === 'psd-maroon';
          const bgPrimary = isGreenPsd
            ? '#024c4b'
            : isMaroonPsd
              ? '#65142a'
              : tpl.palette?.bgPrimary || '#1e293b';
          const bgSecondary = isGreenPsd
            ? '#ffffff'
            : isMaroonPsd
              ? '#490c1d'
              : tpl.palette?.bgSecondary || '#0f172a';
          const accent = isGreenPsd
            ? '#01665e'
            : isMaroonPsd
              ? '#ffd132'
              : tpl.palette?.accent || '#4F46E5';

          const isTopHeadline =
            isGreenPsd ||
            tpl.styleType === 'top-band-white-footer' ||
            tpl.styleType === 'editorial-broadsheet' ||
            tpl.styleType === 'split-header-badge' ||
            tpl.styleType === 'magazine-split' ||
            tpl.styleType === 'paper-ittefaq';

          const isVideoStyle = tpl.styleType === 'video-play-frame';
          const isArchStyle = tpl.styleType === 'islamic-arch';

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelectTemplate(tpl)}
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-all duration-150 ${
                isSelected
                  ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/30'
                  : 'border-[#E5E7EB] hover:border-[#4F46E5]/60 dark:border-[#1F2937] dark:hover:border-indigo-400'
              }`}
            >
              <div
                className="relative flex aspect-square w-full flex-col justify-between p-2"
                style={{
                  background: `linear-gradient(145deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`,
                }}
              >
                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}

                {isTopHeadline ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div
                      className="mx-auto h-1.5 w-1/3 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <div
                      className={`relative mx-1 my-1.5 flex-1 border bg-slate-300/80 ${
                        isArchStyle ? 'rounded-t-2xl' : 'rounded-sm'
                      }`}
                      style={{ borderColor: isArchStyle ? accent : '#ffffff' }}
                    >
                      {isVideoStyle && (
                        <span
                          className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9px] text-white"
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.78)',
                            borderColor: accent,
                          }}
                        >
                          ▶
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 rounded-sm bg-black/25 px-1.5 py-1">
                      <div
                        className="mx-auto h-1.5 w-4/5 rounded-sm"
                        style={{ backgroundColor: tpl.defaultTextColor }}
                      />
                      <div
                        className="mx-auto h-1.5 w-3/5 rounded-sm"
                        style={{ backgroundColor: tpl.defaultHighlightColor }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white px-2.5 py-2 dark:bg-[#111827]">
                <p className="truncate text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                  {tpl.name}
                </p>
                <p className="truncate text-[11px] text-[#64748B] dark:text-slate-400">
                  {getCategoryDisplayName(tpl.category)}
                </p>
              </div>
            </button>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-[#64748B] dark:text-slate-400">
            কোনো টেমপ্লেট পাওয়া যায়নি। অন্য শব্দ দিয়ে খুঁজুন।
          </div>
        )}
      </div>
    </div>
  );
};
