import type { CustomTextItem, ExtraImageLayer, ProceduralStyleType } from '../types/card';

export const BUILTIN_LAYER_IDS = [
  'frame',
  'photo',
  'date-badge',
  'footer',
  'headline',
  'subheading',
  'logo',
] as const;

export type BuiltinLayerId = (typeof BUILTIN_LAYER_IDS)[number];

/**
 * Returns default bottom-to-top Z-order for all active layers.
 * Higher index = drawn later = visually on top.
 */
export function getDefaultLayerOrder(
  styleType: ProceduralStyleType,
  customTexts: CustomTextItem[] = [],
  extraImages: ExtraImageLayer[] = []
): string[] {
  const base: string[] =
    styleType === 'psd-overlay'
      ? ['photo', 'frame', 'date-badge', 'footer', 'headline', 'subheading', 'logo']
      : ['frame', 'photo', 'date-badge', 'footer', 'headline', 'subheading', 'logo'];

  for (const img of extraImages) {
    base.push(`image:${img.id}`);
  }
  for (const txt of customTexts) {
    base.push(`text:${txt.id}`);
  }
  return base;
}

/**
 * Synchronizes a persisted layerOrder with current built-in layers,
 * customTexts, and extraImages while preserving user's relative Z-ordering.
 */
export function normalizeLayerOrder(
  currentOrder: string[] | undefined,
  styleType: ProceduralStyleType,
  customTexts: CustomTextItem[] = [],
  extraImages: ExtraImageLayer[] = []
): string[] {
  const validIds = new Set<string>(BUILTIN_LAYER_IDS);
  for (const txt of customTexts) validIds.add(`text:${txt.id}`);
  for (const img of extraImages) validIds.add(`image:${img.id}`);

  const defaults = getDefaultLayerOrder(styleType, customTexts, extraImages);
  if (!currentOrder || currentOrder.length === 0) {
    return defaults;
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const id of currentOrder) {
    if (validIds.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of defaults) {
    if (!seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  return result;
}

/**
 * Visual stack order for UI display (top-most layer first, bottom-most last).
 */
export function toVisualTopDownOrder(bottomToTopOrder: string[]): string[] {
  return [...bottomToTopOrder].reverse();
}

/**
 * Move a layer up (+1 in bottom-to-top render array) or down (-1).
 */
export function moveLayerStep(
  bottomToTopOrder: string[],
  layerId: string,
  direction: 'up' | 'down'
): string[] {
  const idx = bottomToTopOrder.indexOf(layerId);
  if (idx === -1) return bottomToTopOrder;
  const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= bottomToTopOrder.length) return bottomToTopOrder;
  const next = [...bottomToTopOrder];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

/**
 * Reorder from visual top-down index A to top-down index B.
 */
export function reorderVisualTopDown(
  bottomToTopOrder: string[],
  fromVisualIdx: number,
  toVisualIdx: number
): string[] {
  const topDown = [...bottomToTopOrder].reverse();
  if (
    fromVisualIdx < 0 ||
    toVisualIdx < 0 ||
    fromVisualIdx >= topDown.length ||
    toVisualIdx >= topDown.length ||
    fromVisualIdx === toVisualIdx
  ) {
    return bottomToTopOrder;
  }
  const [moved] = topDown.splice(fromVisualIdx, 1);
  topDown.splice(toVisualIdx, 0, moved);
  return topDown.reverse();
}

export function getDefaultBengaliDateText(): string {
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
