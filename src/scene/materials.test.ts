import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const roleColors = {
  ground: '#d0d4cc',
  path: '#b8bcb4',
  groupShell: '#e0ddd5',
  civicHub: '#d8d4cc',
  darkMetal: '#3a3a3a',
  glass: '#a0c0d0',
  thermalWarm: '#e87840',
  thermalCool: '#60b0c0',
  polymer: '#c890d0',
  electronics: '#7090b0',
  textile: '#c89060',
  sma: '#90b080',
  context: '#c0bdb5',
  selectionEdge: '#f0a050',
  land: '#b8c8a0',
  clearing: '#e0dcd4',
  districtAccent: '#8b9e6b',
  routeActive: '#e08040',
  routePreview: '#f0b060',
  routeMuted: '#a0a098',
  pavement: '#c0bdb5',
  sidewalk: '#d8d4cc',
  curb: '#a0a098',
  grass: '#90b870',
  road: '#8a8a82',
  landDark: '#80a060',
} as const;

const roles = Object.keys(roleColors) as Array<keyof MaterialPalette>;
const textureProperties = [
  'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap',
  'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap',
] as const;

describe('Hateno Village material palette', () => {
  it('provides every semantic role as a distinctly colored MeshToonMaterial', () => {
    const palette = createMaterialPalette();

    for (const role of roles) {
      expect(palette[role], role).toBeInstanceOf(THREE.MeshToonMaterial);
      expect(`#${palette[role].color.getHexString()}`, role).toBe(roleColors[role]);
    }

    disposeMaterialPalette(palette);
  });

  it('creates independent instances so semantic roles cannot overwrite each other', () => {
    const palette = createMaterialPalette();

    expect(new Set(Object.values(palette)).size).toBe(roles.length);

    disposeMaterialPalette(palette);
  });

  it('configures the glass role for transparent shallow-depth rendering', () => {
    const palette = createMaterialPalette();

    expect(palette.glass.transparent).toBe(true);
    expect(palette.glass.opacity).toBe(0.55);
    expect(palette.glass.depthWrite).toBe(false);

    disposeMaterialPalette(palette);
  });

  it('keeps every material texture-free', () => {
    const palette = createMaterialPalette();

    for (const material of Object.values(palette)) {
      for (const property of textureProperties) {
        const value = material[property];
        expect(value == null, property).toBe(true);
      }
    }

    disposeMaterialPalette(palette);
  });

  it('disposes each material once and never repeats disposal for the same palette', () => {
    const palette = createMaterialPalette();
    const disposeSpies = Object.values(palette).map((material) => vi.spyOn(material, 'dispose'));

    disposeMaterialPalette(palette);
    disposeMaterialPalette(palette);

    for (const dispose of disposeSpies) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('orders land, clearing, and district accents by relative luminance (land darker than clearing)', () => {
    const palette = createMaterialPalette();

    const landLum = relativeLuminance(`#${palette.land.color.getHexString()}`);
    const clearingLum = relativeLuminance(`#${palette.clearing.color.getHexString()}`);
    const districtLum = relativeLuminance(`#${palette.districtAccent.color.getHexString()}`);

    expect(landLum).toBeLessThan(clearingLum);
    expect(districtLum).toBeLessThan(clearingLum);

    disposeMaterialPalette(palette);
  });

  it('orders active route contrast above muted route contrast', () => {
    const palette = createMaterialPalette();

    const activeLum = relativeLuminance(`#${palette.routeActive.color.getHexString()}`);
    const mutedLum = relativeLuminance(`#${palette.routeMuted.color.getHexString()}`);
    const previewLum = relativeLuminance(`#${palette.routePreview.color.getHexString()}`);

    expect(activeLum).not.toBe(mutedLum);
    expect(previewLum).toBeGreaterThan(mutedLum);

    disposeMaterialPalette(palette);
  });

  it('keeps dark text accents readable against the light clearing surface', () => {
    const palette = createMaterialPalette();

    const darkLum = relativeLuminance(`#${palette.darkMetal.color.getHexString()}`);
    const clearingLum = relativeLuminance(`#${palette.clearing.color.getHexString()}`);
    const contrastRatio = (clearingLum + 0.05) / (darkLum + 0.05);

    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);

    disposeMaterialPalette(palette);
  });
});
