import { expect, test, type Page } from '@playwright/test';

interface RafProbe {
  callbacks: number;
  requested: number;
}

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (text.includes('VALIDATE_STATUS') || text.includes('Shader Error')) return;
      errors.push(`console: ${text}`);
    }
  });
  page.on('pageerror', (error) => { errors.push(`page: ${error.message}`); });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.bodyScroll).toBeLessThanOrEqual(dimensions.bodyClient);
  expect(dimensions.documentScroll).toBeLessThanOrEqual(dimensions.documentClient);
}

test('desktop keyboard selection synchronizes the navigator, card, label, and Escape overview', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const navigator = page.getByRole('navigation', { name: 'Organization' });
  const smartTextiles = navigator.getByRole('button', { name: 'View Smart Textiles' });
  await expect(navigator).toBeVisible();
  await smartTextiles.focus();
  await expect(smartTextiles).toBeFocused();
  const focusPresentation = await smartTextiles.evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const navRect = button.closest('nav')!.getBoundingClientRect();
    const style = getComputedStyle(button);
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const outlineOffset = Number.parseFloat(style.outlineOffset);
    const boxShadowSpread = 5;
    const focusExtent = Math.max(0, outlineWidth + outlineOffset, boxShadowSpread);
    return {
      outlineWidth,
      fullyInsideNav: buttonRect.left - focusExtent >= navRect.left
        && buttonRect.right + focusExtent <= navRect.right
        && buttonRect.top - focusExtent >= navRect.top
        && buttonRect.bottom + focusExtent <= navRect.bottom,
    };
  });
  expect(focusPresentation.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(focusPresentation.fullyInsideNav).toBe(true);
  await page.keyboard.press('Enter');

  await expect(smartTextiles).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Smart Textiles' })).toBeVisible();
  await expect(page.locator('[data-label-id="smart-textiles"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('button[data-overview]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.locator('[data-label-id="smart-textiles"]')).toHaveAttribute('data-selected', 'false');
  expect(browserErrors).toEqual([]);
});

test('mobile selection remains usable at 390 by 844 without page overflow', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const browserErrors = collectBrowserErrors(page);
  await page.goto(baseURL!);

  await page.locator('button[data-explorer-toggle]').tap();
  const shapeMemoryAlloys = page.locator('button[data-entity-id="shape-memory-alloys"]');
  await shapeMemoryAlloys.tap();

  await expect(shapeMemoryAlloys).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Shape-Memory Alloys' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(browserErrors).toEqual([]);
  await context.close();
});

test('reduced motion selection settles without continuous camera travel', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const probe: RafProbe = { callbacks: 0, requested: 0 };
    Object.defineProperty(window, '__rafProbe', { value: probe });
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      probe.requested += 1;
      return nativeRequestAnimationFrame((time) => {
        probe.callbacks += 1;
        callback(time);
      });
    };
  });
  await page.goto('/');

  const appShell = page.locator('.app-shell');
  const smartTextiles = page.getByRole('navigation', { name: 'Organization' })
    .getByRole('button', { name: 'View Smart Textiles' });
  await expect(appShell).toHaveAttribute('data-reduced-motion', 'true');
  await smartTextiles.click();
  await expect(smartTextiles).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-label-id="smart-textiles"]')).toHaveAttribute('data-selected', 'true');

  await page.waitForTimeout(150);
  const settled = await page.evaluate(() => (window as typeof window & { __rafProbe: RafProbe }).__rafProbe.callbacks);
  await page.waitForTimeout(300);
  const afterSettle = await page.evaluate(() => (window as typeof window & { __rafProbe: RafProbe }).__rafProbe.callbacks);
  expect(afterSettle).toBe(settled);
  expect(browserErrors).toEqual([]);
});

test('WebGL failure keeps the semantic navigator, cards, and alert fallback', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/');

  const navigator = page.getByRole('navigation', { name: 'Organization' });
  const hub = navigator.getByRole('button', { name: /View CiMS/ });
  await expect(navigator).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('3D view is unavailable');
  await hub.click();
  await expect(hub).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.entity-card').getByRole('heading', { name: /CiMS/ })).toBeVisible();
  expect(browserErrors.some((message) => message.includes('Error creating WebGL context'))).toBe(true);
  expect(browserErrors.every((message) => message.includes('Error creating WebGL context'))).toBe(true);
});

test('mobile WebGL fallback keeps navigation, alert, and selected card in separate regions', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await context.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await page.locator('button[data-explorer-toggle]').tap();
  await page.locator('button[data-entity-id="shape-memory-alloys"]').tap();
  const regions = await page.evaluate(() => {
    const names = ['.organization-nav', '.app-shell__fallback', '.entity-card'] as const;
    const rectangles = names.map((selector) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect());
    const intersects = (left: DOMRect, right: DOMRect): boolean => left.left < right.right
      && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
    return {
      overlap: rectangles.some((left, index) => rectangles.slice(index + 1).some((right) => intersects(left, right))),
      insideViewport: rectangles.every((rect) => rect.left >= 0 && rect.top >= 0
        && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight),
    };
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Shape-Memory Alloys' })).toBeVisible();
  expect(regions).toEqual({ overlap: false, insideViewport: true });
  await context.close();
});

test('renderer backing stores respect desktop and mobile DPR caps', async ({ browser, baseURL }) => {
  for (const profile of [
    { width: 1200, height: 800, deviceScaleFactor: 2, cap: 1.5 },
    { width: 390, height: 844, deviceScaleFactor: 3, cap: 1.25 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(baseURL!);
    const ratio = await page.locator('canvas').evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return canvas.width / rect.width;
    });
    expect(ratio).toBeLessThanOrEqual(profile.cap);
    expect(ratio).toBeGreaterThan(0);
    await context.close();
  }
});

test('real renderer exposes enabled soft shadows and the neutral scene atmosphere', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.locator('canvas')).toHaveAttribute('data-shadow-map', 'enabled');
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-background', '#dce3df');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-webgl-status', 'ready');
});

test('route legend exposes distinct coordination, adjacency, and collaboration strokes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const strokes = await page.locator('.route-legend p').evaluateAll((entries) => entries.map((entry) => {
    const style = getComputedStyle(entry, '::before');
    return {
      text: entry.textContent,
      borderStyle: style.borderTopStyle,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
    };
  }));
  expect(strokes.length).toBeGreaterThanOrEqual(3);
  for (const stroke of strokes) {
    expect(stroke.text.length).toBeGreaterThan(0);
    expect(stroke.borderStyle).toBeTruthy();
  }
});

test('mounted projected labels switch visible aliases across aspect changes without losing accessibility or selection', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');

  const cimsHub = page.locator('[data-label-id="cims-hub"]');
  await expect(cimsHub).toBeVisible();
  const fullText = await cimsHub.textContent();
  await expect(cimsHub).toHaveAttribute('aria-label', `View ${fullText}`);
  await cimsHub.evaluate((button) => { button.dataset.mountedBeforeResize = 'true'; });
  await cimsHub.click();
  await expect(cimsHub).toHaveAttribute('data-selected', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cimsHub).toHaveAttribute('data-mounted-before-resize', 'true');
  await expect(cimsHub).toHaveAttribute('data-selected', 'true');

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(cimsHub).toHaveAttribute('data-mounted-before-resize', 'true');
  await expect(cimsHub).toHaveAttribute('data-selected', 'true');
});

test('portrait overview exposes district navigator', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('button[data-explorer-toggle]').click();

  await expect(page.getByRole('navigation', { name: 'Organization' })).toBeVisible();
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  test(`initial ${viewport.name} overview shows district labels and navigator`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Organization' })).toBeVisible();
    await expect(page.locator('[data-label-id="cims-hub"]')).toBeVisible();
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test(`captures the semantic ${viewport.name} overview`, async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    if (viewport.width <= 768) {
      await page.locator('button[data-explorer-toggle]').click();
    }
    await expect(page.getByRole('navigation', { name: 'Organization' })).toBeVisible();
    await expect(page.locator('.entity-card').getByRole('heading', { name: 'Overview' })).toBeVisible();
    if (viewport.width > 768) {
      await expect(page.locator('[data-label-id="cims-hub"]')).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/visual/${viewport.name}/overview.png`, fullPage: true });
    expect(browserErrors).toEqual([]);
  });
}

test('captures a grayscale desktop overview for contrast review', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.locator('.neighborhood').evaluate((element) => { element.style.filter = 'grayscale(1)'; });
  await expect(page.locator('[data-label-id="cims-hub"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual/grayscale-desktop/overview.png', fullPage: true });
  expect(browserErrors).toEqual([]);
});

test('SEi overview shows exactly the five district labels and hides research labels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const districtIds = ['cims-hub', 'hycatt', 'new-zema', 'uds', 'htw-saar'];
  const researchIds = ['elastocalorics', 'electroactive-polymers', 'smart-material-electronics', 'smart-textiles', 'shape-memory-alloys'];

  for (const id of districtIds) {
    await expect(page.locator(`[data-label-id="${id}"]`)).toBeVisible();
  }
  for (const id of researchIds) {
    await expect(page.locator(`[data-label-id="${id}"]`)).toBeHidden();
  }
});

test('entering CiMS reveals hub and five research labels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const navigator = page.getByRole('navigation', { name: 'Organization' });
  const cimsHub = navigator.getByRole('button', { name: /View CiMS/ });
  await cimsHub.click();
  await expect(cimsHub).toHaveAttribute('aria-current', 'true');

  await expect(page.locator('[data-label-id="cims-hub"]')).toBeVisible();
});

test('direct deep link restores scope and selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?scope=cims&entity=smart-textiles');

  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Smart Textiles' })).toBeVisible();
  await expect(page.locator('[data-label-id="smart-textiles"]')).toHaveAttribute('data-selected', 'true');
});

test('Back and Overview controls preserve semantic navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const navigator = page.getByRole('navigation', { name: 'Organization' });
  await navigator.getByRole('button', { name: 'View Smart Textiles' }).click();
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Smart Textiles' })).toBeVisible();

  await page.locator('button[data-back]').click();
  await expect(page.locator('button[data-overview]')).toHaveAttribute('aria-current', 'true');

  await navigator.getByRole('button', { name: 'View Elastocalorics' }).click();
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Elastocalorics' })).toBeVisible();

  await page.locator('button[data-overview]').click();
  await expect(page.locator('button[data-overview]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.entity-card').getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('every interactive control has an accessible name and minimum touch target', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const buttons = await page.locator('button').all();
  for (const button of buttons) {
    const name = await button.getAttribute('aria-label') ?? await button.textContent();
    expect(name?.trim().length).toBeGreaterThan(0);
    const box = await button.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('no horizontal page overflow at all viewport sizes', async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 812, height: 375 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    await context.close();
  }
});

declare global {
  interface Window {
    __rafProbe: RafProbe;
  }
}
