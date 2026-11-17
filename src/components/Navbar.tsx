import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Menu, Moon, Newspaper, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { isDark, toggleDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50 ${
      isActive
        ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold dark:bg-indigo-950/70 dark:text-indigo-300'
        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-gray-800/70'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-md dark:border-[#1F2937] dark:bg-[#111827]/95">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Logo + Brand */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50 rounded-lg dark:text-slate-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4F46E5] text-white shadow-xs">
            <Newspaper className="h-4 w-4" />
          </span>
          <span>MXB ফটোকার্ড</span>
        </Link>

        {/* Center/Right: Desktop Navigation */}
        <nav aria-label="প্রধান নেভিগেশন" className="hidden items-center gap-1.5 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            হোম
          </NavLink>
          <NavLink to="/templates" className={navLinkClass}>
            টেমপ্লেট
          </NavLink>
          <NavLink to="/my-work" className={navLinkClass}>
            আমার কাজ
          </NavLink>
        </nav>

        {/* Right: Theme Toggle + Single Primary CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleDark}
            aria-label={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            title={isDark ? 'লাইট মোড' : 'ডার্ক মোড'}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] transition-colors duration-150 hover:bg-slate-50 hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-slate-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            to="/templates"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 text-[14px] font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-[#4338CA] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 sm:px-4"
          >
            <span>শুরু করুন</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="মেনু"
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] md:hidden dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <nav
          aria-label="মোবাইল নেভিগেশন"
          className="flex items-center gap-2 border-t border-[#E5E7EB] bg-white px-4 py-2.5 md:hidden dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={navLinkClass}
          >
            হোম
          </NavLink>
          <NavLink
            to="/templates"
            onClick={() => setMobileMenuOpen(false)}
            className={navLinkClass}
          >
            টেমপ্লেট
          </NavLink>
          <NavLink
            to="/my-work"
            onClick={() => setMobileMenuOpen(false)}
            className={navLinkClass}
          >
            আমার কাজ
          </NavLink>
        </nav>
      )}
    </header>
  );
};
