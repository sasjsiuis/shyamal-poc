import React from 'react';
import { Link2, RotateCcw, Trash2, X } from 'lucide-react';
import { sanitizeUrlInput } from '../../utils/newsExtractor';

interface MobileUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsUrl: string;
  onNewsUrlChange: (url: string) => void;
  onNewsUrlPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClearNewsUrl: () => void;
  onTriggerFetch: () => void;
  isExtracting: boolean;
  isLikelyValidUrl: boolean;
  extractError: string | null;
}

export const MobileUrlModal: React.FC<MobileUrlModalProps> = ({
  isOpen,
  onClose,
  newsUrl,
  onNewsUrlChange,
  onNewsUrlPaste,
  onClearNewsUrl,
  onTriggerFetch,
  isExtracting,
  isLikelyValidUrl,
  extractError,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="নিউজ লিংক বদলান"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-xs md:hidden"
      onClick={onClose}
    >
      <div
        className="mb-[env(safe-area-inset-bottom)] w-full max-w-md space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-bold text-[#0F172A] dark:text-slate-100">
            <Link2 className="h-4 w-4 text-[#4F46E5]" />
            <span>নিউজ লিংক থেকে আনুন</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#64748B] active:bg-slate-100 dark:text-slate-300 dark:active:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex items-center gap-1.5">
          <input
            type="url"
            autoFocus
            value={newsUrl}
            onPaste={onNewsUrlPaste}
            onChange={(e) => {
              const raw = e.target.value;
              const nextVal = /https?:\/\/.*https?:\/\//i.test(raw)
                ? sanitizeUrlInput(raw)
                : raw;
              onNewsUrlChange(nextVal);
            }}
            placeholder="https://... নিউজ লিংক পেস্ট করুন"
            aria-label="নিউজের লিংক"
            className="h-12 min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-3.5 text-[16px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
          />
          {newsUrl.length > 0 && (
            <button
              type="button"
              onClick={onClearNewsUrl}
              aria-label="লিংক মুছুন"
              className="flex h-12 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#EF4444] active:bg-red-50 dark:border-[#1F2937] dark:bg-[#0B0F19]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {extractError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-[#EF4444] dark:bg-red-950/40">
            {extractError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A] active:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
          >
            বন্ধ করুন
          </button>
          <button
            type="button"
            disabled={!isLikelyValidUrl || isExtracting}
            onClick={() => {
              onTriggerFetch();
              onClose();
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white active:bg-[#4338CA] disabled:opacity-45"
          >
            <RotateCcw className={`h-4 w-4 ${isExtracting ? 'animate-spin' : ''}`} />
            <span>{isExtracting ? 'আনা হচ্ছে...' : 'আনুন'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
