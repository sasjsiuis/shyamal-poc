import React, { useEffect, useRef, useState } from 'react';
import { toBengaliDigits } from '../utils/projectStorage';

const BENGALI_TO_ASCII: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function parseFlexibleNumber(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[০-৯]/g, (ch) => BENGALI_TO_ASCII[ch] ?? ch)
    .replace(/[^0-9.-]/g, '');
  if (!ascii || ascii === '-' || ascii === '.' || ascii === '-.') return null;
  const parsed = Number(ascii);
  return Number.isFinite(parsed) ? parsed : null;
}

interface EditableNumberBadgeProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (nextVal: number) => void;
  ariaLabel?: string;
  className?: string;
  displayFormatter?: (val: number) => string;
}

export const EditableNumberBadge: React.FC<EditableNumberBadgeProps> = ({
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
  ariaLabel,
  className = '',
  displayFormatter,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(value)));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(Math.round(value)));
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const clampAndRound = (num: number) => {
    const clamped = Math.max(min, Math.min(max, num));
    if (step >= 1) {
      return Math.round(clamped);
    }
    return Math.round(clamped * 100) / 100;
  };

  const commitDraft = () => {
    setEditing(false);
    const parsed = parseFlexibleNumber(draft);
    if (parsed === null) {
      setDraft(String(Math.round(value)));
      return;
    }
    const next = clampAndRound(parsed);
    onChange(next);
    setDraft(String(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setDraft(String(Math.round(value)));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFlexibleNumber(draft) ?? value;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? step * 10 : step);
      const next = clampAndRound(current + delta);
      setDraft(String(next));
      onChange(next);
    }
  };

  if (editing) {
    return (
      <div
        className={`inline-flex items-center rounded-md border border-[#4F46E5] bg-white px-1.5 py-0.5 ring-2 ring-[#4F46E5]/20 max-md:min-h-[44px] max-md:px-2.5 dark:bg-[#0B0F19] ${className}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode={min < 0 ? 'text' : 'numeric'}
          aria-label={ariaLabel}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-[42px] bg-transparent text-center text-[12px] font-semibold text-[#0F172A] tabular-nums focus:outline-none max-md:w-[54px] max-md:text-[16px] dark:text-slate-100"
        />
        {suffix && (
          <span className="text-[11px] font-semibold text-[#64748B] select-none max-md:text-xs">{suffix}</span>
        )}
      </div>
    );
  }

  const label = displayFormatter
    ? displayFormatter(value)
    : `${toBengaliDigits(Math.round(value))}${suffix}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(String(Math.round(value)));
        setEditing(true);
      }}
      title="ক্লিক করে সরাসরি সংখ্যা লিখুন"
      aria-label={ariaLabel ? `${ariaLabel}: ${label} (ক্লিক করে সংখ্যা লিখুন)` : undefined}
      className={`inline-flex min-w-[46px] cursor-text items-center justify-center rounded-md border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-0.5 text-[12px] font-semibold text-[#0F172A] tabular-nums transition-colors hover:border-[#4F46E5]/70 hover:bg-white max-md:min-h-[44px] max-md:min-w-[56px] max-md:px-3 max-md:text-sm dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:border-indigo-500/70 ${className}`}
    >
      {label}
    </button>
  );
};
