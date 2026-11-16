import type {
  BrandLogoSlot,
  FontOption,
  HighlightRange,
  LineMode,
  LogoBadgeStyle,
  LogoSettings,
  RectBox,
  RenderedLayoutMetrics,
  TemplateConfig,
} from '../types/card';

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

// Pixel-perfect procedural rendering of Green & Maroon fallback frames
function renderPsdTemplateArtwork(
  ctx: CanvasRenderingContext2D,
  templateId: string,
  W: number,
  H: number,
  pBox: RectBox,
  hideDefaultBrand: boolean
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

    // Outer white/cream frame with opening at the top for logo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;

    // Top horizontal segments
    ctx.beginPath();
    ctx.moveTo(54, 66);
    ctx.lineTo(365, 66);
    ctx.moveTo(715, 66);
    ctx.lineTo(1026, 66);

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

function renderProceduralTemplateChrome(
  ctx: CanvasRenderingContext2D,
  template: TemplateConfig,
  photoImg: HTMLImageElement | null,
  zoom: number,
  panX: number,
  panY: number,
  hideDefaultBrand: boolean,
  isExport: boolean
): BrandLogoSlot {
  const W = template.canvasWidth;
  const H = template.canvasHeight;
  const pal = template.palette!;
  const pBox = template.photoBox;

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, pal.bgPrimary);
  bgGrad.addColorStop(1, pal.bgSecondary);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const dateStr = getBengaliDateString();
  const kicker = template.kickerText !== undefined ? template.kickerText.trim() : '';
  const ctaText =
    template.footerCtaText !== undefined ? template.footerCtaText.trim() : 'বিস্তারিত কমেন্টে';

  if (template.styleType === 'top-band-white-footer') {
    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, pBox.y + pBox.height - 60, W, H - (pBox.y + pBox.height - 60));

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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
    const leftMeta =
      !hideDefaultBrand && kicker ? `${kicker}  •  ${dateStr}` : dateStr;
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
    // Top frame segments with centered opening for the brand logo
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(36, 42);
    ctx.lineTo(W / 2 - 190, 42);
    ctx.moveTo(W / 2 + 190, 42);
    ctx.lineTo(W - 36, 42);
    ctx.moveTo(36, 42);
    ctx.lineTo(36, H - 42);
    ctx.moveTo(W - 36, 42);
    ctx.lineTo(W - 36, H - 42);
    ctx.moveTo(36, H - 42);
    ctx.lineTo(W - 36, H - 42);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pBox.x - 8, pBox.y - 8, pBox.width + 16, pBox.height + 16);
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);

    if (!hideDefaultBrand && kicker) {
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
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);

    const scrim = ctx.createLinearGradient(0, H * 0.36, 0, H - 85);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(0.45, 'rgba(9,13,22,0.72)');
    scrim.addColorStop(1, pal.bgPrimary);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.36, W, H - H * 0.36);

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, 48, 44, 56, pal.badgeBg, pal.badgeText, 8, 'left', 28);
    }

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 90, W, 90);
    const footerLine = ctaText
      ? hideDefaultBrand
        ? ctaText
        : `${dateStr}  •  ${ctaText}`
      : hideDefaultBrand
        ? ''
        : dateStr;
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, 52, 20, 52, pal.badgeBg, pal.badgeText, 6, 'left', 27);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 78, W, 78);
    const footerLine = ctaText
      ? hideDefaultBrand
        ? ctaText
        : `${dateStr}  •  ${ctaText}`
      : hideDefaultBrand
        ? ''
        : dateStr;
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

    if (!hideDefaultBrand) {
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
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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
    // Rounded border with subtle top opening for brand logo
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 40, 40, W - 80, H - 80, 20);
    ctx.stroke();

    // Clear top border segment behind centered logo slot
    ctx.fillStyle = pal.bgPrimary;
    ctx.fillRect(W / 2 - 188, 22, 376, 36);

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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
      !hideDefaultBrand && kicker && ctaText
        ? `${kicker}  •  ${ctaText}`
        : !hideDefaultBrand && kicker
          ? kicker
          : ctaText;
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, W / 2, 34, 46, pal.badgeBg, pal.badgeText, 23, 'center', 25);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 108, W, 108);
    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.footerText;
      ctx.globalAlpha = 0.78;
      ctx.font = `600 22px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(dateStr, 54, H - 54);
      ctx.globalAlpha = 1;
    }
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, 56, 22, 52, pal.badgeBg, pal.badgeText, 6, 'left', 28);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(pBox.x, pBox.y + pBox.height - 8, 180, 8);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 84, W, 84);
    const footerLine = ctaText
      ? hideDefaultBrand
        ? ctaText
        : `${dateStr}  •  ${ctaText}`
      : hideDefaultBrand
        ? ''
        : dateStr;
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, `▶  ${kicker}`, 52, 20, 52, pal.badgeBg, pal.badgeText, 26, 'left', 26);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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
    const footerLine = ctaText
      ? hideDefaultBrand
        ? ctaText
        : `${dateStr}  •  ${ctaText}`
      : hideDefaultBrand
        ? ''
        : dateStr;
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

    if (!hideDefaultBrand && kicker) {
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
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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

    if (!hideDefaultBrand) {
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
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.restore();

    drawRoundedRect(ctx, pBox.x, pBox.y, pBox.width, pBox.height, 18);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    if (!hideDefaultBrand && kicker) {
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, W / 2, 16, 56, pal.badgeBg, pal.badgeText, 28, 'center', 28);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(W / 2 - 110, pBox.y + pBox.height - 6, 220, 12);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(32, H - 112, W - 64, 80);
    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.footerText;
      ctx.globalAlpha = 0.78;
      ctx.font = `600 21px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(dateStr, 64, H - 72);
      ctx.globalAlpha = 1;
    }
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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, 56, 20, 52, pal.badgeBg, pal.badgeText, 10, 'left', 27);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
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

    if (!hideDefaultBrand) {
      ctx.fillStyle = template.defaultTextColor || '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.font = `600 24px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(dateStr, W - 56, H - 68);
      ctx.globalAlpha = 1;
    }

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

    if (!hideDefaultBrand && kicker) {
      drawDynamicBadge(ctx, kicker, 58, 30, 50, pal.badgeBg, pal.badgeText, 8, 'left', 26);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);

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
    const footerLine = ctaText
      ? hideDefaultBrand
        ? ctaText
        : `${dateStr}  •  ${ctaText}`
      : hideDefaultBrand
        ? ''
        : dateStr;
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
  } else {
    // modern-inset-card
    drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 28);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (!hideDefaultBrand && kicker) {
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
  const fitScale = Math.min(
    slot.maxWidth / activeLogoImg.naturalWidth,
    slot.maxHeight / activeLogoImg.naturalHeight
  );
  const baseW = activeLogoImg.naturalWidth * fitScale;
  const baseH = activeLogoImg.naturalHeight * fitScale;
  const userScale = Math.max(0.25, Math.min(2.0, (logoSettings.scale || 100) / 100));
  const drawW = baseW * userScale;
  const drawH = baseH * userScale;

  let anchorCenterX = slot.x + slot.maxWidth / 2;
  if (slot.align === 'left') {
    anchorCenterX = slot.x + drawW / 2;
  } else if (slot.align === 'right') {
    anchorCenterX = slot.x + slot.maxWidth - drawW / 2;
  }
  const anchorCenterY = slot.y + slot.maxHeight / 2;

  const logoCenterX = anchorCenterX + (logoSettings.x / 100) * (W * 0.42);
  const logoCenterY = anchorCenterY + (logoSettings.y / 100) * (H * 0.42);

  const lx = logoCenterX - drawW / 2;
  const ly = logoCenterY - drawH / 2;

  const badgeMode: LogoBadgeStyle = logoSettings.badgeStyle ?? 'none';
  const showBadge =
    badgeMode === 'white' ||
    badgeMode === 'frosted' ||
    (badgeMode === 'auto' && slot.surfaceIsDark);

  const padX = slot.padX ?? Math.max(10, Math.round(drawH * 0.22));
  const padY = slot.padY ?? Math.max(6, Math.round(drawH * 0.14));
  const bx = lx - padX;
  const by = ly - padY;
  const bw = drawW + padX * 2;
  const bh = drawH + padY * 2;

  ctx.save();
  if (showBadge) {
    const radius = slot.pillRadius ?? Math.round(bh / 2);
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
    drawRoundedRect(ctx, bx, by, bw, bh, radius);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle =
      badgeMode === 'frosted'
        ? slot.surfaceIsDark
          ? 'rgba(255, 255, 255, 0.65)'
          : 'rgba(148, 163, 184, 0.42)'
        : 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = Math.max(1.5, Math.round(bh * 0.025));
    drawRoundedRect(ctx, bx, by, bw, bh, radius);
    ctx.stroke();
  } else if (slot.surfaceIsDark) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = Math.max(4, Math.round(drawH * 0.12));
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(activeLogoImg, lx, ly, drawW, drawH);
  ctx.restore();

  return showBadge
    ? { x: bx, y: by, width: bw, height: bh }
    : { x: lx, y: ly, width: drawW, height: drawH };
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
    isExport = false,
    snapState,
  } = opts;

  const W = template.canvasWidth;
  const H = template.canvasHeight;

  ctx.clearRect(0, 0, W, H);

  let brandSlot: BrandLogoSlot;
  let psdOverlayDrawsBakedLogo = false;

  // 1. Render Photo + Template Artwork
  if (template.styleType === 'psd-overlay') {
    brandSlot = getPsdBrandLogoSlot(template);

    // LAYER 1 (Bottom Photo Layer): Draw the news photo inside the designated photo cutout
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

    // LAYER 2 (Top Frame Layer): Draw the template overlay PNG/SVG directly on top of the photo
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
        logoSettings.hideDefaultBrand
      );
    }

    // Crisp frame border around the photo window
    ctx.strokeStyle = template.id === 'psd-green' ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = template.id === 'psd-green' ? 4 : 3;
    ctx.strokeRect(template.photoBox.x, template.photoBox.y, template.photoBox.width, template.photoBox.height);

    const badgeMode: LogoBadgeStyle = logoSettings.badgeStyle ?? 'none';
    const hasCustomLogo = Boolean(logoSettings.dataUrl && logoImg && logoImg.naturalWidth > 0);
    const hasLogoTransform =
      logoSettings.scale !== 100 ||
      logoSettings.x !== 0 ||
      logoSettings.y !== 0;
    const needsBadgeOverPsd =
      badgeMode === 'white' ||
      badgeMode === 'frosted' ||
      (badgeMode === 'auto' && brandSlot.surfaceIsDark);

    if (logoSettings.hideDefaultBrand && !hasCustomLogo && template.defaultBrandMask) {
      for (const r of template.defaultBrandMask.rects) {
        ctx.fillStyle = r.fill;
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    } else if (
      psdOverlayDrawsBakedLogo &&
      (hasCustomLogo || hasLogoTransform || needsBadgeOverPsd)
    ) {
      // Mask only the baked SVG logo region so our adjusted/badged/custom logo replaces it cleanly
      if (template.id === 'psd-green') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1290, 1790, 650, 195);
        psdOverlayDrawsBakedLogo = false;
      } else if (template.id === 'psd-maroon') {
        ctx.fillStyle = '#5a0b22';
        ctx.fillRect(366, 6, 348, 74);
        psdOverlayDrawsBakedLogo = false;
      }
    }

    // Optional category/kicker badge if user customized kickerText on a PSD overlay template
    if (template.kickerText && template.kickerText.trim()) {
      const badgeFontSize = Math.round(W * 0.024);
      const badgeH = Math.round(W * 0.044);
      const badgeBg = template.id === 'psd-green' ? '#ece304' : '#f7cf46';
      const badgeFg = '#111827';
      drawDynamicBadge(
        ctx,
        template.kickerText.trim(),
        template.photoBox.x + Math.round(W * 0.022),
        template.photoBox.y + Math.round(W * 0.022),
        badgeH,
        badgeBg,
        badgeFg,
        Math.round(badgeH / 2),
        'left',
        badgeFontSize
      );
    }
  } else {
    brandSlot = renderProceduralTemplateChrome(
      ctx,
      template,
      photoImg,
      photoZoom,
      photoPanX,
      photoPanY,
      logoSettings.hideDefaultBrand,
      isExport
    );
  }

  // 2. Headline Text
  const hb = template.headlineBox;
  const trimmedHeadline = headline.trim();

  let textHitBox: RectBox = {
    x: hb.centerX - hb.maxWidth * 0.4,
    y: hb.centerY - hb.maxHeight * 0.35,
    width: hb.maxWidth * 0.8,
    height: hb.maxHeight * 0.7,
  };

  const centerX = hb.centerX + textOffsetX * W;
  const centerY = hb.centerY + textOffsetY * H;

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

  if (trimmedHeadline.length > 0) {
    const mask = buildHighlightMask(headline, highlights);
    const fontWeight = font.weight ?? 600;
    const setFont = (sizePx: number) => {
      ctx.font = `${fontWeight} ${sizePx.toFixed(1)}px ${font.family}`;
    };

    const lineGapScale = Math.max(0.5, lineGapPercent / 100);
    const baseLineRatio = 1.3;

    let fittedSize = lineMode === 'one' ? hb.singleLineFontSize : hb.baseFontSize;
    let finalLines: WordToken[][] = [];

    if (lineMode === 'one') {
      const singleTokens = tokenizeLineIntoWords(headline.replace(/\r?\n/g, ' '), 0, mask);
      setFont(fittedSize);
      const spaceW = ctx.measureText(' ').width;
      const rawWidth = measureWordListWidth(ctx, singleTokens, spaceW);
      if (rawWidth > hb.maxWidth && rawWidth > 0) {
        fittedSize = Math.max(16, fittedSize * (hb.maxWidth / rawWidth) * 0.98);
      }
      finalLines = [singleTokens];
    } else if (lineMode === 'two') {
      const allWords = tokenizeLineIntoWords(headline.replace(/\r?\n/g, ' '), 0, mask);
      for (let attempt = 0; attempt < 36; attempt++) {
        setFont(fittedSize);
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
        setFont(fittedSize);
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

    const renderFontSize = Math.max(12, fittedSize * (fontSizePercent / 100));
    setFont(renderFontSize);
    const spaceWidth = ctx.measureText(' ').width;
    const lineHeight = renderFontSize * baseLineRatio * lineGapScale;

    if (lineMode === 'auto' && Math.abs(fontSizePercent - 100) >= 6) {
      const paragraphs = headline.split(/\r?\n/);
      const rewrapped: WordToken[][] = [];
      let charCursor = 0;
      for (const pText of paragraphs) {
        const pWords = tokenizeLineIntoWords(pText, charCursor, mask);
        rewrapped.push(...wrapWordsSmart(ctx, pWords, hb.maxWidth, spaceWidth));
        charCursor += pText.length + 1;
      }
      if (rewrapped.length > 0) {
        finalLines = rewrapped;
      }
    }

    const numLines = finalLines.length;
    const blockHeight = numLines * lineHeight;
    let maxRenderedLineW = 0;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (textShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowBlur = Math.max(4, renderFontSize * 0.14);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(2, renderFontSize * 0.05);
    }

    const firstLineCenterY = centerY - ((numLines - 1) * lineHeight) / 2;

    for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
      const words = finalLines[lineIdx];
      const lineW = measureWordListWidth(ctx, words, spaceWidth);
      if (lineW > maxRenderedLineW) maxRenderedLineW = lineW;

      let cursorX = centerX - lineW / 2;
      const lineY = firstLineCenterY + lineIdx * lineHeight;

      for (let wIdx = 0; wIdx < words.length; wIdx++) {
        const word = words[wIdx];
        for (const seg of word.segments) {
          ctx.fillStyle = seg.highlighted ? highlightColor : textColor;
          ctx.fillText(seg.text, cursorX, lineY);
          cursorX += ctx.measureText(seg.text).width;
        }
        if (wIdx < words.length - 1) {
          cursorX += spaceWidth;
        }
      }
    }
    ctx.restore();

    const padX = Math.max(24, renderFontSize * 0.35);
    const padY = Math.max(18, renderFontSize * 0.25);
    textHitBox = {
      x: centerX - maxRenderedLineW / 2 - padX,
      y: centerY - blockHeight / 2 - padY,
      width: Math.max(120, maxRenderedLineW + padX * 2),
      height: Math.max(60, blockHeight + padY * 2),
    };
  }

  // 3. Unified Brand Logo Pass (Official Shyamal Sylhet Logo OR Custom Uploaded Logo)
  let logoHitBox: RectBox | null = null;
  const activeLogoImg =
    logoSettings.dataUrl && logoImg && logoImg.naturalWidth > 0
      ? logoImg
      : !logoSettings.hideDefaultBrand && officialLogoImg && officialLogoImg.naturalWidth > 0
        ? officialLogoImg
        : null;

  if (psdOverlayDrawsBakedLogo && !logoSettings.hideDefaultBrand) {
    // Baked SVG already rendered the default official logo at exact coordinates
    logoHitBox = {
      x: brandSlot.x,
      y: brandSlot.y,
      width: brandSlot.maxWidth,
      height: brandSlot.maxHeight,
    };
  } else if (activeLogoImg) {
    logoHitBox = drawUnifiedBrandLogo(ctx, W, H, brandSlot, activeLogoImg, logoSettings);
  }

  return {
    canvasWidth: W,
    canvasHeight: H,
    textHitBox,
    photoHitBox: template.photoBox,
    logoHitBox,
  };
}
