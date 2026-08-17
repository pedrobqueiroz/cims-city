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
  ground: '#d7ddd8',
  path: '#b7bcb8',
  groupShell: '#e5dfd4',
  civicHub: '#d8c9b4',
  darkMetal: '#28343b',
  glass: '#6f8994',
  thermalWarm: '#d9754f',
  thermalCool: '#4d91a7',
  polymer: '#8a719b',
  electronics: '#4f718e',
  textile: '#a47b5d',
  sma: '#71886d',
  context: '#aeb7b4',
  selectionEdge: '#f4c45e',
  land: '#c8d7b0',
  clearing: '#eae8df',
  districtAccent: '#8b9e6b',
  routeActive: '#d4793b',
  routePreview: '#e8a665',
  routeMuted: '#9e9a90',
  pavement: '#c2c5be',
  sidewalk: '#e0ddd5',
  curb: '#8a8d86',
  grass: '#a8c490',
  road: '#7a7d76',
  landDark: '#98b878',
} as const;

const roles = Object.keys(roleColors) as Array<keyof MaterialPalette>;
const textureProperties = [
  'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap',
  'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap',
] as const;

describe('shared PBR material palette', () => {
  it('provides every semantic role as a distinctly colored MeshStandardMaterial', () => {
    const palette = createMaterialPalette();

    for (const role of roles) {
      expect(palette[role], role).toBeInstanceOf(THREE.MeshStandardMaterial);
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
    expect(palette.glass.opacity).toBe(0.42);
    expect(palette.glass.roughness).toBe(0.18);
    expect(palette.glass.metalness).toBe(0);
    expect(palette.glass.depthWrite).toBe(false);

    disposeMaterialPalette(palette);
  });

  it('uses matte architectural shells and the authored dark-metal properties', () => {
    const palette = createMaterialPalette();

    expect(palette.groupShell.roughness).toBeGreaterThanOrEqual(0.65);
    expect(palette.civicHub.roughness).toBeGreaterThanOrEqual(0.65);
    expect(palette.context.roughness).toBeGreaterThanOrEqual(0.65);
    expect(palette.darkMetal.roughness).toBe(0.34);
    expect(palette.darkMetal.metalness).toBe(0.72);

    disposeMaterialPalette(palette);
  });

  it('keeps every material texture-free', () => {
    const palette = createMaterialPalette();

    for (const material of Object.values(palette)) {
      for (const property of textureProperties) expect(material[property], property).toBeNull();
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
