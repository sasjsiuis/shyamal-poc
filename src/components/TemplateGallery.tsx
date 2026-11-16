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
          placeholder="টেমপ্লেট বা ক্যাটাগরি খুঁজুন (যেমন: প্রবাসে সিলেট, চাকরির খোঁজে, ইসলাম, ভিডিও)..."
          className="w-full rounded-lg border border-[#d6cfc2] bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap gap-1.5">
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
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'border border-[#c9c5c0] bg-[#f4eee4] text-slate-800 hover:bg-[#ebe3d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{displayLabel}</span>
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Category Inline Rename Bar */}
      {activeCategory !== 'সব' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e3dbcd] bg-[#faf6ef] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/70">
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
                className="min-w-0 flex-1 rounded-md border border-[#1c3060] bg-white px-2.5 py-1 text-xs font-medium text-slate-900 focus:outline-none dark:border-sky-400 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={commitCategoryRename}
                className="cursor-pointer rounded-md bg-[#1c3060] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#15254b] dark:bg-[#254689]"
              >
                সেভ
              </button>
              <button
                type="button"
                onClick={() => setEditingCategoryKey(null)}
                className="cursor-pointer rounded-md border border-[#c9c5c0] bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-white px-2 py-1 text-[11px] font-semibold text-[#1c3060] hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300"
                >
                  <Pencil className="h-3 w-3" />
                  <span>ক্যাটাগরির নাম পরিবর্তন</span>
                </button>
                {categoryNames[activeCategory] && categoryNames[activeCategory] !== activeCategory && (
                  <button
                    type="button"
                    onClick={() => onResetCategoryName(activeCategory)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#c9c5c0] bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-[#f4eee4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
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

      {/* Scrollable Template Visual Grid */}
      <div className="grid max-h-[380px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
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
              : tpl.palette?.accent || '#faab3f';

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
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-[#faab3f] ring-2 ring-[#faab3f]/60'
                  : 'border-[#d6cfc2] hover:border-[#1c3060] dark:border-slate-700 dark:hover:border-slate-400'
              }`}
            >
              {/* Live Mini Visual Schematic Preview */}
              <div
                className="relative flex aspect-square w-full flex-col justify-between p-2"
                style={{
                  background: `linear-gradient(145deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`,
                }}
              >
                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#faab3f] text-slate-950 shadow">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
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
                      className="mx-1 flex-1 my-1.5 rounded-sm border bg-slate-300/80"
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

              <div className="bg-white px-2 py-1.5 dark:bg-slate-800">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {tpl.name}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {getCategoryDisplayName(tpl.category)} · ফ্রি
                </p>
              </div>
            </button>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            কোনো টেমপ্লেট পাওয়া যায়নি। অন্য শব্দ দিয়ে খুঁজুন।
          </div>
        )}
      </div>
    </div>
  );
};
