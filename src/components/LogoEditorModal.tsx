import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Crop,
  Eraser,
  Maximize2,
  MousePointerSquareDashed,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { LogoShape } from '../types/card';
import { RangeSlider } from './RangeSlider';

interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type EditorToolMode = 'crop' | 'erase-rect' | 'erase-brush';
type CropAspectPreset = 'free' | '1:1' | '16:9' | '4:3';

const LOGO_SHAPE_OPTIONS: Array<{ id: LogoShape; label: string }> = [
  { id: 'original', label: 'আসল' },
  { id: 'square', label: 'চার কোণা' },
  { id: 'rounded', label: 'রাউন্ডেড' },
  { id: 'circle', label: 'গোল' },
  { id: 'pill', label: 'পিল' },
];

const SIZE_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'ছোট (৬৫%)', value: 65 },
  { label: 'স্বাভাবিক (১০০%)', value: 100 },
  { label: 'মাঝারি (১৩০%)', value: 130 },
  { label: 'বড় (১৬৫%)', value: 165 },
];

interface LogoEditorModalProps {
  isOpen: boolean;
  sourceDataUrl: string;
  initialShape: LogoShape;
  initialScale: number;
  onCancel: () => void;
  onApply: (result: { dataUrl: string; shape: LogoShape; scale: number }) => void;
}

export const LogoEditorModal: React.FC<LogoEditorModalProps> = ({
  isOpen,
  sourceDataUrl,
  initialShape,
  initialScale,
  onCancel,
  onApply,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraseHistoryRef = useRef<ImageData[]>([]);

  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [toolMode, setToolMode] = useState<EditorToolMode>('crop');
  const [shape, setShape] = useState<LogoShape>(initialShape);
  const [scale, setScale] = useState<number>(initialScale);
  const [cropRect, setCropRect] = useState<NormRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>('free');
  const [brushSize, setBrushSize] = useState<number>(28);
  const [eraseUndoCount, setEraseUndoCount] = useState<number>(0);
  const [pendingEraseRect, setPendingEraseRect] = useState<NormRect | null>(null);
  const [workTick, setWorkTick] = useState<number>(0);

  const interactionRef = useRef<{
    type:
      | 'none'
      | 'crop-move'
      | 'crop-nw'
      | 'crop-ne'
      | 'crop-sw'
      | 'crop-se'
      | 'erase-rect'
      | 'erase-brush';
    startX: number;
    startY: number;
    startCrop: NormRect;
  }>({
    type: 'none',
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, w: 1, h: 1 },
  });

  // Load sourceDataUrl into offscreen working canvas
  useEffect(() => {
    if (!isOpen || !sourceDataUrl) return;
    setShape(initialShape);
    setScale(initialScale);
    setCropRect({ x: 0, y: 0, w: 1, h: 1 });
    setAspectPreset('free');
    setToolMode('crop');
    setPendingEraseRect(null);
    eraseHistoryRef.current = [];
    setEraseUndoCount(0);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = Math.max(1, img.naturalWidth);
      const natH = Math.max(1, img.naturalHeight);
      // Cap working canvas at 1400px max side for snappy editing while staying crisp
      const scaleDown = Math.min(1, 1400 / Math.max(natW, natH));
      const cw = Math.max(1, Math.round(natW * scaleDown));
      const ch = Math.max(1, Math.round(natH * scaleDown));

      const off = document.createElement('canvas');
      off.width = cw;
      off.height = ch;
      const octx = off.getContext('2d');
      if (octx) {
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(img, 0, 0, cw, ch);
      }
      workCanvasRef.current = off;
      setImgSize({ w: cw, h: ch });
      setWorkTick((t) => t + 1);
    };
    img.src = sourceDataUrl;
  }, [isOpen, sourceDataUrl, initialShape, initialScale]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  // Render preview canvas with checkerboard, shape clip preview, crop marks, or erase rect
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    const work = workCanvasRef.current;
    if (!canvas || !work || imgSize.w === 0 || imgSize.h === 0) return;

    const maxPreview = 480;
    const fit = Math.min(maxPreview / imgSize.w, maxPreview / imgSize.h);
    const dw = Math.max(120, Math.round(imgSize.w * fit));
    const dh = Math.max(120, Math.round(imgSize.h * fit));
    if (canvas.width !== dw) canvas.width = dw;
    if (canvas.height !== dh) canvas.height = dh;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dw, dh);

    // Checkerboard background
    const tile = 14;
    for (let y = 0; y < dh; y += tile) {
      for (let x = 0; x < dw; x += tile) {
        const darkTile = ((x / tile) + (y / tile)) % 2 === 1;
        ctx.fillStyle = darkTile ? '#e2e8f0' : '#f8fafc';
        ctx.fillRect(x, y, tile, tile);
      }
    }

    // Draw working logo image
    ctx.drawImage(work, 0, 0, dw, dh);

    const cx = cropRect.x * dw;
    const cy = cropRect.y * dh;
    const cw = cropRect.w * dw;
    const ch = cropRect.h * dh;

    if (toolMode === 'crop') {
      // Dim outside crop area
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.rect(0, 0, dw, dh);
      ctx.rect(cx, cy, cw, ch);
      ctx.fill('evenodd');
      ctx.restore();

      // Shape guide inside crop box
      if (shape === 'circle') {
        const rad = Math.min(cw, ch) / 2;
        ctx.save();
        ctx.strokeStyle = '#faab3f';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(cx + cw / 2, cy + ch / 2, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (shape === 'rounded' || shape === 'pill') {
        const r =
          shape === 'pill'
            ? Math.min(cw, ch) / 2
            : Math.round(Math.min(cw, ch) * 0.22);
        ctx.save();
        ctx.strokeStyle = '#faab3f';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, r);
        ctx.stroke();
        ctx.restore();
      }

      // Crisp crop border & corner L-handles (ক্রপ চিহ্ন)
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Rule of thirds subtle guides
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + cw / 3, cy);
      ctx.lineTo(cx + cw / 3, cy + ch);
      ctx.moveTo(cx + (cw * 2) / 3, cy);
      ctx.lineTo(cx + (cw * 2) / 3, cy + ch);
      ctx.moveTo(cx, cy + ch / 3);
      ctx.lineTo(cx + cw, cy + ch / 3);
      ctx.moveTo(cx, cy + (ch * 2) / 3);
      ctx.lineTo(cx + cw, cy + (ch * 2) / 3);
      ctx.stroke();

      // Corner handles
      const handleLen = Math.min(18, Math.max(10, Math.min(cw, ch) * 0.22));
      ctx.strokeStyle = '#faab3f';
      ctx.lineWidth = 4;
      ctx.lineCap = 'square';
      const corners: Array<[number, number, number, number]> = [
        [cx, cy, 1, 1],
        [cx + cw, cy, -1, 1],
        [cx, cy + ch, 1, -1],
        [cx + cw, cy + ch, -1, -1],
      ];
      for (const [hx, hy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(hx + sx * handleLen, hy);
        ctx.lineTo(hx, hy);
        ctx.lineTo(hx, hy + sy * handleLen);
        ctx.stroke();
      }
      ctx.restore();
    } else if (toolMode === 'erase-rect' && pendingEraseRect) {
      const rx = pendingEraseRect.x * dw;
      const ry = pendingEraseRect.y * dh;
      const rw = pendingEraseRect.w * dw;
      const rh = pendingEraseRect.h * dh;
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }, [imgSize, cropRect, shape, toolMode, pendingEraseRect, workTick]);

  const pushEraseSnapshot = useCallback(() => {
    const work = workCanvasRef.current;
    if (!work) return;
    const wctx = work.getContext('2d');
    if (!wctx) return;
    const snap = wctx.getImageData(0, 0, work.width, work.height);
    eraseHistoryRef.current = [...eraseHistoryRef.current.slice(-14), snap];
    setEraseUndoCount(eraseHistoryRef.current.length);
  }, []);

  const handleUndoErase = () => {
    const work = workCanvasRef.current;
    if (!work || eraseHistoryRef.current.length === 0) return;
    const wctx = work.getContext('2d');
    if (!wctx) return;
    const last = eraseHistoryRef.current[eraseHistoryRef.current.length - 1];
    eraseHistoryRef.current = eraseHistoryRef.current.slice(0, -1);
    wctx.putImageData(last, 0, 0);
    setEraseUndoCount(eraseHistoryRef.current.length);
    setWorkTick((t) => t + 1);
  };

  const handleResetImage = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const work = workCanvasRef.current;
      if (!work) return;
      const wctx = work.getContext('2d');
      if (!wctx) return;
      wctx.clearRect(0, 0, work.width, work.height);
      wctx.drawImage(img, 0, 0, work.width, work.height);
      eraseHistoryRef.current = [];
      setEraseUndoCount(0);
      setPendingEraseRect(null);
      setCropRect({ x: 0, y: 0, w: 1, h: 1 });
      setAspectPreset('free');
      setWorkTick((t) => t + 1);
    };
    img.src = sourceDataUrl;
  };

  const applyPendingEraseRect = (rectToRemove: NormRect) => {
    const work = workCanvasRef.current;
    if (!work) return;
    if (rectToRemove.w < 0.015 || rectToRemove.h < 0.015) return;
    pushEraseSnapshot();
    const wctx = work.getContext('2d');
    if (!wctx) return;
    wctx.clearRect(
      rectToRemove.x * work.width,
      rectToRemove.y * work.height,
      rectToRemove.w * work.width,
      rectToRemove.h * work.height
    );
    setPendingEraseRect(null);
    setWorkTick((t) => t + 1);
  };

  const applyAspectPreset = (preset: CropAspectPreset) => {
    setAspectPreset(preset);
    if (preset === 'free') {
      return;
    }
    if (!imgSize.w || !imgSize.h) return;

    const targetRatio = preset === '1:1' ? 1 : preset === '16:9' ? 16 / 9 : 4 / 3;
    const imgRatio = imgSize.w / imgSize.h;

    let normW = 1;
    let normH = 1;
    if (imgRatio > targetRatio) {
      normH = 0.92;
      normW = (normH * imgSize.h * targetRatio) / imgSize.w;
    } else {
      normW = 0.92;
      normH = (normW * imgSize.w) / targetRatio / imgSize.h;
    }
    normW = Math.min(1, Math.max(0.15, normW));
    normH = Math.min(1, Math.max(0.15, normH));
    setCropRect({
      x: (1 - normW) / 2,
      y: (1 - normH) / 2,
      w: normW,
      h: normH,
    });
  };

  const getNormCoords = (clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { nx: 0, ny: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
      ny: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const eraseAtNormPoint = (nx: number, ny: number) => {
    const work = workCanvasRef.current;
    if (!work) return;
    const wctx = work.getContext('2d');
    if (!wctx) return;
    const r = (brushSize / 480) * Math.max(work.width, work.height) * 0.5;
    wctx.save();
    wctx.globalCompositeOperation = 'destination-out';
    wctx.beginPath();
    wctx.arc(nx * work.width, ny * work.height, Math.max(6, r), 0, Math.PI * 2);
    wctx.fill();
    wctx.restore();
    setWorkTick((t) => t + 1);
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    const { nx, ny } = getNormCoords(clientX, clientY);

    if (toolMode === 'erase-rect') {
      interactionRef.current = {
        type: 'erase-rect',
        startX: nx,
        startY: ny,
        startCrop: cropRect,
      };
      setPendingEraseRect({ x: nx, y: ny, w: 0, h: 0 });
      return;
    }

    if (toolMode === 'erase-brush') {
      pushEraseSnapshot();
      interactionRef.current = {
        type: 'erase-brush',
        startX: nx,
        startY: ny,
        startCrop: cropRect,
      };
      eraseAtNormPoint(nx, ny);
      return;
    }

    // Crop mode handle hit testing
    const tol = 0.085;
    const { x, y, w, h } = cropRect;
    let type: typeof interactionRef.current.type = 'none';
    if (Math.abs(nx - x) < tol && Math.abs(ny - y) < tol) type = 'crop-nw';
    else if (Math.abs(nx - (x + w)) < tol && Math.abs(ny - y) < tol) type = 'crop-ne';
    else if (Math.abs(nx - x) < tol && Math.abs(ny - (y + h)) < tol) type = 'crop-sw';
    else if (Math.abs(nx - (x + w)) < tol && Math.abs(ny - (y + h)) < tol) type = 'crop-se';
    else if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) type = 'crop-move';
    else {
      // Clicking outside starts a fresh resize from se corner or moves
      type = 'crop-move';
    }

    interactionRef.current = {
      type,
      startX: nx,
      startY: ny,
      startCrop: { ...cropRect },
    };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const st = interactionRef.current;
    if (st.type === 'none') return;
    const { nx, ny } = getNormCoords(clientX, clientY);

    if (st.type === 'erase-rect') {
      const rx = Math.min(st.startX, nx);
      const ry = Math.min(st.startY, ny);
      const rw = Math.abs(nx - st.startX);
      const rh = Math.abs(ny - st.startY);
      setPendingEraseRect({ x: rx, y: ry, w: rw, h: rh });
      return;
    }

    if (st.type === 'erase-brush') {
      eraseAtNormPoint(nx, ny);
      return;
    }

    const dx = nx - st.startX;
    const dy = ny - st.startY;
    const sc = st.startCrop;
    const minSize = 0.1;

    if (st.type === 'crop-move') {
      const nextX = Math.max(0, Math.min(1 - sc.w, sc.x + dx));
      const nextY = Math.max(0, Math.min(1 - sc.h, sc.y + dy));
      setCropRect({ ...sc, x: nextX, y: nextY });
      return;
    }

    let left = sc.x;
    let top = sc.y;
    let right = sc.x + sc.w;
    let bottom = sc.y + sc.h;

    if (st.type === 'crop-nw') {
      left = Math.max(0, Math.min(right - minSize, sc.x + dx));
      top = Math.max(0, Math.min(bottom - minSize, sc.y + dy));
    } else if (st.type === 'crop-ne') {
      right = Math.min(1, Math.max(left + minSize, sc.x + sc.w + dx));
      top = Math.max(0, Math.min(bottom - minSize, sc.y + dy));
    } else if (st.type === 'crop-sw') {
      left = Math.max(0, Math.min(right - minSize, sc.x + dx));
      bottom = Math.min(1, Math.max(top + minSize, sc.y + sc.h + dy));
    } else if (st.type === 'crop-se') {
      right = Math.min(1, Math.max(left + minSize, sc.x + sc.w + dx));
      bottom = Math.min(1, Math.max(top + minSize, sc.y + sc.h + dy));
    }

    setCropRect({
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
    });
  };

  const handlePointerUp = () => {
    const st = interactionRef.current;
    if (st.type === 'erase-rect' && pendingEraseRect) {
      if (pendingEraseRect.w > 0.025 && pendingEraseRect.h > 0.025) {
        applyPendingEraseRect(pendingEraseRect);
      } else {
        setPendingEraseRect(null);
      }
    }
    interactionRef.current.type = 'none';
  };

  const handleApplyFinal = () => {
    const work = workCanvasRef.current;
    if (!work) return;

    const sx = Math.max(0, Math.round(cropRect.x * work.width));
    const sy = Math.max(0, Math.round(cropRect.y * work.height));
    const sw = Math.max(8, Math.min(work.width - sx, Math.round(cropRect.w * work.width)));
    const sh = Math.max(8, Math.min(work.height - sy, Math.round(cropRect.h * work.height)));

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);

    onApply({
      dataUrl: out.toDataURL('image/png'),
      shape,
      scale,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-editor-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-2xl sm:rounded-xl dark:border-[#1F2937] dark:bg-[#111827]"
      >
        {/* Mobile grab bar */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3.5 sm:px-5 dark:border-[#1F2937]">
          <div className="min-w-0">
            <h3
              id="logo-editor-title"
              className="truncate text-base font-bold text-[#0F172A] sm:text-lg dark:text-slate-100"
            >
              কাস্টম লোগো এডিট, ক্রপ ও শেপ
            </h3>
            <p className="truncate text-xs text-[#64748B] dark:text-slate-400">
              ক্রপ করুন, অংশ মুছে ফেলুন এবং শেপ ও সাইজ দিয়ে ফটোকার্ডে যোগ করুন
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="বন্ধ করুন"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="grid grid-cols-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-[1fr_290px]">
          {/* Left: Interactive Canvas Workspace */}
          <div className="min-w-0 space-y-3">
            {/* Tool Mode Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              <button
                type="button"
                onClick={() => setToolMode('crop')}
                className={`inline-flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  toolMode === 'crop'
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-300'
                }`}
              >
                <Crop className="h-3.5 w-3.5 shrink-0" />
                <span>ক্রপ চিহ্ন</span>
              </button>
              <button
                type="button"
                onClick={() => setToolMode('erase-rect')}
                className={`inline-flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  toolMode === 'erase-rect'
                    ? 'bg-[#EF4444] text-white'
                    : 'text-[#64748B] hover:text-[#EF4444] dark:text-slate-300'
                }`}
              >
                <MousePointerSquareDashed className="h-3.5 w-3.5 shrink-0" />
                <span>সিলেক্ট করে রিমুভ</span>
              </button>
              <button
                type="button"
                onClick={() => setToolMode('erase-brush')}
                className={`inline-flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  toolMode === 'erase-brush'
                    ? 'bg-[#EF4444] text-white'
                    : 'text-[#64748B] hover:text-[#EF4444] dark:text-slate-300'
                }`}
              >
                <Eraser className="h-3.5 w-3.5 shrink-0" />
                <span>ব্রাশ ইরেজ</span>
              </button>
            </div>

            {/* Canvas Frame */}
            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3 dark:border-[#1F2937] dark:bg-[#0B0F19]">
              <canvas
                ref={displayCanvasRef}
                onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={(e) => {
                  if (e.touches.length === 1) {
                    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 1) {
                    e.preventDefault();
                    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchEnd={handlePointerUp}
                className={`block max-h-[320px] max-w-full select-none rounded-lg touch-none shadow-xs ${
                  toolMode === 'crop' ? 'cursor-move' : 'cursor-crosshair'
                }`}
              />
            </div>

            {/* Contextual Tool Sub-controls */}
            {toolMode === 'crop' ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'free', label: 'ফ্রি' },
                      { id: '1:1', label: '১:১' },
                      { id: '16:9', label: '১৬:৯' },
                      { id: '4:3', label: '৪:৩' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyAspectPreset(p.id)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                        aspectPreset === p.id
                          ? 'bg-[#4F46E5] text-white'
                          : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAspectPreset('free');
                    setCropRect({ x: 0, y: 0, w: 1, h: 1 });
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline dark:text-indigo-400"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>সম্পূর্ণ ছবি</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs dark:border-red-900/60 dark:bg-red-950/30">
                <span className="font-medium text-red-800 dark:text-red-200">
                  {toolMode === 'erase-rect'
                    ? 'যে অংশ মুছতে চান তা টেনে সিলেক্ট করলেই রিমুভ হবে'
                    : 'লোগোর ওপর আঙুল বা মাউস বুলিয়ে অবাঞ্ছিত অংশ মুছুন'}
                </span>
                <div className="flex items-center gap-2">
                  {toolMode === 'erase-brush' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#0F172A] dark:text-slate-300">
                        ব্রাশ:
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={70}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-20 accent-[#EF4444]"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleUndoErase}
                    disabled={eraseUndoCount === 0}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 font-semibold text-[#0F172A] disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200"
                  >
                    <Undo2 className="h-3 w-3" />
                    <span>আনডু</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetImage}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 font-semibold text-[#EF4444] dark:border-red-800 dark:bg-[#111827] dark:text-red-300"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>রিসেট</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Shape & Size Controls */}
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-4">
              {/* Shape Selection */}
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                <p className="mb-2 text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  লোগোর শেপ নির্বাচন করুন
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {LOGO_SHAPE_OPTIONS.map((opt) => {
                    const active = shape === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setShape(opt.id)}
                        className={`min-h-[38px] cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#4F46E5] text-white'
                            : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size Presets + Slider */}
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5 dark:border-[#1F2937] dark:bg-[#0B0F19]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#0F172A] tabular-nums dark:text-slate-200">
                    ডিফল্ট সাইজ ({scale}%)
                  </p>
                  <button
                    type="button"
                    onClick={() => setScale(100)}
                    aria-label="সাইজ রিসেট"
                    className="cursor-pointer rounded p-1 text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-gray-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setScale(preset.value)}
                      className={`min-h-[36px] cursor-pointer rounded-lg px-2 py-1 text-[11.5px] font-semibold transition-colors ${
                        scale === preset.value
                          ? 'bg-[#4F46E5] text-white'
                          : 'border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <RangeSlider
                  min={25}
                  max={200}
                  value={scale}
                  onChange={setScale}
                  ariaLabel="লোগোর সাইজ"
                />
              </div>

              <p className="text-[12px] leading-relaxed text-[#64748B] dark:text-slate-400">
                ফটোকার্ডে অ্যাড করার পর লোগোটি আঙুল বা মাউস দিয়ে টেনে কার্ডের যেকোনো জায়গায় বসাতে পারবেন।
              </p>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#1F2937]">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>বাতিল</span>
              </button>
              <button
                type="button"
                onClick={handleApplyFinal}
                className="inline-flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#4338CA]"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>ফটোকার্ডে অ্যাড করুন</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
