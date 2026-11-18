import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  FolderOpen,
  Link2,
  Loader2,
  Moon,
  Newspaper,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  Sun,
  Undo2,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { ExportFormat } from '../../types/card';
import { sanitizeUrlInput } from '../../utils/newsExtractor';
import { formatBengaliClockTime } from '../../utils/projectStorage';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'limit-reached';

interface EditorTopBarProps {
  templateName: string;
  projectName: string;
  onRenameProject: (nextName: string) => void;
  saveStatus: AutoSaveStatus;
  lastSavedAt: number | null;
  onManualSave: () => void;
  newsUrl: string;
  onNewsUrlChange: (url: string) => void;
  onNewsUrlPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClearNewsUrl: () => void;
  onTriggerFetch: () => void;
  isExtracting: boolean;
  isLikelyValidUrl: boolean;
  exportFormat: ExportFormat;
  onChangeExportFormat: (fmt: ExportFormat) => void;
  onDownload: () => void;
  downloadDone: boolean;
  // Mobile top bar controls
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenMobileUrlModal?: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  templateName,
  projectName,
  onRenameProject,
  saveStatus,
  lastSavedAt,
  onManualSave,
  newsUrl,
  onNewsUrlChange,
  onNewsUrlPaste,
  onClearNewsUrl,
  onTriggerFetch,
  isExtracting,
  isLikelyValidUrl,
  exportFormat,
  onChangeExportFormat,
  onDownload,
  downloadDone,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenMobileUrlModal,
}) => {
  const { isDark, toggleDark } = useTheme();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== projectName) {
      onRenameProject(trimmed);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white pt-[env(safe-area-inset-top)] dark:border-[#1F2937] dark:bg-[#111827]">
      {/* Mobile Compact 48px Top Bar (<768px) */}
      <div className="flex h-12 items-center justify-between gap-1 px-1.5 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <Link
            to="/templates"
            title="টেমপ্লেট গ্যালারিতে ফিরুন"
            aria-label="টেমপ্লেটে ফিরুন"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#0F172A] active:bg-slate-100 dark:text-slate-100 dark:active:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          {editingName ? (
            <input
              type="text"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              aria-label="প্রজেক্টের নাম"
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#4F46E5] bg-white px-2 text-[16px] font-semibold text-[#0F172A] focus:outline-none dark:bg-[#0B0F19] dark:text-slate-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(projectName);
                setEditingName(true);
              }}
              title="প্রজেক্টের নাম বদলাতে ক্লিক করুন"
              aria-label={`নাম বদলান: ${templateName}`}
              className="flex min-h-[44px] min-w-[44px] max-w-full flex-1 cursor-pointer items-center gap-1 overflow-hidden rounded-lg px-1.5 text-left text-[13.5px] font-bold text-[#0F172A] active:bg-slate-100 dark:text-slate-100 dark:active:bg-gray-800"
            >
              <span className="truncate">{templateName}</span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {onOpenMobileUrlModal && (
            <button
              type="button"
              onClick={onOpenMobileUrlModal}
              title="লিংক বদলান"
              aria-label="লিংক বদলান"
              className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors active:bg-slate-100 dark:active:bg-gray-800 ${
                newsUrl.trim() ? 'text-[#4F46E5] dark:text-indigo-400' : 'text-[#0F172A] dark:text-slate-200'
              }`}
            >
              <Link2 className="h-[18px] w-[18px]" />
            </button>
          )}

          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="পিছনে যান"
              aria-label="আনডু"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#0F172A] transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-200 dark:active:bg-gray-800"
            >
              <Undo2 className="h-[18px] w-[18px]" />
            </button>
          )}

          {onRedo && (
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="সামনে যান"
              aria-label="রিডু"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#0F172A] transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-200 dark:active:bg-gray-800"
            >
              <Redo2 className="h-[18px] w-[18px]" />
            </button>
          )}

          <button
            type="button"
            onClick={onDownload}
            aria-label="কার্ড ডাউনলোড"
            className="ml-0.5 inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl bg-[#4F46E5] px-3 text-[13px] font-semibold text-white shadow-xs transition-colors active:bg-[#4338CA] whitespace-nowrap"
          >
            {downloadDone ? (
              <Check className="h-4 w-4 stroke-[2.5]" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{downloadDone ? 'সেভ' : 'ডাউনলোড'}</span>
          </button>
        </div>
      </div>

      {/* Desktop Top Bar (>=768px) — Unchanged */}
      <div className="hidden h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 md:flex">
        {/* Left: Back arrow + Template/Project name + Save status */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <Link
            to="/templates"
            title="টেমপ্লেট গ্যালারিতে ফিরুন"
            aria-label="টেমপ্লেটে ফিরুন"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#0F172A] transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-white sm:flex">
            <Newspaper className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {editingName ? (
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="h-7 w-40 rounded border border-[#4F46E5] bg-white px-2 text-xs font-semibold text-[#0F172A] focus:outline-none dark:bg-[#0B0F19] dark:text-slate-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(projectName);
                    setEditingName(true);
                  }}
                  title="প্রজেক্টের নাম বদলাতে ক্লিক করুন"
                  className="group inline-flex max-w-[160px] cursor-pointer items-center gap-1 truncate text-left text-[13.5px] font-bold text-[#0F172A] hover:text-[#4F46E5] sm:max-w-[200px] dark:text-slate-100"
                >
                  <span className="truncate">{templateName}</span>
                  <Pencil className="h-3 w-3 shrink-0 text-[#64748B] opacity-60 group-hover:opacity-100" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] leading-tight">
              <span className="hidden max-w-[140px] truncate text-[#64748B] lg:inline dark:text-slate-400">
                {projectName}
              </span>
              {saveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 font-medium text-[#64748B] dark:text-slate-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>সেভ হচ্ছে…</span>
                </span>
              )}
              {saveStatus === 'saved' && lastSavedAt && (
                <span className="inline-flex items-center gap-1 font-medium text-[#10B981]">
                  <Check className="h-3 w-3" />
                  <span className="tabular-nums">
                    সেভ হয়েছে {formatBengaliClockTime(lastSavedAt)}
                  </span>
                </span>
              )}
              {saveStatus === 'limit-reached' && (
                <span className="font-medium text-[#F59E0B]">৫০টির সীমা পূর্ণ</span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Desktop News Link Input */}
        <div className="hidden max-w-[440px] flex-1 items-center gap-1.5 md:flex">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
            <input
              type="url"
              value={newsUrl}
              onPaste={onNewsUrlPaste}
              onChange={(e) => {
                const raw = e.target.value;
                const nextVal = /https?:\/\/.*https?:\/\//i.test(raw)
                  ? sanitizeUrlInput(raw)
                  : raw;
                onNewsUrlChange(nextVal);
              }}
              placeholder="এখানে নিউজের লিংক পেস্ট করুন..."
              aria-label="নিউজের লিংক"
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] pl-8 pr-8 text-[13px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            />
            {newsUrl.length > 0 && (
              <button
                type="button"
                onClick={onClearNewsUrl}
                aria-label="লিংক মুছুন"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A] dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isLikelyValidUrl && (
            <button
              type="button"
              disabled={isExtracting}
              onClick={onTriggerFetch}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12.5px] font-semibold text-[#0F172A] hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'আনা হচ্ছে...' : 'আনুন'}</span>
            </button>
          )}
        </div>

        {/* Right: Save, Format toggle, My Work, Theme, Primary Download */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onManualSave}
            title="সেভ করুন (Ctrl+S)"
            aria-label="সেভ করুন"
            className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] font-medium text-[#0F172A] hover:bg-slate-50 lg:inline-flex dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            <Save className="h-3.5 w-3.5 text-[#64748B]" />
            <span>সেভ</span>
          </button>

          {/* Format Toggle */}
          <div className="hidden items-center rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-0.5 sm:inline-flex dark:border-[#1F2937] dark:bg-[#0B0F19]">
            {(['png', 'jpeg'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onChangeExportFormat(fmt)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold uppercase transition-colors ${
                  exportFormat === fmt
                    ? 'bg-white text-[#0F172A] shadow-2xs dark:bg-[#111827] dark:text-white'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400'
                }`}
              >
                {fmt === 'png' ? 'PNG' : 'JPG'}
              </button>
            ))}
          </div>

          <Link
            to="/my-work"
            title="আমার কাজ"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[13px] font-medium text-[#0F172A] transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100 dark:hover:bg-gray-800"
          >
            <FolderOpen className="h-4 w-4 text-[#64748B]" />
            <span className="hidden sm:inline">আমার কাজ</span>
          </Link>

          <button
            type="button"
            onClick={toggleDark}
            aria-label={isDark ? 'লাইট মোড' : 'ডার্ক মোড'}
            className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50 sm:inline-flex dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 text-[13.5px] font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-[#4338CA] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 sm:px-4"
          >
            {downloadDone ? (
              <Check className="h-4 w-4 stroke-[2.5]" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{downloadDone ? 'হয়েছে ✓' : 'ডাউনলোড'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
