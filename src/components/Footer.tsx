import React from 'react';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white dark:border-[#1F2937] dark:bg-[#111827]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-[#64748B] sm:flex-row sm:px-6 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-bold text-[#0F172A] whitespace-nowrap dark:text-slate-100"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#4F46E5] text-white">
              <Newspaper className="h-3.5 w-3.5" />
            </span>
            <span>MXB ফটোকার্ড</span>
          </Link>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            |
          </span>
          <span>© ২০২৬ · বাংলা নিউজের জন্য তৈরি</span>
        </div>

        <div className="flex items-center gap-5 font-medium">
          <Link
            to="/"
            className="transition-colors hover:text-[#0F172A] whitespace-nowrap dark:hover:text-slate-100"
          >
            হোম
          </Link>
          <Link
            to="/templates"
            className="transition-colors hover:text-[#0F172A] whitespace-nowrap dark:hover:text-slate-100"
          >
            টেমপ্লেট
          </Link>
          <Link
            to="/my-work"
            className="transition-colors hover:text-[#0F172A] whitespace-nowrap dark:hover:text-slate-100"
          >
            আমার কাজ
          </Link>
          <Link
            to="/learn"
            className="transition-colors hover:text-[#0F172A] whitespace-nowrap dark:hover:text-slate-100"
          >
            শিখুন
          </Link>
        </div>
      </div>
    </footer>
  );
};
