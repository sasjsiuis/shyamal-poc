import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success', durationMs = 2800) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => {
        dismiss(id);
      }, durationMs);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-150 ${
              t.tone === 'success'
                ? 'border-emerald-200 bg-white text-slate-900 dark:border-emerald-800 dark:bg-gray-900 dark:text-slate-100'
                : t.tone === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100'
                  : t.tone === 'error'
                    ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100'
                    : 'border-gray-200 bg-white text-slate-900 dark:border-gray-800 dark:bg-gray-900 dark:text-slate-100'
            }`}
          >
            {t.tone === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />}
            {t.tone === 'warning' && <AlertCircle className="h-4 w-4 shrink-0 text-[#F59E0B]" />}
            {t.tone === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />}
            {t.tone === 'info' && <Info className="h-4 w-4 shrink-0 text-[#4F46E5]" />}
            <span className="whitespace-nowrap">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="বন্ধ করুন"
              className="ml-1 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  return useContext(ToastContext);
}
