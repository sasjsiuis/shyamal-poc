import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toBengaliDigits } from '../../utils/projectStorage';

interface MobileFullscreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewImageUrl: string;
  aspectRatio: string;
}

export const MobileFullscreenPreviewModal: React.FC<MobileFullscreenPreviewModalProps> = ({
  isOpen,
  onClose,
  previewImageUrl,
  aspectRatio,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ active: boolean; dist: number; startZoom: number }>({
    active: false,
    dist: 0,
    startZoom: 1,
  });
  const panRef = useRef<{ active: boolean; sx: number; sy: number; ix: number; iy: number }>({
    active: false,
    sx: 0,
    sy: 0,
    ix: 0,
    iy: 0,
  });
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ফুলস্ক্রিন প্রিভিউ"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-sm md:hidden"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <span className="text-sm font-semibold text-slate-200">
          জুম: {toBengaliDigits(Math.round(zoom * 100))}%
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.35).toFixed(2))))}
            aria-label="ছোট করুন"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.35).toFixed(2))))}
            aria-label="বড় করুন"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              aria-label="জুম রিসেট"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="প্রিভিউ বন্ধ করুন"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/15 text-white active:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Interactive Pinch-Zoom Canvas Stage */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-3 touch-none"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = { active: true, dist: Math.hypot(dx, dy), startZoom: zoom };
            panRef.current.active = false;
            return;
          }
          if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapRef.current < 280) {
              if (zoom > 1.1) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              } else {
                setZoom(2);
              }
              lastTapRef.current = 0;
              return;
            }
            lastTapRef.current = now;
            if (zoom > 1) {
              panRef.current = {
                active: true,
                sx: e.touches[0].clientX,
                sy: e.touches[0].clientY,
                ix: pan.x,
                iy: pan.y,
              };
            }
          }
        }}
        onTouchMove={(e) => {
          if (pinchRef.current.active && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (pinchRef.current.dist > 10) {
              const next = Math.max(
                1,
                Math.min(3.5, (pinchRef.current.startZoom * dist) / pinchRef.current.dist)
              );
              setZoom(next);
              if (next <= 1.02) setPan({ x: 0, y: 0 });
            }
            return;
          }
          if (panRef.current.active && e.touches.length === 1) {
            const dx = e.touches[0].clientX - panRef.current.sx;
            const dy = e.touches[0].clientY - panRef.current.sy;
            setPan({
              x: Math.max(-320, Math.min(320, panRef.current.ix + dx)),
              y: Math.max(-320, Math.min(320, panRef.current.iy + dy)),
            });
          }
        }}
        onTouchEnd={() => {
          pinchRef.current.active = false;
          panRef.current.active = false;
        }}
      >
        {previewImageUrl && (
          <img
            src={previewImageUrl}
            alt="কার্ড ফুলস্ক্রিন প্রিভিউ"
            style={{
              aspectRatio,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            }}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-75"
            draggable={false}
          />
        )}
      </div>

      <p className="pb-[max(12px,env(safe-area-inset-bottom))] text-center text-xs text-slate-400">
        দুই আঙুলে পিঞ্চ বা ডাবল-ট্যাপ করে জুম করুন
      </p>
    </div>
  );
};
