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
  isCustom?: boolean;
  dataUrl?: string;
}

export type LogoBadgeStyle = 'auto' | 'white' | 'frosted' | 'none';

export interface LogoSettings {
  dataUrl: string | null;
  scale: number; // 20..200 (%)
  x: number; // -100..100 (%)
  y: number; // -100..100 (%)
  hideDefaultBrand: boolean;
  badgeStyle?: LogoBadgeStyle;
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
  | 'cyber-tech-grid';

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
}

export interface TemplateOverride {
  name?: string;
  category?: Exclude<TemplateCategory, 'সব'>;
  kickerText?: string;
  footerCtaText?: string;
}

export interface RenderedLayoutMetrics {
  canvasWidth: number;
  canvasHeight: number;
  textHitBox: RectBox;
  photoHitBox: RectBox;
  logoHitBox: RectBox | null;
}
