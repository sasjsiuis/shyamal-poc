export type ThemeMode = 'light' | 'dark' | 'auto';
export type LineMode = 'auto' | 'one' | 'two';
export type ExportFormat = 'png' | 'jpeg';

export interface HighlightRange {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
  weight?: number | string;
  italic?: boolean;
  isCustom?: boolean;
  dataUrl?: string;
}

export type QuoteMarkStyle = 'classic' | 'bold-block' | 'slash' | 'circle-badge' | 'none';
export type QuotePhotoStyle = 'original' | 'grayscale' | 'rim-glow' | 'duotone';

export interface QuoteCardSettings {
  authorName: string;
  authorTitle: string;
  sourceText: string;
  badgeText: string;
  ratingText: string;
  questionText: string;
  questionAuthor: string;
  questionMeta: string;
  secondaryPhotoSrc: string;
  quoteMarkStyle: QuoteMarkStyle;
  quoteMarkColor: string;
  quoteMarkSizePercent: number;
  showDecorShapes: boolean;
  showQuoteMarks: boolean;
  showSocialIcons: boolean;
  photoStyle: QuotePhotoStyle;
  photoRimColor: string;
  cardSurfaceColor: string;
  authorNameColor: string;
  authorTitleColor: string;
}

export type LogoBadgeStyle = 'auto' | 'white' | 'frosted' | 'none';
export type LogoShape = 'original' | 'square' | 'rounded' | 'circle' | 'pill';

export interface LogoSettings {
  dataUrl: string | null;
  scale: number; // 20..200 (%)
  x: number; // -200..200 (%)
  y: number; // -200..200 (%)
  hideDefaultBrand: boolean;
  badgeStyle?: LogoBadgeStyle;
  shape?: LogoShape;
}

export interface SubheadingSettings {
  text: string;
  fontSizePercent: number; // 60..180
  color: string; // empty string = match template/headline color
  offsetX: number; // -0.48..0.48
  offsetY: number; // -0.48..0.48
}

export interface CustomTextItem {
  id: string;
  text: string;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  fontSize: number; // reference px at 1080w (16..110)
  color: string;
  bgColor: string | null;
}

export interface BrandLogoSlot {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  align: 'left' | 'center' | 'right';
  surfaceIsDark: boolean;
  pillRadius?: number;
  padX?: number;
  padY?: number;
}

export type ProceduralStyleType =
  | 'psd-overlay'
  | 'top-band-white-footer'
  | 'framed-bottom-box'
  | 'full-bleed-gradient'
  | 'broadcast-ticker'
  | 'editorial-broadsheet'
  | 'quote-spotlight'
  | 'split-header-badge'
  | 'modern-inset-card'
  | 'diagonal-ribbon'
  | 'video-play-frame'
  | 'islamic-arch'
  | 'magazine-split'
  | 'minimal-polaroid'
  | 'interview-spotlight'
  | 'job-career-card'
  | 'cyber-tech-grid'
  | 'tv-jamuna'
  | 'tv-ekattor'
  | 'tv-independent'
  | 'tv-rtv'
  | 'tv-desh'
  | 'portal-ntv'
  | 'tv-ekhon'
  | 'tv-somoy'
  | 'paper-prothom-alo-1'
  | 'paper-prothom-alo-2'
  | 'portal-jagonews'
  | 'paper-daily-star'
  | 'portal-bdnews24'
  | 'portal-dhakapost'
  | 'paper-kalerkantho'
  | 'paper-jugantor'
  | 'paper-ittefaq'
  | 'portal-sylhetvoice-blue'
  | 'portal-protidiner-cream'
  | 'portal-sylhetvoice-dark'
  | 'portal-protidiner-black'
  | 'portal-protidiner-split'
  | 'portal-emjanews'
  | 'portal-sylhetview'
  | 'portal-sylhettoday'
  | 'quote-dramatic-gradient'
  | 'quote-arc-halftone'
  | 'quote-dark-glass-rating'
  | 'quote-violet-lime-card'
  | 'quote-wave-testimonial'
  | 'quote-neon-duotone'
  | 'quote-book-crimson-mark'
  | 'quote-press-halftone'
  | 'quote-qa-split'
  | 'quote-executive-box'
  | 'quote-chamfer-political'
  | 'quote-corporate-overlap'
  | 'quote-warm-bubble';

export type TemplateCategory =
  | 'সব'
  | 'পিএসডি ডিফল্ট'
  | 'ব্রেকিং নিউজ'
  | 'জাতীয়'
  | 'আন্তর্জাতিক'
  | 'খেলাধুলা'
  | 'অর্থনীতি'
  | 'প্রযুক্তি'
  | 'মতামত ও উক্তি'
  | 'নাগরিক সংবাদ'
  | 'প্রবাসে সিলেট'
  | 'চাকরির খোঁজে'
  | 'সারা বাংলা'
  | 'শিক্ষাঙ্গন'
  | 'খবর'
  | 'নিউজফ্ল্যাশ'
  | 'জীবনযাপন'
  | 'ইসলাম'
  | 'অর্থ-বাণিজ্য'
  | 'শিল্প-সাহিত্য'
  | 'গনমাধ্যম'
  | 'মুখোমুখি'
  | 'ভিডিও';

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  category: Exclude<TemplateCategory, 'সব'>;
  styleType: ProceduralStyleType;
  canvasWidth: number;
  canvasHeight: number;
  overlayUrl?: string;
  overlaySourceCrop?: RectBox;
  defaultPhotoSrc?: string;
  photoBox: RectBox;
  photoClipPadding?: number;
  headlineBox: {
    centerX: number;
    centerY: number;
    maxWidth: number;
    maxHeight: number;
    baseFontSize: number;
    singleLineFontSize: number;
  };
  headlineAlign?: 'center' | 'left';
  defaultTextColor: string;
  defaultHighlightColor: string;
  defaultBrandMask?: {
    rects: Array<RectBox & { fill: string }>;
  };
  palette?: {
    bgPrimary: string;
    bgSecondary: string;
    accent: string;
    footerBg: string;
    footerText: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
  };
  kickerText?: string;
  footerCtaText?: string;
  hasWebsiteUrl?: boolean;
  websiteUrl?: string;
  defaultQuote?: {
    headline: string;
    highlights?: HighlightRange[];
    fontId?: string;
    settings: Partial<QuoteCardSettings>;
  };
}

export interface ExtraImageLayer {
  id: string;
  name: string;
  dataUrl: string;
  x: number; // 0..1 normalized center X
  y: number; // 0..1 normalized center Y
  widthPercent: number; // 8..150 (% of canvasWidth)
  aspectRatio: number; // naturalWidth / naturalHeight
  rotation: number; // -180..180 deg
  opacity: number; // 0..100 (%)
  borderRadius: number; // 0..50 (%)
  borderWidth: number; // 0..24 px
  borderColor: string;
  shadow: boolean;
}

export interface TemplateOverride {
  name?: string;
  category?: Exclude<TemplateCategory, 'সব'>;
  kickerText?: string;
  footerCtaText?: string;
  websiteUrl?: string;
  dateText?: string;
  palette?: Partial<NonNullable<TemplateConfig['palette']>>;
  quoteSettings?: Partial<QuoteCardSettings>;
}

export interface RenderedLayoutMetrics {
  canvasWidth: number;
  canvasHeight: number;
  textHitBox: RectBox;
  photoHitBox: RectBox;
  logoHitBox: RectBox | null;
  subheadingHitBox: RectBox | null;
  customTextHitBoxes: Array<{ id: string; box: RectBox }>;
  extraImageHitBoxes: Array<{ id: string; box: RectBox }>;
}
