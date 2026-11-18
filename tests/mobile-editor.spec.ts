import { expect, test, type Page } from '@playwright/test';

async function openMobileEditor(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/editor/psd-green', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main canvas')).toBeVisible({ timeout: 15_000 });
  // Allow initial canvas draw & ResizeObserver measurement to settle
  await page.waitForTimeout(350);
}

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
        'button, a, input, select, textarea, [role="button"]'
      );
      for (const el of interactive) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // Hidden file inputs
        if (el instanceof HTMLInputElement && el.type === 'file') continue;

        const minDim = el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range'
          ? rect.height
          : Math.min(rect.width, rect.height);
        if (minDim < 43.5) {
          violations.push(
            `Small target <44px: <${el.tagName.toLowerCase()}> "${el.getAttribute('aria-label') || el.textContent?.trim() || ''}" => ${Math.round(rect.width)}x${Math.round(rect.height)}`
          );
        }

        if (
          (el.tagName === 'INPUT' &&
            !['range', 'color', 'checkbox', 'radio', 'file'].includes((el as HTMLInputElement).type)) ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT'
        ) {
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 15.9) {
            violations.push(
              `Small input font <16px: <${el.tagName.toLowerCase()}> => ${fontSize}px`
            );
          }
        }
      }
    }

    // Check document non-scrolling & no nested vertical scroll containers inside sheet
    const docOverflowY = document.documentElement.scrollHeight - window.innerHeight;
    const docOverflowX = document.documentElement.scrollWidth - window.innerWidth;
    if (docOverflowY > 2) {
      violations.push(`Document vertical overflow: scrollHeight=${document.documentElement.scrollHeight}, innerHeight=${window.innerHeight}`);
    }
    if (docOverflowX > 2) {
      violations.push(`Document horizontal overflow: scrollWidth=${document.documentElement.scrollWidth}, innerWidth=${window.innerWidth}`);
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
            violations.push(`Unexpected nested vertical scroll container: ${node.tagName}.${node.className}`);
          }
        }
      }
      if (scrollCount > 1) {
        violations.push(`Expected <= 1 scroll container inside sheet, found ${scrollCount}`);
      }
    }

    for (const root of containers) {
      const rbox = root.getBoundingClientRect();
      if (rbox.width > window.innerWidth + 1) {
        violations.push(
          `Container "${root.tagName}" wider than viewport: ${Math.round(rbox.width)} > ${window.innerWidth}`
        );
      }
    }

    return violations;
  });
}

test.describe('MXB Mobile Editor Redesign (<768px)', () => {
  test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  for (const vp of [
    { width: 360, height: 740, minCardWidth: 260 },
    { width: 390, height: 844, minCardWidth: 300 },
    { width: 414, height: 896, minCardWidth: 320 },
  ]) {
    test(`initial load, 100% visible preview with default sheet, and 44px/16px audit on ${vp.width}x${vp.height}`, async ({
      page,
    }) => {
      await openMobileEditor(page, vp.width, vp.height);

      // 1. Sheet starts closed, hint is visible, no document scroll
      await expect(page.locator('section[aria-label="মোবাইল এডিটর সেটিংস"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /নিচের টুল থেকে এডিট করুন/ })).toBeVisible();

      const headerBox = await page.locator('header').boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox!.height).toBeLessThanOrEqual(52);

      const initialCanvasBox = await page.locator('main canvas').boundingBox();
      expect(initialCanvasBox).not.toBeNull();
      expect(initialCanvasBox!.width).toBeGreaterThanOrEqual(vp.minCardWidth);
      expect(initialCanvasBox!.y).toBeGreaterThanOrEqual(headerBox!.height - 1);

      const initialViolations = await auditMobileViewportControls(page);
      expect(initialViolations).toEqual([]);

      // 2. Open টেক্সট panel at default snap: card remains 100% visible and >= minCardWidth
      await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'টেক্সট' }).click();
      const sheet = page.locator('section[aria-label="মোবাইল এডিটর সেটিংস"]');
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(260);

      const openCanvasBox = await page.locator('main canvas').boundingBox();
      const sheetBox = await sheet.boundingBox();
      expect(openCanvasBox).not.toBeNull();
      expect(sheetBox).not.toBeNull();
      expect(openCanvasBox!.width).toBeGreaterThanOrEqual(vp.minCardWidth);
      expect(openCanvasBox!.y).toBeGreaterThanOrEqual(headerBox!.height - 1);
      expect(openCanvasBox!.y + openCanvasBox!.height).toBeLessThanOrEqual(sheetBox!.y + 2);

      const textViolations = await auditMobileViewportControls(page);
      expect(textViolations).toEqual([]);

      // 3. Check স্টাইল, ছবি, লোগো panel controls & sliders
      for (const tabLabel of ['স্টাইল', 'ছবি', 'লোগো']) {
        await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: tabLabel }).click();
        await page.waitForTimeout(120);
        const tabViolations = await auditMobileViewportControls(page);
        expect(tabViolations).toEqual([]);
      }

      // 4. Check টেমপ্লেট panel lazy batching (< 3500px initial height, not 14600px) & horizontal categories
      await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'টেমপ্লেট' }).click();
      await page.waitForTimeout(150);
      const tplViolations = await auditMobileViewportControls(page);
      expect(tplViolations).toEqual([]);
      const tplScrollH = await sheet.locator('[data-sheet-scroll="true"]').evaluate((el) => el.scrollHeight);
      expect(tplScrollH).toBeLessThan(3500);
    });
  }

  test('bottom sheet drag handle snaps between collapsed, default, expanded, and closes on swipe down', async ({
    page,
  }) => {
    await openMobileEditor(page, 390, 844);
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'স্টাইল' }).click();
    const sheet = page.locator('section[aria-label="মোবাইল এডিটর সেটিংস"]');
    await expect(sheet).toHaveAttribute('data-sheet-snap', 'default');

    const handle = sheet.locator('[data-sheet-drag-handle="true"]');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Swipe UP -> expanded
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 140, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(240);
    await expect(sheet).toHaveAttribute('data-sheet-snap', 'expanded');

    // Swipe DOWN -> default
    const boxExp = await handle.boundingBox();
    const cyExp = boxExp!.y + boxExp!.height / 2;
    await page.mouse.move(cx, cyExp);
    await page.mouse.down();
    await page.mouse.move(cx, cyExp + 110, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(240);
    await expect(sheet).toHaveAttribute('data-sheet-snap', 'default');

    // Swipe DOWN again -> collapsed (~64px)
    const boxDef = await handle.boundingBox();
    const cyDef = boxDef!.y + boxDef!.height / 2;
    await page.mouse.move(cx, cyDef);
    await page.mouse.down();
    await page.mouse.move(cx, cyDef + 100, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(240);
    await expect(sheet).toHaveAttribute('data-sheet-snap', 'collapsed');
    const colBox = await sheet.boundingBox();
    expect(colBox!.height).toBeLessThanOrEqual(72);

    // Swipe DOWN from collapsed -> closes completely
    const boxCol = await handle.boundingBox();
    const cyCol = boxCol!.y + boxCol!.height / 2;
    await page.mouse.move(cx, cyCol);
    await page.mouse.down();
    await page.mouse.move(cx, cyCol + 35, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await expect(sheet).toHaveCount(0);
  });

  test('soft keyboard open (390x500) hides tab bar, shows Done button, and keeps >=140px preview', async ({
    page,
  }) => {
    await openMobileEditor(page, 390, 844);
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'টেক্সট' }).click();

    const textarea = page.locator('#mobile-headline-textarea');
    await expect(textarea).toBeVisible();
    await textarea.focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await page.waitForTimeout(250);

    await expect(page.getByRole('button', { name: 'সম্পন্ন' })).toBeVisible();
    await expect(page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"]')).toBeHidden();

    const canvasBox = await page.locator('main canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThanOrEqual(140);

    // Tap "সম্পন্ন" blurs keyboard & restores full UI
    await page.getByRole('button', { name: 'সম্পন্ন' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"]')).toBeVisible();
  });

  test('headline typing, before/after hold compare, URL modal, fullscreen preview, and export save toast', async ({
    page,
  }) => {
    await openMobileEditor(page, 390, 844);

    // URL modal opens cleanly from top bar Link icon
    await page.getByRole('button', { name: 'লিংক বদলান' }).click();
    const urlDialog = page.getByRole('dialog', { name: 'নিউজ লিংক বদলান' });
    await expect(urlDialog).toBeVisible();
    const urlViolations = await urlDialog.locator('input, button').evaluateAll((els) =>
      els
        .filter((el) => window.getComputedStyle(el).display !== 'none')
        .map((el) => ({
          tag: el.tagName,
          h: el.getBoundingClientRect().height,
          fs: el.tagName === 'INPUT' ? parseFloat(window.getComputedStyle(el).fontSize) : 16,
        }))
        .filter((r) => r.h < 43.5 || r.fs < 15.9)
    );
    expect(urlViolations).toEqual([]);
    await urlDialog.getByRole('button', { name: 'বন্ধ করুন' }).last().click();
    await expect(urlDialog).toHaveCount(0);

    // Capture canvas snapshot before edits
    const originalDataUrl = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    // Edit headline in টেক্সট panel
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'টেক্সট' }).click();
    const textarea = page.locator('#mobile-headline-textarea');
    await textarea.fill('নতুন মোবাইল শিরোনাম পরীক্ষা');
    await page.waitForTimeout(220);

    const editedDataUrl = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(editedDataUrl).not.toEqual(originalDataUrl);

    // Before/After hold button temporarily shows original card while pressed
    const compareBtn = page.getByRole('button', { name: 'আগে এবং পরে তুলনা' });
    const cbox = await compareBtn.boundingBox();
    expect(cbox).not.toBeNull();
    await page.mouse.move(cbox!.x + cbox!.width / 2, cbox!.y + cbox!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    const heldDataUrl = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(heldDataUrl).not.toEqual(editedDataUrl);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const releasedDataUrl = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(releasedDataUrl).toEqual(editedDataUrl);

    // Fullscreen preview modal opens & closes
    await page.getByRole('button', { name: 'ফুলস্ক্রিন প্রিভিউ' }).click();
    const fsDialog = page.getByRole('dialog', { name: 'ফুলস্ক্রিন প্রিভিউ' });
    await expect(fsDialog).toBeVisible();
    await fsDialog.getByRole('button', { name: 'প্রিভিউ বন্ধ করুন' }).click();
    await expect(fsDialog).toHaveCount(0);

    // Export button shows "আমার কাজ-এ সেভ হয়েছে ✓"
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'এক্সপোর্ট' }).click();
    await page.getByRole('button', { name: 'কার্ড ডাউনলোড করুন' }).click();
    await expect(page.getByText('আমার কাজ-এ সেভ হয়েছে ✓')).toBeVisible();
  });

  test('mobile layers panel: live thumbnails, empty subheading omitted until added, eye toggle dims & persists, drill-down back nav', async ({
    page,
  }) => {
    await openMobileEditor(page, 390, 844);
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'লেয়ার' }).click();

    const sheet = page.locator('section[aria-label="মোবাইল এডিটর সেটিংস"]');
    await expect(sheet).toBeVisible();
    const layerViolations = await auditMobileViewportControls(page);
    expect(layerViolations).toEqual([]);

    // Empty subheading omitted initially
    await expect(sheet.locator('[data-layer-row-id="subheading"]')).toHaveCount(0);

    // Rows >= 64px tall and thumbnails non-blank
    const headlineRow = sheet.locator('[data-layer-row-id="headline"]');
    await expect(headlineRow).toBeVisible();
    const rowBox = await headlineRow.boundingBox();
    expect(rowBox!.height).toBeGreaterThanOrEqual(63);

    const hasDrawnPixels = await headlineRow.locator('canvas').evaluate((c) => {
      const ctx = (c as HTMLCanvasElement).getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, (c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height).data;
      let nonBg = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) nonBg++;
      }
      return nonBg > 15;
    });
    expect(hasDrawnPixels).toBe(true);

    // Eye toggle hides layer on canvas, dims row, and persists across reload
    const beforeHideCanvas = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    await sheet.getByRole('button', { name: 'শিরোনাম লুকান' }).click();
    await page.waitForTimeout(120);
    const afterHideCanvas = await page
      .locator('main canvas')
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    expect(afterHideCanvas).not.toEqual(beforeHideCanvas);

    const dimmedOpacity = await headlineRow.evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
    expect(dimmedOpacity).toBeLessThan(0.6);

    // Wait for 1000ms auto-save debounce so visibility persists in IndexedDB across reload
    await page.waitForTimeout(1300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main canvas')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(300);
    await page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"] button', { hasText: 'লেয়ার' }).click();
    const persistedOpacity = await page
      .locator('[data-layer-row-id="headline"]')
      .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
    expect(persistedOpacity).toBeLessThan(0.6);

    // Restore visibility & drill-down into layer edit view with "← লেয়ার" Back button
    await page.getByRole('button', { name: 'শিরোনাম দেখান' }).click();
    await page.locator('[data-layer-row-id="headline"]').click();
    await expect(sheet.getByRole('button', { name: 'লেয়ার' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /শিরোনাম.*লক/ })).toBeVisible();
    await sheet.getByRole('button', { name: 'লেয়ার' }).click();
    await expect(page.locator('[data-layer-row-id="headline"]')).toBeVisible();

    // "+ যোগ করুন" -> সাব-হেডিং opens subheading edit
    await page.getByRole('button', { name: 'যোগ করুন' }).click();
    await page.getByRole('button', { name: 'সাব-হেডিং' }).click();
    await expect(sheet.getByPlaceholder('যেমন: বিশেষ প্রতিনিধি / বিস্তারিত')).toBeVisible();
  });
});

test.describe('Desktop Regression Check (>=768px)', () => {
  test('1280x800 preserves left rail, right panel, header URL input, and floating stage toolbar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/editor/psd-green', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main canvas')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('aside[aria-label="এডিটর টুলস"]')).toBeVisible();
    await expect(page.locator('aside[aria-label="এডিটর কন্ট্রোল প্যানেল"]')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'নিউজের লিংক' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ডিজাইন সরানোর টুল' })).toBeVisible();
    await expect(page.locator('nav[aria-label="মোবাইল এডিটর ট্যাব"]')).toBeHidden();
  });
});
