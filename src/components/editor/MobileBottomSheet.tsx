import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export type MobileSheetSnap = 'collapsed' | 'default' | 'expanded';

interface MobileBottomSheetProps {
  isOpen: boolean;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  snapState: MobileSheetSnap;
  onSnapChange: (next: MobileSheetSnap) => void;
  onClose: () => void;
  viewportHeight: number;
  isKeyboardOpen: boolean;
  onKeyboardDone?: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  title,
  icon: Icon,
  snapState,
  onSnapChange,
  onClose,
  viewportHeight,
  isKeyboardOpen,
  onKeyboardDone,
  headerRight,
  children,
}) => {
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startH: number;
    startTime: number;
    lastH: number;
  }>({
    active: false,
    pointerId: -1,
    startY: 0,
    startH: 0,
    startTime: 0,
    lastH: 0,
  });

  const collapsedH = 64;
  const defaultH = Math.min(365, Math.max(245, Math.round(viewportHeight * 0.40)));
  const expandedH = Math.min(540, Math.max(360, Math.round(viewportHeight * 0.60)));
  const keyboardH = Math.min(180, Math.max(124, Math.round(viewportHeight * 0.34)));

  const targetH = isKeyboardOpen
    ? keyboardH
    : snapState === 'collapsed'
      ? collapsedH
      : snapState === 'expanded'
        ? expandedH
        : defaultH;

  const currentH = dragHeight !== null ? dragHeight : targetH;

  const snapStateRef = useRef(snapState);
  snapStateRef.current = snapState;
  const callbacksRef = useRef({ onSnapChange, onClose });
  callbacksRef.current = { onSnapChange, onClose };
  const limitsRef = useRef({ collapsedH, defaultH, expandedH });
  limitsRef.current = { collapsedH, defaultH, expandedH };

  useEffect(() => {
    const onWinPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dy = e.clientY - dragRef.current.startY;
      const maxH = limitsRef.current.expandedH + 40;
      const nextH = Math.max(32, Math.min(maxH, Math.round(dragRef.current.startH - dy)));
      dragRef.current.lastH = nextH;
      setDragHeight(nextH);
    };

    const onWinPointerUp = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dy = e.clientY - dragRef.current.startY;
      const dt = Math.max(16, Date.now() - dragRef.current.startTime);
      const vy = dy / dt;
      const finalH = dragRef.current.lastH;
      const snap = snapStateRef.current;
      const { collapsedH: cH, defaultH: dH, expandedH: eH } = limitsRef.current;
      const { onSnapChange: setSnap, onClose: closeSheet } = callbacksRef.current;

      dragRef.current.active = false;
      setDragHeight(null);

      if (Math.abs(dy) < 8) {
        setSnap(snap === 'collapsed' ? 'default' : 'collapsed');
        return;
      }

      if (snap === 'collapsed') {
        if (dy < -30) {
          setSnap(finalH > (dH + eH) / 2 ? 'expanded' : 'default');
        } else if (dy > 20 || finalH < 44) {
          closeSheet();
        }
        return;
      }

      if (snap === 'expanded') {
        if (finalH < (cH + dH) / 2 - 20) {
          setSnap('collapsed');
        } else if (dy > 45 || vy > 0.45) {
          setSnap('default');
        }
        return;
      }

      if (dy < -40 || vy < -0.45) {
        setSnap('expanded');
      } else if (finalH < 46 || (vy > 0.85 && dy > 130)) {
        closeSheet();
      } else if (dy > 38 || vy > 0.4) {
        setSnap('collapsed');
      }
    };

    window.addEventListener('pointermove', onWinPointerMove);
    window.addEventListener('pointerup', onWinPointerUp);
    window.addEventListener('pointercancel', onWinPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWinPointerMove);
      window.removeEventListener('pointerup', onWinPointerUp);
      window.removeEventListener('pointercancel', onWinPointerUp);
    };
  }, []);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, a')) return;
    if (isKeyboardOpen) return;

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startH: currentH,
      startTime: Date.now(),
      lastH: currentH,
    };
    setDragHeight(currentH);
  };

  return (
    <section
      aria-label="মোবাইল এডিটর সেটিংস"
      data-sheet-snap={snapState}
      style={{ height: `${currentH}px` }}
      className={`relative z-20 flex w-full max-w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-[#E5E7EB] bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)] md:hidden dark:border-[#1F2937] dark:bg-[#111827] ${
        dragHeight !== null ? 'transition-none' : 'transition-[height] duration-200 ease-out'
      }`}
    >
      {/* Draggable Handle & Header (~64px when collapsed) */}
      <div
        data-sheet-drag-handle="true"
        onPointerDown={handlePointerDown}
        style={{ touchAction: 'none' }}
        className={`flex shrink-0 select-none flex-col border-b border-[#E5E7EB] px-3 dark:border-[#1F2937] ${
          isKeyboardOpen ? 'py-1' : 'min-h-[64px] justify-center pb-1.5 pt-1'
        }`}
      >
        {!isKeyboardOpen && (
          <div className="mx-auto mb-1 flex h-3 w-16 items-center justify-center">
            <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex w-full items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-[#4F46E5] dark:text-indigo-400" />}
            <span className="truncate">{title}</span>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isKeyboardOpen ? (
              <button
                type="button"
                onClick={onKeyboardDone}
                className="inline-flex min-h-[44px] min-w-[68px] cursor-pointer items-center justify-center rounded-xl bg-[#4F46E5] px-3.5 text-[13px] font-semibold text-white active:bg-[#4338CA]"
              >
                সম্পন্ন
              </button>
            ) : (
              <>
                {headerRight}
                <button
                  type="button"
                  onClick={() => {
                    if (snapState === 'collapsed') onSnapChange('default');
                    else if (snapState === 'default') onSnapChange('expanded');
                    else onSnapChange('default');
                  }}
                  aria-label={snapState === 'expanded' ? 'প্যানেল ছোট করুন' : 'প্যানেল বড় করুন'}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#64748B] active:bg-slate-100 dark:text-slate-300 dark:active:bg-gray-800"
                >
                  {snapState === 'expanded' ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronUp className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="প্যানেল বন্ধ করুন"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#64748B] active:bg-slate-100 dark:text-slate-300 dark:active:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Single Scroll Container (Never Nested) */}
      {snapState !== 'collapsed' || isKeyboardOpen ? (
        <div
          data-sheet-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
};
