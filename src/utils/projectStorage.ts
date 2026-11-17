import { createStore, del, get, keys, set } from 'idb-keyval';
import { ALL_TEMPLATES, PSD_GREEN_TEMPLATE, PSD_MAROON_TEMPLATE } from '../data/templates';
import type { TemplateConfig } from '../types/card';
import type { ProjectEditorState, SavedProject } from '../types/project';

export const DEFAULT_PHOTO_SRC = '/assets/aistudio/5329_21a6eb86.png';
export const MAX_SAVED_PROJECTS = 50;

const projectStore =
  typeof window !== 'undefined' ? createStore('mxb-photocard-db', 'projects') : undefined;

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(val: number | string): string {
  return String(val).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultProjectName(headline: string, fallback = 'নতুন ফটো কার্ড'): string {
  const clean = headline.trim().replace(/\s+/g, ' ');
  if (!clean) return fallback;
  return clean.slice(0, 30);
}

export function createInitialEditorState(
  template: TemplateConfig,
  initialNewsUrl = ''
): ProjectEditorState {
  const isMaroon = template.id === PSD_MAROON_TEMPLATE.id;
  return {
    newsUrl: initialNewsUrl,
    selectedTemplateId: template.id,
    customTemplate: template.id.startsWith('custom-') ? template : null,
    headline: isMaroon
      ? 'নাহিদ ইসলাম কোনো ব্যক্তি নন, একটি ইতিহাস : ড. ইউনূস'
      : 'ডেঙ্গু কেড়ে নিলো আরও ৬ জনের প্রাণ',
    highlights: isMaroon
      ? [{ id: 'sample-hl-2', start: 29, end: 40, text: 'একটি ইতিহাস' }]
      : [{ id: 'sample-hl-1', start: 16, end: 27, text: 'আরও ৬ জনের' }],
    highlightTab: 'words',
    lineMode: 'auto',
    fontSizePercent: 100,
    lineGapPercent: 92,
    selectedFontId: 'kalpurush',
    textOffsetX: 0,
    textOffsetY: 0,
    textShadow: false,
    textColor: template.defaultTextColor,
    highlightColor: template.defaultHighlightColor,
    photoSrc: DEFAULT_PHOTO_SRC,
    photoZoom: 1,
    photoPanX: 0,
    photoPanY: 0,
    logoSettings: {
      dataUrl: null,
      scale: 100,
      x: 0,
      y: 0,
      hideDefaultBrand: false,
      badgeStyle: 'none',
      shape: 'original',
    },
    subheading: {
      text: '',
      fontSizePercent: 100,
      color: '',
      offsetX: 0,
      offsetY: 0,
    },
    customTexts: [],
    exportFormat: 'png',
    exportQuality: 96,
    templateOverrides: {},
  };
}

async function dataOrBlobUrlToBlob(src: string | null | undefined): Promise<Blob | null> {
  if (!src) return null;
  if (!src.startsWith('data:') && !src.startsWith('blob:')) return null;
  try {
    const resp = await fetch(src);
    return await resp.blob();
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<SavedProject[]> {
  if (!projectStore) return [];
  try {
    const allKeys = await keys(projectStore);
    const items = await Promise.all(
      allKeys.map((k) => get<SavedProject>(k, projectStore))
    );
    return items
      .filter((p): p is SavedProject => Boolean(p && p.id && p.state))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getProjectCount(): Promise<number> {
  if (!projectStore) return 0;
  try {
    const allKeys = await keys(projectStore);
    return allKeys.length;
  } catch {
    return 0;
  }
}

export async function getProjectById(projectId: string): Promise<SavedProject | null> {
  if (!projectStore || !projectId) return null;
  try {
    const proj = await get<SavedProject>(projectId, projectStore);
    if (!proj) return null;

    // Hydrate Blobs cleanly into Object URLs / Data URLs so rendering & canvas export stay unchanged
    const hydratedState: ProjectEditorState = { ...proj.state };
    if (proj.photoBlob instanceof Blob) {
      hydratedState.photoSrc = URL.createObjectURL(proj.photoBlob);
    }
    if (proj.logoBlob instanceof Blob) {
      hydratedState.logoSettings = {
        ...hydratedState.logoSettings,
        dataUrl: URL.createObjectURL(proj.logoBlob),
      };
    }
    if (proj.customOverlayBlob instanceof Blob && hydratedState.customTemplate) {
      hydratedState.customTemplate = {
        ...hydratedState.customTemplate,
        overlayUrl: URL.createObjectURL(proj.customOverlayBlob),
      };
    }
    return {
      ...proj,
      state: hydratedState,
    };
  } catch {
    return null;
  }
}

export async function saveProject(
  project: Omit<SavedProject, 'photoBlob' | 'logoBlob' | 'customOverlayBlob'> & {
    photoBlob?: Blob | null;
    logoBlob?: Blob | null;
    customOverlayBlob?: Blob | null;
  }
): Promise<{ saved: boolean; limitReached?: boolean }> {
  if (!projectStore) return { saved: false };
  try {
    const existing = await get<SavedProject>(project.id, projectStore);
    if (!existing) {
      const count = await getProjectCount();
      if (count >= MAX_SAVED_PROJECTS) {
        return { saved: false, limitReached: true };
      }
    }

    // Store uploaded images/logos natively as Blobs in IndexedDB
    const photoBlob =
      project.photoBlob !== undefined
        ? project.photoBlob
        : await dataOrBlobUrlToBlob(project.state.photoSrc);

    const logoBlob =
      project.logoBlob !== undefined
        ? project.logoBlob
        : await dataOrBlobUrlToBlob(project.state.logoSettings.dataUrl);

    const customOverlayBlob =
      project.customOverlayBlob !== undefined
        ? project.customOverlayBlob
        : await dataOrBlobUrlToBlob(project.state.customTemplate?.overlayUrl);

    // Strip huge inline data/blob URLs from JSON state when saved as Blobs
    const cleanState: ProjectEditorState = {
      ...project.state,
      photoSrc: photoBlob ? '' : project.state.photoSrc,
      logoSettings: {
        ...project.state.logoSettings,
        dataUrl: logoBlob ? null : project.state.logoSettings.dataUrl,
      },
      customTemplate:
        project.state.customTemplate && customOverlayBlob
          ? { ...project.state.customTemplate, overlayUrl: undefined }
          : project.state.customTemplate,
    };

    const record: SavedProject = {
      id: project.id,
      templateId: project.templateId,
      name: project.name,
      newsUrl: project.newsUrl,
      state: cleanState,
      photoBlob,
      logoBlob,
      customOverlayBlob,
      thumbnail: project.thumbnail,
      createdAt: existing?.createdAt ?? project.createdAt,
      updatedAt: project.updatedAt,
    };

    await set(record.id, record, projectStore);
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

export async function createNewProject(
  templateId: string,
  initialNewsUrl = ''
): Promise<{ project: SavedProject | null; limitReached?: boolean }> {
  const count = await getProjectCount();
  if (count >= MAX_SAVED_PROJECTS) {
    return { project: null, limitReached: true };
  }
  const tpl = ALL_TEMPLATES.find((t) => t.id === templateId) || PSD_GREEN_TEMPLATE;
  const now = Date.now();
  const state = createInitialEditorState(tpl, initialNewsUrl);
  const proj: SavedProject = {
    id: generateUuid(),
    templateId: tpl.id,
    name: defaultProjectName(state.headline),
    newsUrl: initialNewsUrl,
    state,
    photoBlob: null,
    logoBlob: null,
    customOverlayBlob: null,
    thumbnail: '',
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(proj);
  return { project: proj };
}

export async function duplicateProject(
  sourceId: string
): Promise<{ project: SavedProject | null; limitReached?: boolean }> {
  if (!projectStore) return { project: null };
  const count = await getProjectCount();
  if (count >= MAX_SAVED_PROJECTS) {
    return { project: null, limitReached: true };
  }
  const raw = await get<SavedProject>(sourceId, projectStore);
  if (!raw) return { project: null };
  const now = Date.now();
  const copy: SavedProject = {
    ...raw,
    id: generateUuid(),
    name: `${raw.name} (কপি)`.slice(0, 42),
    createdAt: now,
    updatedAt: now,
  };
  await set(copy.id, copy, projectStore);
  return { project: copy };
}

export async function renameProject(projectId: string, newName: string): Promise<boolean> {
  if (!projectStore) return false;
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const existing = await get<SavedProject>(projectId, projectStore);
  if (!existing) return false;
  await set(
    projectId,
    {
      ...existing,
      name: trimmed.slice(0, 60),
      updatedAt: Date.now(),
    },
    projectStore
  );
  return true;
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!projectStore) return;
  await del(projectId, projectStore);
}

export function generateCanvasThumbnail(sourceCanvas: HTMLCanvasElement | null): string {
  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) return '';
  try {
    const targetW = 300;
    const ratio = sourceCanvas.height / sourceCanvas.width;
    const targetH = Math.max(1, Math.round(targetW * ratio));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = targetW;
    thumbCanvas.height = targetH;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
    return thumbCanvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}

export function formatBengaliRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'এইমাত্র';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${toBengaliDigits(diffMin)} মিনিট আগে`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${toBengaliDigits(diffHr)} ঘণ্টা আগে`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'গতকাল';
  if (diffDay < 7) return `${toBengaliDigits(diffDay)} দিন আগে`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${toBengaliDigits(diffWeek)} সপ্তাহ আগে`;
  const d = new Date(timestamp);
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}

export function formatBengaliClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${toBengaliDigits(h)}:${toBengaliDigits(m)}`;
}
