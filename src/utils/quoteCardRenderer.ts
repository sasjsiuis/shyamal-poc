import type {
  BrandLogoSlot,
  FontOption,
  ProceduralStyleType,
  QuoteCardSettings,
  QuoteMarkStyle,
  QuotePhotoStyle,
  RectBox,
  TemplateConfig,
} from '../types/card';

export const QUOTE_STYLE_TYPES = new Set<ProceduralStyleType>([
  'quote-dramatic-gradient',
  'quote-arc-halftone',
  'quote-dark-glass-rating',
  'quote-violet-lime-card',
  'quote-wave-testimonial',
  'quote-neon-duotone',
  'quote-book-crimson-mark',
  'quote-press-halftone',
  'quote-qa-split',
  'quote-executive-box',
  'quote-chamfer-political',
  'quote-corporate-overlap',
  'quote-warm-bubble',
]);

export function isQuoteStyleType(styleType: ProceduralStyleType): boolean {
  return QUOTE_STYLE_TYPES.has(styleType);
}

export function getDefaultQuoteSettings(
  template: TemplateConfig,
  override?: Partial<QuoteCardSettings> | null
): QuoteCardSettings {
  const tplDefaults = template.defaultQuote?.settings || {};
  const pal = template.palette;
  return {
    authorName: tplDefaults.authorName ?? 'বক্তার নাম',
    authorTitle: tplDefaults.authorTitle ?? 'পদবি ও প্রতিষ্ঠান',
    sourceText: tplDefaults.sourceText ?? '',
    badgeText: tplDefaults.badgeText ?? (template.kickerText || ''),
    ratingText: tplDefaults.ratingText ?? '',
    questionText: tplDefaults.questionText ?? '',
    questionAuthor: tplDefaults.questionAuthor ?? '',
    questionMeta: tplDefaults.questionMeta ?? '',
    secondaryPhotoSrc: tplDefaults.secondaryPhotoSrc ?? '',
    quoteMarkStyle: tplDefaults.quoteMarkStyle ?? 'classic',
    quoteMarkColor: tplDefaults.quoteMarkColor ?? (pal?.accent || '#4f46e5'),
    quoteMarkSizePercent: tplDefaults.quoteMarkSizePercent ?? 100,
    showDecorShapes: tplDefaults.showDecorShapes ?? true,
    showQuoteMarks: tplDefaults.showQuoteMarks ?? true,
    showSocialIcons: tplDefaults.showSocialIcons ?? false,
    photoStyle: tplDefaults.photoStyle ?? 'original',
    photoRimColor: tplDefaults.photoRimColor ?? (pal?.accent || '#ffffff'),
    cardSurfaceColor: tplDefaults.cardSurfaceColor ?? (pal?.bgSecondary || '#ffffff'),
    authorNameColor: tplDefaults.authorNameColor ?? template.defaultTextColor,
    authorTitleColor: tplDefaults.authorTitleColor ?? (pal?.footerText || '#cbd5e1'),
    ...(override || {}),
  };
}

function drawVarRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: [number, number, number, number]
): void {
  const [rTL, rTR, rBR, rBL] = radii.map((r) => Math.max(0, Math.min(r, w / 2, h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  ctx.lineTo(x + w, y + h - rBR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  ctx.lineTo(x + rBL, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  ctx.lineTo(x, y + rTL);
  ctx.quadraticCurveTo(x, y, x + rTL, y);
  ctx.closePath();
}

function drawChamferBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  chamferTL: number,
  chamferTR: number,
  chamferBR: number,
  chamferBL: number
): void {
  ctx.beginPath();
  if (chamferTR > 0) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - chamferTR, y);
    ctx.lineTo(x + w, y + chamferTR);
  } else {
    ctx.moveTo(x + chamferTL + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  }

  if (chamferBR > 0) {
    ctx.lineTo(x + w, y + h - chamferBR);
    ctx.lineTo(x + w - chamferBR, y + h);
  } else {
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  }

  if (chamferBL > 0) {
    ctx.lineTo(x + chamferBL, y + h);
    ctx.lineTo(x, y + h - chamferBL);
  } else {
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  }

  if (chamferTL > 0) {
    ctx.lineTo(x, y + chamferTL);
    ctx.lineTo(x + chamferTL, y);
  } else {
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
}

function drawWrappedTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

interface ImageAlphaBounds {
  hasAlpha: boolean;
  minXRatio: number;
  minYRatio: number;
  maxXRatio: number;
  maxYRatio: number;
}

const alphaBoundsCache = new WeakMap<HTMLImageElement, ImageAlphaBounds>();

function inspectImageAlphaBounds(img: HTMLImageElement): ImageAlphaBounds {
  const cached = alphaBoundsCache.get(img);
  if (cached) return cached;

  const fallback: ImageAlphaBounds = {
    hasAlpha: false,
    minXRatio: 0,
    minYRatio: 0,
    maxXRatio: 1,
    maxYRatio: 1,
  };

  if (typeof document === 'undefined' || !img.naturalWidth || !img.naturalHeight) {
    return fallback;
  }

  try {
    const sw = 96;
    const sh = Math.max(32, Math.min(160, Math.round((img.naturalHeight / img.naturalWidth) * sw)));
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const sctx = c.getContext('2d', { willReadFrequently: true });
    if (!sctx) return fallback;

    sctx.clearRect(0, 0, sw, sh);
    sctx.drawImage(img, 0, 0, sw, sh);
    const data = sctx.getImageData(0, 0, sw, sh).data;

    let minX = sw;
    let minY = sh;
    let maxX = 0;
    let maxY = 0;
    let transparentPixels = 0;
    const total = sw * sh;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const alpha = data[(y * sw + x) * 4 + 3];
        if (alpha < 210) {
          transparentPixels++;
        }
        if (alpha >= 25) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const hasAlpha = transparentPixels / total > 0.06 && maxX > minX && maxY > minY;
    const result: ImageAlphaBounds = hasAlpha
      ? {
          hasAlpha: true,
          minXRatio: Math.max(0, minX / sw),
          minYRatio: Math.max(0, minY / sh),
          maxXRatio: Math.min(1, (maxX + 1) / sw),
          maxYRatio: Math.min(1, (maxY + 1) / sh),
        }
      : fallback;

    alphaBoundsCache.set(img, result);
    return result;
  } catch {
    alphaBoundsCache.set(img, fallback);
    return fallback;
  }
}

function drawCoverPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: RectBox,
  zoom: number,
  panX: number,
  panY: number,
  photoStyle: QuotePhotoStyle,
  portraitBiasY = 0.5,
  extraZoom = 1
): void {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  if (!imgW || !imgH) return;

  const baseScale = Math.max(box.width / imgW, box.height / imgH);
  const panActiveBoost =
    zoom <= 1.02 && (Math.abs(panX) > 1 || Math.abs(panY) > 1) ? 1.12 : 1.0;
  const finalScale = baseScale * Math.max(0.5, zoom) * extraZoom * panActiveBoost;

  const drawW = imgW * finalScale;
  const drawH = imgH * finalScale;
  const maxShiftX = Math.max((drawW - box.width) / 2, box.width * 0.25);
  const maxShiftY = Math.max((drawH - box.height) / 2, box.height * 0.25);
  const offsetX = (panX / 100) * maxShiftX;
  const offsetY = (panY / 100) * maxShiftY;
  const drawX = box.x + (box.width - drawW) / 2 + offsetX;
  const baseTopY = box.y + box.height * 0.5 - drawH * portraitBiasY;
  const minDrawY = box.y + box.height - drawH;
  const clampedTopY = Math.min(box.y, Math.max(minDrawY, baseTopY));
  const drawY = clampedTopY + offsetY;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (photoStyle === 'grayscale' || photoStyle === 'duotone') {
    ctx.filter = 'grayscale(100%) contrast(1.08)';
  } else if (photoStyle === 'rim-glow') {
    ctx.filter = 'contrast(1.04) saturate(1.06)';
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawCutoutPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  alphaInfo: ImageAlphaBounds,
  box: RectBox,
  zoom: number,
  panX: number,
  panY: number,
  photoStyle: QuotePhotoStyle,
  rimColor: string
): void {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  if (!imgW || !imgH) return;

  const visW = Math.max(10, imgW * (alphaInfo.maxXRatio - alphaInfo.minXRatio));
  const visH = Math.max(10, imgH * (alphaInfo.maxYRatio - alphaInfo.minYRatio));
  const visCenterXRatio = (alphaInfo.minXRatio + alphaInfo.maxXRatio) / 2;

  // Scale silhouette to fill portrait height cleanly without cropping hair or leaving excessive gap
  const fitByWidth = (box.width * 0.96) / visW;
  const fitByHeight = (box.height * 0.94) / visH;
  const baseScale = Math.max(fitByHeight * 0.9, Math.min(fitByWidth * 1.06, fitByHeight * 1.02));
  const finalScale = baseScale * Math.max(0.5, zoom);

  const drawW = imgW * finalScale;
  const drawH = imgH * finalScale;
  const maxShiftX = Math.max(box.width * 0.28, Math.abs(drawW - box.width) / 2);
  const maxShiftY = Math.max(box.height * 0.25, Math.abs(drawH - box.height) / 2);
  const offsetX = (panX / 100) * maxShiftX;
  const offsetY = (panY / 100) * maxShiftY;

  const drawX = box.x + box.width / 2 - visCenterXRatio * drawW + offsetX;
  // Anchor visible bottom flush to box bottom so cutout stands naturally
  const drawY = box.y + box.height - alphaInfo.maxYRatio * drawH + offsetY;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (photoStyle === 'grayscale' || photoStyle === 'duotone') {
    ctx.filter = 'grayscale(100%) contrast(1.08)';
  } else if (photoStyle === 'rim-glow') {
    ctx.filter = 'contrast(1.04) saturate(1.06)';
  }

  if (photoStyle === 'rim-glow') {
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = Math.max(22, box.width * 0.045);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  if (photoStyle === 'duotone') {
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = rimColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
  ctx.restore();
}

function drawPortraitShape(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  box: RectBox,
  zoom: number,
  panX: number,
  panY: number,
  photoStyle: QuotePhotoStyle,
  rimColor: string,
  opts: {
    shape: 'rect' | 'circle' | 'rounded' | 'soft-blend' | 'chamfer';
    radius?: number;
    borderWidth?: number;
    borderColor?: string;
    fadeColor?: string;
    photoDeleted?: boolean;
  }
): void {
  if (opts.photoDeleted || !img || !img.naturalWidth) {
    return;
  }

  const alphaInfo = inspectImageAlphaBounds(img);
  const isCutoutImage = alphaInfo.hasAlpha && opts.shape !== 'circle';

  ctx.save();

  if (opts.shape === 'circle') {
    if (photoStyle === 'rim-glow' || (opts.borderWidth && opts.borderWidth > 0)) {
      ctx.save();
      if (photoStyle === 'rim-glow') {
        ctx.shadowColor = rimColor;
        ctx.shadowBlur = Math.max(18, box.width * 0.06);
      }
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const rad = Math.min(box.width, box.height) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = opts.borderColor || rimColor;
      ctx.fill();
      ctx.restore();
    }

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const rad = Math.min(box.width, box.height) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.clip();
    drawCoverPhoto(ctx, img, box, zoom, panX, panY, photoStyle, 0.42, 1.24);
    if (photoStyle === 'duotone') {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = rimColor;
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    ctx.restore();

    if (opts.borderWidth && opts.borderWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.lineWidth = opts.borderWidth;
      ctx.strokeStyle = opts.borderColor || rimColor;
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (isCutoutImage) {
    // Allow generous horizontal breath while clipping bottom cleanly inside the card edge
    ctx.beginPath();
    ctx.rect(box.x - 40, Math.max(0, box.y - 40), box.width + 80, box.height + 40);
    ctx.clip();

    drawCutoutPhoto(ctx, img, alphaInfo, box, zoom, panX, panY, photoStyle, rimColor);

    if (opts.shape === 'soft-blend' && opts.fadeColor) {
      const botGrad = ctx.createLinearGradient(0, box.y + box.height * 0.78, 0, box.y + box.height);
      botGrad.addColorStop(0, 'rgba(0,0,0,0)');
      botGrad.addColorStop(1, `${opts.fadeColor}f2`);
      ctx.fillStyle = botGrad;
      ctx.fillRect(box.x - 40, box.y + box.height * 0.78, box.width + 80, box.height * 0.22 + 2);
    }

    ctx.restore();
    return;
  }

  if (photoStyle === 'rim-glow' || (opts.borderWidth && opts.borderWidth > 0)) {
    ctx.save();
    if (photoStyle === 'rim-glow') {
      ctx.shadowColor = rimColor;
      ctx.shadowBlur = Math.max(18, box.width * 0.05);
    }
    if (opts.shape === 'rounded') {
      drawVarRoundedRect(ctx, box.x, box.y, box.width, box.height, [
        opts.radius ?? 24,
        opts.radius ?? 24,
        opts.radius ?? 24,
        opts.radius ?? 24,
      ]);
      ctx.fillStyle = rimColor;
      ctx.fill();
    }
    ctx.restore();
  }

  if (opts.shape === 'rounded') {
    const r = opts.radius ?? 28;
    drawVarRoundedRect(ctx, box.x, box.y, box.width, box.height, [r, r, r, r]);
    ctx.clip();
  } else if (opts.shape === 'chamfer') {
    drawChamferBlock(ctx, box.x, box.y, box.width, box.height, 36, 0, 0, 0, 120);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
  }

  drawCoverPhoto(ctx, img, box, zoom, panX, panY, photoStyle, 0.43, 1.04);

  if (photoStyle === 'duotone') {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = rimColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.restore();
  }

  if (opts.shape === 'soft-blend' && opts.fadeColor) {
    const leftGrad = ctx.createLinearGradient(box.x, 0, box.x + box.width * 0.48, 0);
    leftGrad.addColorStop(0, opts.fadeColor);
    leftGrad.addColorStop(0.45, `${opts.fadeColor}cc`);
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(box.x, box.y, box.width, box.height);

    const botGrad = ctx.createLinearGradient(0, box.y + box.height * 0.65, 0, box.y + box.height);
    botGrad.addColorStop(0, 'rgba(0,0,0,0)');
    botGrad.addColorStop(1, `${opts.fadeColor}ee`);
    ctx.fillStyle = botGrad;
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }

  ctx.restore();

  if (opts.borderWidth && opts.borderWidth > 0 && opts.shape === 'rounded') {
    const r = opts.radius ?? 28;
    ctx.save();
    drawVarRoundedRect(ctx, box.x, box.y, box.width, box.height, [r, r, r, r]);
    ctx.lineWidth = opts.borderWidth;
    ctx.strokeStyle = opts.borderColor || rimColor;
    ctx.stroke();
    ctx.restore();
  }
}

export function drawQuoteMarkGlyph(
  ctx: CanvasRenderingContext2D,
  style: QuoteMarkStyle,
  x: number,
  y: number,
  size: number,
  color: string,
  closing = false
): void {
  if (style === 'none' || size <= 2) return;
  ctx.save();
  ctx.translate(x, y);
  if (closing) {
    ctx.rotate(Math.PI);
  }

  if (style === 'slash') {
    ctx.fillStyle = color;
    const w = size * 0.32;
    const h = size * 0.78;
    const gap = size * 0.14;
    for (let i = 0; i < 2; i++) {
      const bx = -size * 0.45 + i * (w + gap);
      ctx.beginPath();
      ctx.moveTo(bx + w * 0.25, -h * 0.42);
      ctx.lineTo(bx + w, -h * 0.42);
      ctx.lineTo(bx + w * 0.72, h * 0.42);
      ctx.lineTo(bx, h * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (style === 'circle-badge') {
    if (closing) {
      // Undo outer 180deg rotation so top glossy highlight stays on top
      ctx.rotate(-Math.PI);
    }
    const rad = size * 0.52;
    const g = ctx.createLinearGradient(-rad, -rad, rad, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, color);
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // subtle glossy top highlight
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, -rad * 0.38, rad * 0.65, rad * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(size * 1.15)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(closing ? '”' : '“', 0, size * 0.22);
    ctx.restore();
    return;
  }

  if (style === 'bold-block') {
    ctx.fillStyle = color;
    const unit = size * 0.38;
    const gap = size * 0.14;
    for (let i = 0; i < 2; i++) {
      const ox = -unit - gap * 0.5 + i * (unit + gap);
      const oy = -unit * 0.75;
      ctx.beginPath();
      ctx.moveTo(ox, oy + unit * 0.55);
      ctx.quadraticCurveTo(ox, oy, ox + unit * 0.85, oy);
      ctx.lineTo(ox + unit * 0.85, oy + unit * 0.34);
      ctx.quadraticCurveTo(ox + unit * 0.45, oy + unit * 0.38, ox + unit * 0.45, oy + unit * 0.62);
      ctx.lineTo(ox + unit * 0.88, oy + unit * 0.62);
      ctx.lineTo(ox + unit * 0.88, oy + unit * 1.38);
      ctx.lineTo(ox, oy + unit * 1.38);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // classic curly glyph
  ctx.fillStyle = color;
  ctx.font = `900 ${Math.round(size * 1.5)}px Georgia, 'Noto Serif Bengali', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('“', 0, size * 0.18);
  ctx.restore();
}

function drawHalftoneGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing: number,
  radius: number,
  color: string,
  alpha = 0.16
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let py = y; py <= y + h; py += spacing) {
    for (let px = x; px <= x + w; px += spacing) {
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSocialIconsRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  bgColor: string,
  fgColor: string
): void {
  const labels = ['f', 'x', 'in', 'yt'];
  ctx.save();
  const gap = size * 0.32;
  for (let i = 0; i < labels.length; i++) {
    const bx = x + i * (size + gap);
    ctx.fillStyle = bgColor;
    drawVarRoundedRect(ctx, bx, y, size, size, [6, 6, 6, 6]);
    ctx.fill();
    ctx.fillStyle = fgColor;
    ctx.font = `800 ${Math.round(size * 0.56)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], bx + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
}

export interface QuoteRenderContext {
  ctx: CanvasRenderingContext2D;
  template: TemplateConfig;
  photoImg: HTMLImageElement | null;
  secondaryPhotoImg?: HTMLImageElement | null;
  photoZoom: number;
  photoPanX: number;
  photoPanY: number;
  photoDeleted?: boolean;
  quoteSettings: QuoteCardSettings;
  font: FontOption;
  dateText?: string;
  hideDate?: boolean;
  hideFooter?: boolean;
  skipPhotoDraw?: boolean;
  hasLogoIntent: boolean;
}

export function renderQuoteCardChrome(params: QuoteRenderContext): BrandLogoSlot {
  const {
    ctx,
    template,
    photoImg,
    secondaryPhotoImg,
    photoZoom,
    photoPanX,
    photoPanY,
    photoDeleted,
    quoteSettings: q,
    font,
    hideDate,
    hideFooter,
    skipPhotoDraw,
  } = params;

  const W = template.canvasWidth;
  const H = template.canvasHeight;
  const p = template.palette || {
    bgPrimary: '#0853b8',
    bgSecondary: '#021742',
    accent: '#fbbf24',
    footerBg: '#021742',
    footerText: '#ffffff',
    badgeBg: '#ffffff',
    badgeText: '#111827',
    borderColor: '#ffffff',
  };

  const qMarkSizeBase = Math.max(0.5, Math.min(1.6, (q.quoteMarkSizePercent || 100) / 100));
  const shouldDrawMarks = q.showQuoteMarks && q.quoteMarkStyle !== 'none';
  const websiteStr = (template.hasWebsiteUrl && template.websiteUrl) ? template.websiteUrl : '';
  const showPhoto = !skipPhotoDraw && !photoDeleted;

  switch (template.styleType) {
    case 'quote-dramatic-gradient': {
      const grad = ctx.createRadialGradient(W * 0.72, H * 0.42, W * 0.08, W * 0.35, H * 0.55, W * 1.15);
      grad.addColorStop(0, p.accent);
      grad.addColorStop(0.42, p.bgPrimary);
      grad.addColorStop(1, p.bgSecondary);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W * 0.55, 0);
        ctx.lineTo(W * 0.12, H * 0.65);
        ctx.lineTo(0, H * 0.55);
        ctx.closePath();
        ctx.fill();

        // Thin L-bracket accent under text like reference
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W * 0.085, H * 0.56);
        ctx.lineTo(W * 0.085, H * 0.615);
        ctx.lineTo(W * 0.43, H * 0.615);
        ctx.stroke();
        ctx.restore();
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'soft-blend',
          fadeColor: p.bgSecondary,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.11, H * 0.17, 74 * qMarkSizeBase, q.quoteMarkColor);
      }

      // Top-left small source / creator badge
      if (!hideDate && (q.sourceText || q.badgeText)) {
        const avR = 30;
        const avX = W * 0.092;
        const avY = H * 0.068;
        if (secondaryPhotoImg && secondaryPhotoImg.naturalWidth > 0) {
          drawPortraitShape(
            ctx,
            secondaryPhotoImg,
            { x: avX - avR, y: avY - avR, width: avR * 2, height: avR * 2 },
            1,
            0,
            0,
            'original',
            '#ffffff',
            { shape: 'circle', borderWidth: 2.5, borderColor: '#ffffff' }
          );
        }
        const tx = secondaryPhotoImg ? avX + avR + 14 : avX - avR;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 26px ${font.family}`;
        ctx.fillText(q.badgeText || q.sourceText, tx, avY - 10);
        if (q.sourceText && q.badgeText) {
          ctx.fillStyle = 'rgba(255,255,255,0.78)';
          ctx.font = `500 20px ${font.family}`;
          ctx.fillText(q.sourceText, tx, avY + 18);
        }
        ctx.restore();
      }

      // Bottom-right bold author stack with subtle contrast scrim
      if (q.authorName || q.authorTitle) {
        const scrim = ctx.createLinearGradient(0, H * 0.68, 0, H);
        scrim.addColorStop(0, 'rgba(2,23,66,0)');
        scrim.addColorStop(0.5, `${p.bgSecondary}aa`);
        scrim.addColorStop(1, `${p.bgSecondary}f2`);
        ctx.fillStyle = scrim;
        ctx.fillRect(0, H * 0.68, W, H * 0.32);

        const ax = W * 0.59;
        const ay = H * 0.77;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = q.authorNameColor || '#ffffff';
        ctx.font = `800 54px ${font.family}`;
        const nameLines = drawWrappedTextLines(ctx, q.authorName, W * 0.36);
        nameLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, ay + idx * 62);
        });
        const roleY = ay + Math.max(1, nameLines.slice(0, 2).length) * 62 + 12;
        ctx.fillStyle = q.authorTitleColor || '#e2e8f0';
        ctx.font = `500 27px ${font.family}`;
        const roleLines = drawWrappedTextLines(ctx, q.authorTitle, W * 0.36);
        roleLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, roleY + idx * 34);
        });
        ctx.restore();
      }

      return { x: W * 0.72, y: H * 0.04, maxWidth: 260, maxHeight: 74, align: 'right', surfaceIsDark: true };
    }

    case 'quote-arc-halftone': {
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, p.bgPrimary);
      bgGrad.addColorStop(0.55, p.bgPrimary);
      bgGrad.addColorStop(1, p.bgSecondary);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        drawHalftoneGrid(ctx, 20, 20, W - 40, H - 40, 24, 2.8, p.accent, 0.1);

        // Sweeping cobalt arc from top-right framing behind the portrait without crossing quote text
        ctx.save();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 86;
        ctx.beginPath();
        ctx.arc(W * 1.38, H * 0.69, W * 0.72, Math.PI * 0.86, Math.PI * 1.38);
        ctx.stroke();

        // Bottom-left golden accent arc
        ctx.strokeStyle = p.footerBg;
        ctx.lineWidth = 72;
        ctx.beginPath();
        ctx.arc(-W * 0.08, H * 1.04, W * 0.38, Math.PI * 1.48, Math.PI * 1.98);
        ctx.stroke();

        // Soft top-right amber orb
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.footerBg;
        ctx.beginPath();
        ctx.arc(W * 0.85, H * 0.05, 118, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `900 120px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('”', W * 0.85, H * 0.065);
        ctx.restore();
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'soft-blend',
          fadeColor: p.bgSecondary,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, 'bold-block', W * 0.12, H * 0.205, 58 * qMarkSizeBase, q.quoteMarkColor);
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.35, H * 0.675, 116 * qMarkSizeBase, q.quoteMarkColor, true);
      }

      // White floating pill nameplate bottom-right
      if (q.authorName || q.authorTitle) {
        const cardW = W * 0.44;
        const cardH = 164;
        const cardX = W * 0.47;
        const cardY = H * 0.78;
        ctx.save();
        ctx.shadowColor = 'rgba(15,23,42,0.18)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = p.badgeBg;
        drawVarRoundedRect(ctx, cardX, cardY, cardW, cardH, [36, 36, 36, 36]);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#111827';
        ctx.font = `800 38px ${font.family}`;
        ctx.fillText(q.authorName, cardX + 34, cardY + 28, cardW - 68);
        ctx.fillStyle = q.authorTitleColor || '#334155';
        ctx.font = `500 25px ${font.family}`;
        const tLines = drawWrappedTextLines(ctx, q.authorTitle, cardW - 68);
        tLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, cardX + 34, cardY + 84 + idx * 32);
        });
        ctx.restore();
      }

      if (!hideFooter && websiteStr) {
        ctx.save();
        ctx.fillStyle = p.accent;
        ctx.font = `700 26px ${font.family}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(websiteStr, W * 0.19, H * 0.088);
        ctx.restore();
      }

      return { x: W * 0.085, y: H * 0.055, maxWidth: 110, maxHeight: 90, align: 'left', surfaceIsDark: false };
    }

    case 'quote-dark-glass-rating': {
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 80, W * 0.5, H * 0.5, W * 0.85);
      bgGrad.addColorStop(0, p.bgSecondary);
      bgGrad.addColorStop(1, p.bgPrimary);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W * 0.32, H * 0.46, W * 0.46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(W * 0.62, H * 0.72, W * 0.34, 0, Math.PI * 2);
        ctx.stroke();
        drawHalftoneGrid(ctx, W * 0.68, H * 0.82, 360, 260, 26, 4.5, p.accent, 0.25);
        ctx.restore();
      }

      // Main glass surface card (flat top-left/bottom-left, curved TR, crisp BR)
      const cardX = W * 0.145;
      const cardY = H * 0.22;
      const cardW = W * 0.735;
      const cardH = H * 0.59;
      ctx.save();
      ctx.fillStyle = q.cardSurfaceColor || '#0b2566';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 40;
      drawVarRoundedRect(ctx, cardX, cardY, cardW, cardH, [24, 240, 24, 24]);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(96,165,250,0.22)';
      ctx.stroke();
      ctx.restore();

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'circle',
          borderWidth: 8,
          borderColor: '#ffffff',
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, cardX + 60, cardY - 12, 130 * qMarkSizeBase, q.quoteMarkColor);
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, cardX + cardW - 65, cardY + cardH + 5, 130 * qMarkSizeBase, q.quoteMarkColor, true);
      }

      // Speaker Name & Title inside upper card
      if (q.authorName || q.authorTitle) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#ffffff';
        ctx.font = `800 38px ${font.family}`;
        ctx.fillText(q.authorName, cardX + 74, cardY + 72, cardW * 0.55);
        ctx.fillStyle = q.authorTitleColor || '#cbd5e1';
        ctx.font = `500 25px ${font.family}`;
        ctx.fillText(q.authorTitle, cardX + 74, cardY + 122, cardW * 0.58);
        ctx.restore();
      }

      // Rating pill bottom-left inside card with crisp golden vector star
      if (q.ratingText) {
        ctx.save();
        const px = cardX + 74;
        const py = cardY + cardH - 110;
        const pillW = 166;
        const pillH = 66;
        ctx.fillStyle = p.badgeBg;
        drawVarRoundedRect(ctx, px, py, pillW, pillH, [33, 33, 33, 33]);
        ctx.fill();

        const hasStar = q.ratingText.includes('★') || q.ratingText.includes('*');
        const labelOnly = q.ratingText.replace(/[★*]/g, '').trim();
        if (hasStar && labelOnly) {
          // Draw crisp 5-point golden star on left + rating number on right
          const sx = px + 56;
          const sy = py + pillH / 2;
          const outerR = 17;
          const innerR = 7.5;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const rad = i % 2 === 0 ? outerR : innerR;
            const ang = (Math.PI / 5) * i - Math.PI / 2;
            const vx = sx + Math.cos(ang) * rad;
            const vy = sy + Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.fillStyle = '#f59e0b';
          ctx.fill();

          ctx.fillStyle = p.badgeText;
          ctx.font = `800 34px ${font.family}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelOnly, px + 86, py + pillH / 2 + 2, pillW - 98);
        } else {
          ctx.fillStyle = p.badgeText;
          ctx.font = `800 32px ${font.family}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(q.ratingText, px + pillW / 2, py + pillH / 2 + 2, pillW - 24);
        }
        ctx.restore();
      }

      if (!hideFooter && websiteStr) {
        ctx.save();
        ctx.fillStyle = p.footerText;
        ctx.font = `600 28px ${font.family}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(websiteStr, W * 0.145, H * 0.89);
        ctx.restore();
      }

      return { x: W * 0.56, y: H * 0.055, maxWidth: 360, maxHeight: 84, align: 'right', surfaceIsDark: true };
    }

    case 'quote-violet-lime-card': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * 0.58, H * 0.48, W * 0.42, -Math.PI * 0.35, Math.PI * 0.62);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, H * 0.6);
        ctx.lineTo(W, H * 0.6);
        ctx.stroke();
        ctx.restore();
      }

      const cardX = W * 0.165;
      const cardY = H * 0.235;
      const cardW = W * 0.665;
      const cardH = H * 0.54;
      ctx.save();
      ctx.fillStyle = q.cardSurfaceColor || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 42;
      drawVarRoundedRect(ctx, cardX, cardY, cardW, cardH, [20, 260, 20, 20]);
      ctx.fill();
      ctx.restore();

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'circle',
          borderWidth: 10,
          borderColor: '#ffffff',
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, cardX + 35, cardY - 10, 140 * qMarkSizeBase, q.quoteMarkColor);
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, cardX + cardW - 50, cardY + cardH + 10, 140 * qMarkSizeBase, q.quoteMarkColor, true);
      }

      if (q.authorName || q.authorTitle) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#0f172a';
        ctx.font = `800 38px ${font.family}`;
        ctx.fillText(q.authorName, cardX + 68, cardY + 95, cardW * 0.54);
        ctx.fillStyle = q.authorTitleColor || '#475569';
        ctx.font = `500 26px ${font.family}`;
        ctx.fillText(q.authorTitle, cardX + 68, cardY + 145, cardW * 0.56);
        ctx.restore();
      }

      if (q.badgeText) {
        ctx.save();
        const bx = cardX + 68;
        const by = cardY + cardH - 105;
        ctx.font = `700 26px ${font.family}`;
        const tw = Math.min(cardW * 0.65, ctx.measureText(q.badgeText).width + 64);
        ctx.fillStyle = p.badgeBg;
        drawVarRoundedRect(ctx, bx, by, tw, 64, [32, 32, 32, 32]);
        ctx.fill();
        ctx.fillStyle = p.badgeText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.badgeText, bx + tw / 2, by + 33);
        ctx.restore();
      }

      if (!hideFooter) {
        if (q.showSocialIcons) {
          drawSocialIconsRow(ctx, W * 0.068, H * 0.892, 34, '#ffffff', p.bgPrimary);
        }
        if (websiteStr) {
          ctx.save();
          ctx.fillStyle = p.footerText;
          ctx.font = `700 24px ${font.family}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(websiteStr, W * 0.068, H * 0.94);
          ctx.restore();
        }
      }

      return { x: W * 0.68, y: H * 0.04, maxWidth: 280, maxHeight: 82, align: 'right', surfaceIsDark: true };
    }

    case 'quote-wave-testimonial': {
      ctx.fillStyle = p.bgSecondary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(W * 0.14, H * 0.95, W * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sweeping white organic curve filling top-left through center
      ctx.save();
      ctx.fillStyle = p.bgPrimary;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.78, 0);
      ctx.bezierCurveTo(W * 1.02, H * 0.25, W * 1.06, H * 0.56, W * 0.72, H * 0.69);
      ctx.bezierCurveTo(W * 0.45, H * 0.79, W * 0.18, H * 0.74, 0, H * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (!hideDate && template.kickerText) {
        ctx.save();
        ctx.fillStyle = p.accent;
        ctx.font = `700 28px ${font.family}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.kickerText, W * 0.075, H * 0.062);
        ctx.restore();
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.125, H * 0.165, 118 * qMarkSizeBase, q.quoteMarkColor);
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'circle',
          borderWidth: 14,
          borderColor: p.accent,
          photoDeleted,
        });
      }

      if (q.authorName || q.authorTitle) {
        const ax = W * 0.095;
        const ay = H * 0.59;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#0f172a';
        ctx.font = `800 36px ${font.family}`;
        ctx.fillText(q.authorName, ax, ay, W * 0.48);
        ctx.fillStyle = q.authorTitleColor || '#334155';
        ctx.font = `500 26px ${font.family}`;
        const roleLines = drawWrappedTextLines(ctx, q.authorTitle, W * 0.48);
        roleLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, ay + 48 + idx * 34);
        });
        ctx.restore();
      }

      if (!hideFooter && websiteStr) {
        ctx.save();
        ctx.fillStyle = p.footerText;
        ctx.font = `700 22px ${font.family}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(websiteStr, W * 0.94, H * 0.942);
        ctx.restore();
      }

      return { x: W * 0.06, y: H * 0.915, maxWidth: 260, maxHeight: 68, align: 'left', surfaceIsDark: true };
    }

    case 'quote-neon-duotone': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        const glow = ctx.createRadialGradient(W * 0.15, H * 0.1, 20, W * 0.25, H * 0.2, W * 0.75);
        glow.addColorStop(0, p.bgSecondary);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        drawHalftoneGrid(ctx, W * 0.28, 0, W * 0.72, H, 22, 2.5, p.accent, 0.08);
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 46,
          borderWidth: q.photoStyle === 'rim-glow' ? 7 : 0,
          borderColor: q.photoRimColor,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.15, H * 0.215, 118 * qMarkSizeBase, q.quoteMarkColor);
      }

      if (q.authorName || q.authorTitle) {
        const ax = W * 0.08;
        const ay = H * 0.785;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || p.accent;
        ctx.font = `italic 700 30px ${font.family}`;
        ctx.fillText(`${q.authorName},`, ax, ay, W * 0.45);
        ctx.fillStyle = q.authorTitleColor || '#e2e8f0';
        ctx.font = `italic 500 25px ${font.family}`;
        const lines = drawWrappedTextLines(ctx, q.authorTitle, W * 0.45);
        lines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, ay + 40 + idx * 32);
        });
        ctx.restore();
      }

      return { x: W * 0.075, y: H * 0.90, maxWidth: 260, maxHeight: 70, align: 'left', surfaceIsDark: true };
    }

    case 'quote-book-crimson-mark': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        // Subtle editorial paper grain lines
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.028)';
        ctx.lineWidth = 2;
        for (let i = -H; i < W + H; i += 24) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i - H * 0.4, H);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!hideDate && q.sourceText) {
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.font = `600 28px ${font.family}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.sourceText, W * 0.055, H * 0.062);
        ctx.restore();
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 36,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.455, H * 0.725, 195 * qMarkSizeBase, q.quoteMarkColor, true);
      }

      if (q.authorName) {
        const ax = W * 0.095;
        const ay = H * 0.665;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorTitleColor || '#475569';
        ctx.font = `600 26px ${font.family}`;
        ctx.fillText('বলেছেন:', ax, ay);
        ctx.fillStyle = q.authorNameColor || '#111827';
        ctx.font = `800 50px ${font.family}`;
        const nameLines = drawWrappedTextLines(ctx, q.authorName, W * 0.34);
        nameLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, ay + 36 + idx * 58);
        });
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#475569';
          ctx.font = `500 23px ${font.family}`;
          ctx.fillText(q.authorTitle, ax, ay + 42 + nameLines.slice(0, 2).length * 58, W * 0.34);
        }
        ctx.restore();
      }

      return { x: W * 0.87, y: H * 0.04, maxWidth: 96, maxHeight: 74, align: 'right', surfaceIsDark: false };
    }

    case 'quote-press-halftone': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        drawHalftoneGrid(ctx, 18, 18, W - 36, H - 90, 26, 5.2, '#94a3b8', 0.12);

        // Sweeping crimson crescent arc behind portrait on right
        ctx.save();
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(W * 0.98, H * 0.66, W * 0.45, Math.PI * 0.6, Math.PI * 1.55);
        ctx.lineTo(W, H * 0.92);
        ctx.lineTo(W * 0.56, H * 0.92);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 30,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, W * 0.115, H * 0.19, 86 * qMarkSizeBase, q.quoteMarkColor);
      }

      if (q.authorName || q.authorTitle) {
        const ax = W * 0.085;
        const ay = H * 0.72;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#111827';
        ctx.font = `800 34px ${font.family}`;
        ctx.fillText(`- ${q.authorName}`, ax, ay, W * 0.42);
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#374151';
          ctx.font = `500 25px ${font.family}`;
          ctx.fillText(q.authorTitle, ax + 18, ay + 42, W * 0.42);
        }
        ctx.restore();
      }

      if (!hideFooter) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, H - 96, W, 14);
        ctx.fillStyle = p.footerBg;
        ctx.fillRect(0, H - 82, W, 82);
        ctx.save();
        ctx.fillStyle = p.footerText;
        ctx.font = `600 26px ${font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const line = [template.footerCtaText, websiteStr].filter(Boolean).join(' ');
        if (line) ctx.fillText(line, W / 2, H - 41);
        ctx.restore();
      }

      return { x: W * 0.055, y: H * 0.036, maxWidth: 280, maxHeight: 74, align: 'left', surfaceIsDark: false };
    }

    case 'quote-qa-split': {
      const midY = Math.round(H * 0.468);
      const barH = 22;
      const stripH = hideFooter ? 0 : 62;

      // Top light panel (Questioner)
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, midY);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.035)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(W * 0.72, midY * 0.45, 290, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Secondary Photo (Questioner, top-left)
      const secBox: RectBox = { x: 24, y: 65, width: W * 0.46, height: midY - 65 };
      if (secondaryPhotoImg && secondaryPhotoImg.naturalWidth > 0) {
        drawPortraitShape(ctx, secondaryPhotoImg, secBox, 1, 0, 0, 'original', '#e2e8f0', {
          shape: 'rounded',
          radius: 26,
        });
      } else if (!photoDeleted && q.showDecorShapes) {
        // Subtle editorial question badge if 2nd image not uploaded yet
        ctx.save();
        ctx.fillStyle = '#f1f5f9';
        drawVarRoundedRect(ctx, 56, 95, W * 0.36, midY - 130, [36, 36, 36, 36]);
        ctx.fill();
        ctx.fillStyle = p.bgSecondary;
        ctx.font = `800 130px ${font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 56 + W * 0.18, 95 + (midY - 130) / 2);
        ctx.restore();
      }

      // Top-right Question text + Author + Meta (auto-scaled cleanly inside right half)
      const qX = W * 0.73;
      const qMaxW = W * 0.44;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#111827';
      const rawQuestion = q.questionText || 'আপনার প্রশ্ন এখানে লিখুন';
      let qFontSize = 52;
      let qLines: string[] = [];
      for (; qFontSize >= 26; qFontSize -= 3) {
        ctx.font = `800 ${qFontSize}px ${font.family}`;
        qLines = drawWrappedTextLines(ctx, rawQuestion, qMaxW);
        if (qLines.length <= 4 && qLines.length * (qFontSize * 1.24) <= midY * 0.42) {
          break;
        }
      }
      const qLineH = Math.round(qFontSize * 1.24);
      const qStartY = Math.max(96, midY * 0.27);
      qLines.slice(0, 4).forEach((ln, idx) => {
        ctx.fillText(ln, qX, qStartY + idx * qLineH);
      });
      const afterQY = qStartY + Math.max(1, qLines.slice(0, 4).length) * qLineH + 20;
      if (q.questionAuthor) {
        ctx.fillStyle = '#111827';
        ctx.font = `800 30px ${font.family}`;
        ctx.fillText(`- ${q.questionAuthor}`, qX, afterQY, qMaxW);
      }
      if (q.questionMeta) {
        ctx.fillStyle = '#475569';
        ctx.font = `600 18px ${font.family}`;
        ctx.fillText(q.questionMeta, qX, afterQY + 48, qMaxW);
      }
      ctx.restore();

      // Center accent bar
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, midY, W, barH);

      // Bottom maroon answer panel
      const botY = midY + barH;
      const botH = H - botY - stripH;
      ctx.fillStyle = p.bgSecondary;
      ctx.fillRect(0, botY, W, botH);

      if (showPhoto) {
        drawPortraitShape(
          ctx,
          photoImg,
          { x: W * 0.50, y: botY + 18, width: W * 0.485, height: botH - 18 },
          photoZoom,
          photoPanX,
          photoPanY,
          q.photoStyle,
          q.photoRimColor,
          {
            shape: 'rounded',
            radius: 26,
            borderWidth: q.photoStyle === 'rim-glow' ? 5 : 0,
            borderColor: q.photoRimColor,
            photoDeleted,
          }
        );
      }

      if (q.badgeText) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        drawVarRoundedRect(ctx, W * 0.065, botY + 46, 170, 52, [10, 10, 10, 10]);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 26px ${font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.badgeText, W * 0.065 + 85, botY + 73, 150);
        ctx.restore();
      }

      if (q.authorName || q.authorTitle) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = q.authorNameColor || '#ffffff';
        ctx.font = `800 30px ${font.family}`;
        ctx.fillText(`- ${q.authorName}`, W * 0.065, H - stripH - 70, W * 0.42);
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#fde68a';
          ctx.font = `500 21px ${font.family}`;
          ctx.fillText(q.authorTitle, W * 0.085, H - stripH - 36, W * 0.4);
        }
        ctx.restore();
      }

      if (!hideFooter) {
        ctx.fillStyle = p.footerBg;
        ctx.fillRect(0, H - stripH, W, stripH);
        if (template.footerCtaText || q.sourceText) {
          ctx.save();
          ctx.fillStyle = p.footerText;
          ctx.font = `700 20px ${font.family}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(template.footerCtaText || q.sourceText, W / 2, H - stripH / 2);
          ctx.restore();
        }
      }

      return { x: W * 0.065, y: 26, maxWidth: 210, maxHeight: 58, align: 'left', surfaceIsDark: false };
    }

    case 'quote-executive-box': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      // Forest green rounded quote box on left sized cleanly to frame text
      const bx = W * 0.075;
      const by = H * 0.255;
      const bw = W * 0.485;
      const bh = H * 0.42;
      ctx.save();
      ctx.fillStyle = q.cardSurfaceColor || p.bgSecondary;
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = 24;
      drawVarRoundedRect(ctx, bx, by, bw, bh, [42, 42, 42, 42]);
      ctx.fill();
      ctx.restore();

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 36,
          photoDeleted,
        });
      }

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, bx + 65, by - 10, 134 * qMarkSizeBase, q.quoteMarkColor);
      }

      if (q.authorName || q.authorTitle) {
        const ax = W * 0.11;
        const ay = by + bh + 44;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || p.accent;
        ctx.font = `800 50px ${font.family}`;
        const nLines = drawWrappedTextLines(ctx, q.authorName, W * 0.36);
        nLines.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, ax, ay + idx * 56);
        });
        const tY = ay + Math.max(1, nLines.slice(0, 2).length) * 56 + 12;
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#1f2937';
          ctx.font = `500 25px ${font.family}`;
          ctx.fillText(q.authorTitle, ax, tY, W * 0.38);
        }
        ctx.restore();
      }

      return { x: W * 0.08, y: H * 0.05, maxWidth: 230, maxHeight: 74, align: 'left', surfaceIsDark: false };
    }

    case 'quote-chamfer-political': {
      ctx.fillStyle = p.bgPrimary;
      ctx.fillRect(0, 0, W, H);

      if (q.showDecorShapes) {
        ctx.save();
        ctx.strokeStyle = 'rgba(15,23,42,0.08)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * 0.54, H * 0.52, W * 0.37, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(W * 0.54, H * 0.52, W * 0.51, 0, Math.PI * 2);
        ctx.stroke();

        // Top-right crimson chamfered photo backdrop
        ctx.fillStyle = q.cardSurfaceColor || p.bgSecondary;
        drawChamferBlock(ctx, W * 0.475, H * 0.055, W * 0.475, H * 0.45, 58, 0, 0, 0, 145);
        ctx.fill();
        ctx.restore();
      }

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 36,
          photoDeleted,
        });
      }

      // Main left crimson quote card with big top-right diagonal chamfer
      const qx = W * 0.038;
      const qy = H * 0.28;
      const qw = W * 0.58;
      const qh = H * 0.605;
      ctx.save();
      ctx.fillStyle = q.cardSurfaceColor || p.bgSecondary;
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 32;
      drawChamferBlock(ctx, qx, qy, qw, qh, 66, 0, 260, 0, 0);
      ctx.fill();
      ctx.restore();

      // Yellow corner badge / quote mark on top of left block
      if (shouldDrawMarks) {
        ctx.save();
        const bx = qx + 115;
        const by = qy + 72;
        const bSize = 100 * qMarkSizeBase;
        ctx.fillStyle = q.quoteMarkColor || p.accent;
        drawChamferBlock(ctx, bx, by, bSize, bSize, 16, 18, 0, 24, 0);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.font = `900 ${Math.round(54 * qMarkSizeBase)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↘', bx + bSize * 0.5, by + bSize * 0.52);
        ctx.restore();
      }

      // Yellow horizontal divider & author line inside left block
      const ruleY = qy + qh - 165;
      ctx.save();
      ctx.fillStyle = p.accent;
      ctx.fillRect(qx + 48, ruleY, qw - 96, 8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = q.authorNameColor || '#ffffff';
      ctx.font = `800 28px ${font.family}`;
      const authLine = q.authorTitle ? `${q.authorName} - ${q.authorTitle}` : q.authorName;
      ctx.fillText(authLine, qx + 48, ruleY + 22, qw - 96);
      ctx.restore();

      if (!hideFooter && websiteStr) {
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.font = `600 26px ${font.family}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const handleX = W * 0.055;
        const measuredW = Math.min(W * 0.30, ctx.measureText(websiteStr).width);
        ctx.fillText(websiteStr, handleX, H * 0.945, W * 0.30);
        const lineStart = handleX + measuredW + 16;
        const lineEnd = Math.max(lineStart + 24, W * 0.38);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lineStart, H * 0.945);
        ctx.lineTo(lineEnd, H * 0.945);
        ctx.stroke();
        if (q.showSocialIcons) {
          ctx.font = `700 24px sans-serif`;
          ctx.fillText('♥  ▾', lineEnd + 12, H * 0.945);
        }
        ctx.restore();
      }

      return { x: W * 0.055, y: H * 0.05, maxWidth: 220, maxHeight: 74, align: 'left', surfaceIsDark: false };
    }

    case 'quote-corporate-overlap': {
      // Soft atmospheric gradient backdrop
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, p.bgPrimary);
      bg.addColorStop(0.55, '#f8fafc');
      bg.addColorStop(1, p.bgSecondary);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'rounded',
          radius: 26,
          photoDeleted,
        });
      }

      if (q.showDecorShapes) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(W * 0.80, H * 0.56, W * 0.195, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = p.footerBg;
        ctx.lineWidth = 42;
        ctx.beginPath();
        ctx.arc(W * 0.78, H * 0.56, W * 0.31, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Main overlapping magenta box on right
      const bx = W * 0.382;
      const by = H * 0.38;
      const bw = W * 0.535;
      const bh = H * 0.305;
      ctx.save();
      ctx.fillStyle = q.cardSurfaceColor || '#910955';
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 28;
      ctx.fillRect(bx, by, bw, bh);
      // Yellow bar hanging under left corner
      ctx.fillStyle = p.accent;
      ctx.fillRect(bx, by + bh, bw * 0.42, 24);
      ctx.restore();

      if (shouldDrawMarks) {
        drawQuoteMarkGlyph(ctx, q.quoteMarkStyle, bx + 130, by - 25, 130 * qMarkSizeBase, q.quoteMarkColor);
      }

      if (q.authorName || q.authorTitle) {
        const ax = W * 0.625;
        const ay = H * 0.835;
        ctx.save();
        ctx.fillStyle = q.cardSurfaceColor || '#910955';
        ctx.fillRect(ax - 22, ay, 12, 66);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = q.authorNameColor || '#0f172a';
        ctx.font = `800 36px ${font.family}`;
        ctx.fillText(q.authorName, ax, ay - 2, W * 0.34);
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#334155';
          ctx.font = `500 24px ${font.family}`;
          ctx.fillText(q.authorTitle, ax, ay + 42, W * 0.34);
        }
        ctx.restore();
      }

      return { x: W * 0.82, y: H * 0.035, maxWidth: 160, maxHeight: 90, align: 'right', surfaceIsDark: false };
    }

    case 'quote-warm-bubble': {
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, p.bgPrimary);
      grad.addColorStop(0.55, p.bgPrimary);
      grad.addColorStop(1, p.bgSecondary);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (showPhoto) {
        drawPortraitShape(ctx, photoImg, template.photoBox, photoZoom, photoPanX, photoPanY, q.photoStyle, q.photoRimColor, {
          shape: 'soft-blend',
          fadeColor: p.bgPrimary,
          photoDeleted,
        });
      }

      // Speech bubble header badge (skewed white rectangle with tail + shadow offset)
      if (q.badgeText) {
        ctx.save();
        const bx = W * 0.082;
        const by = H * 0.14;
        const bw = W * 0.31;
        const bh = 122;
        // Drop offset brown shadow block
        ctx.fillStyle = p.borderColor;
        ctx.beginPath();
        ctx.moveTo(bx + 18, by - 14);
        ctx.lineTo(bx + bw + 18, by - 26);
        ctx.lineTo(bx + bw + 18, by + bh - 8);
        ctx.lineTo(bx + 18, by + bh);
        ctx.closePath();
        ctx.fill();

        // Main white speech bubble + tail
        ctx.fillStyle = q.cardSurfaceColor || '#ffffff';
        ctx.beginPath();
        ctx.moveTo(bx, by + 16);
        ctx.lineTo(bx + bw, by - 14);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw * 0.62, by + bh + 6);
        ctx.lineTo(bx + bw * 0.48, by + bh + 44);
        ctx.lineTo(bx + bw * 0.50, by + bh + 8);
        ctx.lineTo(bx, by + bh + 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.badgeText;
        ctx.font = `900 54px ${font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.badgeText, bx + bw / 2, by + bh / 2 + 2, bw - 30);
        ctx.restore();
      }

      // Bold hashtag / source + author line below quote
      if (q.sourceText || q.authorName) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (q.sourceText) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 44px ${font.family}`;
          ctx.fillText(q.sourceText, W * 0.082, H * 0.74, W * 0.48);
        }
        if (q.authorName) {
          ctx.fillStyle = q.authorNameColor || '#ffffff';
          ctx.font = `800 32px ${font.family}`;
          ctx.fillText(q.authorName, W * 0.082, H * 0.922, W * 0.4);
        }
        if (q.authorTitle) {
          ctx.fillStyle = q.authorTitleColor || '#d6d3d1';
          ctx.font = `500 20px ${font.family}`;
          ctx.fillText(q.authorTitle, W * 0.082, H * 0.946, W * 0.4);
        }
        ctx.restore();
      }

      return { x: W * 0.082, y: H * 0.04, maxWidth: 220, maxHeight: 74, align: 'left', surfaceIsDark: true };
    }

    default:
      return { x: W * 0.06, y: H * 0.04, maxWidth: 240, maxHeight: 74, align: 'left', surfaceIsDark: true };
  }
}
