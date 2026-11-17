import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Eye,
  Layers,
  Maximize2,
  Palette,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { TemplatePreviewCanvas } from '../components/TemplatePreviewCanvas';
import { useToast } from '../components/Toast';
import {
  CATEGORY_USAGE_NOTES,
  STYLE_TYPE_META,
  getTemplateAspectLabel,
} from '../data/templateMetadata';
import { ALL_TEMPLATES } from '../data/templates';
import type { TemplateCategory, TemplateConfig, TemplateOverride } from '../types/card';
import { createNewProject, toBengaliDigits } from '../utils/projectStorage';

const CATEGORY_NAMES_STORAGE_KEY = 'news_card_category_names_v1';
const TEMPLATE_OVERRIDES_STORAGE_KEY = 'news_card_template_overrides_v1';
const PAGE_BATCH_SIZE = 24;

export const TemplatesGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('সব');
  const [sortBy, setSortBy] = useState<'popular' | 'name'>('popular');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_BATCH_SIZE);
  const [inspectedTemplateId, setInspectedTemplateId] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

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

  const getCategoryDisplayName = (cat: TemplateCategory): string => {
    if (cat === 'সব') return 'সব';
    return categoryNames[cat]?.trim() || cat;
  };

  // Derive categories dynamically from existing template data
  const availableCategories = useMemo<TemplateCategory[]>(() => {
    const seen = new Set<Exclude<TemplateCategory, 'সব'>>();
    for (const tpl of ALL_TEMPLATES) {
      seen.add(tpl.category);
    }
    return ['সব', ...Array.from(seen)];
  }, []);

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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { সব: resolvedTemplates.length };
    for (const tpl of resolvedTemplates) {
      counts[tpl.category] = (counts[tpl.category] || 0) + 1;
    }
    return counts;
  }, [resolvedTemplates]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = resolvedTemplates.filter((t) => {
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
    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'bn'));
    }
    return list;
  }, [resolvedTemplates, searchQuery, activeCategory, sortBy, categoryNames]);

  const visibleTemplates = useMemo(() => {
    return filteredTemplates.slice(0, visibleCount);
  }, [filteredTemplates, visibleCount]);

  useEffect(() => {
    setVisibleCount(PAGE_BATCH_SIZE);
  }, [searchQuery, activeCategory, sortBy]);

  const inspectedTemplate = useMemo(() => {
    if (!inspectedTemplateId) return null;
    return resolvedTemplates.find((t) => t.id === inspectedTemplateId) || null;
  }, [resolvedTemplates, inspectedTemplateId]);

  useEffect(() => {
    if (!inspectedTemplate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectedTemplateId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedTemplate]);

  const handleEditTemplate = async (tpl: TemplateConfig) => {
    if (creatingId) return;
    setCreatingId(tpl.id);
    try {
      const { project, limitReached } = await createNewProject(tpl.id);
      if (limitReached || !project) {
        showToast(
          'সর্বোচ্চ ৫০টি প্রজেক্ট পূর্ণ হয়েছে — "আমার কাজ" থেকে পুরনো কাজ মুছে দিন',
          'warning',
          4200
        );
        navigate('/my-work');
        return;
      }
      navigate(`/editor/${tpl.id}/${project.id}`);
    } finally {
      setCreatingId(null);
    }
  };

  const handleUpdateTemplateOverride = (templateId: string, patch: TemplateOverride) => {
    setTemplateOverrides((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        ...patch,
      },
    }));
  };

  const handleResetTemplateOverride = (templateId: string) => {
    setTemplateOverrides((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  };

  const handleResetCategoryName = (categoryKey: Exclude<TemplateCategory, 'সব'>) => {
    setCategoryNames((prev) => {
      const next = { ...prev };
      delete next[categoryKey];
      return next;
    });
  };

  const remainingCount = Math.max(0, filteredTemplates.length - visibleTemplates.length);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#0F172A] dark:bg-[#0B0F19] dark:text-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-7 sm:px-6 sm:py-9">
        {/* Breadcrumb */}
        <nav
          aria-label="ব্রেডক্রাম্ব"
          className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-[#64748B] dark:text-slate-400"
        >
          <Link to="/" className="hover:text-[#0F172A] dark:hover:text-slate-200">
            হোম
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#0F172A] dark:text-slate-200">টেমপ্লেট</span>
        </nav>

        {/* Page Title + Search/Sort Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] sm:text-[32px] dark:text-white">
              সব টেমপ্লেট
            </h1>
            <p className="mt-1 text-[14px] text-[#64748B] dark:text-slate-400">
              {toBengaliDigits(ALL_TEMPLATES.length)}টি ডিজাইন থেকে বেছে নিন, তারপর “এডিট করুন” চাপুন
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[270px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="টেমপ্লেট খুঁজুন..."
                aria-label="টেমপ্লেট খুঁজুন"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-8 text-[14px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="খোঁজা মুছুন"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'popular' | 'name')}
              aria-label="সাজানোর ধরন"
              className="h-10 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13.5px] font-medium text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
            >
              <option value="popular">জনপ্রিয়</option>
              <option value="name">নাম অনুযায়ী</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div
          role="tablist"
          aria-label="টেমপ্লেট ক্যাটাগরি"
          className="mt-5 flex items-center gap-2 overflow-x-auto pb-2"
        >
          {availableCategories.map((cat) => {
            const isActive = activeCategory === cat;
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#0F172A] text-white dark:bg-[#4F46E5]'
                    : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-gray-800'
                }`}
              >
                <span>{getCategoryDisplayName(cat)}</span>
                <span
                  className={`text-[11px] tabular-nums ${
                    isActive ? 'text-white/75' : 'text-[#64748B] dark:text-slate-400'
                  }`}
                >
                  {toBengaliDigits(count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Responsive Grid: 2 mobile, 3 tablet, 4 desktop */}
        <section className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visibleTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:border-[#4F46E5]/60 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
            >
              {/* Thumbnail + Hover Overlay */}
              <div className="relative overflow-hidden">
                <TemplatePreviewCanvas template={tpl} size={360} />

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/50 opacity-0 backdrop-blur-[1.5px] transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={creatingId === tpl.id}
                    onClick={() => handleEditTemplate(tpl)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[13.5px] font-semibold text-[#0F172A] shadow-md transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#4F46E5]" />
                    <span>এডিট করুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedTemplateId(tpl.id)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium text-white/90 hover:text-white"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>প্রিভিউ</span>
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                    {tpl.name}
                  </h3>
                  <p className="mt-0.5 truncate text-[12px] text-[#64748B] dark:text-slate-400">
                    {getCategoryDisplayName(tpl.category)} · {STYLE_TYPE_META[tpl.styleType]?.label}
                  </p>
                </div>

                {/* Mobile quick action row */}
                <div className="flex items-center justify-between gap-2 border-t border-[#E5E7EB] pt-2 lg:hidden dark:border-[#1F2937]">
                  <button
                    type="button"
                    onClick={() => setInspectedTemplateId(tpl.id)}
                    className="cursor-pointer text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
                  >
                    প্রিভিউ
                  </button>
                  <button
                    type="button"
                    disabled={creatingId === tpl.id}
                    onClick={() => handleEditTemplate(tpl)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#4F46E5] px-2.5 py-1 text-[12px] font-semibold text-white"
                  >
                    <span>এডিট করুন</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="col-span-full rounded-xl border border-[#E5E7EB] bg-white py-14 text-center text-sm text-[#64748B] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-400">
              কোনো টেমপ্লেট পাওয়া যায়নি। অন্য শব্দ বা ক্যাটাগরি নির্বাচন করুন।
            </div>
          )}
        </section>

        {/* Load More */}
        {remainingCount > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + PAGE_BATCH_SIZE)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-5 text-[13.5px] font-semibold text-[#0F172A] shadow-2xs transition-colors duration-150 hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-gray-800"
            >
              <span>আরও টেমপ্লেট দেখুন ({toBengaliDigits(remainingCount)})</span>
            </button>
          </div>
        )}
      </main>

      {/* Template Detail & Quick Customize Modal */}
      {inspectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-xs sm:p-5"
          onClick={() => setInspectedTemplateId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-detail-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3.5 sm:px-6 dark:border-[#1F2937]">
              <div className="min-w-0">
                <h3
                  id="template-detail-title"
                  className="truncate text-lg font-bold text-[#0F172A] dark:text-slate-100"
                >
                  {inspectedTemplate.name}
                </h3>
                <p className="truncate text-xs text-[#64748B] dark:text-slate-400">
                  {getCategoryDisplayName(inspectedTemplate.category)} ·{' '}
                  {STYLE_TYPE_META[inspectedTemplate.styleType]?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTemplateId(null)}
                aria-label="বন্ধ করুন"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-[340px_1fr]">
              <div>
                <div className="overflow-hidden rounded-xl border border-[#E5E7EB] shadow-xs dark:border-[#1F2937]">
                  <TemplatePreviewCanvas
                    template={inspectedTemplate}
                    size={640}
                    eager
                    preserveAspect
                  />
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                    <div className="flex items-start gap-2.5">
                      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
                      <div>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                          ডিজাইন স্টাইল: {STYLE_TYPE_META[inspectedTemplate.styleType]?.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-400">
                          {STYLE_TYPE_META[inspectedTemplate.styleType]?.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 border-t border-[#E5E7EB] pt-2.5 dark:border-[#1F2937]">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
                      <div>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                          কোথায় ব্যবহার করবেন ({getCategoryDisplayName(inspectedTemplate.category)})
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-400">
                          {CATEGORY_USAGE_NOTES[inspectedTemplate.category]}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#64748B] dark:border-[#1F2937] dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Maximize2 className="h-3.5 w-3.5 text-[#4F46E5]" />
                        <span>সাইজ: {getTemplateAspectLabel(inspectedTemplate)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-[#4F46E5]" />
                        <span>রং:</span>
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{
                            backgroundColor:
                              inspectedTemplate.palette?.bgPrimary ||
                              (inspectedTemplate.id === 'psd-green' ? '#024c4b' : '#65142a'),
                          }}
                        />
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{
                            backgroundColor: inspectedTemplate.palette?.accent || '#4F46E5',
                          }}
                        />
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{ backgroundColor: inspectedTemplate.defaultHighlightColor }}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Quick Badge / CTA / Website URL Override */}
                  <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-white p-3.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-slate-200">
                        <Tag className="h-3.5 w-3.5 text-[#4F46E5]" />
                        <span>কার্ডের ব্যাজ ও ফুটার পরিবর্তন (ঐচ্ছিক)</span>
                      </span>
                      {(templateOverrides[inspectedTemplate.id] ||
                        categoryNames[inspectedTemplate.category]) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleResetTemplateOverride(inspectedTemplate.id);
                            handleResetCategoryName(inspectedTemplate.category);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A]"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>রিসেট</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#64748B] dark:text-slate-300">
                          কার্ডে দেখানো ক্যাটাগরি ব্যাজ
                        </label>
                        <input
                          type="text"
                          value={inspectedTemplate.kickerText ?? ''}
                          onChange={(e) =>
                            handleUpdateTemplateOverride(inspectedTemplate.id, {
                              kickerText: e.target.value,
                            })
                          }
                          placeholder="খালি রাখলে ব্যাজ দেখাবে না"
                          className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
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
                      ].includes(inspectedTemplate.styleType) && (
                        <div>
                          <label className="mb-1 block text-[11.5px] font-medium text-[#64748B] dark:text-slate-300">
                            নিচের ফুটার লেখা (CTA)
                          </label>
                          <input
                            type="text"
                            value={inspectedTemplate.footerCtaText ?? 'বিস্তারিত কমেন্টে'}
                            onChange={(e) =>
                              handleUpdateTemplateOverride(inspectedTemplate.id, {
                                footerCtaText: e.target.value,
                              })
                            }
                            placeholder="খালি রাখলে ফুটার দেখাবে না"
                            className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                          />
                        </div>
                      )}

                      {inspectedTemplate.hasWebsiteUrl && (
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[11.5px] font-medium text-[#64748B] dark:text-slate-300">
                            ওয়েবসাইট ইউআরএল
                          </label>
                          <input
                            type="text"
                            value={inspectedTemplate.websiteUrl ?? ''}
                            onChange={(e) =>
                              handleUpdateTemplateOverride(inspectedTemplate.id, {
                                websiteUrl: e.target.value,
                              })
                            }
                            placeholder="যেমন: www.yoursite.com"
                            className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E5E7EB] pt-3 dark:border-[#1F2937]">
                  <button
                    type="button"
                    onClick={() => setInspectedTemplateId(null)}
                    className="h-10 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectedTemplate;
                      setInspectedTemplateId(null);
                      handleEditTemplate(target);
                    }}
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA]"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>এডিট করুন</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
