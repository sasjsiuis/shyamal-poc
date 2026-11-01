import React, { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { ALL_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import type { TemplateCategory, TemplateConfig } from '../types/card';

interface TemplateGalleryProps {
  selectedTemplateId: string;
  onSelectTemplate: (template: TemplateConfig) => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  selectedTemplateId,
  onSelectTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('সব');

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_TEMPLATES.filter((t) => {
      const catMatch = activeCategory === 'সব' || t.category === activeCategory;
      const queryMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.kickerText && t.kickerText.toLowerCase().includes(q));
      return catMatch && queryMatch;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="টেমপ্লেট খুঁজুন (যেমন: ব্রেকিং, খেলাধুলা, জাতীয়, উক্তি)..."
          className="w-full rounded-lg border border-[#d6cfc2] bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1c3060] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#1c3060] text-white dark:bg-[#254689]'
                  : 'border border-[#c9c5c0] bg-[#f4eee4] text-slate-800 hover:bg-[#ebe3d5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Scrollable 54-Template Visual Grid */}
      <div className="grid max-h-[340px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
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
            tpl.styleType === 'split-header-badge';

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
                      className="mx-1 my-1.5 flex-1 rounded-sm border bg-slate-300/80"
                      style={{ borderColor: '#ffffff' }}
                    />
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
                  {tpl.category} · ফ্রি
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
