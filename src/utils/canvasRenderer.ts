import type {
  FontOption,
  HighlightRange,
  LineMode,
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

// Pixel-perfect procedural rendering of Green & Maroon templates matching user's exact photos
function renderPsdTemplateArtwork(
  ctx: CanvasRenderingContext2D,
  templateId: string,
  W: number,
  H: number,
  pBox: RectBox,
  hideDefaultBrand: boolean,
  officialLogoImg?: HTMLImageElement | null
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

      // Bottom right brand logo using authentic image asset
      if (officialLogoImg && officialLogoImg.naturalWidth > 0) {
        ctx.drawImage(officialLogoImg, 1320, 1805, 590, 155);
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('নতুন শতাব্দীর দৈনিক', 1910, 1828);

        ctx.font = `700 126px 'Kalpurush', 'Hind Siliguri', sans-serif`;
        ctx.fillStyle = '#028669';
        ctx.fillText('সিলেট', 1910, 1935);
        
        const siletW = ctx.measureText('সিলেট').width;
        ctx.fillStyle = '#dc2626';
        ctx.fillText('শ্যামল ', 1910 - siletW, 1935);

        ctx.font = `700 28px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = '#475569';
        ctx.fillText('Shyamal Sylhet', 1910, 1968);
      }
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

    if (!hideDefaultBrand) {
      // Top Logo centered in top opening using authentic official logo asset
      if (officialLogoImg && officialLogoImg.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.drawImage(officialLogoImg, 375, 14, 330, 70);
        ctx.restore();
      } else {
        ctx.font = `700 48px 'Kalpurush', 'Hind Siliguri', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ef4444';
        ctx.fillText('শ্যামল ', W / 2 - 62, 42);
        ctx.fillStyle = '#10b981';
        ctx.fillText('সিলেট', W / 2 + 62, 42);
        ctx.restore();
      }
    }

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

    // Bottom "••• বিস্তারিত কমেন্টে •••" in yellow/gold with divider lines
    ctx.fillStyle = '#ffd132';
    ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('••• বিস্তারিত কমেন্টে •••', W / 2, 1030);

    const ctaW = ctx.measureText('••• বিস্তারিত কমেন্টে •••').width;
    ctx.strokeStyle = 'rgba(255, 209, 50, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 1030);
    ctx.lineTo(W / 2 - ctaW / 2 - 20, 1030);
    ctx.moveTo(W / 2 + ctaW / 2 + 20, 1030);
    ctx.lineTo(1018, 1030);
    ctx.stroke();
  }
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
): void {
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

  if (template.styleType === 'top-band-white-footer') {
    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, pBox.y + pBox.height - 60, W, H - (pBox.y + pBox.height - 60));

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

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
    ctx.fillText(template.footerCtaText || 'বিস্তারিত কমেন্টে', W / 2, pillY + pillH / 2 + 2);

    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.footerText;
      ctx.font = `600 26px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(dateStr, 54, H - 46);

      ctx.textAlign = 'right';
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.fillText(template.kickerText || 'সংবাদ ডেস্ক', W - 54, H - 46);
    }
  } else if (template.styleType === 'framed-bottom-box') {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 42, W - 72, H - 84);

    if (!hideDefaultBrand && template.kickerText) {
      ctx.fillStyle = pal.bgPrimary;
      ctx.fillRect(W / 2 - 190, 16, 380, 54);
      ctx.fillStyle = pal.accent;
      ctx.font = `700 32px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText, W / 2, 44);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pBox.x - 8, pBox.y - 8, pBox.width + 16, pBox.height + 16);
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.fillRect(pBox.x - 8, pBox.y + pBox.height + 12, pBox.width + 16, 336);

    ctx.fillStyle = pal.bgPrimary;
    ctx.fillRect(W / 2 - 180, H - 68, 360, 52);
    ctx.fillStyle = pal.accent;
    ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(template.footerCtaText || 'বিস্তারিত কমেন্টে', W / 2, H - 42);
  } else if (template.styleType === 'full-bleed-gradient') {
    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);

    const scrim = ctx.createLinearGradient(0, H * 0.36, 0, H - 85);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(0.45, 'rgba(9,13,22,0.72)');
    scrim.addColorStop(1, pal.bgPrimary);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.36, W, H - H * 0.36);

    if (!hideDefaultBrand && template.kickerText) {
      ctx.fillStyle = pal.badgeBg;
      drawRoundedRect(ctx, 48, 44, 250, 56, 8);
      ctx.fill();
      ctx.fillStyle = pal.badgeText;
      ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText, 48 + 125, 44 + 29);
    }

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = pal.footerText;
    ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      hideDefaultBrand ? 'বিস্তারিত কমেন্টে' : `${dateStr}  •  বিস্তারিত কমেন্টে`,
      W / 2,
      H - 44
    );
  } else if (template.styleType === 'broadcast-ticker') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, 92);

    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.badgeBg;
      drawRoundedRect(ctx, 52, 20, 240, 52, 6);
      ctx.fill();
      ctx.fillStyle = pal.badgeText;
      ctx.font = `700 27px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText || 'ব্রেকিং নিউজ', 52 + 120, 47);

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `500 24px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(dateStr, W - 52, 47);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 78, W, 78);
    ctx.fillStyle = pal.footerText;
    ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিস্তারিত কমেন্টে দেখুন', W / 2, H - 38);
  } else if (template.styleType === 'editorial-broadsheet') {
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(64, 58, W - 128, 6);

    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.accent;
      ctx.font = `700 26px 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText || 'প্রধান সংবাদ', 64, 88);

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
    ctx.fillRect(64, H - 124, W - 128, 66);
    ctx.fillStyle = pal.footerText;
    ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিস্তারিত কমেন্টে', W / 2, H - 90);
  } else if (template.styleType === 'quote-spotlight') {
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 40, 40, W - 80, H - 80, 20);
    ctx.stroke();

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

    if (!hideDefaultBrand) {
      ctx.fillStyle = pal.accent;
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${template.kickerText || 'উক্তি'}  •  বিস্তারিত কমেন্টে`, W / 2, H - 68);
    }
  } else if (template.styleType === 'split-header-badge') {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 0, W, 14);

    if (!hideDefaultBrand && template.kickerText) {
      ctx.fillStyle = pal.badgeBg;
      drawRoundedRect(ctx, (W - 240) / 2, 34, 240, 46, 23);
      ctx.fill();
      ctx.fillStyle = pal.badgeText;
      ctx.font = `700 25px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText, W / 2, 58);
    }

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    ctx.fillStyle = pal.footerBg;
    ctx.fillRect(0, H - 108, W, 108);
    ctx.fillStyle = pal.footerText;
    ctx.font = `700 30px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      hideDefaultBrand ? 'বিস্তারিত কমেন্টে' : `${dateStr}  |  বিস্তারিত কমেন্টে`,
      W / 2,
      H - 54
    );
  } else {
    drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 28);
    ctx.strokeStyle = pal.borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    drawPhotoIntoBox(ctx, photoImg, pBox, 0, zoom, panX, panY, isExport);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(pBox.x, pBox.y, pBox.width, pBox.height);

    if (!hideDefaultBrand && template.kickerText) {
      ctx.fillStyle = pal.badgeBg;
      drawRoundedRect(ctx, pBox.x + 24, pBox.y + 24, 230, 50, 8);
      ctx.fill();
      ctx.fillStyle = pal.badgeText;
      ctx.font = `700 26px 'Kalpurush', 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.kickerText, pBox.x + 24 + 115, pBox.y + 50);
    }

    ctx.fillStyle = pal.footerBg;
    drawRoundedRect(ctx, (W - 340) / 2, H - 104, 340, 56, 28);
    ctx.fill();
    ctx.fillStyle = pal.footerText;
    ctx.font = `700 28px 'Kalpurush', 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিস্তারিত কমেন্টে', W / 2, H - 75);
  }
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

  // 1. Render Photo + Template Artwork
  if (template.styleType === 'psd-overlay') {
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

    // LAYER 2 (Top Frame Layer): Draw the template overlay PNG directly on top of the photo!
    // Since the photo window in the overlay is transparent, the photo shines through cleanly underneath.
    if (overlayImg && overlayImg.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (template.overlaySourceCrop) {
        const c = template.overlaySourceCrop;
        ctx.drawImage(overlayImg, c.x, c.y, c.width, c.height, 0, 0, W, H);
      } else {
        ctx.drawImage(overlayImg, 0, 0, W, H);
      }
    } else {
      // Direct pixel-perfect procedural frame matching user's exact PSD templates!
      renderPsdTemplateArtwork(
        ctx,
        template.id,
        W,
        H,
        template.photoBox,
        logoSettings.hideDefaultBrand,
        officialLogoImg
      );
    }

    // Crisp frame border around the photo window
    ctx.strokeStyle = template.id === 'psd-green' ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = template.id === 'psd-green' ? 4 : 3;
    ctx.strokeRect(template.photoBox.x, template.photoBox.y, template.photoBox.width, template.photoBox.height);

    if (logoSettings.hideDefaultBrand && template.defaultBrandMask) {
      for (const r of template.defaultBrandMask.rects) {
        ctx.fillStyle = r.fill;
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    }
  } else {
    renderProceduralTemplateChrome(
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

  // 3. Custom Logo
  let logoHitBox: RectBox | null = null;
  if (logoSettings.dataUrl && logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
    const baseLogoMaxW = W * 0.18 * (logoSettings.scale / 100);
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
    const drawW = baseLogoMaxW;
    const drawH = drawW / aspect;

    const defaultCenterX = template.id === 'psd-maroon' ? W / 2 : W * 0.82;
    const defaultCenterY = template.id === 'psd-maroon' ? H * 0.042 : H * 0.92;

    const logoCenterX = defaultCenterX + (logoSettings.x / 100) * (W * 0.45);
    const logoCenterY = defaultCenterY + (logoSettings.y / 100) * (H * 0.45);

    const lx = logoCenterX - drawW / 2;
    const ly = logoCenterY - drawH / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, lx, ly, drawW, drawH);
    ctx.restore();

    logoHitBox = { x: lx, y: ly, width: drawW, height: drawH };
  }

  return {
    canvasWidth: W,
    canvasHeight: H,
    textHitBox,
    photoHitBox: template.photoBox,
    logoHitBox,
  };
}
