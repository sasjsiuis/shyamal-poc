import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Pencil,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { TemplatePreviewCanvas } from '../components/TemplatePreviewCanvas';
import { useToast } from '../components/Toast';
import { ALL_TEMPLATES, PSD_GREEN_TEMPLATE } from '../data/templates';
import type { SavedProject } from '../types/project';
import { sanitizeUrlInput } from '../utils/newsExtractor';
import {
  createNewProject,
  formatBengaliRelativeTime,
  listProjects,
  toBengaliDigits,
} from '../utils/projectStorage';

const POPULAR_TEMPLATE_IDS = [
  'psd-green',
  'psd-maroon',
  'portal-sylhetvoice-blue',
  'portal-protidiner-cream',
  'portal-sylhetvoice-dark',
  'portal-emjanews',
  'portal-sylhetview',
  'portal-sylhettoday',
];

const HERO_SHOWCASE_IDS = [
  'psd-green',
  'psd-maroon',
  'brk-crimson-live',
  'portal-sylhetvoice-blue',
  'portal-protidiner-cream',
  'nat-royal-navy',
  'portal-sylhetvoice-dark',
  'int-global-cobalt',
  'portal-emjanews',
  'portal-sylhetview',
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [heroUrl, setHeroUrl] = useState('');
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  useEffect(() => {
    let active = true;
    listProjects().then((items) => {
      if (active) setRecentProjects(items.slice(0, 4));
    });
    return () => {
      active = false;
    };
  }, []);

  const heroShowcaseTemplates = useMemo(() => {
    const picked = HERO_SHOWCASE_IDS.map((id) => ALL_TEMPLATES.find((t) => t.id === id)).filter(
      (t): t is NonNullable<typeof t> => Boolean(t)
    );
    const seen = new Set(picked.map((t) => t.id));
    for (const tpl of ALL_TEMPLATES) {
      if (picked.length >= 10) break;
      if (!seen.has(tpl.id)) {
        seen.add(tpl.id);
        picked.push(tpl);
      }
    }
    return picked.slice(0, 10);
  }, []);

  useEffect(() => {
    if (isHeroHovered || heroShowcaseTemplates.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroShowcaseTemplates.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [isHeroHovered, heroShowcaseTemplates.length]);

  const popularTemplates = useMemo(() => {
    const picked = POPULAR_TEMPLATE_IDS.map((id) => ALL_TEMPLATES.find((t) => t.id === id)).filter(
      (t): t is NonNullable<typeof t> => Boolean(t)
    );
    if (picked.length >= 8) return picked.slice(0, 8);
    return ALL_TEMPLATES.slice(0, 8);
  }, []);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeUrlInput(heroUrl);
    if (cleaned) {
      navigate(`/editor/${PSD_GREEN_TEMPLATE.id}?url=${encodeURIComponent(cleaned)}`);
    } else {
      navigate(`/editor/${PSD_GREEN_TEMPLATE.id}`);
    }
  };

  const handleOpenTemplateEditor = async (templateId: string) => {
    if (creatingId) return;
    setCreatingId(templateId);
    try {
      const { project, limitReached } = await createNewProject(templateId);
      if (limitReached || !project) {
        showToast(
          'সর্বোচ্চ ৫০টি প্রজেক্ট পূর্ণ হয়েছে — "আমার কাজ" থেকে পুরনো কাজ মুছে দিন',
          'warning',
          4200
        );
        navigate('/my-work');
        return;
      }
      navigate(`/editor/${templateId}/${project.id}`);
    } finally {
      setCreatingId(null);
    }
  };

  const totalCountLabel = toBengaliDigits(ALL_TEMPLATES.length);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#0F172A] dark:bg-[#0B0F19] dark:text-slate-100">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="hero-grid-bg border-b border-[#E5E7EB] dark:border-[#1F2937]">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
            {/* Left Copy & 56px Input */}
            <div className="min-w-0 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-[13px] font-medium text-[#64748B] shadow-2xs dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-300">
                <span className="font-semibold text-[#4F46E5] dark:text-indigo-400">নতুন</span>
                <span aria-hidden="true">·</span>
                <span>{totalCountLabel}+ প্রিমিয়াম টেমপ্লেট যুক্ত হয়েছে</span>
              </div>

              <h1
                className="text-[36px] font-bold leading-[1.16] tracking-tight text-[#0F172A] sm:text-[48px] lg:text-[54px] dark:text-white"
                style={{ textWrap: 'balance' }}
              >
                নিউজ লিংক দিন,{' '}
                <span className="text-[#4F46E5] dark:text-indigo-400">৫ সেকেন্ডে</span> ফটো কার্ড
              </h1>

              <p className="max-w-xl text-[15px] leading-relaxed text-[#64748B] sm:text-[16px] dark:text-slate-400">
                বাংলা নিউজ পেজ ও পোর্টালের জন্য সবচেয়ে সহজ ফটো কার্ড মেকার। কোনো ডিজাইন জ্ঞান
                লাগবে না — লিংক দিন, টেমপ্লেট বাছুন, ডাউনলোড করুন।
              </p>

              {/* 56px Link Input + Primary Action */}
              <form
                onSubmit={handleHeroSubmit}
                className="flex flex-col gap-2.5 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center dark:border-[#1F2937] dark:bg-[#111827]"
              >
                <div className="relative flex flex-1 items-center">
                  <Link2 className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#64748B]" />
                  <input
                    type="text"
                    value={heroUrl}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      const cleaned = sanitizeUrlInput(pasted);
                      if (cleaned) {
                        e.preventDefault();
                        setHeroUrl(cleaned);
                      }
                    }}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    placeholder="এখানে নিউজের লিংক পেস্ট করুন..."
                    aria-label="নিউজের লিংক"
                    className="h-14 w-full rounded-lg bg-transparent pl-10 pr-3 text-[15px] text-[#0F172A] placeholder:text-[#64748B] focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4338CA] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 sm:h-12"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>কার্ড বানান</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-[#64748B] dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#10B981]" />
                  <span>সম্পূর্ণ ফ্রি</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#10B981]" />
                  <span>লগইন লাগবে না</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#10B981]" />
                  <span>HD ডাউনলোড</span>
                </span>
              </div>
            </div>

            {/* Right: Animated 10-Card Sliding Showcase */}
            <div
              className="relative mx-auto w-full max-w-[430px] lg:ml-auto"
              onMouseEnter={() => setIsHeroHovered(true)}
              onMouseLeave={() => setIsHeroHovered(false)}
            >
              {/* Background rotated preview of the next upcoming card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-4 top-6 hidden h-[86%] w-[86%] rotate-6 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white opacity-90 shadow-lg transition-transform duration-500 sm:block dark:border-[#1F2937] dark:bg-[#111827]"
              >
                {heroShowcaseTemplates.length > 0 && (
                  <TemplatePreviewCanvas
                    key={
                      heroShowcaseTemplates[
                        (activeHeroSlide + 1) % heroShowcaseTemplates.length
                      ].id
                    }
                    template={
                      heroShowcaseTemplates[
                        (activeHeroSlide + 1) % heroShowcaseTemplates.length
                      ]
                    }
                    size={360}
                    eager
                  />
                )}
              </div>

              {/* Foreground animated 10-card slider */}
              <div className="relative z-10 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-2.5 shadow-xl dark:border-[#1F2937] dark:bg-[#111827]">
                <div className="relative overflow-hidden rounded-lg">
                  <div
                    className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                    style={{ transform: `translateX(-${activeHeroSlide * 100}%)` }}
                  >
                    {heroShowcaseTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => handleOpenTemplateEditor(tpl.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenTemplateEditor(tpl.id);
                          }
                        }}
                        title={`${tpl.name} — ক্লিক করে এডিট করুন`}
                        className="group relative w-full shrink-0 cursor-pointer"
                      >
                        <TemplatePreviewCanvas template={tpl} size={460} eager />
                        <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-[#0F172A]/75 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                          <Pencil className="h-3 w-3" />
                          <span>এডিট করুন</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Prev / Next Mini Controls */}
                  <button
                    type="button"
                    aria-label="আগের কার্ড"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveHeroSlide(
                        (prev) =>
                          (prev - 1 + heroShowcaseTemplates.length) % heroShowcaseTemplates.length
                      );
                    }}
                    className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-[#0F172A]/55 text-white backdrop-blur-xs transition-all hover:bg-[#4F46E5]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="পরের কার্ড"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveHeroSlide((prev) => (prev + 1) % heroShowcaseTemplates.length);
                    }}
                    className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-[#0F172A]/55 text-white backdrop-blur-xs transition-all hover:bg-[#4F46E5]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Slide Indicator Bar (10 cards) */}
                <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[11px] font-bold text-[#4F46E5] tabular-nums dark:bg-indigo-950/70 dark:text-indigo-300">
                      {toBengaliDigits(activeHeroSlide + 1)}/{toBengaliDigits(heroShowcaseTemplates.length)}
                    </span>
                    <span className="truncate text-[12px] font-semibold text-[#0F172A] dark:text-slate-200">
                      {heroShowcaseTemplates[activeHeroSlide]?.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {heroShowcaseTemplates.map((tpl, idx) => {
                      const active = idx === activeHeroSlide;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          aria-label={`${tpl.name} (${toBengaliDigits(idx + 1)})`}
                          onClick={() => setActiveHeroSlide(idx)}
                          className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                            active
                              ? 'w-4 bg-[#4F46E5]'
                              : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-gray-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Floating badge: Headline auto fetched */}
              <div className="pointer-events-none absolute -left-3 bottom-16 z-20 hidden items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 shadow-md sm:flex dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#10B981] dark:bg-emerald-950/60">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-[12.5px] font-semibold text-[#0F172A] dark:text-slate-100">
                    হেডলাইন অটো বসেছে
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    যেকোনো নিউজ লিংক থেকে
                  </p>
                </div>
              </div>

              {/* Floating badge: Download ready */}
              <div className="pointer-events-none absolute -bottom-4 right-3 z-20 hidden items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 shadow-md sm:flex dark:border-[#1F2937] dark:bg-[#111827]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Download className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-[12.5px] font-semibold text-[#0F172A] dark:text-slate-100">
                    ডাউনলোড হয়েছে ✓
                  </p>
                  <p className="text-[11px] text-[#64748B] tabular-nums dark:text-slate-400">
                    PNG / JPG · HD কোয়ালিটি
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Saved Projects Row (shown only if projects exist in IndexedDB) */}
        {recentProjects.length > 0 && (
          <section className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-[#0F172A] dark:text-slate-100">
                  সাম্প্রতিক কাজ
                </h2>
                <p className="text-[13px] text-[#64748B] dark:text-slate-400">
                  যেখানে থেমেছিলেন, সেখান থেকেই শুরু করুন
                </p>
              </div>
              <Link
                to="/my-work"
                className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#4F46E5] hover:text-[#4338CA] whitespace-nowrap dark:text-indigo-400"
              >
                <span>সব কাজ দেখুন</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentProjects.map((proj) => (
                <Link
                  key={proj.id}
                  to={`/editor/${proj.templateId}/${proj.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:border-[#4F46E5]/50 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-slate-100 dark:border-[#1F2937] dark:bg-gray-800">
                    {proj.thumbnail ? (
                      <img
                        src={proj.thumbnail}
                        alt={proj.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#64748B]">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#0F172A] dark:text-slate-100">
                      {proj.name}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[#64748B] tabular-nums dark:text-slate-400">
                      {formatBengaliRelativeTime(proj.updatedAt)}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#4F46E5]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* How It Works (3 Steps) */}
        <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mb-8 text-center">
            <p className="text-[13px] font-semibold text-[#4F46E5] dark:text-indigo-400">
              মাত্র ৩টি ধাপ
            </p>
            <h2 className="mt-1 text-[26px] font-bold tracking-tight text-[#0F172A] sm:text-[32px] dark:text-slate-100">
              কীভাবে কাজ করে
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                num: '১',
                icon: Link2,
                title: 'লিংক পেস্ট করুন',
                desc: 'যেকোনো বাংলা নিউজ পোর্টালের লিংক দিন। হেডলাইন আর ছবি নিজে থেকেই চলে আসবে।',
              },
              {
                num: '২',
                icon: LayoutGrid,
                title: 'টেমপ্লেট বাছুন',
                desc: `${totalCountLabel}+ রেডি ডিজাইন থেকে আপনার পেজের স্টাইল অনুযায়ী একটি বেছে নিন।`,
              },
              {
                num: '৩',
                icon: Download,
                title: 'ডাউনলোড করুন',
                desc: 'এক ক্লিকে HD PNG বা JPG। সরাসরি ফেসবুকে পোস্ট করার জন্য তৈরি।',
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute right-5 top-4 text-[32px] font-bold text-slate-200 select-none dark:text-gray-800"
                  >
                    {step.num}
                  </span>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/70 dark:text-indigo-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[17px] font-bold text-[#0F172A] dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Features Grid (6 Cards) */}
        <section className="mx-auto max-w-[1280px] px-4 pb-14 sm:px-6 sm:pb-16">
          <div className="mb-8 text-center">
            <p className="text-[13px] font-semibold text-[#4F46E5] dark:text-indigo-400">ফিচার</p>
            <h2 className="mt-1 text-[26px] font-bold tracking-tight text-[#0F172A] sm:text-[32px] dark:text-slate-100">
              নিউজ পেজের জন্য যা যা দরকার
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Sparkles,
                tone: 'bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-400',
                title: 'অটো হেডলাইন ও ছবি',
                desc: 'লিংক থেকে শিরোনাম, ছবি আর সোর্স নিজে থেকেই বসে যায়।',
              },
              {
                icon: LayoutGrid,
                tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
                title: `${totalCountLabel}+ টেমপ্লেট`,
                desc: 'ব্রেকিং, খেলা, রাজনীতি, বিনোদন — সব ধরনের নিউজের ডিজাইন।',
              },
              {
                icon: ShieldCheck,
                tone: 'bg-emerald-50 text-[#10B981] dark:bg-emerald-950/60 dark:text-emerald-400',
                title: 'নিজের লোগো',
                desc: 'একবার লোগো দিন, ক্রপ ও শেপ করে কার্ডের যেকোনো জায়গায় বসান।',
              },
              {
                icon: Download,
                tone: 'bg-amber-50 text-[#F59E0B] dark:bg-amber-950/60 dark:text-amber-400',
                title: 'PNG/JPG HD ডাউনলোড',
                desc: 'হাই-রেজোলিউশন PNG ও JPG, ঝকঝকে প্রিন্ট ও সোশ্যাল কোয়ালিটি।',
              },
              {
                icon: Type,
                tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
                title: 'বাংলা ফন্ট',
                desc: 'হিন্দ শিলিগুড়ি, কালপুরুষ, নোটোসহ সুন্দর বাংলা ফন্ট ও কাস্টম ফন্ট।',
              },
              {
                icon: Smartphone,
                tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
                title: 'মোবাইলে কাজ করে',
                desc: 'ফোন থেকেই সহজে কার্ড বানান, এডিট করুন আর শেয়ার করুন।',
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <div
                    className={`mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg ${feat.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0F172A] dark:text-slate-100">
                    {feat.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#64748B] dark:text-slate-400">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Popular Templates Preview Grid */}
        <section className="mx-auto max-w-[1280px] px-4 pb-14 sm:px-6 sm:pb-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-bold tracking-tight text-[#0F172A] sm:text-[28px] dark:text-slate-100">
                জনপ্রিয় টেমপ্লেট
              </h2>
              <p className="mt-1 text-[14px] text-[#64748B] dark:text-slate-400">
                সবচেয়ে বেশি ব্যবহৃত ডিজাইনগুলো
              </p>
            </div>
            <Link
              to="/templates"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13.5px] font-semibold text-[#0F172A] transition-colors duration-150 hover:bg-slate-50 whitespace-nowrap dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-gray-800"
            >
              <span>সব টেমপ্লেট দেখুন</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popularTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:border-[#4F46E5]/60 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
              >
                <div className="relative overflow-hidden">
                  <TemplatePreviewCanvas template={tpl} size={340} />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={creatingId === tpl.id}
                      onClick={() => handleOpenTemplateEditor(tpl.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[13.5px] font-semibold text-[#0F172A] shadow-md transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#4F46E5]" />
                      <span>এডিট করুন</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                      {tpl.name}
                    </h3>
                    <p className="truncate text-[12px] text-[#64748B] dark:text-slate-400">
                      {tpl.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenTemplateEditor(tpl.id)}
                    aria-label={`${tpl.name} এডিট করুন`}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] px-2.5 text-xs font-semibold text-[#4F46E5] transition-colors hover:bg-[#EEF2FF] sm:hidden dark:border-[#1F2937] dark:text-indigo-400"
                  >
                    এডিট
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Dark CTA Banner */}
        <section className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#1E1B4B] px-6 py-9 text-white shadow-lg sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight sm:text-[28px]">
                আজকের প্রথম কার্ডটা বানিয়ে ফেলুন
              </h2>
              <p className="mt-1 text-[14px] text-slate-300">
                ফ্রি, কোনো অ্যাকাউন্ট ছাড়াই।
              </p>
            </div>
            <Link
              to="/templates"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-5 text-[14.5px] font-semibold text-[#0F172A] transition-colors duration-150 hover:bg-slate-100 whitespace-nowrap"
            >
              <span>টেমপ্লেট দেখুন</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
