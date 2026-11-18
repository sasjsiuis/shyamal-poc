import type {
  BrandLogoSlot,
  CustomTextItem,
  ExtraImageLayer,
  FontOption,
  HighlightRange,
  LineMode,
  LogoBadgeStyle,
  LogoSettings,
  LogoShape,
  ProceduralStyleType,
  RectBox,
  RenderedLayoutMetrics,
  SubheadingSettings,
  TemplateConfig,
} from '../types/card';
import { normalizeLayerOrder } from './layerUtils';

export interface RenderCardOptions {
  ctx: CanvasRenderingContext2D;
  template: TemplateConfig;
  overlayImg: HTMLImageElement | null;
  photoImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  officialLogoImg?: HTMLImageElement | null;
  headline: string;
  highlights: HighlightRange[];
  lineMode: LineMode;
  fontSizePercent: number;
  lineGapPercent: number;
  font: FontOption;
  textOffsetX: number;
  textOffsetY: number;
  textShadow: boolean;
  textColor: string;
  highlightColor: string;
  photoZoom: number;
  photoPanX: number;
  photoPanY: number;
  logoSettings: LogoSettings;
  subheading?: SubheadingSettings;
  customTexts?: CustomTextItem[];
  activeCustomTextId?: string | null;
  extraImages?: ExtraImageLayer[];
  extraImageEls?: Record<string, HTMLImageElement>;
  activeExtraImageId?: string | null;
  layerOrder?: string[];
  layerVisibility?: Record<string, boolean>;
  layerOpacity?: Record<string, number>;
  dateTextOverride?: string;
  isExport?: boolean;
  snapState?: { snappedX: boolean; snappedY: boolean; isDragging: boolean };
}

interface TextSegment {
  text: string;
  highlighted: boolean;
}

interface WordToken {
  raw: string;
  segments: TextSegment[];
}

function isBengaliCombiningChar(code: number): boolean {
  return (
    (code >= 0x0981 && code <= 0x0983) ||
    code === 0x09bc ||
    (code >= 0x09be && code <= 0x09cd) ||
    code === 0x09d7 ||
    (code >= 0x09e2 && code <= 0x09e3) ||
    code === 0x200c ||
    code === 0x200d
  );
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function buildHighlightMask(headline: string, highlights: HighlightRange[]): boolean[] {
  const mask = new Array<boolean>(headline.length).fill(false);
  if (!headline || highlights.length === 0) return mask;

  for (const h of highlights) {
    let s = h.start;
    let e = h.end;

    if (s < 0 || e > headline.length || s >= e || headline.slice(s, e) !== h.text) {
      if (h.text && h.text.trim()) {
        const foundIdx = headline.indexOf(h.text);
        if (foundIdx !== -1) {
          s = foundIdx;
          e = foundIdx + h.text.length;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    while (s > 0 && isBengaliCombiningChar(headline.charCodeAt(s))) {
      s--;
    }
    while (e < headline.length && isBengaliCombiningChar(headline.charCodeAt(e))) {
      e++;
    }
    while (e < headline.length && headline.charCodeAt(e - 1) === 0x09cd) {
      e++;
      while (e < headline.length && isBengaliCombiningChar(headline.charCodeAt(e))) {
        e++;
      }
    }

    for (let i = Math.max(0, s); i < Math.min(headline.length, e); i++) {
      mask[i] = true;
    }
  }

  return mask;
}

function tokenizeLineIntoWords(lineText: string, lineStartOffset: number, mask: boolean[]): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(lineText)) !== null) {
    const word = match[0];
    const absStart = lineStartOffset + match.index;
    const segments: TextSegment[] = [];

    let i = 0;
    while (i < word.length) {
      const segHighlight = mask[absStart + i] || false;
      let j = i + 1;
      while (j < word.length) {
        const code = word.charCodeAt(j);
        const prevCode = word.charCodeAt(j - 1);
        if (isBengaliCombiningChar(code) || prevCode === 0x09cd) {
          j++;
          continue;
        }
        if ((mask[absStart + j] || false) === segHighlight) {
          j++;
        } else {
          break;
        }
      }
      segments.push({
        text: word.slice(i, j),
        highlighted: segHighlight,
      });
      i = j;
    }

    tokens.push({ raw: word, segments });
  }

  return tokens;
}

function measureWordListWidth(ctx: CanvasRenderingContext2D, words: WordToken[], spaceWidth: number): number {
  if (words.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    total += ctx.measureText(words[i].raw).width;
    if (i < words.length - 1) total += spaceWidth;
  }
  return total;
}

function wrapWordsSmart(
  ctx: CanvasRenderingContext2D,
  words: WordToken[],
  maxWidth: number,
  spaceWidth: number
): WordToken[][] {
  if (words.length === 0) return [];
  const lines: WordToken[][] = [];
  let current: WordToken[] = [words[0]];
  let currentW = ctx.measureText(words[0].raw).width;

  for (let i = 1; i < words.length; i++) {
    const w = ctx.measureText(words[i].raw).width;
    if (currentW + spaceWidth + w <= maxWidth) {
      current.push(words[i]);
      currentW += spaceWidth + w;
    } else {
      lines.push(current);
      current = [words[i]];
      currentW = w;
    }
  }
  if (current.length > 0) lines.push(current);

  if (lines.length >= 2) {
    const lastIdx = lines.length - 1;
    const prevLine = lines[lastIdx - 1];
    const lastLine = lines[lastIdx];
    if (lastLine.length === 1 && prevLine.length >= 3) {
      const candidateLast = [prevLine[prevLine.length - 1], ...lastLine];
      if (measureWordListWidth(ctx, candidateLast, spaceWidth) <= maxWidth) {
        lines[lastIdx - 1] = prevLine.slice(0, -1);
        lines[lastIdx] = candidateLast;
      }
    }
  }

  return lines;
}

function splitIntoTwoBalancedLines(
  ctx: CanvasRenderingContext2D,
  words: WordToken[],
  spaceWidth: number
): WordToken[][] {
  if (words.length === 0) return [];
  if (words.length === 1) return [words];

  let bestSplit = Math.ceil(words.length / 2);
  let bestMaxW = Infinity;

  for (let split = 1; split < words.length; split++) {
    const w1 = measureWordListWidth(ctx, words.slice(0, split), spaceWidth);
    const w2 = measureWordListWidth(ctx, words.slice(split), spaceWidth);
    const maxW = Math.max(w1, w2);
    if (maxW < bestMaxW) {
      bestMaxW = maxW;
      bestSplit = split;
    }
  }

  return [words.slice(0, bestSplit), words.slice(bestSplit)];
}

function drawPhotoIntoBox(
  ctx: CanvasRenderingContext2D,
  photoImg: HTMLImageElement | null,
  box: RectBox,
  clipPad: number,
  zoom: number,
  panX: number,
  panY: number,
  isExport: boolean
): void {
  const clipX = box.x - clipPad;
  const clipY = box.y - clipPad;
  const clipW = box.width + clipPad * 2;
  const clipH = box.height + clipPad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, clipY, clipW, clipH);
  ctx.clip();

  if (!photoImg || !photoImg.naturalWidth || !photoImg.naturalHeight) {
    ctx.fillStyle = isExport ? '#e5e7eb' : '#d9d9d9';
    ctx.fillRect(clipX, clipY, clipW, clipH);

    if (!isExport) {
      const placeholderFontSize = Math.round(box.width * 0.044);
      ctx.fillStyle = '#808080';
      ctx.font = `500 ${placeholderFontSize}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ছবি এখানে বসবে', box.x + box.width / 2, box.y + box.height / 2);
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#18181b';
  ctx.fillRect(clipX, clipY, clipW, clipH);

  const imgW = photoImg.naturalWidth;
  const imgH = photoImg.naturalHeight;
  const baseScale = Math.max(clipW / imgW, clipH / imgH);
  const panActiveBoost =
    zoom <= 1.02 && (Math.abs(panX) > 1 || Math.abs(panY) > 1) ? 1.12 : 1.0;
  const finalScale = baseScale * Math.max(0.5, zoom) * panActiveBoost;

  const drawW = imgW * finalScale;
  const drawH = imgH * finalScale;

  const maxShiftX = Math.max((drawW - clipW) / 2, clipW * 0.25);
  const maxShiftY = Math.max((drawH - clipH) / 2, clipH * 0.25);

  const offsetX = (panX / 100) * maxShiftX;
  const offsetY = (panY / 100) * maxShiftY;

  const drawX = clipX + (clipW - drawW) / 2 + offsetX;
  const drawY = clipY + (clipH - drawH) / 2 + offsetY;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function getBengaliDateString(): string {
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

function getBengaliWeekdayAndDateString(): string {
  try {
    const weekday = new Intl.DateTimeFormat('bn-BD', { weekday: 'long' }).format(new Date());
    const datePart = new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return `${weekday} | ${datePart}`;
  } catch {
    return getBengaliDateString();
  }
}

// Pixel-perfect procedural rendering of Green & Maroon fallback frames
function maskMaroonBakedLogoRegion(
  ctx: CanvasRenderingContext2D,
  closeTopBorder: boolean
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(364, 4, 352, 77);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
  bgGrad.addColorStop(0, '#5a0b22');
  bgGrad.addColorStop(0.45, '#69122c');
  bgGrad.addColorStop(0.7, '#550c20');
  bgGrad.addColorStop(1, '#420616');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  const sheen = ctx.createLinearGradient(1080, 0, 0, 1080);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.04)');
  sheen.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.restore();

  if (closeTopBorder) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(364, 66);
    ctx.lineTo(716, 66);
    ctx.stroke();
    ctx.restore();
  }
}

function renderPsdTemplateArtwork(
  ctx: CanvasRenderingContext2D,
  templateId: string,
  W: number,
  H: number,
  pBox: RectBox,
  hideDefaultBrand: boolean,
  hasLogoInTopSlot = true
): void {
  if (templateId === 'psd-green') {
    // Top and side wrapping dark teal banner (y=0 to 1569)
    ctx.fillStyle = '#024c4b';
    ctx.fillRect(0, 0, W, 1569);

    // Bottom card footer: pure white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 1569, W, H - 1569);

    // Frame line around photo window
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    // "••• বিস্তারিত কমেন্টে •••" centered pill
    const pillW = 610;
    const pillH = 82;
    const pillX = (W - pillW) / 2;
    const pillY = 1604;
    ctx.fillStyle = '#01665e';
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 41);
    ctx.fill();

    // 3 side dots left and right of pill
    for (const dir of [-1, 1]) {
      for (let d = 1; d <= 3; d++) {
        ctx.beginPath();
        ctx.arc(W / 2 + dir * (pillW / 2 + 26 + d * 36), pillY + pillH / 2, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#01665e';
        ctx.fill();
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 42px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('••• বিস্তারিত কমেন্টে •••', W / 2, pillY + pillH / 2 + 3);

    if (!hideDefaultBrand) {
      // Bottom left web address
      ctx.fillStyle = '#65142a';
      ctx.font = `700 64px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('shyamalsylhet.net', 90, 1940);
    }
  } else {
    // psd-maroon
    ctx.fillStyle = '#5a0b22';
    ctx.fillRect(0, 0, W, H);

    // Subtle background matrix dots texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let gy = 20; gy < H; gy += 24) {
      for (let gx = 20; gx < W; gx += 24) {
        if ((gx * 17 ^ gy * 31) % 100 < 20) {
          ctx.fillRect(gx, gy, 2.5, 2.5);
        }
      }
    }

    // Outer white/cream frame (leave opening at top only when a logo sits there)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;

    // Top horizontal segments
    ctx.beginPath();
    if (hasLogoInTopSlot) {
      ctx.moveTo(54, 66);
      ctx.lineTo(365, 66);
      ctx.moveTo(715, 66);
      ctx.lineTo(1026, 66);
    } else {
      ctx.moveTo(54, 66);
      ctx.lineTo(1026, 66);
    }

    // Left and Right verticals
    ctx.moveTo(54, 66);
    ctx.lineTo(54, 1016);
    ctx.moveTo(1026, 66);
    ctx.lineTo(1026, 1016);

    // Bottom horizontal segments
    ctx.moveTo(54, 1016);
    ctx.lineTo(365, 1016);
    ctx.moveTo(715, 1016);
    ctx.lineTo(1026, 1016);

    // Decorative corner notches
    ctx.moveTo(38, 66);
    ctx.lineTo(54, 66);
    ctx.moveTo(1026, 66);
    ctx.lineTo(1042, 66);
    ctx.moveTo(54, 50);
    ctx.lineTo(54, 66);
    ctx.moveTo(1026, 50);
    ctx.lineTo(1026, 66);

    ctx.moveTo(38, 1016);
    ctx.lineTo(54, 1016);
    ctx.moveTo(1026, 1016);
    ctx.lineTo(1042, 1016);
    ctx.moveTo(54, 1016);
    ctx.lineTo(54, 1032);
    ctx.moveTo(1026, 1016);
    ctx.lineTo(1026, 1032);
    ctx.stroke();

    // Double frame around photo: 3px outer white, 1px inner maroon
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.strokeStyle = 'rgba(159, 18, 57, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pBox.x + 3, pBox.y + 3, pBox.width - 6, pBox.height - 6);

    // Headline container below photo: solid dark maroon box
    ctx.fillStyle = '#621027';
    ctx.fillRect(pBox.x, 726, pBox.width, 272);

    // Bottom "বিস্তারিত কমেন্টে" in golden-yellow embedded in the bottom border opening
    ctx.fillStyle = '#f7cf46';
    ctx.font = `700 34px 'Kalpurush', 'Hind Siliguri', 'Noto Serif Bengali', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিস্তারিত কমেন্টে', W / 2, 1016);
  }
}

function drawDynamicBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  h: number,
  bgColor: string,
  textColor: string,
  radius = 8,
  align: 'left' | 'center' = 'left',
  fontSize = 26
): void {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `700 ${fontSize}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
  const textW = ctx.measureText(text).width;
  const pillW = Math.max(180, Math.min(540, textW + 54));
  const rx = align === 'center' ? x - pillW / 2 : x;
  ctx.fillStyle = bgColor;
  drawRoundedRect(ctx, rx, y, pillW, h, radius);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rx + pillW / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawGlobeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.46, r, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx - r * 0.84, cy - r * 0.48);
  ctx.lineTo(cx + r * 0.84, cy - r * 0.48);
  ctx.moveTo(cx - r * 0.84, cy + r * 0.48);
  ctx.lineTo(cx + r * 0.84, cy + r * 0.48);
  ctx.stroke();
  ctx.restore();
}

function drawWebsiteWithGlobe(
  ctx: CanvasRenderingContext2D,
  urlText: string,
  anchorX: number,
  centerY: number,
  align: 'left' | 'center' | 'right',
  color: string,
  fontSize = 25,
  withGlobe = true
): void {
  const clean = urlText.trim();
  if (!clean) return;
  ctx.save();
  ctx.font = `600 ${fontSize}px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(clean).width;
  const r = Math.round(fontSize * 0.44);
  const gap = withGlobe ? Math.round(fontSize * 0.36) : 0;
  const totalW = withGlobe ? r * 2 + gap + textW : textW;

  let startX = anchorX;
  if (align === 'center') startX = anchorX - totalW / 2;
  else if (align === 'right') startX = anchorX - totalW;

  if (withGlobe) {
    drawGlobeIcon(ctx, startX + r, centerY - 1, r, color);
  }
  ctx.textAlign = 'left';
  ctx.fillText(clean, startX + (withGlobe ? r * 2 + gap : 0), centerY);
  ctx.restore();
}

function drawHalftoneDots(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  step = 18,
  radius = 2.2
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let py = y; py < y + h; py += step) {
    for (let px = x; px < x + w; px += step) {
      if (((px * 19 + py * 37) % 100) < 42) {
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function needsLogoContrastBadge(color: string): boolean {
  const hex = color.trim().replace('#', '');
  let r = 0;
  let g = 0;
  let b = 0;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return true;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return luminance < 215 || saturation > 0.22;
}

interface ChromeLayerOpts {
  dateTextOverride?: string;
  hideDate?: boolean;
  hideFooter?: boolean;
  skipPhotoDraw?: boolean;
}

function renderProceduralTemplateChrome(
  ctx: CanvasRenderingContext2D,
  template: TemplateConfig,
  photoImg: HTMLImageElement | null,
  zoom: number,
  panX: number,
  panY: number,
  hasActiveLogo: boolean,
  isExport: boolean,
  chromeOpts?: ChromeLayerOpts
): BrandLogoSlot {
  const W = template.canvasWidth;
  const H = template.canvasHeight;
  const pal = template.palette!;
  const pBox = template.photoBox;

  const renderChromePhoto = () => {
    if (chromeOpts?.skipPhotoDraw) return;
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
  };

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, pal.bgPrimary);
  bgGrad.addColorStop(1, pal.bgSecondary);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const rawDateStr =
    chromeOpts?.dateTextOverride !== undefined && chromeOpts.dateTextOverride.trim() !== ''
      ? chromeOpts.dateTextOverride.trim()
      : getBengaliDateString();
  const dateStr = chromeOpts?.hideDate ? '' : rawDateStr;
  const kicker = chromeOpts?.hideDate
    ? ''
    : template.kickerText !== undefined
      ? template.kickerText.trim()
      : '';
  const ctaText = chromeOpts?.hideFooter
    ? ''
    : template.footerCtaText !== undefined
      ? template.footerCtaText.trim()
      : 'বিস্তারিত কমেন্টে';

  if (template.styleType === 'top-band-white-footer') {
    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, pBox.y + pBox.height - 60, W, H - (pBox.y + pBox.height - 60));

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (ctaText) {
      const pillW = 340;
      const pillH = 64;
      const pillX = (W - pillW) / 2;
      const pillY = pBox.y + pBox.height + 36;
      ctx.fillStyle = pal.accent;
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 32);
      ctx.fill();

      for (const dir of [-1, 1]) {
        for (let d = 1; d <= 3; d++) {
          ctx.beginPath();
          ctx.arc(W / 2 + dir * (pillW / 2 + 18 + d * 22), pillY + pillH / 2, 7 + (3 - d), 0, Math.PI * 2);
          ctx.fillStyle = pal.accent;
          ctx.fill();
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, pillY + pillH / 2 + 2);
    }

    ctx.fillStyle = pal.footerText;
    ctx.font = `600 25px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const leftMeta = kicker ? `${kicker}  •  ${dateStr}` : dateStr;
    ctx.fillText(leftMeta, 54, H - 56);

    return {
      x: 840,
      y: H - 102,
      maxWidth: 306,
      maxHeight: 82,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.footerBg),
      pillRadius: 14,
      padX: 16,
      padY: 10,
    };
  } else if (template.styleType === 'framed-bottom-box') {
    // Top frame segments (leave centered opening only when brand logo sits there)
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (hasActiveLogo) {
      ctx.moveTo(36, 42);
      ctx.lineTo(W / 2 - 190, 42);
      ctx.moveTo(W / 2 + 190, 42);
      ctx.lineTo(W - 36, 42);
    } else {
      ctx.moveTo(36, 42);
      ctx.lineTo(W - 36, 42);
    }
    ctx.moveTo(36, 42);
    ctx.lineTo(36, H - 42);
    ctx.moveTo(W - 36, 42);
    ctx.lineTo(W - 36, H - 42);
    ctx.moveTo(36, H - 42);
    ctx.lineTo(W - 36, H - 42);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pBox.x - 8, pBox.y - 8, pBox.width + 16, pBox.height + 16);
    renderChromePhoto();

    if (kicker) {
      drawDynamicBadge(ctx, kicker, pBox.x + 20, pBox.y + 20, 44, pal.badgeBg, pal.badgeText, 8, 'left', 24);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.fillRect(pBox.x - 8, pBox.y + pBox.height + 12, pBox.width + 16, 336);

    if (ctaText) {
      ctx.fillStyle = pal.bgPrimary;
      ctx.fillRect(W / 2 - 180, H - 68, 360, 52);
      ctx.fillStyle = pal.accent;
      ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 42);
    }

    return {
      x: W / 2 - 165,
      y: 12,
      maxWidth: 330,
      maxHeight: 62,
      align: 'center',
      surfaceIsDark: needsLogoContrastBadge(pal.bgPrimary),
      pillRadius: 16,
      padX: 16,
      padY: 7,
    };
  } else if (template.styleType === 'full-bleed-gradient') {
    renderChromePhoto();

    const scrim = ctx.createLinearGradient(0, H * 0.36, 0, H - 85);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(0.45, 'rgba(9,13,22,0.72)');
    scrim.addColorStop(1, pal.bgPrimary);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.36, W, H - H * 0.36);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 48, 44, 56, pal.badgeBg, pal.badgeText, 8, 'left', 28);
    }

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 90, W, 90);
    const footerLine = ctaText ? `${dateStr}  •  ${ctaText}` : dateStr;
    if (footerLine) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine, W / 2, H - 44);
    }

    return {
      x: 846,
      y: 36,
      maxWidth: 306,
      maxHeight: 72,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 16,
      padX: 16,
      padY: 9,
    };
  } else if (template.styleType === 'broadcast-ticker') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, 92);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 52, 20, 52, pal.badgeBg, pal.badgeText, 6, 'left', 27);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 78, W, 78);
    const footerLine = ctaText ? `${dateStr}  •  ${ctaText}` : dateStr;
    if (footerLine) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine, W / 2, H - 38);
    }

    return {
      x: 856,
      y: 14,
      maxWidth: 292,
      maxHeight: 64,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 7,
    };
  } else if (template.styleType === 'editorial-broadsheet') {
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(64, 58, W - 128, 6);

    if (kicker) {
      ctx.fillStyle = pal.accent;
      ctx.font = `700 26px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 64, 88);
    }

    ctx.fillStyle = template.defaultTextColor || '#334155';
    ctx.globalAlpha = 0.75;
    ctx.textAlign = 'right';
    ctx.font = `500 24px 'Hind Siliguri', sans-serif`;
    ctx.fillText(dateStr, W - 64, 88);
    ctx.globalAlpha = 1;

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(64, H - 134, W - 128, 82);
    if (ctaText) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 93);
    }

    return {
      x: 826,
      y: H - 127,
      maxWidth: 286,
      maxHeight: 68,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.footerBg),
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'quote-spotlight') {
    // Rounded border (open at top center only when brand logo sits there)
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 40, 40, W - 80, H - 80, 20);
    ctx.stroke();

    if (hasActiveLogo) {
      // Clear top border segment behind centered logo slot
      ctx.fillStyle = pal.bgPrimary;
      ctx.fillRect(W / 2 - 188, 22, 376, 36);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.badgeBg;
    ctx.beginPath();
    ctx.arc(W / 2, pBox.y + pBox.height, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.badgeText;
    ctx.font = `700 56px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('“', W / 2, pBox.y + pBox.height + 10);

    const quoteMeta =
      kicker && ctaText ? `${kicker}  •  ${ctaText}` : kicker || ctaText;
    if (quoteMeta) {
      ctx.fillStyle = pal.accent;
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(quoteMeta, W / 2, H - 68);
    }

    return {
      x: W / 2 - 165,
      y: 12,
      maxWidth: 330,
      maxHeight: 66,
      align: 'center',
      surfaceIsDark: needsLogoContrastBadge(pal.bgPrimary),
      pillRadius: 16,
      padX: 16,
      padY: 8,
    };
  } else if (template.styleType === 'split-header-badge') {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 0, W, 14);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, W / 2, 34, 46, pal.badgeBg, pal.badgeText, 23, 'center', 25);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 108, W, 108);
    ctx.fillStyle = pal.footerText;
    ctx.globalAlpha = 0.78;
    ctx.font = `600 22px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 54, H - 54);
    ctx.globalAlpha = 1;
    if (ctaText) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 54);
    }

    return {
      x: 844,
      y: H - 94,
      maxWidth: 302,
      maxHeight: 80,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.footerBg),
      pillRadius: 16,
      padX: 16,
      padY: 10,
    };
  } else if (template.styleType === 'diagonal-ribbon') {
    ctx.save();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 130);
    ctx.lineTo(0, 92);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 56, 22, 52, pal.badgeBg, pal.badgeText, 6, 'left', 28);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(pBox.x, pBox.y + pBox.height - 8, 180, 8);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 84, W, 84);
    const footerLine = ctaText ? `${dateStr}  •  ${ctaText}` : dateStr;
    if (footerLine) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine, W / 2, H - 42);
    }

    return {
      x: 848,
      y: 18,
      maxWidth: 296,
      maxHeight: 68,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.accent),
      pillRadius: 15,
      padX: 15,
      padY: 8,
    };
  } else if (template.styleType === 'video-play-frame') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(0, 0, W, 94);

    if (kicker) {
      drawDynamicBadge(ctx, `▶  ${kicker}`, 52, 20, 52, pal.badgeBg, pal.badgeText, 26, 'left', 26);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    const barY = pBox.y + pBox.height - 10;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(pBox.x, barY, pBox.width, 10);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(pBox.x, barY, pBox.width * 0.42, 10);

    const cx = pBox.x + pBox.width / 2;
    const cy = pBox.y + pBox.height / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 22);
    ctx.lineTo(cx + 24, cy);
    ctx.lineTo(cx - 14, cy + 22);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 84, W, 84);
    const footerLine = ctaText ? `${dateStr}  •  ${ctaText}` : dateStr;
    if (footerLine) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine, W / 2, H - 42);
    }

    return {
      x: 852,
      y: 15,
      maxWidth: 296,
      maxHeight: 64,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 7,
    };
  } else if (template.styleType === 'islamic-arch') {
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(42, 42, W - 84, H - 84);

    const corners: Array<[number, number]> = [
      [42, 42],
      [W - 42, 42],
      [42, H - 42],
      [W - 42, H - 42],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 10, cy);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 10, cy);
      ctx.closePath();
      ctx.fill();
    }

    if (kicker) {
      drawDynamicBadge(ctx, kicker, W / 2, 22, 52, pal.badgeBg, pal.badgeText, 26, 'center', 27);
    }

    ctx.save();
    ctx.beginPath();
    const archR = 140;
    ctx.moveTo(pBox.x + archR, pBox.y);
    ctx.lineTo(pBox.x + pBox.width - archR, pBox.y);
    ctx.quadraticCurveTo(pBox.x + pBox.width, pBox.y, pBox.x + pBox.width, pBox.y + archR);
    ctx.lineTo(pBox.x + pBox.width, pBox.y + pBox.height);
    ctx.lineTo(pBox.x, pBox.y + pBox.height);
    ctx.lineTo(pBox.x, pBox.y + archR);
    ctx.quadraticCurveTo(pBox.x, pBox.y, pBox.x + archR, pBox.y);
    ctx.closePath();
    ctx.clip();
    renderChromePhoto();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pBox.x + archR, pBox.y);
    ctx.lineTo(pBox.x + pBox.width - archR, pBox.y);
    ctx.quadraticCurveTo(pBox.x + pBox.width, pBox.y, pBox.x + pBox.width, pBox.y + archR);
    ctx.lineTo(pBox.x + pBox.width, pBox.y + pBox.height);
    ctx.lineTo(pBox.x, pBox.y + pBox.height);
    ctx.lineTo(pBox.x, pBox.y + archR);
    ctx.quadraticCurveTo(pBox.x, pBox.y, pBox.x + archR, pBox.y);
    ctx.closePath();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    if (ctaText) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 88);

      const ctaW = ctx.measureText(ctaText).width;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(76, H - 88);
      ctx.lineTo(Math.max(76, W / 2 - ctaW / 2 - 20), H - 88);
      ctx.moveTo(Math.min(790, W / 2 + ctaW / 2 + 20), H - 88);
      ctx.lineTo(790, H - 88);
      ctx.stroke();
    }

    return {
      x: 828,
      y: H - 124,
      maxWidth: 300,
      maxHeight: 72,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.bgPrimary),
      pillRadius: 15,
      padX: 15,
      padY: 8,
    };
  } else if (template.styleType === 'magazine-split') {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 0, 22, H);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 64, 34, 48, pal.badgeBg, pal.badgeText, 8, 'left', 25);
    }
    ctx.fillStyle = template.defaultTextColor || '#ffffff';
    ctx.globalAlpha = 0.72;
    ctx.font = `500 23px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W - 64, 58);
    ctx.globalAlpha = 1;

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(22, H - 90, W - 22, 90);
    if (ctaText) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 44);
    }

    return {
      x: 844,
      y: H - 82,
      maxWidth: 300,
      maxHeight: 74,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.footerBg),
      pillRadius: 14,
      padX: 15,
      padY: 8,
    };
  } else if (template.styleType === 'minimal-polaroid') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    drawRoundedRect(ctx, 44, 44, W - 88, H - 88, 24);
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, 44, 44, W - 88, H - 88, 24);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.save();
    drawRoundedRect(ctx, pBox.x, pBox.y, pBox.width, pBox.height, 18);
    ctx.clip();
    renderChromePhoto();
    ctx.restore();

    drawRoundedRect(ctx, pBox.x, pBox.y, pBox.width, pBox.height, 18);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    if (kicker) {
      drawDynamicBadge(ctx, kicker, pBox.x + 22, pBox.y - 24, 48, pal.badgeBg, pal.badgeText, 24, 'left', 25);
    }

    if (ctaText) {
      ctx.fillStyle = pal.footerBg;
      drawRoundedRect(ctx, W / 2 - 165, H - 108, 330, 50, 25);
      ctx.fill();
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 83);
    }

    return {
      x: 822,
      y: H - 120,
      maxWidth: 306,
      maxHeight: 72,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.bgPrimary),
      pillRadius: 15,
      padX: 15,
      padY: 8,
    };
  } else if (template.styleType === 'interview-spotlight') {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, W / 2, 16, 56, pal.badgeBg, pal.badgeText, 28, 'center', 28);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(W / 2 - 110, pBox.y + pBox.height - 6, 220, 12);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(32, H - 112, W - 64, 80);
    ctx.fillStyle = pal.footerText;
    ctx.globalAlpha = 0.78;
    ctx.font = `600 21px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 64, H - 72);
    ctx.globalAlpha = 1;
    if (ctaText) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 72);
    }

    return {
      x: 846,
      y: H - 107,
      maxWidth: 296,
      maxHeight: 70,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.footerBg),
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'job-career-card') {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 0, W, 92);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 56, 20, 52, pal.badgeBg, pal.badgeText, 10, 'left', 27);
    }

    renderChromePhoto();
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    drawRoundedRect(ctx, 56, pBox.y + pBox.height + 16, W - 112, 290, 16);
    ctx.fill();

    if (ctaText) {
      ctx.fillStyle = pal.footerBg;
      drawRoundedRect(ctx, W / 2 - 170, H - 94, 340, 52, 26);
      ctx.fill();
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 27px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 68);
    }

    ctx.fillStyle = template.defaultTextColor || '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W - 56, H - 68);
    ctx.globalAlpha = 1;

    return {
      x: 852,
      y: 14,
      maxWidth: 292,
      maxHeight: 64,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.accent),
      pillRadius: 14,
      padX: 14,
      padY: 7,
    };
  } else if (template.styleType === 'cyber-tech-grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (kicker) {
      drawDynamicBadge(ctx, kicker, 58, 30, 50, pal.badgeBg, pal.badgeText, 8, 'left', 26);
    }

    renderChromePhoto();

    const bLen = 44;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pBox.x - 4, pBox.y + bLen);
    ctx.lineTo(pBox.x - 4, pBox.y - 4);
    ctx.lineTo(pBox.x + bLen, pBox.y - 4);
    ctx.moveTo(pBox.x + pBox.width - bLen, pBox.y - 4);
    ctx.lineTo(pBox.x + pBox.width + 4, pBox.y - 4);
    ctx.lineTo(pBox.x + pBox.width + 4, pBox.y + bLen);
    ctx.moveTo(pBox.x - 4, pBox.y + pBox.height - bLen);
    ctx.lineTo(pBox.x - 4, pBox.y + pBox.height + 4);
    ctx.lineTo(pBox.x + bLen, pBox.y + pBox.height + 4);
    ctx.moveTo(pBox.x + pBox.width - bLen, pBox.y + pBox.height + 4);
    ctx.lineTo(pBox.x + pBox.width + 4, pBox.y + pBox.height + 4);
    ctx.lineTo(pBox.x + pBox.width + 4, pBox.y + pBox.height - bLen);
    ctx.stroke();

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 84, W, 84);
    const footerLine = ctaText ? `${dateStr}  •  ${ctaText}` : dateStr;
    if (footerLine) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine, W / 2, H - 42);
    }

    return {
      x: 850,
      y: 18,
      maxWidth: 292,
      maxHeight: 68,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 15,
      padY: 8,
    };
  } else if (template.styleType === 'tv-jamuna') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    const redGrad = ctx.createLinearGradient(0, seamY, 0, H);
    redGrad.addColorStop(0, '#dd0808');
    redGrad.addColorStop(0.55, '#b60000');
    redGrad.addColorStop(1, '#860000');
    ctx.fillStyle = redGrad;
    ctx.fillRect(0, seamY, W, H - seamY);

    // Subtle light glow highlight
    const glow = ctx.createRadialGradient(W * 0.5, seamY + 120, 20, W * 0.5, seamY + 120, 560);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, seamY, W, H - seamY);

    // Right-aligned live date above thin white line
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 22px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(dateStr, W - 96, seamY + 40);

    // Thin white horizontal rule
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(96, seamY + 48, W - 192, 2);

    // Large faint quotation mark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.font = `700 116px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('“', 96, seamY + 56);

    // Crisp vertical white accent bar next to headline
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(96, seamY + 122, 4, 174);

    // Optional attribution / kicker line below headline
    if (kicker) {
      ctx.fillStyle = '#fde68a';
      ctx.font = `600 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 131, seamY + 356);
    }

    // Bottom-left triangle arrow + editable website URL
    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.beginPath();
      ctx.moveTo(96, H - 92);
      ctx.lineTo(116, H - 78);
      ctx.lineTo(96, H - 64);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `600 28px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, 130, H - 78);
    }

    return {
      x: 96,
      y: seamY - 46,
      maxWidth: 350,
      maxHeight: 74,
      align: 'left',
      surfaceIsDark: true,
      pillRadius: 12,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'tv-ekattor') {
    renderChromePhoto();

    const rightX = pBox.width;
    const rightW = W - rightX;
    const rightCenterX = rightX + rightW / 2;

    const maroonGrad = ctx.createLinearGradient(rightX, 0, rightX, H - 74);
    maroonGrad.addColorStop(0, '#7d0000');
    maroonGrad.addColorStop(0.5, '#680000');
    maroonGrad.addColorStop(1, '#4f0000');
    ctx.fillStyle = maroonGrad;
    ctx.fillRect(rightX, 0, rightW, H - 74);

    drawHalftoneDots(ctx, rightX + 18, 24, rightW - 36, H - 120, 'rgba(0,0,0,0.22)', 16, 2.5);

    if (kicker) {
      ctx.fillStyle = '#facc15';
      ctx.font = `700 36px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, rightCenterX, 192);
    }

    // Glowing gold horizontal line
    const lineGrad = ctx.createLinearGradient(rightX + 24, 0, W - 24, 0);
    lineGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
    lineGrad.addColorStop(0.25, 'rgba(245, 158, 11, 0.92)');
    lineGrad.addColorStop(0.75, 'rgba(245, 158, 11, 0.92)');
    lineGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(rightX + 24, 228, rightW - 48, 3);

    if (ctaText) {
      ctx.fillStyle = '#facc15';
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, rightCenterX, H - 122);
    }

    // Crimson bottom strip
    ctx.fillStyle = '#a60707';
    ctx.fillRect(0, H - 74, W, 74);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, 42, H - 37, 'left', '#ffffff', 24, true);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W - 42, H - 37);

    return {
      x: rightX + (rightW - 330) / 2,
      y: 34,
      maxWidth: 330,
      maxHeight: 100,
      align: 'center',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 16,
      padY: 8,
    };
  } else if (template.styleType === 'tv-independent') {
    const seamY = pBox.y + pBox.height;

    // Warm golden background + photo
    const goldBg = ctx.createLinearGradient(0, 0, W, seamY);
    goldBg.addColorStop(0, '#f7b844');
    goldBg.addColorStop(1, '#e59420');
    ctx.fillStyle = goldBg;
    ctx.fillRect(0, 0, W, seamY);
    renderChromePhoto();

    // Lower deep navy box
    ctx.fillStyle = '#081632';
    ctx.fillRect(0, seamY, W, H - 74 - seamY);

    // Subtle navy emblem ring in center
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.arc(W / 2, seamY + 250, 175, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Crimson divider line at seam
    ctx.fillStyle = '#c40f2a';
    ctx.fillRect(0, seamY - 3, W, 7);

    // Centered red CTA bar straddling seam
    if (ctaText) {
      ctx.save();
      ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const bw = Math.max(300, Math.min(640, tw + 130));
      const bh = 54;
      const bx = (W - bw) / 2;
      const by = seamY - bh / 2;

      ctx.fillStyle = '#b90e1c';
      drawRoundedRect(ctx, bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      // Right white arrow square inside pill
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + bw - 54, by + 4, 46, bh - 8);
      ctx.fillStyle = '#b90e1c';
      ctx.beginPath();
      ctx.moveTo(bx + bw - 37, by + 16);
      ctx.lineTo(bx + bw - 22, by + bh / 2);
      ctx.lineTo(bx + bw - 37, by + bh - 16);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, bx + (bw - 50) / 2, seamY + 2);
      ctx.restore();
    }

    if (kicker) {
      ctx.fillStyle = '#facc15';
      ctx.font = `600 22px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W - 44, seamY + 42);
    }

    // Crimson footer bar
    ctx.fillStyle = '#c40f2a';
    ctx.fillRect(0, H - 74, W, 74);

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 34, H - 37);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 25px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, W - 34, H - 37);
    }

    return {
      x: 850,
      y: 30,
      maxWidth: 296,
      maxHeight: 96,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'tv-rtv') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    // Royal blue lower panel
    const blueGrad = ctx.createLinearGradient(0, seamY, 0, H);
    blueGrad.addColorStop(0, '#04368e');
    blueGrad.addColorStop(1, '#011748');
    ctx.fillStyle = blueGrad;
    ctx.fillRect(0, seamY, W, H - seamY);

    drawHalftoneDots(ctx, 24, seamY + 24, W - 48, H - seamY - 120, 'rgba(255,255,255,0.06)', 20, 2.2);

    // Crimson divider band + centered rounded date pill
    ctx.fillStyle = '#990f1e';
    ctx.fillRect(0, seamY - 5, W, 10);

    const pillW = 316;
    const pillH = 48;
    const pillX = (W - pillW) / 2;
    const pillY = seamY - pillH / 2;
    ctx.fillStyle = '#7f0b18';
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 14);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W / 2, seamY + 1);

    // Bottom row: website URL left + gold CTA center
    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, 54, H - 72, 'left', '#ffffff', 26, true);
    }

    if (ctaText) {
      const bw = 320;
      const bh = 46;
      const bx = (W - bw) / 2;
      const by = H - 72 - bh / 2;
      ctx.fillStyle = '#000c29';
      drawRoundedRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();

      const borderGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      borderGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
      borderGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.85)');
      borderGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = borderGrad;
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillRect(bx, by + bh - 2, bw, 2);

      ctx.fillStyle = '#facc15';
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 71);
    }

    return {
      x: 40,
      y: 32,
      maxWidth: 260,
      maxHeight: 90,
      align: 'left',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'tv-desh') {
    const emeraldGrad = ctx.createLinearGradient(0, 0, 0, H);
    emeraldGrad.addColorStop(0, '#063b28');
    emeraldGrad.addColorStop(0.55, '#042519');
    emeraldGrad.addColorStop(1, '#260409');
    ctx.fillStyle = emeraldGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Bangladesh red sun brushstroke accent top-left
    ctx.save();
    const sunGrad = ctx.createRadialGradient(132, 136, 12, 132, 136, 76);
    sunGrad.addColorStop(0, 'rgba(220, 38, 38, 0.92)');
    sunGrad.addColorStop(0.68, 'rgba(220, 38, 38, 0.72)');
    sunGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(132, 136, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawHalftoneDots(ctx, W * 0.45, 40, W * 0.52, 460, 'rgba(255,255,255,0.08)', 20, 2.2);

    // Lower blended photo
    renderChromePhoto();

    // Top smooth fade from emerald into photo
    const topFade = ctx.createLinearGradient(0, pBox.y - 10, 0, pBox.y + 260);
    topFade.addColorStop(0, 'rgba(6, 59, 40, 1)');
    topFade.addColorStop(0.45, 'rgba(4, 37, 25, 0.72)');
    topFade.addColorStop(1, 'rgba(4, 37, 25, 0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, pBox.y - 10, W, 270);

    // Bottom deep crimson vignette
    const botFade = ctx.createLinearGradient(0, H * 0.65, 0, H);
    botFade.addColorStop(0, 'rgba(80, 0, 8, 0)');
    botFade.addColorStop(0.55, 'rgba(92, 0, 10, 0.78)');
    botFade.addColorStop(1, 'rgba(72, 0, 8, 0.96)');
    ctx.fillStyle = botFade;
    ctx.fillRect(0, H * 0.65, W, H * 0.35);

    if (kicker) {
      ctx.fillStyle = '#facc15';
      ctx.font = `700 34px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W / 2, 650);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 28px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W / 2, H - 156);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.fillRect(W / 2 - 240, H - 106, 480, 2);

    if (ctaText) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
      ctx.font = `600 24px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 62);
    }

    return {
      x: 845,
      y: 36,
      maxWidth: 305,
      maxHeight: 92,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'portal-ntv') {
    ctx.fillStyle = '#f2ecde';
    ctx.fillRect(0, 0, W, H);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.fillStyle = '#4b5563';
      ctx.font = `700 26px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, W - 32, 38);
    }

    renderChromePhoto();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = '#374151';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 34, H - 46);

    if (ctaText) {
      ctx.fillStyle = '#374151';
      ctx.font = `600 24px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`*${ctaText}`, W - 34, H - 46);
    }

    return {
      x: 42,
      y: 36,
      maxWidth: 230,
      maxHeight: 88,
      align: 'left',
      surfaceIsDark: false,
      pillRadius: 12,
      padX: 12,
      padY: 6,
    };
  } else if (template.styleType === 'tv-ekhon') {
    renderChromePhoto();

    const emScrim = ctx.createLinearGradient(0, H * 0.34, 0, H);
    emScrim.addColorStop(0, 'rgba(3, 46, 36, 0)');
    emScrim.addColorStop(0.38, 'rgba(3, 46, 36, 0.86)');
    emScrim.addColorStop(0.72, 'rgba(2, 34, 27, 0.96)');
    emScrim.addColorStop(1, '#011913');
    ctx.fillStyle = emScrim;
    ctx.fillRect(0, H * 0.34, W, H * 0.66);

    if (kicker) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 34px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W / 2, 650);
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 38, H - 56);

    if (ctaText) {
      ctx.fillStyle = '#e5e7eb';
      ctx.font = `600 24px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W - 38, H - 56);
    }

    return {
      x: 845,
      y: 34,
      maxWidth: 305,
      maxHeight: 92,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'tv-somoy') {
    ctx.fillStyle = '#f1f2f4';
    ctx.fillRect(0, 0, W, H);

    renderChromePhoto();

    // Smooth fade from photo into light textured gray paper
    const paperFade = ctx.createLinearGradient(0, 440, 0, 810);
    paperFade.addColorStop(0, 'rgba(241, 242, 244, 0)');
    paperFade.addColorStop(0.55, 'rgba(241, 242, 244, 0.78)');
    paperFade.addColorStop(1, '#f1f2f4');
    ctx.fillStyle = paperFade;
    ctx.fillRect(0, 440, W, 380);

    // Subtle halftone map texture + grid in lower half
    drawHalftoneDots(ctx, 40, 740, W - 80, H - 780, 'rgba(15, 23, 42, 0.055)', 18, 2.3);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 760);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Crisp outer 4px crimson border
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);

    if (kicker) {
      ctx.fillStyle = '#1f2937';
      ctx.font = `700 34px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W / 2, 816);
    }

    // Thin centered red line below brand logo
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(W / 2 - 170, H - 122, 340, 2.5);

    ctx.fillStyle = '#111827';
    ctx.font = `600 26px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const somoyFooter = ctaText ? `${dateStr}  ।  ${ctaText}` : dateStr;
    ctx.fillText(somoyFooter, W / 2, H - 70);

    return {
      x: W / 2 - 180,
      y: H - 246,
      maxWidth: 360,
      maxHeight: 92,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 12,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'paper-prothom-alo-1') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    ctx.fillStyle = '#faf7ee';
    ctx.fillRect(0, seamY, W, H - seamY);

    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(0, H - 135, W, 135);

    if (hasActiveLogo) {
      // Centered semicircular upward notch for logo emblem
      ctx.beginPath();
      ctx.arc(W / 2, seamY, 96, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = '#faf7ee';
      ctx.fill();
    }

    if (kicker) {
      ctx.fillStyle = '#374151';
      ctx.font = `600 34px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W / 2, seamY + 152);
    }

    if (ctaText) {
      ctx.fillStyle = '#1f2937';
      ctx.font = `500 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 220);
    }

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, W / 2, H - 68, 'center', '#374151', 28, true);
    }

    return {
      x: W / 2 - 130,
      y: seamY - 62,
      maxWidth: 260,
      maxHeight: 96,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 16,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'paper-prothom-alo-2') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    // Subtle bottom dark vignette on photo for caption legibility
    const photoVignette = ctx.createLinearGradient(0, seamY - 150, 0, seamY);
    photoVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    photoVignette.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
    ctx.fillStyle = photoVignette;
    ctx.fillRect(0, seamY - 150, W, 150);

    if (kicker) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `500 24px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 48, seamY - 42);
    }

    ctx.fillStyle = '#f1f3f5';
    ctx.fillRect(0, seamY, W, H - 96 - seamY);

    if (hasActiveLogo) {
      // Centered semicircular upward notch for logo emblem
      ctx.beginPath();
      ctx.arc(W / 2, seamY, 96, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = '#f1f3f5';
      ctx.fill();
    }

    // Footer gray bar
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, H - 96, W, 96);

    ctx.fillStyle = '#374151';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 54, H - 48);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, W - 54, H - 48, 'right', '#374151', 26, true);
    }

    return {
      x: W / 2 - 130,
      y: seamY - 62,
      maxWidth: 260,
      maxHeight: 96,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 16,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'portal-jagonews') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, seamY, W, H - seamY);

    // Centered indigo capsule overlapping seam
    const pillText = kicker ? `${kicker}  |  ${dateStr}` : dateStr;
    ctx.save();
    ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    const pillTextW = ctx.measureText(pillText).width;
    const pillW = Math.max(320, Math.min(720, pillTextW + 96));
    const pillH = 56;
    const pillX = (W - pillW) / 2;
    const pillY = seamY - pillH / 2;
    ctx.fillStyle = '#1d193a';
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, W / 2, seamY + 1);
    ctx.restore();

    // Short centered white rule
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(W / 2 - 56, H - 154, 112, 3);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, W / 2, H - 82, 'center', '#ffffff', 28, true);
    }

    return {
      x: 845,
      y: 34,
      maxWidth: 305,
      maxHeight: 78,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'paper-daily-star') {
    renderChromePhoto();

    const blackScrim = ctx.createLinearGradient(0, H * 0.45, 0, H);
    blackScrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    blackScrim.addColorStop(0.45, 'rgba(0, 0, 0, 0.72)');
    blackScrim.addColorStop(0.75, 'rgba(0, 0, 0, 0.94)');
    blackScrim.addColorStop(1, '#000000');
    ctx.fillStyle = blackScrim;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);

    if (kicker) {
      ctx.fillStyle = '#e5e7eb';
      ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 84, 836);
    }

    ctx.fillStyle = '#d1d5db';
    ctx.font = `500 25px 'Hind Siliguri', Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 84, H - 110);

    return {
      x: 815,
      y: H - 160,
      maxWidth: 300,
      maxHeight: 92,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'portal-bdnews24') {
    const topH = pBox.y;
    const seamY = pBox.y + pBox.height;

    // Top white strip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, topH);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.fillStyle = '#b91c1c';
      ctx.font = `700 32px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, 34, topH / 2 + 1);
    }

    ctx.fillStyle = '#111827';
    ctx.font = `700 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W - 34, topH / 2 + 1);

    renderChromePhoto();

    // Lower deep crimson square-grid background
    const redGridGrad = ctx.createLinearGradient(0, seamY, 0, H);
    redGridGrad.addColorStop(0, '#a81212');
    redGridGrad.addColorStop(1, '#7a0808');
    ctx.fillStyle = redGridGrad;
    ctx.fillRect(0, seamY, W, H - seamY);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= W; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, seamY);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = seamY; y <= H; y += 52) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (hasActiveLogo) {
      // Centered circular white emblem overlapping seam
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(W / 2, seamY, 68, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    return {
      x: W / 2 - 60,
      y: seamY - 50,
      maxWidth: 120,
      maxHeight: 100,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 60,
      padX: 8,
      padY: 6,
    };
  } else if (template.styleType === 'portal-dhakapost') {
    const tealGrad = ctx.createLinearGradient(0, 0, 0, H);
    tealGrad.addColorStop(0, '#0b364d');
    tealGrad.addColorStop(0.65, '#072233');
    tealGrad.addColorStop(1, '#05121a');
    ctx.fillStyle = tealGrad;
    ctx.fillRect(0, 0, W, H);

    // Top-left orange date
    ctx.fillStyle = '#f59e0b';
    ctx.font = `700 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 42, 48);

    // Rounded photo cutout with crisp white border
    ctx.save();
    drawRoundedRect(ctx, pBox.x, pBox.y, pBox.width, pBox.height, 24);
    ctx.clip();
    renderChromePhoto();
    ctx.restore();

    drawRoundedRect(ctx, pBox.x, pBox.y, pBox.width, pBox.height, 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Bottom horizontal white line + optional center white CTA pill
    const lineY = H - 62;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, lineY, W, 2);

    if (ctaText) {
      ctx.save();
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const pw = Math.max(240, Math.min(520, tw + 72));
      const ph = 50;
      const px = (W - pw) / 2;
      const py = lineY - ph / 2;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, px, py, pw, ph, 25);
      ctx.fill();

      ctx.fillStyle = '#092c3e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, lineY + 1);
      ctx.restore();
    }

    return {
      x: 840,
      y: 16,
      maxWidth: 318,
      maxHeight: 68,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 12,
      padX: 12,
      padY: 6,
    };
  } else if (template.styleType === 'paper-kalerkantho') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    // Lower obsidian-navy background fading up into photo
    const navyFade = ctx.createLinearGradient(0, seamY - 260, 0, seamY + 40);
    navyFade.addColorStop(0, 'rgba(8, 19, 38, 0)');
    navyFade.addColorStop(0.75, 'rgba(8, 19, 38, 0.94)');
    navyFade.addColorStop(1, '#081326');
    ctx.fillStyle = navyFade;
    ctx.fillRect(0, seamY - 260, W, 300);

    ctx.fillStyle = '#081326';
    ctx.fillRect(0, seamY, W, H - seamY);

    // Top-left frosted dark-gray date ribbon
    const ribbonGrad = ctx.createLinearGradient(0, 60, 390, 60);
    ribbonGrad.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
    ribbonGrad.addColorStop(0.8, 'rgba(15, 23, 42, 0.42)');
    ribbonGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = ribbonGrad;
    ctx.fillRect(0, 60, 390, 50);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(0, 60, 360, 1.5);
    ctx.fillRect(0, 108.5, 360, 1.5);

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 44, 85);

    // Centered slanted sky-blue parallelogram banner (only if kicker is set)
    if (kicker) {
      ctx.save();
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(kicker).width;
      const bw = Math.max(280, Math.min(620, tw + 110));
      const bh = 62;
      const skew = 26;
      const cx = W / 2;
      const cy = seamY - 10;

      // Outer slanted accent lines
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 - 28, cy + bh / 2 + 8);
      ctx.lineTo(cx - bw / 2 + skew - 20, cy - bh / 2 - 8);
      ctx.moveTo(cx + bw / 2 - skew + 20, cy + bh / 2 + 8);
      ctx.lineTo(cx + bw / 2 + 28, cy - bh / 2 - 8);
      ctx.stroke();

      // Main parallelogram
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 + skew, cy - bh / 2);
      ctx.lineTo(cx + bw / 2 + skew, cy - bh / 2);
      ctx.lineTo(cx + bw / 2 - skew, cy + bh / 2);
      ctx.lineTo(cx - bw / 2 - skew, cy + bh / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, cx, cy + 2);
      ctx.restore();
    }

    // Bottom row: CTA left + Globe URL right
    if (ctaText) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 25px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`•  ${ctaText}`, 56, H - 82);
    }

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      drawWebsiteWithGlobe(ctx, webUrl, W - 56, H - 82, 'right', '#e2e8f0', 26, true);
    }

    return {
      x: 860,
      y: 38,
      maxWidth: 290,
      maxHeight: 92,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'paper-jugantor') {
    const seamY = pBox.y + pBox.height;

    // Top crimson header bar
    ctx.fillStyle = '#780000';
    ctx.fillRect(0, 0, W, pBox.y);

    renderChromePhoto();

    // Crisp 4px white divider line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, seamY, W, 4);

    // Lower deep crimson gradient
    const jugGrad = ctx.createLinearGradient(0, seamY + 4, 0, H);
    jugGrad.addColorStop(0, '#910303');
    jugGrad.addColorStop(1, '#680000');
    ctx.fillStyle = jugGrad;
    ctx.fillRect(0, seamY + 4, W, H - (seamY + 4));

    // Centered crisp white date
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = `600 26px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W / 2, seamY + 52);

    // Bottom row: website URL left + CTA right
    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 28px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, 48, H - 56);
    }

    if (ctaText) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${ctaText} ...`, W - 48, H - 56);
    }

    return {
      x: W / 2 - 180,
      y: 16,
      maxWidth: 360,
      maxHeight: 76,
      align: 'center',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 16,
      padY: 8,
    };
  } else if (template.styleType === 'paper-ittefaq') {
    // Top solid deep maroon header
    const marGrad = ctx.createLinearGradient(0, 0, 0, pBox.y);
    marGrad.addColorStop(0, '#620000');
    marGrad.addColorStop(1, '#4c0000');
    ctx.fillStyle = marGrad;
    ctx.fillRect(0, 0, W, pBox.y);

    if (kicker) {
      ctx.fillStyle = '#facc15';
      ctx.font = `700 34px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W / 2, pBox.y - 54);
    }

    renderChromePhoto();

    // Bottom dark vignette for logo contrast
    const logoScrim = ctx.createLinearGradient(0, H - 220, 0, H);
    logoScrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    logoScrim.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = logoScrim;
    ctx.fillRect(0, H - 220, W, 220);

    return {
      x: 44,
      y: H - 125,
      maxWidth: 300,
      maxHeight: 86,
      align: 'left',
      surfaceIsDark: true,
      pillRadius: 14,
      padX: 14,
      padY: 8,
    };
  } else if (template.styleType === 'portal-sylhetvoice-blue') {
    const seamY = pBox.y + pBox.height;
    renderChromePhoto();

    // Smooth feathered blue gradient rising from lower panel over bottom of photo
    const blueBody = ctx.createLinearGradient(0, seamY - 170, 0, H);
    blueBody.addColorStop(0, 'rgba(84, 123, 200, 0)');
    blueBody.addColorStop(0.28, 'rgba(80, 119, 196, 0.94)');
    blueBody.addColorStop(0.42, '#5077c4');
    blueBody.addColorStop(1, '#3f64b3');
    ctx.fillStyle = blueBody;
    ctx.fillRect(0, seamY - 170, W, H - (seamY - 170));

    // Top-right slanted crimson ribbon (date by default, or customized kickerText)
    const ribbonLabel = kicker || dateStr;
    if (ribbonLabel) {
      ctx.save();
      ctx.font = `700 28px 'Hind Siliguri', 'Kalpurush', sans-serif`;
      const tw = ctx.measureText(ribbonLabel).width;
      const rw = Math.max(230, Math.min(440, tw + 92));
      const rh = 68;
      const ry = 60;
      const slant = 28;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#d11919';
      ctx.beginPath();
      ctx.moveTo(W - rw + slant, ry);
      ctx.lineTo(W, ry);
      ctx.lineTo(W, ry + rh);
      ctx.lineTo(W - rw, ry + rh);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 28px 'Hind Siliguri', 'Kalpurush', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ribbonLabel, W - (rw - slant / 2) / 2, ry + rh / 2 + 1);
    }

    // Thin bottom divider rule
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.fillRect(68, H - 118, W - 136, 2);

    if (ctaText) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, 68, H - 62);
    }

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.save();
      ctx.font = `600 28px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      const urlW = ctx.measureText(webUrl).width;
      const dotR = 9;
      const dotX = W - 68 - urlW - 22;
      ctx.beginPath();
      ctx.arc(dotX, H - 62, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, W - 68, H - 62);
      ctx.restore();
    }

    return {
      x: 0,
      y: 54,
      maxWidth: 332,
      maxHeight: 102,
      align: 'left',
      surfaceIsDark: false,
      pillRadius: 51,
      padX: 18,
      padY: 10,
    };
  } else if (template.styleType === 'portal-protidiner-cream') {
    // Warm cream canvas with soft blush layered side framing
    ctx.fillStyle = '#f4e5e6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fbf5ee';
    ctx.fillRect(0, 0, W, 650);
    ctx.fillRect(46, 650, W - 92, H - 692);

    // Top-left live Bengali date (or kicker)
    const topLeftLabel = kicker || dateStr;
    if (topLeftLabel) {
      ctx.fillStyle = '#111827';
      ctx.font = `600 29px 'Hind Siliguri', 'Kalpurush', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(topLeftLabel, 38, 56);
    }

    // Center framed photo with thin crimson border
    renderChromePhoto();
    ctx.strokeStyle = '#9f3b42';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    // Bottom rectangular crimson CTA bar
    if (ctaText) {
      const bw = 470;
      const bh = 64;
      const bx = (W - bw) / 2;
      const by = H - 108;
      ctx.fillStyle = '#a81321';
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, by + bh / 2 + 1);
    }

    return {
      x: 825,
      y: 16,
      maxWidth: 344,
      maxHeight: 88,
      align: 'right',
      surfaceIsDark: false,
      pillRadius: 12,
      padX: 10,
      padY: 6,
    };
  } else if (template.styleType === 'portal-sylhetvoice-dark') {
    renderChromePhoto();

    // Smooth dark bottom scrim
    const darkScrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
    darkScrim.addColorStop(0, 'rgba(8, 9, 12, 0)');
    darkScrim.addColorStop(0.45, 'rgba(8, 9, 12, 0.78)');
    darkScrim.addColorStop(0.75, 'rgba(7, 8, 10, 0.94)');
    darkScrim.addColorStop(1, '#060608');
    ctx.fillStyle = darkScrim;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    // Top-right slanted crimson category ribbon
    if (kicker) {
      ctx.save();
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(kicker).width;
      const rw = Math.max(210, Math.min(420, tw + 110));
      const rh = 68;
      const ry = 60;
      const slant = 28;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#d11919';
      ctx.beginPath();
      ctx.moveTo(W - rw + slant, ry);
      ctx.lineTo(W, ry);
      ctx.lineTo(W, ry + rh);
      ctx.lineTo(W - rw, ry + rh);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, W - (rw - slant / 2) / 2, ry + rh / 2 + 1);
    }

    // Subtle red dot + date row above horizontal divider
    ctx.save();
    ctx.beginPath();
    ctx.arc(76, H - 152, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#d11919';
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, 98, H - 152);
    ctx.restore();

    // Thin divider rule
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(68, H - 114, W - 136, 1.5);

    // Bottom footer row: CTA left, yellow dot + URL center-right
    const webUrl = template.websiteUrl?.trim() || '';
    if (ctaText && webUrl) {
      ctx.save();
      ctx.font = `600 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const ctaW = ctx.measureText(ctaText).width;
      ctx.font = `600 26px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      const urlW = ctx.measureText(webUrl).width;
      const totalW = ctaW + 52 + urlW;
      const startX = (W - totalW) / 2;

      ctx.fillStyle = '#d1d5db';
      ctx.font = `600 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, startX, H - 60);

      ctx.beginPath();
      ctx.arc(startX + ctaW + 26, H - 60, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 26px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.fillText(webUrl, startX + ctaW + 52, H - 60);
      ctx.restore();
    } else if (ctaText || webUrl) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText || webUrl, W / 2, H - 60);
    }

    return {
      x: 0,
      y: 62,
      maxWidth: 294,
      maxHeight: 112,
      align: 'left',
      surfaceIsDark: false,
      pillRadius: 56,
      padX: 16,
      padY: 10,
    };
  } else if (template.styleType === 'portal-protidiner-black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    if (kicker) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = `500 42px 'Kalpurush', 'Noto Serif Bengali', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 54, 72);
    }

    renderChromePhoto();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (ctaText) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 44px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, 54, H - 98);
      const ctaW = ctx.measureText(ctaText).width;
      ctx.fillRect(54, H - 68, ctaW + 12, 3);
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `500 30px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, W - 54, H - 56);

    return {
      x: 700,
      y: 36,
      maxWidth: 452,
      maxHeight: 72,
      align: 'right',
      surfaceIsDark: true,
      pillRadius: 12,
      padX: 12,
      padY: 6,
    };
  } else if (template.styleType === 'portal-protidiner-split') {
    const seamY = pBox.y + pBox.height;
    // Upper silver-grey panel + lower jet-black panel
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(0, 0, W, seamY);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, seamY, W, H - seamY);

    if (kicker) {
      ctx.fillStyle = '#111827';
      ctx.font = `700 24px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(kicker, 36, 46);
    }

    renderChromePhoto();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (ctaText) {
      ctx.save();
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const bw = Math.max(296, Math.min(540, tw + 78));
      const bh = 74;
      const bx = (W - bw) / 2;
      const by = H - 104;
      ctx.fillStyle = '#be1e2d';
      drawRoundedRect(ctx, bx, by, bw, bh, 22);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, by + bh / 2 + 2);
      ctx.restore();
    }

    return {
      x: W / 2 - 175,
      y: 22,
      maxWidth: 350,
      maxHeight: 102,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 12,
      padX: 12,
      padY: 6,
    };
  } else if (template.styleType === 'portal-emjanews') {
    const seamY = pBox.y + pBox.height;
    const footerH = 114;

    // White photo frame margin
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, seamY);

    renderChromePhoto();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    // Lower rich crimson gradient
    const redBody = ctx.createLinearGradient(0, seamY, 0, H - footerH);
    redBody.addColorStop(0, '#9e0000');
    redBody.addColorStop(0.55, '#850000');
    redBody.addColorStop(1, '#680000');
    ctx.fillStyle = redBody;
    ctx.fillRect(0, seamY, W, H - footerH - seamY);

    // Subtle halftone map texture
    drawHalftoneDots(ctx, 30, seamY + 20, W - 60, H - footerH - seamY - 40, 'rgba(0, 0, 0, 0.16)', 18, 2.5);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, pBox.x + 24, pBox.y + 24, 46, '#0e3c87', '#facc15', 6, 'left', 24);
    }

    // Navy CTA pill with crisp white border
    if (ctaText) {
      ctx.save();
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const bw = Math.max(264, Math.min(520, tw + 66));
      const bh = 54;
      const bx = (W - bw) / 2;
      const by = H - footerH - 72;
      ctx.fillStyle = '#0e3c87';
      drawRoundedRect(ctx, bx, by, bw, bh, 7);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, bx, by, bw, bh, 7);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, by + bh / 2 + 1);
      ctx.restore();
    }

    // Bottom crisp white strip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, H - footerH, W, footerH);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      ctx.fillStyle = '#8f1111';
      ctx.font = `700 38px Georgia, 'Plus Jakarta Sans', serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, W - 28, H - footerH / 2 + 2);
    }

    return {
      x: 20,
      y: H - footerH + 10,
      maxWidth: 292,
      maxHeight: 94,
      align: 'left',
      surfaceIsDark: false,
      pillRadius: 12,
      padX: 10,
      padY: 6,
    };
  } else if (template.styleType === 'portal-sylhetview') {
    const seamY = pBox.y + pBox.height;
    const footerH = 92;

    // White upper margin around photo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, seamY + 4);
    // Subtle crimson top-right sheen accent behind margin
    const topSheen = ctx.createLinearGradient(W * 0.65, 0, W, 140);
    topSheen.addColorStop(0, 'rgba(189, 22, 26, 0)');
    topSheen.addColorStop(1, 'rgba(189, 22, 26, 0.22)');
    ctx.fillStyle = topSheen;
    ctx.fillRect(W * 0.65, 0, W * 0.35, 160);

    renderChromePhoto();

    // Rich crimson gradient panel below photo
    const redPanel = ctx.createLinearGradient(0, seamY, 0, H - footerH);
    redPanel.addColorStop(0, '#c2171b');
    redPanel.addColorStop(1, '#98080c');
    ctx.fillStyle = redPanel;
    ctx.fillRect(0, seamY, W, H - footerH - seamY);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, pBox.x + 22, pBox.y + 22, 46, '#ffffff', '#b91c1c', 8, 'left', 24);
    }

    // Bottom white CTA pill + 3 white dots on left & right
    if (ctaText) {
      ctx.save();
      ctx.font = `700 38px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const bw = Math.max(460, Math.min(680, tw + 110));
      const bh = 74;
      const bx = (W - bw) / 2;
      const by = H - footerH - 96;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, bx, by, bw, bh, 18);
      ctx.fill();

      for (const dir of [-1, 1]) {
        for (let d = 1; d <= 3; d++) {
          ctx.beginPath();
          ctx.arc(W / 2 + dir * (bw / 2 + 24 + d * 48), by + bh / 2, 13, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }

      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, by + bh / 2 + 2);
      ctx.restore();
    }

    // Bottom crisp white strip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, H - footerH, W, footerH);

    const webUrl = template.websiteUrl?.trim() || '';
    if (webUrl) {
      const fy = H - footerH / 2 + 1;
      // Red triangle arrow + editable website URL
      ctx.save();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(298, fy - 11);
      ctx.lineTo(316, fy);
      ctx.lineTo(298, fy + 11);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.font = `600 28px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(webUrl, 322, fy);

      // Derive clean social handles from websiteUrl
      const cleanHost = webUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      const fbLabel = cleanHost === 'sylhetview24.news' ? 'Sylhetview24.com' : cleanHost;
      const ytLabel = cleanHost === 'sylhetview24.news' ? 'Sylhetview' : cleanHost.split('.')[0];

      // YouTube badge + label on far right
      ctx.font = `600 25px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      const ytW = ctx.measureText(ytLabel).width;
      const ytTextX = W - 26;
      const ytBoxX = ytTextX - ytW - 46;

      ctx.fillStyle = '#dc2626';
      drawRoundedRect(ctx, ytBoxX, fy - 18, 38, 36, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(ytBoxX + 14, fy - 7);
      ctx.lineTo(ytBoxX + 27, fy);
      ctx.lineTo(ytBoxX + 14, fy + 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.textAlign = 'right';
      ctx.fillText(ytLabel, ytTextX, fy);

      // Facebook badge + label to left of YouTube
      const fbTextX = ytBoxX - 18;
      const fbW = ctx.measureText(fbLabel).width;
      const fbBoxX = fbTextX - fbW - 44;

      ctx.fillStyle = '#1877f2';
      drawRoundedRect(ctx, fbBoxX, fy - 18, 36, 36, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 28px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('f', fbBoxX + 18, fy + 2);

      ctx.fillStyle = '#111827';
      ctx.font = `600 25px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(fbLabel, fbTextX, fy);
      ctx.restore();
    }

    return {
      x: 16,
      y: H - footerH + 6,
      maxWidth: 270,
      maxHeight: 80,
      align: 'left',
      surfaceIsDark: false,
      pillRadius: 10,
      padX: 6,
      padY: 4,
    };
  } else if (template.styleType === 'portal-sylhettoday') {
    const seamY = pBox.y + pBox.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    renderChromePhoto();

    // Smooth dark fade across seam into jet black lower panel
    const seamFade = ctx.createLinearGradient(0, seamY - 190, 0, seamY + 12);
    seamFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    seamFade.addColorStop(0.55, 'rgba(0, 0, 0, 0.72)');
    seamFade.addColorStop(1, '#000000');
    ctx.fillStyle = seamFade;
    ctx.fillRect(0, seamY - 190, W, 204);

    // Left white rectangular date tag (weekday | date)
    const leftDateLabel = chromeOpts?.hideDate
      ? ''
      : kicker ||
        (chromeOpts?.dateTextOverride !== undefined && chromeOpts.dateTextOverride.trim() !== ''
          ? chromeOpts.dateTextOverride.trim()
          : getBengaliWeekdayAndDateString());
    if (leftDateLabel) {
      ctx.save();
      ctx.font = `600 23px 'Hind Siliguri', 'Kalpurush', sans-serif`;
      const tw = ctx.measureText(leftDateLabel).width;
      const bw = Math.max(220, Math.min(340, tw + 46));
      const bh = 38;
      const by = seamY - 56;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, by, bw, bh);

      // Small blue left chevron arrow
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(0, by + 10);
      ctx.lineTo(14, by + 10);
      ctx.lineTo(24, by + bh / 2);
      ctx.lineTo(14, by + bh - 10);
      ctx.lineTo(0, by + bh - 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(leftDateLabel, 32, by + bh / 2 + 1);
      ctx.restore();
    }

    // Bottom-right blue arrow chevron + white CTA
    if (ctaText) {
      ctx.save();
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      const tw = ctx.measureText(ctaText).width;
      const rightX = W - 44;
      const cy = H - 56;
      const arrowX = rightX - tw - 48;

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(arrowX, cy - 8);
      ctx.lineTo(arrowX + 26, cy - 8);
      ctx.lineTo(arrowX + 36, cy);
      ctx.lineTo(arrowX + 26, cy + 8);
      ctx.lineTo(arrowX, cy + 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(arrowX + 20, cy - 8);
      ctx.lineTo(arrowX + 28, cy - 8);
      ctx.lineTo(arrowX + 38, cy);
      ctx.lineTo(arrowX + 28, cy + 8);
      ctx.lineTo(arrowX + 20, cy + 8);
      ctx.lineTo(arrowX + 30, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, rightX, cy);
      ctx.restore();
    }

    return {
      x: W / 2 - 205,
      y: seamY - 76,
      maxWidth: 410,
      maxHeight: 82,
      align: 'center',
      surfaceIsDark: false,
      pillRadius: 41,
      padX: 16,
      padY: 8,
    };
  } else {
    // modern-inset-card
    drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 28);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    renderChromePhoto();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (kicker) {
      drawDynamicBadge(ctx, kicker, pBox.x + 24, pBox.y + 24, 50, pal.badgeBg, pal.badgeText, 8, 'left', 26);
    }

    if (ctaText) {
      ctx.fillStyle = pal.footerBg;
      drawRoundedRect(ctx, W / 2 - 165, H - 110, 330, 56, 28);
      ctx.fill();
      ctx.fillStyle = pal.footerText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, W / 2, H - 82);
    }

    return {
      x: 832,
      y: H - 118,
      maxWidth: 304,
      maxHeight: 74,
      align: 'right',
      surfaceIsDark: needsLogoContrastBadge(pal.bgPrimary),
      pillRadius: 15,
      padX: 15,
      padY: 8,
    };
  }
}

function getPsdBrandLogoSlot(template: TemplateConfig): BrandLogoSlot {
  const W = template.canvasWidth;
  const H = template.canvasHeight;
  if (template.id === 'psd-green') {
    return {
      x: 1320,
      y: 1805,
      maxWidth: 590,
      maxHeight: 155,
      align: 'right',
      surfaceIsDark: false,
      pillRadius: 24,
      padX: 26,
      padY: 14,
    };
  }
  if (template.id === 'psd-maroon') {
    return {
      x: 375,
      y: 12,
      maxWidth: 330,
      maxHeight: 62,
      align: 'center',
      surfaceIsDark: true,
      pillRadius: 16,
      padX: 16,
      padY: 6,
    };
  }
  // Custom uploaded PNG frame
  return {
    x: Math.round(W * 0.69),
    y: Math.round(H * 0.89),
    maxWidth: Math.round(W * 0.25),
    maxHeight: Math.round(H * 0.08),
    align: 'right',
    surfaceIsDark: true,
    pillRadius: 16,
    padX: 14,
    padY: 8,
  };
}

function drawUnifiedBrandLogo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  slot: BrandLogoSlot,
  activeLogoImg: HTMLImageElement,
  logoSettings: LogoSettings
): RectBox {
  const userScale = Math.max(0.25, Math.min(2.0, (logoSettings.scale || 100) / 100));
  const shape: LogoShape = logoSettings.shape ?? 'original';

  let drawW: number;
  let drawH: number;

  if (shape === 'circle') {
    const circleSize = Math.min(slot.maxWidth, slot.maxHeight * 1.2) * userScale;
    drawW = circleSize;
    drawH = circleSize;
  } else {
    const fitScale = Math.min(
      slot.maxWidth / activeLogoImg.naturalWidth,
      slot.maxHeight / activeLogoImg.naturalHeight
    );
    drawW = activeLogoImg.naturalWidth * fitScale * userScale;
    drawH = activeLogoImg.naturalHeight * fitScale * userScale;
  }

  let anchorCenterX = slot.x + slot.maxWidth / 2;
  if (slot.align === 'left') {
    anchorCenterX = slot.x + drawW / 2;
  } else if (slot.align === 'right') {
    anchorCenterX = slot.x + slot.maxWidth - drawW / 2;
  }
  const anchorCenterY = slot.y + slot.maxHeight / 2;

  const logoCenterX = anchorCenterX + (logoSettings.x / 100) * (W * 0.45);
  const logoCenterY = anchorCenterY + (logoSettings.y / 100) * (H * 0.45);

  const lx = logoCenterX - drawW / 2;
  const ly = logoCenterY - drawH / 2;

  const badgeMode: LogoBadgeStyle = logoSettings.badgeStyle ?? 'none';
  const showBadge =
    badgeMode === 'white' ||
    badgeMode === 'frosted' ||
    (badgeMode === 'auto' && slot.surfaceIsDark);

  const padX =
    shape === 'circle'
      ? Math.max(5, Math.round(drawW * 0.08))
      : slot.padX ?? Math.max(10, Math.round(drawH * 0.22));
  const padY =
    shape === 'circle'
      ? padX
      : slot.padY ?? Math.max(6, Math.round(drawH * 0.14));
  const bx = lx - padX;
  const by = ly - padY;
  const bw = drawW + padX * 2;
  const bh = drawH + padY * 2;

  const resolveCornerRadius = (w: number, h: number): number => {
    if (shape === 'circle') return Math.max(w, h) / 2;
    if (shape === 'square') return 0;
    if (shape === 'rounded') return Math.round(Math.min(w, h) * 0.22);
    if (shape === 'pill') return Math.round(Math.min(w, h) / 2);
    return slot.pillRadius ?? Math.round(h / 2);
  };

  ctx.save();
  if (showBadge) {
    const badgeRadius = resolveCornerRadius(bw, bh);
    ctx.save();
    ctx.shadowColor =
      badgeMode === 'frosted'
        ? 'rgba(15, 23, 42, 0.16)'
        : 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = Math.max(8, Math.round(bh * 0.18));
    ctx.shadowOffsetY = Math.max(2, Math.round(bh * 0.04));
    if (badgeMode === 'frosted') {
      ctx.fillStyle = slot.surfaceIsDark
        ? 'rgba(255, 255, 255, 0.34)'
        : 'rgba(241, 245, 249, 0.72)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
    }
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, Math.max(bw, bh) / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    } else {
      drawRoundedRect(ctx, bx, by, bw, bh, badgeRadius);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle =
      badgeMode === 'frosted'
        ? slot.surfaceIsDark
          ? 'rgba(255, 255, 255, 0.65)'
          : 'rgba(148, 163, 184, 0.42)'
        : 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = Math.max(1.5, Math.round(bh * 0.025));
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, Math.max(bw, bh) / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
    } else {
      drawRoundedRect(ctx, bx, by, bw, bh, badgeRadius);
      ctx.stroke();
    }
  } else if (slot.surfaceIsDark) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = Math.max(4, Math.round(drawH * 0.12));
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (shape === 'original') {
    ctx.drawImage(activeLogoImg, lx, ly, drawW, drawH);
  } else {
    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, drawW / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Cover-fit square/circle logos cleanly, or contain-fit wide logos over crisp translucent backdrop
      const imgAspect = activeLogoImg.naturalWidth / Math.max(1, activeLogoImg.naturalHeight);
      if (imgAspect > 1.45 || imgAspect < 0.68) {
        if (!showBadge) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.fillRect(lx, ly, drawW, drawH);
        }
        const pad = drawW * 0.1;
        const inner = drawW - pad * 2;
        const s = Math.min(inner / activeLogoImg.naturalWidth, inner / activeLogoImg.naturalHeight);
        const iw = activeLogoImg.naturalWidth * s;
        const ih = activeLogoImg.naturalHeight * s;
        ctx.drawImage(activeLogoImg, logoCenterX - iw / 2, logoCenterY - ih / 2, iw, ih);
      } else {
        const s = Math.max(drawW / activeLogoImg.naturalWidth, drawH / activeLogoImg.naturalHeight);
        const iw = activeLogoImg.naturalWidth * s;
        const ih = activeLogoImg.naturalHeight * s;
        ctx.drawImage(activeLogoImg, logoCenterX - iw / 2, logoCenterY - ih / 2, iw, ih);
      }
    } else {
      const clipRadius = resolveCornerRadius(drawW, drawH);
      drawRoundedRect(ctx, lx, ly, drawW, drawH, clipRadius);
      ctx.clip();
      ctx.drawImage(activeLogoImg, lx, ly, drawW, drawH);
    }
    ctx.restore();
  }

  ctx.restore();

  return showBadge
    ? { x: bx, y: by, width: bw, height: bh }
    : { x: lx, y: ly, width: drawW, height: drawH };
}

function isBuiltInPortalLogoTemplate(styleType: ProceduralStyleType): boolean {
  return (
    styleType === 'portal-sylhetvoice-blue' ||
    styleType === 'portal-protidiner-cream' ||
    styleType === 'portal-sylhetvoice-dark' ||
    styleType === 'portal-protidiner-black' ||
    styleType === 'portal-protidiner-split' ||
    styleType === 'portal-emjanews' ||
    styleType === 'portal-sylhetview' ||
    styleType === 'portal-sylhettoday'
  );
}

function drawVerifiedBlueCheck(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1d9bf0';
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.04);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
  ctx.lineTo(cx + r * 0.45, cy - r * 0.32);
  ctx.stroke();
  ctx.restore();
}

function drawPortalDefaultLogo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  slot: BrandLogoSlot,
  styleType: ProceduralStyleType,
  logoSettings: LogoSettings
): RectBox {
  const userScale = Math.max(0.25, Math.min(2.0, (logoSettings.scale || 100) / 100));
  const shape: LogoShape = logoSettings.shape ?? 'original';

  let drawW = slot.maxWidth * userScale;
  let drawH = slot.maxHeight * userScale;
  if (shape === 'circle') {
    const circleSize = Math.min(slot.maxWidth, slot.maxHeight * 1.45) * userScale;
    drawW = circleSize;
    drawH = circleSize;
  }

  let anchorCenterX = slot.x + slot.maxWidth / 2;
  if (slot.align === 'left') {
    anchorCenterX = slot.x + drawW / 2;
  } else if (slot.align === 'right') {
    anchorCenterX = slot.x + slot.maxWidth - drawW / 2;
  }
  const anchorCenterY = slot.y + slot.maxHeight / 2;

  const logoCenterX = anchorCenterX + (logoSettings.x / 100) * (W * 0.45);
  const logoCenterY = anchorCenterY + (logoSettings.y / 100) * (H * 0.45);
  const lx = logoCenterX - drawW / 2;
  const ly = logoCenterY - drawH / 2;

  const badgeMode: LogoBadgeStyle = logoSettings.badgeStyle ?? 'none';
  const showBadge =
    badgeMode === 'white' ||
    badgeMode === 'frosted' ||
    (badgeMode === 'auto' && slot.surfaceIsDark);

  ctx.save();

  // Optional shape/badge background clip or backdrop
  if (showBadge || shape !== 'original') {
    const radius =
      shape === 'circle'
        ? Math.max(drawW, drawH) / 2
        : shape === 'square'
          ? 0
          : shape === 'rounded'
            ? Math.round(Math.min(drawW, drawH) * 0.22)
            : Math.round(Math.min(drawW, drawH) / 2);

    if (showBadge) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
      ctx.shadowBlur = 10;
      ctx.fillStyle =
        badgeMode === 'frosted'
          ? slot.surfaceIsDark
            ? 'rgba(255, 255, 255, 0.34)'
            : 'rgba(241, 245, 249, 0.85)'
          : 'rgba(255, 255, 255, 0.97)';
      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, drawW / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawRoundedRect(ctx, lx, ly, drawW, drawH, radius);
        ctx.fill();
      }
      ctx.restore();
    }

    if (shape !== 'original') {
      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, drawW / 2, 0, Math.PI * 2);
        ctx.clip();
      } else {
        drawRoundedRect(ctx, lx, ly, drawW, drawH, radius);
        ctx.clip();
      }
    }
  }

  // Canonical design space mapping -> scales cleanly with userScale
  const sx = drawW / slot.maxWidth;
  const sy = drawH / slot.maxHeight;
  const u = Math.min(sx, sy);

  if (styleType === 'portal-sylhetvoice-blue' || styleType === 'portal-sylhetvoice-dark') {
    // Crisp white pill (left-flush when at default x=0 & original shape)
    const isFlushLeft = shape === 'original' && Math.abs(logoSettings.x) < 4 && !showBadge;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 12 * u;
    ctx.shadowOffsetY = 4 * u;
    ctx.fillStyle = '#ffffff';
    if (isFlushLeft) {
      const r = drawH / 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + drawW - r, ly);
      ctx.arc(lx + drawW - r, ly + r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(lx, ly + drawH);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'original' && !showBadge) {
      drawRoundedRect(ctx, lx, ly, drawW, drawH, drawH / 2);
      ctx.fill();
    }
    ctx.restore();

    // SylhetVOICE typography
    const sFont = 34 * u;
    const vFont = 58 * u;
    const oFont = 44 * u;

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${sFont.toFixed(1)}px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
    const wSyl = ctx.measureText('Sylhet').width;
    ctx.font = `800 ${vFont.toFixed(1)}px Georgia, serif`;
    const wV = ctx.measureText('V').width;
    ctx.font = `800 ${oFont.toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    const wOice = ctx.measureText('OICE').width;

    const totalTextW = wSyl + wV * 0.9 + wOice;
    const startX = logoCenterX - totalTextW / 2 - 4 * u;
    const baseLineY = logoCenterY + 15 * u;

    ctx.fillStyle = '#25539e';
    ctx.font = `700 ${sFont.toFixed(1)}px 'Plus Jakarta Sans', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('Sylhet', startX, baseLineY);

    ctx.fillStyle = '#2a3648';
    ctx.font = `800 ${vFont.toFixed(1)}px Georgia, serif`;
    ctx.fillText('V', startX + wSyl - 2 * u, baseLineY + 2 * u);

    ctx.font = `800 ${oFont.toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('OICE', startX + wSyl + wV * 0.86, baseLineY);
    ctx.restore();
  } else if (styleType === 'portal-protidiner-cream' || styleType === 'portal-protidiner-split') {
    const showTick = styleType === 'portal-protidiner-cream';
    const mainFont = 38 * u;
    const tagFont = 13.5 * u;
    const tickR = showTick ? 15 * u : 0;

    ctx.save();
    ctx.font = `700 ${mainFont.toFixed(1)}px 'Hind Siliguri', 'Kalpurush', sans-serif`;
    const wLeft = ctx.measureText('প্রতিদিনের').width;
    const wRight = ctx.measureText('সিলেট').width;
    const gap = 2 * u;
    const totalW = wLeft + gap + wRight + (showTick ? tickR * 2 + 10 * u : 0);

    const startX =
      slot.align === 'right'
        ? lx + drawW - totalW
        : logoCenterX - totalW / 2;
    const mainY = logoCenterY - 4 * u;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0d9448';
    ctx.fillText('প্রতিদিনের', startX, mainY);

    ctx.fillStyle = '#dc2626';
    ctx.fillText('সিলেট', startX + wLeft + gap, mainY);

    if (showTick) {
      drawVerifiedBlueCheck(
        ctx,
        startX + wLeft + gap + wRight + 10 * u + tickR,
        mainY - 1 * u,
        tickR
      );
    }

    ctx.fillStyle = '#dc2626';
    ctx.font = `500 ${tagFont.toFixed(1)}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('খবরের সাথে সবসময়...', startX + wLeft + gap + wRight, mainY + 24 * u);
    ctx.restore();
  } else if (styleType === 'portal-protidiner-black') {
    const mainFont = 36 * u;
    const tickR = 14 * u;

    ctx.save();
    ctx.font = `700 ${mainFont.toFixed(1)}px Georgia, 'Noto Serif Bengali', serif`;
    const wText = ctx.measureText('Protidiner Sylhet').width;
    const totalW = wText + 12 * u + tickR * 2;
    const startX = lx + drawW - totalW;

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Protidiner Sylhet', startX, logoCenterY);
    drawVerifiedBlueCheck(ctx, startX + wText + 10 * u + tickR, logoCenterY - 1 * u, tickR);
    ctx.restore();
  } else if (styleType === 'portal-emjanews') {
    ctx.save();
    const globeR = 30 * u;
    const globeX = lx + 86 * u;
    const globeY = logoCenterY - 18 * u;

    ctx.strokeStyle = 'rgba(14, 60, 135, 0.34)';
    ctx.lineWidth = Math.max(1.2, 1.8 * u);
    ctx.beginPath();
    ctx.arc(globeX, globeY, globeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(globeX, globeY, globeR * 0.48, globeR, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(globeX - globeR, globeY);
    ctx.lineTo(globeX + globeR, globeY);
    ctx.moveTo(globeX - globeR * 0.85, globeY - globeR * 0.45);
    ctx.lineTo(globeX + globeR * 0.85, globeY - globeR * 0.45);
    ctx.stroke();

    const emjaFont = 40 * u;
    ctx.font = `800 ${emjaFont.toFixed(1)}px Georgia, 'Plus Jakarta Sans', serif`;
    const wEmja = ctx.measureText('EMJA ').width;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0a357a';
    ctx.fillText('EMJA', lx + 6 * u, logoCenterY + 6 * u);

    ctx.fillStyle = '#1d70e8';
    ctx.font = `italic 800 ${(emjaFont * 0.96).toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('NEWS', lx + 6 * u + wEmja * 0.92, logoCenterY + 6 * u);

    ctx.fillStyle = '#1e293b';
    ctx.font = `600 ${(13.5 * u).toFixed(1)}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.fillText('ঘটনা • ইতিহাস • সংলাপ', lx + 6 * u, logoCenterY + 34 * u);
    ctx.restore();
  } else if (styleType === 'portal-sylhetview') {
    ctx.save();
    // Vertical crimson 24.com strip on right side
    const stripW = 24 * u;
    const stripX = lx + drawW - stripW - 4 * u;
    const stripY = ly + 6 * u;
    const stripH = drawH - 12 * u;

    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(stripX, stripY, stripW, stripH);

    ctx.save();
    ctx.translate(stripX + stripW / 2, stripY + stripH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${(17 * u).toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('24.com', 0, 1 * u);
    ctx.restore();

    // Top tagline + cartoon arch eyes dome
    ctx.fillStyle = '#111827';
    ctx.font = `600 ${(12 * u).toFixed(1)}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('সংবাদের সাথে সারাক্ষণ', lx + 42 * u, ly + 15 * u);

    // Cute dome eyes mark
    const domeX = lx + 206 * u;
    const domeY = ly + 22 * u;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(1.4, 2 * u);
    ctx.beginPath();
    ctx.arc(domeX, domeY, 22 * u, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(domeX - 8 * u, domeY - 4 * u, 5 * u, 0, Math.PI * 2);
    ctx.arc(domeX + 8 * u, domeY - 4 * u, 5 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(domeX - 8 * u, domeY - 4 * u, 2 * u, 0, Math.PI * 2);
    ctx.arc(domeX + 8 * u, domeY - 4 * u, 2 * u, 0, Math.PI * 2);
    ctx.fill();

    // Red rounded square icon + bold "sylhetview"
    const iconSize = 26 * u;
    const iconY = ly + 36 * u;
    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, lx + 4 * u, iconY, iconSize, iconSize, 5 * u);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, 2 * u);
    ctx.beginPath();
    ctx.arc(lx + 4 * u + iconSize / 2, iconY + iconSize / 2, iconSize * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = `800 ${(35 * u).toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('sylhetview', lx + 38 * u, iconY + iconSize / 2 + 2 * u);

    ctx.fillStyle = '#4b5563';
    ctx.font = `500 ${(9.5 * u).toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('Govt. Reg No. 122', stripX - 6 * u, ly + drawH - 10 * u);
    ctx.restore();
  } else if (styleType === 'portal-sylhettoday') {
    // Glowing soft white radial oval pill
    if (!showBadge) {
      ctx.save();
      const glow = ctx.createRadialGradient(
        logoCenterX,
        logoCenterY,
        drawW * 0.12,
        logoCenterX,
        logoCenterY,
        drawW * 0.56
      );
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.99)');
      glow.addColorStop(0.65, 'rgba(255, 255, 255, 0.94)');
      glow.addColorStop(0.88, 'rgba(255, 255, 255, 0.45)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(logoCenterX, logoCenterY, drawW * 0.56, drawH * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    const cR = 20 * u;
    const textFont = 27 * u;
    ctx.font = `700 ${textFont.toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    const wSyl = ctx.measureText('sylhettoday').width;
    const w24 = ctx.measureText('24').width;
    const totalW = cR * 2 + 10 * u + wSyl + w24;
    const startX = logoCenterX - totalW / 2;
    const cy = logoCenterY - 5 * u;

    // Sky-blue circle + white "st"
    ctx.beginPath();
    ctx.arc(startX + cR, cy, cR, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${(20 * u).toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('st', startX + cR, cy + 1 * u);

    // "sylhettoday24"
    const tx = startX + cR * 2 + 10 * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = `700 ${textFont.toFixed(1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('sylhettoday', tx, cy);

    ctx.fillStyle = '#0284c7';
    ctx.fillText('24', tx + wSyl, cy);

    // Subtitle underneath
    ctx.fillStyle = '#334155';
    ctx.font = `500 ${(10.5 * u).toFixed(1)}px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('সংবাদ • মতামত • বিশ্লেষণ', tx + (wSyl + w24) / 2, cy + 22 * u);
    ctx.restore();
  }

  ctx.restore();
  return { x: lx, y: ly, width: drawW, height: drawH };
}

function drawExtraImageLayer(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  item: ExtraImageLayer,
  imgEl: HTMLImageElement | undefined,
  layerOpacityFactor: number,
  isActive: boolean,
  isExport: boolean
): RectBox {
  const aspect = Math.max(0.1, item.aspectRatio || (imgEl && imgEl.naturalHeight > 0 ? imgEl.naturalWidth / imgEl.naturalHeight : 1));
  const drawW = Math.max(24, (Math.max(8, Math.min(150, item.widthPercent)) / 100) * W);
  const drawH = Math.max(24, drawW / aspect);
  const cx = Math.max(0.02, Math.min(0.98, item.x)) * W;
  const cy = Math.max(0.02, Math.min(0.98, item.y)) * H;
  const x = cx - drawW / 2;
  const y = cy - drawH / 2;

  const totalAlpha = Math.max(0, Math.min(1, ((item.opacity ?? 100) / 100) * layerOpacityFactor));
  if (totalAlpha <= 0) {
    return { x, y, width: drawW, height: drawH };
  }

  const radiusRatio = Math.max(0, Math.min(50, item.borderRadius ?? 0)) / 50;
  const radius = (Math.min(drawW, drawH) / 2) * radiusRatio;

  ctx.save();
  ctx.globalAlpha = totalAlpha;
  ctx.translate(cx, cy);
  if (item.rotation) {
    ctx.rotate((item.rotation * Math.PI) / 180);
  }

  if (item.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.36)';
    ctx.shadowBlur = Math.max(8, W * 0.018);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(3, W * 0.006);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    drawRoundedRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  drawRoundedRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, radius);
  ctx.clip();

  if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isExport ? 'high' : 'medium';
    ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
  }
  ctx.restore();

  if ((item.borderWidth ?? 0) > 0) {
    const bw = Math.max(1, item.borderWidth * (W / 1080));
    ctx.strokeStyle = item.borderColor || '#ffffff';
    ctx.lineWidth = bw;
    drawRoundedRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, radius);
    ctx.stroke();
  }

  if (!isExport && isActive) {
    ctx.strokeStyle = '#faab3f';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
    ctx.setLineDash([Math.round(W * 0.01), Math.round(W * 0.007)]);
    const pad = Math.max(4, Math.round(W * 0.004));
    drawRoundedRect(
      ctx,
      -drawW / 2 - pad,
      -drawH / 2 - pad,
      drawW + pad * 2,
      drawH + pad * 2,
      radius + pad
    );
    ctx.stroke();
  }

  ctx.restore();

  return { x, y, width: drawW, height: drawH };
}

export function renderNewsCard(opts: RenderCardOptions): RenderedLayoutMetrics {
  const {
    ctx,
    template,
    overlayImg,
    photoImg,
    logoImg,
    officialLogoImg,
    headline,
    highlights,
    lineMode,
    fontSizePercent,
    lineGapPercent,
    font,
    textOffsetX,
    textOffsetY,
    textShadow,
    textColor,
    highlightColor,
    photoZoom,
    photoPanX,
    photoPanY,
    logoSettings,
    subheading,
    customTexts = [],
    activeCustomTextId,
    extraImages = [],
    extraImageEls = {},
    activeExtraImageId,
    layerOrder,
    layerVisibility,
    layerOpacity,
    dateTextOverride,
    isExport = false,
    snapState,
  } = opts;

  const W = template.canvasWidth;
  const H = template.canvasHeight;

  ctx.clearRect(0, 0, W, H);

  const isLayerVisible = (id: string) => layerVisibility?.[id] !== false;
  const getLayerOpacity = (id: string) =>
    Math.max(0, Math.min(100, layerOpacity?.[id] ?? 100)) / 100;

  const resolvedOrder = normalizeLayerOrder(
    layerOrder,
    template.styleType,
    customTexts,
    extraImages
  );

  const customTextMap = new Map<string, CustomTextItem>();
  for (const item of customTexts) customTextMap.set(item.id, item);

  const extraImageMap = new Map<string, ExtraImageLayer>();
  for (const img of extraImages) extraImageMap.set(img.id, img);

  const hasCustomLogo = Boolean(logoSettings.dataUrl && logoImg && logoImg.naturalWidth > 0);
  const logoLayerVisible = isLayerVisible('logo');
  const logoLayerOpacity = getLayerOpacity('logo');
  const effectiveHideDefaultBrand = logoSettings.hideDefaultBrand || !logoLayerVisible;
  const hasLogoIntent = logoLayerVisible && (hasCustomLogo || !logoSettings.hideDefaultBrand);

  let brandSlot: BrandLogoSlot = getPsdBrandLogoSlot(template);
  let psdOverlayDrawsBakedLogo = false;
  let chromeDrewPhoto = false;

  const frameIdx = resolvedOrder.indexOf('frame');
  const photoIdx = resolvedOrder.indexOf('photo');
  const canProceduralChromeDrawPhotoInline =
    template.styleType !== 'psd-overlay' &&
    isLayerVisible('frame') &&
    isLayerVisible('photo') &&
    getLayerOpacity('frame') === 1 &&
    getLayerOpacity('photo') === 1 &&
    photoIdx === frameIdx + 1;

  // Precompute headline layout so headline and subheading work in any Z-order
  const hb = template.headlineBox;
  const trimmedHeadline = headline.trim();
  const centerX = hb.centerX + textOffsetX * W;
  const centerY = hb.centerY + textOffsetY * H;
  const isLeftAligned = template.headlineAlign === 'left';
  const leftAnchorX = hb.centerX - hb.maxWidth / 2 + textOffsetX * W;

  let textHitBox: RectBox = {
    x: hb.centerX - hb.maxWidth * 0.4,
    y: hb.centerY - hb.maxHeight * 0.35,
    width: hb.maxWidth * 0.8,
    height: hb.maxHeight * 0.7,
  };
  let renderedHeadlineBottomY = centerY + hb.maxHeight * 0.25;
  const renderedHeadlineLeftX = leftAnchorX;

  let computedHeadlineLines: WordToken[][] = [];
  let computedRenderFontSize = hb.baseFontSize;
  let computedLineHeight = hb.baseFontSize * 1.3;
  let computedSpaceWidth = 8;
  const headlineFontWeight = font.weight ?? 600;
  const setHeadlineFont = (sizePx: number) => {
    ctx.font = `${headlineFontWeight} ${sizePx.toFixed(1)}px ${font.family}`;
  };

  if (trimmedHeadline.length > 0 && isLayerVisible('headline')) {
    const mask = buildHighlightMask(headline, highlights);
    const lineGapScale = Math.max(0.5, lineGapPercent / 100);
    const baseLineRatio = 1.3;

    let fittedSize = lineMode === 'one' ? hb.singleLineFontSize : hb.baseFontSize;
    let finalLines: WordToken[][] = [];

    if (lineMode === 'one') {
      const singleTokens = tokenizeLineIntoWords(headline.replace(/\r?\n/g, ' '), 0, mask);
      setHeadlineFont(fittedSize);
      const spaceW = ctx.measureText(' ').width;
      const rawWidth = measureWordListWidth(ctx, singleTokens, spaceW);
      if (rawWidth > hb.maxWidth && rawWidth > 0) {
        fittedSize = Math.max(16, fittedSize * (hb.maxWidth / rawWidth) * 0.98);
      }
      finalLines = [singleTokens];
    } else if (lineMode === 'two') {
      const allWords = tokenizeLineIntoWords(headline.replace(/\r?\n/g, ' '), 0, mask);
      for (let attempt = 0; attempt < 36; attempt++) {
        setHeadlineFont(fittedSize);
        const spaceW = ctx.measureText(' ').width;
        const twoLines = splitIntoTwoBalancedLines(ctx, allWords, spaceW);
        const maxLineW = Math.max(
          ...twoLines.map((ln) => measureWordListWidth(ctx, ln, spaceW)),
          0
        );
        const totalH = twoLines.length * fittedSize * baseLineRatio * lineGapScale;
        if (maxLineW <= hb.maxWidth && totalH <= hb.maxHeight) {
          finalLines = twoLines;
          break;
        }
        const scaleW = maxLineW > hb.maxWidth ? hb.maxWidth / maxLineW : 1;
        const scaleH = totalH > hb.maxHeight ? hb.maxHeight / totalH : 1;
        const nextFactor = Math.min(scaleW, scaleH, 0.95);
        fittedSize = Math.max(16, fittedSize * nextFactor);
        finalLines = twoLines;
        if (fittedSize <= 16) break;
      }
    } else {
      const paragraphs = headline.split(/\r?\n/);
      const minAutoFontSize = Math.max(18, hb.baseFontSize * 0.44);

      for (let size = hb.baseFontSize; size >= minAutoFontSize; size -= hb.baseFontSize * 0.035) {
        fittedSize = size;
        setHeadlineFont(fittedSize);
        const spaceW = ctx.measureText(' ').width;

        const candidateLines: WordToken[][] = [];
        let charCursor = 0;
        let widestWord = 0;

        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
          const pText = paragraphs[pIdx];
          const pWords = tokenizeLineIntoWords(pText, charCursor, mask);
          for (const w of pWords) {
            widestWord = Math.max(widestWord, ctx.measureText(w.raw).width);
          }
          const wrapped = wrapWordsSmart(ctx, pWords, hb.maxWidth, spaceW);
          candidateLines.push(...wrapped);
          charCursor += pText.length + 1;
        }

        const totalH = candidateLines.length * fittedSize * baseLineRatio * lineGapScale;
        const maxAllowedLines = paragraphs.length > 1 ? Math.max(4, paragraphs.length + 1) : 3;

        finalLines = candidateLines;
        if (
          widestWord <= hb.maxWidth &&
          totalH <= hb.maxHeight &&
          candidateLines.length <= maxAllowedLines
        ) {
          break;
        }
      }
    }

    computedRenderFontSize = Math.max(12, fittedSize * (fontSizePercent / 100));
    setHeadlineFont(computedRenderFontSize);
    computedSpaceWidth = ctx.measureText(' ').width;
    computedLineHeight = computedRenderFontSize * baseLineRatio * lineGapScale;

    if (lineMode === 'auto' && Math.abs(fontSizePercent - 100) >= 6) {
      const paragraphs = headline.split(/\r?\n/);
      const rewrapped: WordToken[][] = [];
      let charCursor = 0;
      for (const pText of paragraphs) {
        const pWords = tokenizeLineIntoWords(pText, charCursor, mask);
        rewrapped.push(...wrapWordsSmart(ctx, pWords, hb.maxWidth, computedSpaceWidth));
        charCursor += pText.length + 1;
      }
      if (rewrapped.length > 0) {
        finalLines = rewrapped;
      }
    }

    computedHeadlineLines = finalLines;
    const numLines = computedHeadlineLines.length;
    const blockHeight = numLines * computedLineHeight;
    let maxRenderedLineW = 0;
    for (const words of computedHeadlineLines) {
      maxRenderedLineW = Math.max(
        maxRenderedLineW,
        measureWordListWidth(ctx, words, computedSpaceWidth)
      );
    }

    const padX = Math.max(24, computedRenderFontSize * 0.35);
    const padY = Math.max(18, computedRenderFontSize * 0.25);
    textHitBox = {
      x: isLeftAligned ? leftAnchorX - padX : centerX - maxRenderedLineW / 2 - padX,
      y: centerY - blockHeight / 2 - padY,
      width: Math.max(120, maxRenderedLineW + padX * 2),
      height: Math.max(60, blockHeight + padY * 2),
    };
    renderedHeadlineBottomY = centerY + blockHeight / 2;
  }

  let logoHitBox: RectBox | null = null;
  let subheadingHitBox: RectBox | null = null;
  const customTextHitBoxes: Array<{ id: string; box: RectBox }> = [];
  const extraImageHitBoxes: Array<{ id: string; box: RectBox }> = [];

  for (const layerId of resolvedOrder) {
    if (!isLayerVisible(layerId)) continue;
    const alpha = getLayerOpacity(layerId);
    if (alpha <= 0) continue;

    if (layerId === 'frame') {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (template.styleType === 'psd-overlay') {
        brandSlot = getPsdBrandLogoSlot(template);
        if (overlayImg && overlayImg.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          if (template.overlaySourceCrop) {
            const c = template.overlaySourceCrop;
            ctx.drawImage(overlayImg, c.x, c.y, c.width, c.height, 0, 0, W, H);
          } else {
            ctx.drawImage(overlayImg, 0, 0, W, H);
          }
          if (template.id === 'psd-green' || template.id === 'psd-maroon') {
            psdOverlayDrawsBakedLogo = true;
          }
        } else {
          renderPsdTemplateArtwork(
            ctx,
            template.id,
            W,
            H,
            template.photoBox,
            effectiveHideDefaultBrand,
            hasLogoIntent
          );
        }

        const badgeMode: LogoBadgeStyle = logoSettings.badgeStyle ?? 'none';
        const hasLogoTransform =
          logoSettings.scale !== 100 ||
          logoSettings.x !== 0 ||
          logoSettings.y !== 0 ||
          (logoSettings.shape ?? 'original') !== 'original' ||
          logoLayerOpacity < 1 ||
          resolvedOrder.indexOf('logo') < resolvedOrder.indexOf('frame');
        const needsBadgeOverPsd =
          badgeMode === 'white' ||
          badgeMode === 'frosted' ||
          (badgeMode === 'auto' && brandSlot.surfaceIsDark);

        if (effectiveHideDefaultBrand) {
          if (template.id === 'psd-maroon') {
            if (psdOverlayDrawsBakedLogo) {
              const movedOutOfNotch = Math.abs(logoSettings.x) > 10 || Math.abs(logoSettings.y) > 8;
              maskMaroonBakedLogoRegion(ctx, !hasCustomLogo || movedOutOfNotch || !logoLayerVisible);
              psdOverlayDrawsBakedLogo = false;
            }
          } else if (template.defaultBrandMask) {
            for (const r of template.defaultBrandMask.rects) {
              ctx.fillStyle = r.fill;
              ctx.fillRect(r.x, r.y, r.width, r.height);
            }
            psdOverlayDrawsBakedLogo = false;
          }
        } else if (
          psdOverlayDrawsBakedLogo &&
          (hasCustomLogo || hasLogoTransform || needsBadgeOverPsd)
        ) {
          if (template.id === 'psd-green') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(1290, 1790, 650, 195);
            psdOverlayDrawsBakedLogo = false;
          } else if (template.id === 'psd-maroon') {
            const movedOutOfNotch = Math.abs(logoSettings.x) > 10 || Math.abs(logoSettings.y) > 8;
            maskMaroonBakedLogoRegion(ctx, movedOutOfNotch);
            psdOverlayDrawsBakedLogo = false;
          }
        }

        ctx.strokeStyle = template.id === 'psd-green' ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = template.id === 'psd-green' ? 4 : 3;
        ctx.strokeRect(
          template.photoBox.x,
          template.photoBox.y,
          template.photoBox.width,
          template.photoBox.height
        );
      } else {
        chromeDrewPhoto = canProceduralChromeDrawPhotoInline;
        brandSlot = renderProceduralTemplateChrome(
          ctx,
          template,
          photoImg,
          photoZoom,
          photoPanX,
          photoPanY,
          hasLogoIntent,
          isExport,
          {
            dateTextOverride,
            hideDate: !isLayerVisible('date-badge'),
            hideFooter: !isLayerVisible('footer'),
            skipPhotoDraw: !canProceduralChromeDrawPhotoInline,
          }
        );
      }
      ctx.restore();
    } else if (layerId === 'photo') {
      if (!chromeDrewPhoto) {
        ctx.save();
        ctx.globalAlpha = alpha;
        drawPhotoIntoBox(
          ctx,
          photoImg,
          template.photoBox,
          0,
          photoZoom,
          photoPanX,
          photoPanY,
          isExport
        );
        ctx.restore();
      }
    } else if (layerId === 'date-badge') {
      // Procedural templates render date/kicker inside chrome; PSD overlay templates draw kicker/date badge here
      if (template.styleType === 'psd-overlay') {
        const badgeLabel =
          (template.kickerText && template.kickerText.trim()) ||
          (dateTextOverride && dateTextOverride.trim()) ||
          '';
        if (badgeLabel) {
          ctx.save();
          ctx.globalAlpha = alpha;
          const badgeFontSize = Math.round(W * 0.024);
          const badgeH = Math.round(W * 0.044);
          const badgeBg =
            template.palette?.badgeBg || (template.id === 'psd-green' ? '#ece304' : '#f7cf46');
          const badgeFg = template.palette?.badgeText || '#111827';
          drawDynamicBadge(
            ctx,
            badgeLabel,
            template.photoBox.x + Math.round(W * 0.022),
            template.photoBox.y + Math.round(W * 0.022),
            badgeH,
            badgeBg,
            badgeFg,
            Math.round(badgeH / 2),
            'left',
            badgeFontSize
          );
          ctx.restore();
        }
      }
    } else if (layerId === 'footer') {
      // Handled inside renderProceduralTemplateChrome respecting hideFooter & template overrides
    } else if (layerId === 'headline') {
      if (!isExport && snapState?.isDragging && (snapState.snappedX || snapState.snappedY)) {
        ctx.save();
        ctx.strokeStyle = '#faab3f';
        ctx.lineWidth = Math.max(2, Math.round(W * 0.002));
        ctx.setLineDash([Math.round(W * 0.008), Math.round(W * 0.006)]);

        if (snapState.snappedX) {
          ctx.beginPath();
          ctx.moveTo(hb.centerX, Math.max(0, hb.centerY - hb.maxHeight * 0.65));
          ctx.lineTo(hb.centerX, Math.min(H, hb.centerY + hb.maxHeight * 0.65));
          ctx.stroke();
        }
        if (snapState.snappedY) {
          ctx.beginPath();
          ctx.moveTo(Math.max(0, hb.centerX - hb.maxWidth * 0.52), hb.centerY);
          ctx.lineTo(Math.min(W, hb.centerX + hb.maxWidth * 0.52), hb.centerY);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (trimmedHeadline.length > 0 && computedHeadlineLines.length > 0) {
        ctx.save();
        ctx.globalAlpha = alpha;
        setHeadlineFont(computedRenderFontSize);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        if (textShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
          ctx.shadowBlur = Math.max(4, computedRenderFontSize * 0.14);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.max(2, computedRenderFontSize * 0.05);
        }

        const numLines = computedHeadlineLines.length;
        const firstLineCenterY = centerY - ((numLines - 1) * computedLineHeight) / 2;

        for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
          const words = computedHeadlineLines[lineIdx];
          const lineW = measureWordListWidth(ctx, words, computedSpaceWidth);
          let cursorX = isLeftAligned ? leftAnchorX : centerX - lineW / 2;
          const lineY = firstLineCenterY + lineIdx * computedLineHeight;

          for (let wIdx = 0; wIdx < words.length; wIdx++) {
            const word = words[wIdx];
            for (const seg of word.segments) {
              ctx.fillStyle = seg.highlighted ? highlightColor : textColor;
              ctx.fillText(seg.text, cursorX, lineY);
              cursorX += ctx.measureText(seg.text).width;
            }
            if (wIdx < words.length - 1) {
              cursorX += computedSpaceWidth;
            }
          }
        }
        ctx.restore();
      }
    } else if (layerId === 'subheading') {
      const trimmedSubheading = subheading?.text?.trim() || '';
      if (trimmedSubheading.length > 0 && subheading) {
        const subScale = Math.max(0.6, Math.min(1.8, (subheading.fontSizePercent || 100) / 100));
        const subFontSize = Math.max(14, Math.round(hb.baseFontSize * 0.44 * subScale));
        const subLineHeight = subFontSize * 1.32;
        const subMaxW = hb.maxWidth * 0.94;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `500 ${subFontSize}px ${font.family}`;
        const subLines: string[] = [];
        for (const para of trimmedSubheading.split(/\r?\n/)) {
          const words = para.trim().split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            subLines.push('');
            continue;
          }
          let curr = words[0];
          for (let i = 1; i < words.length; i++) {
            const test = `${curr} ${words[i]}`;
            if (ctx.measureText(test).width <= subMaxW) {
              curr = test;
            } else {
              subLines.push(curr);
              curr = words[i];
            }
          }
          subLines.push(curr);
        }

        const subBlockH = subLines.length * subLineHeight;
        const baseSubY =
          (trimmedHeadline.length > 0 && isLayerVisible('headline')
            ? renderedHeadlineBottomY + subFontSize * 0.72
            : centerY) +
          subheading.offsetY * H;
        const baseSubX =
          (isLeftAligned ? renderedHeadlineLeftX : centerX) + subheading.offsetX * W;

        if (textShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = Math.max(3, subFontSize * 0.14);
          ctx.shadowOffsetY = Math.max(1, subFontSize * 0.05);
        }
        ctx.fillStyle = subheading.color?.trim() ? subheading.color : textColor;
        ctx.textAlign = isLeftAligned ? 'left' : 'center';
        ctx.textBaseline = 'middle';

        let maxSubLineW = 0;
        const startLineY = baseSubY - ((subLines.length - 1) * subLineHeight) / 2;
        for (let i = 0; i < subLines.length; i++) {
          const line = subLines[i];
          maxSubLineW = Math.max(maxSubLineW, ctx.measureText(line).width);
          ctx.fillText(line, baseSubX, startLineY + i * subLineHeight);
        }
        ctx.restore();

        const subPadX = Math.max(20, subFontSize * 0.45);
        const subPadY = Math.max(14, subFontSize * 0.35);
        subheadingHitBox = {
          x: (isLeftAligned ? baseSubX : baseSubX - maxSubLineW / 2) - subPadX,
          y: baseSubY - subBlockH / 2 - subPadY,
          width: Math.max(90, maxSubLineW + subPadX * 2),
          height: Math.max(40, subBlockH + subPadY * 2),
        };
      }
    } else if (layerId === 'logo') {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (psdOverlayDrawsBakedLogo && !logoSettings.hideDefaultBrand) {
        logoHitBox = {
          x: brandSlot.x,
          y: brandSlot.y,
          width: brandSlot.maxWidth,
          height: brandSlot.maxHeight,
        };
      } else if (hasCustomLogo && logoImg) {
        logoHitBox = drawUnifiedBrandLogo(ctx, W, H, brandSlot, logoImg, logoSettings);
      } else if (!logoSettings.hideDefaultBrand && isBuiltInPortalLogoTemplate(template.styleType)) {
        logoHitBox = drawPortalDefaultLogo(ctx, W, H, brandSlot, template.styleType, logoSettings);
      } else if (!logoSettings.hideDefaultBrand && officialLogoImg && officialLogoImg.naturalWidth > 0) {
        logoHitBox = drawUnifiedBrandLogo(ctx, W, H, brandSlot, officialLogoImg, logoSettings);
      }
      ctx.restore();
    } else if (layerId.startsWith('text:')) {
      const txtId = layerId.slice(5);
      const item = customTextMap.get(txtId);
      if (item && item.text.trim()) {
        const scaleFactor = W / 1080;
        const pxFontSize = Math.max(12, Math.round((item.fontSize || 34) * scaleFactor));
        const lines = item.text.trim().split(/\r?\n/);
        const lineH = pxFontSize * 1.28;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `700 ${pxFontSize}px ${font.family}`;
        let maxLineW = 0;
        for (const ln of lines) {
          maxLineW = Math.max(maxLineW, ctx.measureText(ln).width);
        }

        const cx = Math.max(0.03, Math.min(0.97, item.x)) * W;
        const cy = Math.max(0.03, Math.min(0.97, item.y)) * H;
        const padX = item.bgColor
          ? Math.max(12, Math.round(pxFontSize * 0.45))
          : Math.max(10, Math.round(pxFontSize * 0.25));
        const padY = item.bgColor
          ? Math.max(7, Math.round(pxFontSize * 0.24))
          : Math.max(8, Math.round(pxFontSize * 0.2));
        const boxW = Math.max(36, maxLineW + padX * 2);
        const boxH = Math.max(24, lines.length * lineH + padY * 2);
        const bx = cx - boxW / 2;
        const by = cy - boxH / 2;

        if (item.bgColor) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
          ctx.shadowBlur = Math.max(6, Math.round(pxFontSize * 0.22));
          ctx.fillStyle = item.bgColor;
          drawRoundedRect(ctx, bx, by, boxW, boxH, Math.max(8, Math.round(pxFontSize * 0.3)));
          ctx.fill();
          ctx.restore();
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
          ctx.shadowBlur = Math.max(5, Math.round(pxFontSize * 0.22));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.max(2, Math.round(pxFontSize * 0.07));
        }

        ctx.fillStyle = item.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const firstY = cy - ((lines.length - 1) * lineH) / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], cx, firstY + i * lineH);
        }

        if (!isExport && activeCustomTextId === item.id) {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#faab3f';
          ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
          ctx.setLineDash([Math.round(W * 0.01), Math.round(W * 0.007)]);
          drawRoundedRect(
            ctx,
            bx - 4 * scaleFactor,
            by - 4 * scaleFactor,
            boxW + 8 * scaleFactor,
            boxH + 8 * scaleFactor,
            Math.max(8, Math.round(pxFontSize * 0.3))
          );
          ctx.stroke();
        }
        ctx.restore();

        customTextHitBoxes.push({
          id: item.id,
          box: { x: bx, y: by, width: boxW, height: boxH },
        });
      }
    } else if (layerId.startsWith('image:')) {
      const imgId = layerId.slice(6);
      const item = extraImageMap.get(imgId);
      if (item) {
        const box = drawExtraImageLayer(
          ctx,
          W,
          H,
          item,
          extraImageEls[item.id],
          alpha,
          activeExtraImageId === item.id,
          isExport
        );
        extraImageHitBoxes.push({ id: item.id, box });
      }
    }
  }

  return {
    canvasWidth: W,
    canvasHeight: H,
    textHitBox,
    photoHitBox: template.photoBox,
    logoHitBox,
    subheadingHitBox,
    customTextHitBoxes,
    extraImageHitBoxes,
  };
}

