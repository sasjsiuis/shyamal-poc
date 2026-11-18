import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  Highlighter,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Link2,
  Palette,
  Play,
  Smartphone,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { toBengaliDigits } from '../utils/projectStorage';

const DESKTOP_VIDEO_ID = '8jq2rjUb4R0';
const MOBILE_SHORTS_ID = 'M59qYQaj68E';

interface VideoChapter {
  id: string;
  timeSeconds: number;
  timeLabel: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VIDEO_CHAPTERS: VideoChapter[] = [
  {
    id: 'intro-link',
    timeSeconds: 0,
    timeLabel: '০০:০০',
    title: 'নিউজ লিংক দিয়ে ৫ সেকেন্ডে কার্ড',
    description: 'হোম পেইজের লিংক বক্সে যেকোনো বাংলা বা ইংরেজি নিউজের URL পেস্ট করে কার্ড বানান।',
    icon: Link2,
  },
  {
    id: 'zoom-highlight',
    timeSeconds: 37,
    timeLabel: '০০:৩৭',
    title: 'জুম ও শব্দে ক্লিক করে হাইলাইট',
    description: 'শিরোনামের নির্দিষ্ট শব্দে এক ক্লিক করে হাইলাইট রং দিন বা লেখা বদলান।',
    icon: Highlighter,
  },
  {
    id: 'style-fonts',
    timeSeconds: 85,
    timeLabel: '০১:২৫',
    title: 'স্টাইল, ফন্ট, সাইজ ও কালার',
    description: 'লাইন মোড, বাংলা ও কাস্টম ফন্ট, সাইজ, লাইন স্পেসিং, পজিশন, শ্যাডো ও রং ঠিক করুন।',
    icon: Palette,
  },
  {
    id: 'photo-edit',
    timeSeconds: 160,
    timeLabel: '০২:৪০',
    title: 'ছবি বদলানো, জুম, প্যান ও আনডু',
    description: 'নিজের ছবি আপলোড করে জুম/ডানে-বামে সেট করুন এবং প্রয়োজনে Undo ব্যবহার করুন।',
    icon: ImageIcon,
  },
  {
    id: 'logo-editor',
    timeSeconds: 198,
    timeLabel: '০৩:১৮',
    title: 'লোগো আপলোড, ক্রপ, শেপ ও ব্যাজ',
    description: 'কাস্টম লোগো ক্রপ বা ইরেজ করুন, গোল/রাউন্ডেড শেপ ও ব্যাকগ্রাউন্ড ব্যাজ যোগ করুন।',
    icon: BadgeCheck,
  },
  {
    id: 'templates-badge',
    timeSeconds: 266,
    timeLabel: '০৪:২৬',
    title: 'টেমপ্লেট, সাব-হেডিং ও ব্যাজ কাস্টমাইজ',
    description: 'শতাধিক টেমপ্লেট থেকে বেছে নিন, সাব-হেডিং লিখুন ও উপরের/নিচের ব্যাজ বদলান।',
    icon: LayoutGrid,
  },
  {
    id: 'export-card',
    timeSeconds: 344,
    timeLabel: '০৫:৪৪',
    title: 'PNG ও JPG হাই-কোয়ালিটি ডাউনলোড',
    description: 'ফরম্যাট ও কোয়ালিটি নির্ধারণ করে সাথে সাথে HD ফটো কার্ড ডাউনলোড করুন।',
    icon: Download,
  },
  {
    id: 'my-work',
    timeSeconds: 367,
    timeLabel: '০৬:০৭',
    title: '"আমার কাজ" অটো-সেভ ও দ্রুত নতুন কার্ড',
    description: 'ব্রাউজারে সেভ হওয়া আগের কার্ড পুনরায় এডিট করুন বা এডিটরের ভেতর থেকেই নতুন লিংক দিন।',
    icon: FolderOpen,
  },
];

const MOBILE_STEPS = [
  {
    step: '১',
    title: 'টেমপ্লেট বা লিংক বাছাই',
    desc: 'মোবাইল থেকেই হোম পেইজে নিউজ লিংক পেস্ট করুন অথবা পছন্দের টেমপ্লেট বেছে এডিটর খুলুন।',
  },
  {
    step: '২',
    title: 'নিচের মেনু থেকে সহজ এডিট',
    desc: 'স্ক্রিনের নিচের টেক্সট, লেয়ার, স্টাইল, ছবি ও লোগো ট্যাবে ট্যাপ করে আঙুল দিয়ে টেনে সাজান।',
  },
  {
    step: '৩',
    title: 'সরাসরি ফোনে HD ডাউনলোড',
    desc: 'সবকিছু ঠিক হলে এক্সপোর্ট বাটনে ট্যাপ করে PNG বা JPG ফরম্যাটে গ্যালারিতে সেভ করে শেয়ার করুন।',
  },
];

const QUICK_TIPS = [
  {
    title: 'স্পেস চেপে প্রিভিউ সরান',
    desc: 'কীবোর্ডে Space চেপে ধরে বা "সরান" বাটনে ক্লিক করে প্রিভিউ কার্ডটি ডানে-বামে যেকোনো জায়গায় সরাতে ও মাউস হুইলে জুম করতে পারবেন।',
    badge: 'Space + টানুন',
  },
  {
    title: 'সংখ্যার ঘরে সরাসরি টাইপ',
    desc: 'লেখার সাইজ, স্পেসিং, জুম বা লোগো পজিশনের যেকোনো সংখ্যার বক্সে ক্লিক করে বাংলা বা ইংরেজি সংখ্যা লিখে Enter চাপুন।',
    badge: 'ক্লিক ও টাইপ',
  },
  {
    title: 'লেয়ার ও ড্র্যাগ/পেস্ট ছবি',
    desc: 'বামের "লেয়ার" মেনু থেকে সব এলিমেন্ট উপর-নিচ ও কাস্টমাইজ করুন, অথবা কার্ডে সরাসরি ছবি ড্র্যাগ বা Ctrl+V দিয়ে পেস্ট করুন।',
    badge: 'লেয়ার + Ctrl+V',
  },
  {
    title: 'অফলাইনেও অটো-সেভ নিরাপদ',
    desc: 'আপনার তৈরি সর্বোচ্চ ৫০টি প্রজেক্ট ছবি ও লোগোসহ সরাসরি ব্রাউজারে সেভ থাকে — পেজ রিফ্রেশ হলেও কাজ হারাবে না।',
    badge: '৫০ প্রজেক্ট',
  },
];

export const LearnPage: React.FC = () => {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [embedParams, setEmbedParams] = useState<{ start: number; autoplay: boolean; nonce: number }>({
    start: 0,
    autoplay: false,
    nonce: 0,
  });

  const activeChapter = VIDEO_CHAPTERS[activeChapterIndex] || VIDEO_CHAPTERS[0];

  const handleJumpToChapter = (idx: number, seconds: number) => {
    setActiveChapterIndex(idx);
    setEmbedParams((prev) => ({
      start: seconds,
      autoplay: true,
      nonce: prev.nonce + 1,
    }));
  };

  const desktopEmbedUrl = `https://www.youtube.com/embed/${DESKTOP_VIDEO_ID}?rel=0&modestbranding=1${
    embedParams.start > 0 ? `&start=${embedParams.start}` : ''
  }${embedParams.autoplay ? '&autoplay=1' : ''}`;

  const mobileEmbedUrl = `https://www.youtube.com/embed/${MOBILE_SHORTS_ID}?rel=0&modestbranding=1`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#0F172A] dark:bg-[#0B0F19] dark:text-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <nav
          aria-label="ব্রেডক্রাম্ব"
          className="mb-4 flex items-center gap-1.5 text-[13px] text-[#64748B] dark:text-slate-400"
        >
          <Link to="/" className="transition-colors hover:text-[#0F172A] dark:hover:text-slate-100">
            হোম
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-[#0F172A] dark:text-slate-200">শিখুন</span>
        </nav>

        {/* Page Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-[12.5px] font-semibold text-[#4F46E5] shadow-2xs dark:border-[#1F2937] dark:bg-[#111827] dark:text-indigo-400">
              <BookOpen className="h-3.5 w-3.5" />
              <span>ভিডিও গাইড ও টিউটোরিয়াল</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] sm:text-[34px] dark:text-white">
              ৭ মিনিটে শিখে নিন ফটো কার্ড বানানোর সম্পূর্ণ নিয়ম
            </h1>
            <p className="max-w-2xl text-[14.5px] leading-relaxed text-[#64748B] dark:text-slate-400">
              নিউজ লিংক পেস্ট করা থেকে শুরু করে হাইলাইট, বাংলা ফন্ট, কাস্টম লোগো ও HD ডাউনলোড — ধাপে
              ধাপে ফুল-কোয়ালিটি ভিডিও দেখে ও অধ্যায় নির্বাচন করে শিখুন।
            </p>
          </div>

          <Link
            to="/templates"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#4F46E5] px-5 text-[14px] font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA]"
          >
            <Wand2 className="h-4 w-4" />
            <span>এখনই শুরু করুন</span>
          </Link>
        </div>

        {/* Main Video Player + Interactive Chapters Grid */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          {/* Left: Full HD YouTube Player Card */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
            <div className="relative aspect-video w-full bg-slate-950">
              <iframe
                key={`${embedParams.start}-${embedParams.nonce}`}
                src={desktopEmbedUrl}
                title="MXB ফটোকার্ড সম্পূর্ণ টিউটোরিয়াল"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>

            {/* Video Meta & External YouTube Link */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] p-4 dark:border-[#1F2937]">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#4F46E5] dark:text-indigo-400">
                  <span className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] px-2 py-0.5 tabular-nums dark:bg-indigo-950/70">
                    <Play className="h-3 w-3" />
                    <span>{activeChapter.timeLabel}</span>
                  </span>
                  <span className="truncate">{activeChapter.title}</span>
                </div>
                <p className="text-[13px] text-[#64748B] dark:text-slate-400">
                  {activeChapter.description}
                </p>
              </div>

              <a
                href={`https://youtu.be/${DESKTOP_VIDEO_ID}${
                  embedParams.start > 0 ? `?t=${embedParams.start}` : ''
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-1.5 text-[12px] font-semibold text-[#0F172A] transition-colors hover:bg-slate-100 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:bg-gray-800"
              >
                <span>YouTube-এ দেখুন</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Right: Clickable Timestamp Chapters */}
          <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
            <div className="mb-3 flex items-center justify-between border-b border-[#E5E7EB] pb-3 dark:border-[#1F2937]">
              <div>
                <h2 className="text-[16px] font-bold text-[#0F172A] dark:text-white">
                  ভিডিও অধ্যায়সমূহ ({toBengaliDigits(VIDEO_CHAPTERS.length)})
                </h2>
                <p className="text-[12px] text-[#64748B] dark:text-slate-400">
                  যেকোনো ধাপে ক্লিক করলেই সেই অংশ শুরু হবে
                </p>
              </div>
              <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-300">
                ০৭:০৩ মিনিট
              </span>
            </div>

            <div className="space-y-1.5">
              {VIDEO_CHAPTERS.map((chap, idx) => {
                const Icon = chap.icon;
                const active = idx === activeChapterIndex;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => handleJumpToChapter(idx, chap.timeSeconds)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-2.5 text-left transition-all duration-150 ${
                      active
                        ? 'border-[#4F46E5]/50 bg-[#EEF2FF]/75 dark:border-indigo-500/40 dark:bg-indigo-950/40'
                        : 'border-transparent hover:border-[#E5E7EB] hover:bg-[#F7F8FA] dark:hover:border-[#1F2937] dark:hover:bg-[#0B0F19]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-[#F7F8FA] text-[#64748B] dark:bg-[#0B0F19] dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[13.5px] font-semibold ${
                            active
                              ? 'text-[#4F46E5] dark:text-indigo-300'
                              : 'text-[#0F172A] dark:text-slate-100'
                          }`}
                        >
                          {toBengaliDigits(idx + 1)}. {chap.title}
                        </span>
                        <span className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#64748B] tabular-nums ring-1 ring-[#E5E7EB] dark:bg-[#0B0F19] dark:text-slate-400 dark:ring-[#1F2937]">
                          {chap.timeLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#64748B] dark:text-slate-400">
                        {chap.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </section>

        {/* Dedicated Mobile Tutorial Section (YouTube Shorts 9:16) */}
        <section className="mt-12 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8 dark:border-[#1F2937] dark:bg-[#111827]">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.2fr_auto]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-1 text-[12px] font-semibold text-[#4F46E5] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-indigo-400">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>মোবাইল ইউজার গাইড</span>
                </div>
                <h2 className="text-[22px] font-bold text-[#0F172A] sm:text-[26px] dark:text-white">
                  মোবাইল থেকে কার্ড বানানোর নিয়ম
                </h2>
                <p className="max-w-xl text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400">
                  কম্পিউটার ছাড়াই আপনার স্মার্টফোন থেকে কয়েক সেকেন্ডেই প্রফেশনাল নিউজ ফটো কার্ড
                  তৈরি করুন। নিচের শর্টস ভিডিওটিতে পুরো মোবাইল workflow দেখানো হয়েছে।
                </p>
              </div>

              <div className="space-y-3">
                {MOBILE_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5 dark:border-[#1F2937] dark:bg-[#0B0F19]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-[13px] font-bold text-white">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-[14.5px] font-bold text-[#0F172A] dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#64748B] dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/templates"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4F46E5] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
                >
                  <span>মোবাইলে কার্ড তৈরি করুন</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`https://youtube.com/shorts/${MOBILE_SHORTS_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:bg-gray-800"
                >
                  <span>YouTube Shorts-এ দেখুন</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Vertical 9:16 Shorts Player */}
            <div className="mx-auto w-full max-w-[300px] sm:max-w-[320px]">
              <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-slate-950 shadow-lg ring-1 ring-black/5 dark:border-[#1F2937] dark:ring-white/10">
                <div className="aspect-[9/16] w-full">
                  <iframe
                    src={mobileEmbedUrl}
                    title="মোবাইল থেকে কার্ড বানানোর নিয়ম"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pro Tips & Keyboard Shortcuts Grid */}
        <section className="mt-12">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/70 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[22px] font-bold text-[#0F172A] dark:text-white">
                দ্রুত কাজের দারুণ কিছু টিপস
              </h2>
              <p className="text-[13px] text-[#64748B] dark:text-slate-400">
                এডিটরে আরও দ্রুত ও নিখুঁতভাবে কাজ করার শর্টকাট
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_TIPS.map((tip) => (
              <div
                key={tip.title}
                className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-[#1F2937] dark:bg-[#111827]"
              >
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5] dark:bg-indigo-950/70 dark:text-indigo-300">
                    <Keyboard className="h-3 w-3" />
                    <span>{tip.badge}</span>
                  </span>
                  <h3 className="mt-3 text-[15.5px] font-bold text-[#0F172A] dark:text-slate-100">
                    {tip.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B] dark:text-slate-400">
                    {tip.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-12 rounded-2xl bg-[#0F172A] p-7 text-center text-white sm:p-10 dark:border dark:border-[#1F2937] dark:bg-[#111827]">
          <h2 className="text-[22px] font-bold sm:text-[26px]">
            দেখা তো হলো — এবার প্রথম কার্ড বানিয়ে ফেলুন
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-slate-300">
            যেকোনো টেমপ্লেট বেছে নিন অথবা হোম পেইজে নিউজের লিংক পেস্ট করে ৫ সেকেন্ডে ফটো কার্ড তৈরি
            করুন।
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/templates"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#4F46E5] px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
            >
              <span>টেমপ্লেট দেখুন</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-5 text-[14px] font-semibold text-slate-200 transition-colors hover:bg-slate-800"
            >
              <span>লিংক দিয়ে শুরু</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
