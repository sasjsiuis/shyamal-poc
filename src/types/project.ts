import type {
  CustomTextItem,
  ExportFormat,
  ExtraImageLayer,
  HighlightRange,
  LineMode,
  LogoSettings,
  SubheadingSettings,
  TemplateConfig,
  TemplateOverride,
} from './card';

export interface ProjectEditorState {
  newsUrl: string;
  selectedTemplateId: string;
  customTemplate: TemplateConfig | null;
  headline: string;
  highlights: HighlightRange[];
  highlightTab: 'words' | 'manual';
  lineMode: LineMode;
  fontSizePercent: number;
  lineGapPercent: number;
  selectedFontId: string;
  textOffsetX: number;
  textOffsetY: number;
  textShadow: boolean;
  textColor: string;
  highlightColor: string;
  headlineAlignOverride?: 'left' | 'center' | 'right';
  photoSrc: string;
  photoZoom: number;
  photoPanX: number;
  photoPanY: number;
  logoSettings: LogoSettings;
  subheading: SubheadingSettings;
  customTexts: CustomTextItem[];
  extraImages?: ExtraImageLayer[];
  layerOrder?: string[];
  layerVisibility?: Record<string, boolean>;
  layerOpacity?: Record<string, number>;
  layerLocks?: Record<string, boolean>;
  layerNames?: Record<string, string>;
  exportFormat: ExportFormat;
  exportQuality: number;
  templateOverrides: Record<string, TemplateOverride>;
}

export interface SavedProject {
  id: string;
  templateId: string;
  name: string;
  newsUrl: string;
  state: ProjectEditorState;
  photoBlob?: Blob | null;
  logoBlob?: Blob | null;
  customOverlayBlob?: Blob | null;
  thumbnail: string;
  createdAt: number;
  updatedAt: number;
}
