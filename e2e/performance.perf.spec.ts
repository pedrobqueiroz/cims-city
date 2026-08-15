import { expect, test, type Page } from '@playwright/test';

interface RafProbe {
  callbacks: number;
  requested: number;
}

interface FrameSample {
  durationMs: number;
  frames: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  effectiveFps: number;
  longFramesOver34Ms: number;
}

async function sampleFrames(page: Page, durationMs: number, exerciseCamera: boolean): Promise<FrameSample> {
  return page.evaluate(async ({ durationMs, exerciseCamera }) => {
    const sortedPercentile = (values: number[], percentile: number): number => {
      const sorted = [...values].sort((left, right) => left - right);
      const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
      return sorted[index] ?? 0;
    };
    const buttons = ['smart-textiles', 'shape-memory-alloys', 'cims-hub']
      .map((id) => document.querySelector<HTMLButtonElement>(`[data-entity-id="${id}"]`))
      .filter((button): button is HTMLButtonElement => Boolean(button));
    let selectionIndex = 0;
    const cameraInterval = exerciseCamera
      ? window.setInterval(() => {
        buttons[selectionIndex % buttons.length]?.click();
        selectionIndex += 1;
      }, 1_200)
      : undefined;
    if (exerciseCamera) buttons[0]?.click();

    const intervals: number[] = [];
    const start = performance.now();
    let previous = start;
    await new Promise<void>((resolve) => {
      const onFrame = (now: number): void => {
        intervals.push(now - previous);
        previous = now;
        if (now - start >= durationMs) {
          resolve();
          return;
        }
        window.requestAnimationFrame(onFrame);
      };
      window.requestAnimationFrame(onFrame);
    });
    if (cameraInterval !== undefined) window.clearInterval(cameraInterval);

    const measuredDuration = previous - start;
    const totalInterval = intervals.reduce((sum, interval) => sum + interval, 0);
    const average = totalInterval / intervals.length;
    return {
      durationMs: measuredDuration,
      frames: intervals.length,
      averageMs: average,
      p50Ms: sortedPercentile(intervals, 0.5),
      p95Ms: sortedPercentile(intervals, 0.95),
      maxMs: Math.max(...intervals),
      effectiveFps: 1_000 / average,
      longFramesOver34Ms: intervals.filter((interval) => interval > 34).length,
    };
  }, { durationMs, exerciseCamera });
}

test('@performance records production RAF cadence and proves the request-driven runtime idles', async ({ page }) => {
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
  await page.waitForTimeout(1_800);

  const idleStart = await page.evaluate(() => window.__rafProbe.callbacks);
  await page.waitForTimeout(1_000);
  const idleEnd = await page.evaluate(() => window.__rafProbe.callbacks);
  expect(idleEnd - idleStart).toBe(0);

  const overview = await sampleFrames(page, 10_000, false);
  const cameraTransitions = await sampleFrames(page, 10_000, true);
  const environment = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const context = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const debugInfo = context?.getExtension('WEBGL_debug_renderer_info');
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      renderer: debugInfo && context
        ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
        : 'unavailable',
      navigation: navigation ? {
        responseEndMs: navigation.responseEnd,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadEventEndMs: navigation.loadEventEnd,
        transferSizeBytes: navigation.transferSize,
        decodedBodySizeBytes: navigation.decodedBodySize,
      } : 'unavailable',
    };
  });

  expect(overview.durationMs).toBeGreaterThanOrEqual(9_900);
  expect(overview.frames).toBeGreaterThan(100);
  expect(cameraTransitions.durationMs).toBeGreaterThanOrEqual(9_900);
  expect(cameraTransitions.frames).toBeGreaterThan(100);
  expect(idleEnd - idleStart).toBe(0);
  expect(cameraTransitions.p95Ms).toBeLessThan(120);
  expect(cameraTransitions.maxMs).toBeLessThan(200);
  console.log(`[performance] ${JSON.stringify({ idleRafCallbacks: idleEnd - idleStart, overview, cameraTransitions, environment })}`);
});

declare global {
  interface Window {
    __rafProbe: RafProbe;
  }
}
