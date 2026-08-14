import { describe, expect, it } from 'vitest';
import { selectGraphicsQuality, selectMotionPolicy, selectQuality } from './quality';

describe('selectMotionPolicy', () => {
  it('returns reduced for reduced-motion preference', () => {
    expect(selectMotionPolicy(true)).toBe('reduced');
  });

  it('returns full when reduced-motion is not preferred', () => {
    expect(selectMotionPolicy(false)).toBe('full');
  });
});

describe('selectGraphicsQuality', () => {
  it('returns the desktop tier for wide viewports with fine pointers', () => {
    expect(selectGraphicsQuality({ width: 1280, dpr: 2, coarsePointer: false })).toEqual({
      tier: 'desktop', maxDpr: 1.5, shadowSize: 2048,
      contextDensity: 1, selectionEdges: true,
    });
  });

  it('returns the mobile tier for narrow viewports', () => {
    expect(selectGraphicsQuality({ width: 699, dpr: 2, coarsePointer: false })).toEqual({
      tier: 'mobile', maxDpr: 1.25, shadowSize: 1024,
      contextDensity: 0.55, selectionEdges: false,
    });
  });

  it('returns the mobile tier for coarse pointers regardless of width', () => {
    expect(selectGraphicsQuality({ width: 1280, dpr: 2, coarsePointer: true })).toEqual({
      tier: 'mobile', maxDpr: 1.25, shadowSize: 1024,
      contextDensity: 0.55, selectionEdges: false,
    });
  });

  it('does not reduce semantic detail for reduced motion alone', () => {
    const desktop = selectGraphicsQuality({ width: 1200, dpr: 2, coarsePointer: false });
    expect(desktop.tier).toBe('desktop');
    expect(desktop.contextDensity).toBe(1);
  });

  it.each([
    { width: 1280, expected: 1.5 },
    { width: 699, expected: 1.25 },
  ])('returns the tier cap $expected when device DPR is 1 at width $width', ({ width, expected }) => {
    expect(selectGraphicsQuality({
      width,
      dpr: 1,
      coarsePointer: false,
    }).maxDpr).toBe(expected);
  });
});

describe('selectQuality (compat)', () => {
  it.each([
    {
      name: 'desktop',
      input: { width: 1280, dpr: 2, reducedMotion: false, coarsePointer: false },
      expected: {
        tier: 'desktop', maxDpr: 1.5, shadowSize: 2048,
        contextDensity: 1, selectionEdges: true,
      },
    },
    {
      name: 'narrow mobile',
      input: { width: 699, dpr: 2, reducedMotion: false, coarsePointer: false },
      expected: {
        tier: 'mobile', maxDpr: 1.25, shadowSize: 1024,
        contextDensity: 0.55, selectionEdges: false,
      },
    },
    {
      name: 'coarse-pointer mobile',
      input: { width: 1280, dpr: 2, reducedMotion: false, coarsePointer: true },
      expected: {
        tier: 'mobile', maxDpr: 1.25, shadowSize: 1024,
        contextDensity: 0.55, selectionEdges: false,
      },
    },
  ])('returns the $name tier policy', ({ input, expected }) => {
    expect(selectQuality(input)).toEqual(expected);
  });

  it('uses graphics tier for quality even when reduced motion is active', () => {
    const result = selectQuality({ width: 1200, dpr: 2, reducedMotion: true, coarsePointer: false });
    expect(result.tier).toBe('desktop');
    expect(result.contextDensity).toBe(1);
  });
});
