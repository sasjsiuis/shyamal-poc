import React, { useEffect, useRef, useState } from 'react';
import { BUILTIN_FONTS } from '../data/templates';
import type { FontOption, HighlightRange, LogoSettings, TemplateConfig } from '../types/card';
import { renderNewsCard } from '../utils/canvasRenderer';

const overlayImageCache = new Map<string, HTMLImageElement | null>();
const overlayWaiters = new Map<string, Array<(img: HTMLImageElement | null) => void>>();

function loadCachedOverlay(url: string, cb: (img: HTMLImageElement | null) => void) {
  if (overlayImageCache.has(url)) {
    cb(overlayImageCache.get(url) ?? null);
    return;
  }
  const existing = overlayWaiters.get(url);
  if (existing) {
    existing.push(cb);
    return;
  }
  overlayWaiters.set(url, [cb]);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    overlayImageCache.set(url, img);
    const list = overlayWaiters.get(url) || [];
    overlayWaiters.delete(url);
    list.forEach((fn) => fn(img));
  };
  img.onerror = () => {
    overlayImageCache.set(url, null);
    const list = overlayWaiters.get(url) || [];
    overlayWaiters.delete(url);
    list.forEach((fn) => fn(null));
  };
  img.src = url;
}

const DEFAULT_FALLBACK_PHOTO = '/assets/aistudio/5329_21a6eb86.png';

function loadCachedPhoto(url: string, cb: (img: HTMLImageElement | null) => void) {
  loadCachedOverlay(url, cb);
}

let sharedOfficialLogo: HTMLImageElement | null = null;
let sharedOfficialLogoLoading = false;
const officialLogoWaiters: Array<(img: HTMLImageElement | null) => void> = [];

function getSharedOfficialLogo(cb: (img: HTMLImageElement | null) => void) {
  if (sharedOfficialLogo) {
    cb(sharedOfficialLogo);
    return;
  }
  officialLogoWaiters.push(cb);
  if (sharedOfficialLogoLoading) return;
  sharedOfficialLogoLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    sharedOfficialLogo = img;
    officialLogoWaiters.splice(0).forEach((fn) => fn(img));
  };
  img.onerror = () => {
    officialLogoWaiters.splice(0).forEach((fn) => fn(null));
  };
  img.src = '/assets/shyamal_sylhet_logo.png';
}

export const DEFAULT_THUMB_HEADLINE = 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ';
export const DEFAULT_THUMB_HIGHLIGHTS: HighlightRange[] = [
  { id: 'thumb-hl', start: 16, end: 27, text: 'আরও ৬ জনের' },
];
const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  dataUrl: null,
  scale: 100,
  x: 0,
  y: 0,
  hideDefaultBrand: false,
  badgeStyle: 'none',
  shape: 'original',
};

interface TemplatePreviewCanvasProps {
  template: TemplateConfig;
  photoImg?: HTMLImageElement | null;
  logoImg?: HTMLImageElement | null;
  officialLogoImg?: HTMLImageElement | null;
  logoSettings?: LogoSettings;
  headline?: string;
  highlights?: HighlightRange[];
  activeFont?: FontOption;
  size?: number;
  eager?: boolean;
  preserveAspect?: boolean;
}

export const TemplatePreviewCanvas: React.FC<TemplatePreviewCanvasProps> = ({
  template,
  photoImg,
  logoImg = null,
  officialLogoImg,
  logoSettings = DEFAULT_LOGO_SETTINGS,
  headline = DEFAULT_THUMB_HEADLINE,
  highlights = DEFAULT_THUMB_HIGHLIGHTS,
  activeFont = BUILTIN_FONTS[0],
  size = 400,
  eager = false,
  preserveAspect = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templatePhotoUrl = template.defaultPhotoSrc || DEFAULT_FALLBACK_PHOTO;
  const templateSecPhotoUrl = template.defaultQuote?.settings.secondaryPhotoSrc || '';

  const [inView, setInView] = useState(eager);
  const [rendered, setRendered] = useState(false);
  const [fallbackPhoto, setFallbackPhoto] = useState<HTMLImageElement | null>(
    () => overlayImageCache.get(templatePhotoUrl) ?? null
  );
  const [fallbackSecPhoto, setFallbackSecPhoto] = useState<HTMLImageElement | null>(
    () => (templateSecPhotoUrl ? overlayImageCache.get(templateSecPhotoUrl) ?? null : null)
  );
  const [fallbackOfficialLogo, setFallbackOfficialLogo] = useState<HTMLImageElement | null>(
    sharedOfficialLogo
  );
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(() =>
    template.overlayUrl ? overlayImageCache.get(template.overlayUrl) ?? null : null
  );

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: '220px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!inView) return;
    let active = true;
    if (!photoImg) {
      loadCachedPhoto(templatePhotoUrl, (img) => {
        if (active) setFallbackPhoto(img);
      });
    }
    if (templateSecPhotoUrl) {
      loadCachedPhoto(templateSecPhotoUrl, (img) => {
        if (active) setFallbackSecPhoto(img);
      });
    } else {
      setFallbackSecPhoto(null);
    }
    if (!officialLogoImg && !fallbackOfficialLogo) {
      getSharedOfficialLogo(setFallbackOfficialLogo);
    }
    return () => {
      active = false;
    };
  }, [inView, photoImg, templatePhotoUrl, templateSecPhotoUrl, officialLogoImg, fallbackOfficialLogo]);

  useEffect(() => {
    if (!inView) return;
    if (!template.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    let active = true;
    loadCachedOverlay(template.overlayUrl, (img) => {
      if (active) setOverlayImg(img);
    });
    return () => {
      active = false;
    };
  }, [inView, template.overlayUrl]);

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = size / template.canvasWidth;
    canvas.width = size;
    canvas.height = Math.round(template.canvasHeight * scale);

    ctx.save();
    ctx.scale(scale, scale);

    const hasCustomHeadline =
      headline !== DEFAULT_THUMB_HEADLINE && headline.trim().length > 0;
    const quoteDefaults = template.defaultQuote;
    const effectiveHeadline = hasCustomHeadline
      ? headline
      : quoteDefaults?.headline || (headline.trim() ? headline : DEFAULT_THUMB_HEADLINE);
    const effectiveHighlights = hasCustomHeadline
      ? highlights
      : quoteDefaults?.highlights ?? (headline.trim() ? highlights : DEFAULT_THUMB_HIGHLIGHTS);
    const resolvedFont =
      !hasCustomHeadline && quoteDefaults?.fontId
        ? BUILTIN_FONTS.find((f) => f.id === quoteDefaults.fontId) || activeFont
        : activeFont;

    renderNewsCard({
      ctx,
      template,
      overlayImg,
      photoImg: photoImg ?? fallbackPhoto,
      logoImg,
      officialLogoImg: officialLogoImg ?? fallbackOfficialLogo,
      headline: effectiveHeadline,
      highlights: effectiveHighlights,
      lineMode: 'auto',
      fontSizePercent: 100,
      lineGapPercent: 92,
      font: resolvedFont,
      textOffsetX: 0,
      textOffsetY: 0,
      textShadow: false,
      textColor: template.defaultTextColor,
      highlightColor: template.defaultHighlightColor,
      photoZoom: 1,
      photoPanX: 0,
      photoPanY: 0,
      logoSettings,
      secondaryPhotoImg: fallbackSecPhoto,
      isExport: true,
    });

    ctx.restore();
    setRendered(true);
  }, [
    inView,
    size,
    template,
    overlayImg,
    photoImg,
    fallbackPhoto,
    fallbackSecPhoto,
    logoImg,
    officialLogoImg,
    fallbackOfficialLogo,
    logoSettings,
    headline,
    highlights,
    activeFont,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-slate-100 dark:bg-gray-800 ${
        preserveAspect ? '' : 'aspect-square'
      }`}
      style={
        preserveAspect
          ? { aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }
          : undefined
      }
    >
      {(!inView || !rendered) && (
        <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-gray-800" />
      )}
      {inView && (
        <canvas
          ref={canvasRef}
          className={`block h-full w-full object-cover transition-opacity duration-200 ${
            rendered ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
