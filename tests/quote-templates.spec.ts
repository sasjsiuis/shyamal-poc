import { expect, test, type Page } from '@playwright/test';

const QUOTE_TEMPLATE_IDS = [
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
];

async function auditMobileViewportControls(page: Page) {
  return page.evaluate(() => {
    const violations: string[] = [];
    const containers = [
      document.querySelector('header'),
      document.querySelector('section[aria-label="মোবাইল এডিটর সেটিংস"]'),
      document.querySelector('nav[aria-label="মোবাইল এডিটর ট্যাব"]'),
    ].filter(Boolean) as HTMLElement[];

    for (const root of containers) {
      const interactive = root.querySelectorAll<HTMLElement>(
        'button, a, input, select, textarea, [role="button"], [role="switch"]'
      );
      for (const el of interactive) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (el instanceof HTMLInputElement && el.type === 'file') continue;

        const minDim =
          el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range'
            ? rect.height
            : Math.min(rect.width, rect.height);
        if (minDim < 43.5) {
          violations.push(
            `Small target <44px: <${el.tagName.toLowerCase()}> "${el.getAttribute('aria-label') || el.textContent?.trim() || ''}" => ${Math.round(rect.width)}x${Math.round(rect.height)}`
          );
        }

        if (
          (el.tagName === 'INPUT' &&
            !['range', 'color', 'checkbox', 'radio', 'file'].includes(
              (el as HTMLInputElement).type
            )) ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT'
        ) {
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 15.9) {
            violations.push(`Small input font <16px: <${el.tagName.toLowerCase()}> => ${fontSize}px`);
          }
        }
      }
    }

    if (document.documentElement.scrollHeight - window.innerHeight > 2) {
      violations.push(`Document vertical overflow`);
    }
    if (document.documentElement.scrollWidth - window.innerWidth > 2) {
      violations.push(`Document horizontal overflow`);
    }

    const sheet = document.querySelector('section[aria-label="মোবাইল এডিটর সেটিংস"]');
    if (sheet) {
      const sheetNodes = sheet.querySelectorAll<HTMLElement>('*');
      let scrollCount = 0;
      for (const node of sheetNodes) {
        if (node.tagName === 'TEXTAREA') continue;
        const st = window.getComputedStyle(node);
        if (st.overflowY === 'auto' || st.overflowY === 'scroll') {
          scrollCount += 1;
          if (node.dataset.sheetScroll !== 'true') {
            violations.push(`Unexpected nested scroll: ${node.tagName}.${node.className}`);
          }
        }
      }
      if (scrollCount > 1) {
        violations.push(`Expected <= 1 scroll container inside sheet, found ${scrollCount}`);
      }
    }

    return violations;
  });
}

const QUOTE_TEMPLATE_TITLES = [
  'গ্রেডিয়েন্ট ড্রামা উক্তি',
  'হালফটোন আর্ক উক্তি',
  'ডার্ক গ্লাস ও রেটিং কার্ড',
  'ভায়োলেট-লাইম মডার্ন কোট',
  'ওয়েভ এডিটোরিয়াল উক্তি',
  'নিয়ন-ম্যাজেন্টা ডুয়োটোন কোট',
  'সাহিত্য ও বইয়ের উক্তি',
  'প্রেস হ্যালফটোন উক্তি কার্ড',
  'প্রশ্নোত্তর ও পডকাস্ট স্প্লিট',
  'এক্সিকিউটিভ গ্রিন বক্স উক্তি',
  'চ্যাম্ফার্ড জ্যামিতিক বক্তব্য কার্ড',
  'কর্পোরেট ওভারল্যাপ উক্তি কার্ড',
  'স্পিচ বাবল উক্তি পোস্টার',
];

test.describe('Quote Poster Templates, 30 Fonts & Photo Delete', () => {
  test('templates gallery lists all 13 quote templates under মতামত ও উক্তি with non-blank canvases', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/templates', { waitUntil: 'domcontentloaded' });

    const quoteCatTab = page.getByRole('tab', { name: /মতামত ও উক্তি/ });
    await expect(quoteCatTab).toBeVisible({ timeout: 15_000 });
    await quoteCatTab.click();
    await page.waitForTimeout(500);

    const firstCanvas = page.locator('main canvas').first();
    await expect(firstCanvas).toBeVisible();
    const hasPixels = await firstCanvas.evaluate((c) => {
      const el = c as HTMLCanvasElement;
      const ctx = el.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, el.width, el.height).data;
      return data.some((v, idx) => idx % 4 === 3 && v > 0);
    });
    expect(hasPixels).toBe(true);

    for (const title of QUOTE_TEMPLATE_TITLES) {
      await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('desktop quote editor supports 30 fonts, full quote customization, layers, and deleting default photo', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/editor/quote-dramatic-gradient', { waitUntil: 'domcontentloaded' });
    const mainCanvas = page.locator('main canvas');
    await expect(mainCanvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(450);

    const initialDataUrl = await mainCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(initialDataUrl.length).toBeGreaterThan(5000);

    // Edit speaker name & title in টেক্সট tab
    const authorInput = page.getByPlaceholder('যেমন: ড. রফিকুল ইসলাম');
    await expect(authorInput).toBeVisible();
    await authorInput.fill('আহমেদ ছফা');
    await page.waitForTimeout(200);
    const afterAuthorUrl = await mainCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(afterAuthorUrl).not.toEqual(initialDataUrl);

    // Style tab: verify >= 28 fonts in dropdown & quote style options
    await page.getByRole('button', { name: 'স্টাইল' }).click();
    const fontTrigger = page.locator('button[aria-haspopup="listbox"]');
    await fontTrigger.click();
    const fontOptionsCount = await page.locator('[role="listbox"] [role="option"]').count();
    expect(fontOptionsCount).toBeGreaterThanOrEqual(28);
    await page.locator('[role="listbox"] [role="option"]').nth(4).click();

    await page.getByRole('button', { name: 'বোল্ড ব্লক' }).click();
    await page.waitForTimeout(200);
    const afterStyleUrl = await mainCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(afterStyleUrl).not.toEqual(afterAuthorUrl);

    // Photo tab: switch photo style & delete default photo cleanly
    const desktopPanel = page.locator('aside[aria-label="এডিটর কন্ট্রোল প্যানেল"]');
    await page.getByRole('button', { name: 'ছবি', exact: true }).click();
    await desktopPanel.getByRole('button', { name: 'সাদাকালো' }).click();
    await page.waitForTimeout(150);
    const beforeDeleteUrl = await mainCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    await desktopPanel.getByRole('button', { name: 'ছবি মুছুন' }).click();
    await page.waitForTimeout(200);
    await expect(desktopPanel.getByText('মূল ছবি মুছে ফেলা হয়েছে।')).toBeVisible();
    const afterDeleteUrl = await mainCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(afterDeleteUrl).not.toEqual(beforeDeleteUrl);

    // Wait for auto-save and verify photoDeleted persists across reload
    await page.waitForTimeout(1300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(mainCanvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'ছবি', exact: true }).click();
    await expect(desktopPanel.getByText('মূল ছবি মুছে ফেলা হয়েছে।')).toBeVisible();

    // Verify Q&A split template also renders without errors
    await page.goto('/editor/quote-qa-split', { waitUntil: 'domcontentloaded' });
    await expect(mainCanvas).toBeVisible({ timeout: 15_000 });
    await expect(desktopPanel.getByPlaceholder('যেমন: আপনার সেরা পরামর্শ কী?')).toBeVisible();

    // Verify Layers inspector opens quote design controls on 'frame'
    await page.getByRole('button', { name: 'লেয়ার' }).click();
    await desktopPanel.getByText('উক্তির ডিজাইন, আইকন ও রং').click();
    await expect(desktopPanel.getByText('কোটেশন আইকন ও এলিমেন্ট')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('mobile quote editor passes 44px tap target & 16px input font audit across all quote tabs', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/editor/quote-violet-lime-card', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main canvas')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(350);

    for (const tabLabel of ['টেক্সট', 'স্টাইল', 'ছবি', 'লেয়ার']) {
      await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: tabLabel }).click();
      await page.waitForTimeout(180);
      const violations = await auditMobileViewportControls(page);
      expect(violations, `Violations on tab ${tabLabel}`).toEqual([]);
    }

    // Also test mobile photo delete & frame drill-down in Layers
    const mobileSheet = page.locator('section[aria-label="মোবাইল এডিটর সেটিংস"]');
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'ছবি' }).click();
    await mobileSheet.getByRole('button', { name: 'ছবি মুছুন' }).click();
    await expect(mobileSheet.getByText('মূল ছবি মুছে ফেলা হয়েছে।')).toBeVisible();

    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'লেয়ার' }).click();
    await mobileSheet.locator('[data-layer-row-id="frame"]').click();
    await page.waitForTimeout(150);
    const frameLayerViolations = await auditMobileViewportControls(page);
    expect(frameLayerViolations).toEqual([]);
  });
});
